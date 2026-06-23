import React, { useState, useEffect, useContext } from 'react';
import { API_URL } from '../api';
import { ThemeContext } from '../App';
import OrderDetailsModal from './OrderDetailsModal';
import { CreditCard, Clock, BadgeCheck, Ban, Building2 } from 'lucide-react';

const fmt = (n) => (parseFloat(n) || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 });
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const IS_FLOTA = (c) => /(ald|ayvens)/i.test(c || '');
const IS_CN    = (c) => /consult.?networks/i.test(c || '');

export default function ContableView() {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [orders, setOrders] = useState([]);
  const [aldBillings, setAldBillings] = useState([]);
  const [cnBillings, setCnBillings] = useState([]);
  const [activeTab, setActiveTab] = useState('ALD');
  const [selectedOrder, setSelectedOrder] = useState(null);

  const fetchAll = () => {
    fetch(`${API_URL}/orders?_embed=quotes`)
      .then(r => r.json()).then(d => setOrders(Array.isArray(d) ? d : [])).catch(() => {});
    fetch(`${API_URL}/ald_billings`)
      .then(r => r.json()).then(d => setAldBillings(Array.isArray(d) ? d : [])).catch(() => {});
    fetch(`${API_URL}/cn_billings`)
      .then(r => r.json()).then(d => setCnBillings(Array.isArray(d) ? d : [])).catch(() => {});
  };

  useEffect(() => { fetchAll(); }, []);

  const calcOrderTotal = (o) => {
    const q = o.quotes?.find(q => q.autorizada) || o.quotes?.[0];
    if (!q) return 0;
    return (q.items || []).reduce((sum, i) => {
      const lt = (Number(i.precio) || 0) * (Number(i.cantidad) || 1);
      return sum + lt + (i.aplicaIva ? lt * 0.19 : 0);
    }, 0);
  };

  const makeBillingHandlers = (collection, billings, refetch) => ({
    markFacturada: async (cycleId, year, month) => {
      const fechaEnvio = new Date().toISOString();
      const venc = new Date(); venc.setDate(venc.getDate() + 35);
      const fechaVencimiento = venc.toISOString();
      const existing = billings.find(b => b.id === cycleId);
      if (existing) {
        await fetch(`${API_URL}/${collection}/${cycleId}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fechaEnvio, fechaVencimiento })
        });
      } else {
        await fetch(`${API_URL}/${collection}`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: cycleId, year, month, fechaEnvio, fechaVencimiento, pagado: false, fechaPago: null })
        });
      }
      refetch();
    },
    markPagada: async (cycleId) => {
      await fetch(`${API_URL}/${collection}/${cycleId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pagado: true, fechaPago: new Date().toISOString() })
      });
      refetch();
    }
  });

  const aldHandlers = makeBillingHandlers('ald_billings', aldBillings,
    () => fetch(`${API_URL}/ald_billings`).then(r => r.json()).then(d => setAldBillings(Array.isArray(d) ? d : [])));
  const cnHandlers  = makeBillingHandlers('cn_billings', cnBillings,
    () => fetch(`${API_URL}/cn_billings`).then(r => r.json()).then(d => setCnBillings(Array.isArray(d) ? d : [])));

  const getStatus = (billing) => {
    if (!billing || !billing.fechaEnvio) return { label: 'Pendiente de facturar', color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.05)', icon: <Clock size={14}/> };
    if (billing.pagado) return { label: `Pagado · ${new Date(billing.fechaPago).toLocaleDateString('es-CO')}`, color: '#10b981', bg: 'rgba(16,185,129,0.1)', icon: <BadgeCheck size={14}/> };
    const venc = new Date(billing.fechaVencimiento);
    if (venc < new Date()) return { label: `VENCIDO · vencía ${venc.toLocaleDateString('es-CO')}`, color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: <Ban size={14}/> };
    const dias = Math.ceil((venc - new Date()) / 86400000);
    return { label: `Esperando pago · vence ${venc.toLocaleDateString('es-CO')} (${dias}d)`, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: <Clock size={14}/> };
  };

  const renderBillingTab = (clientFilter, billings, handlers, title, emptyMsg) => {
    const clientOrders = orders.filter(o => clientFilter(o.cliente) && o.estado === 'Entregado');
    const grouped = {};
    clientOrders.forEach(o => {
      if (!o.fecha) return;
      const d = new Date(o.fecha);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      if (!grouped[key]) grouped[key] = { year: d.getFullYear(), month: d.getMonth()+1, ordersList: [] };
      grouped[key].ordersList.push(o);
    });
    const cycles = Object.entries(grouped)
      .map(([key, data]) => ({ ...data, id: key, billing: billings.find(b => b.id === key) || null }))
      .sort((a, b) => b.id.localeCompare(a.id));

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>{title}</h2>
            <p style={{ color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>Ciclos mensuales · corte día 19 · pago a 35 días</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            {[
              { label: 'Ciclos', val: cycles.length, color: 'var(--primary)' },
              { label: 'Pendientes', val: cycles.filter(c => !c.billing?.fechaEnvio).length, color: '#f59e0b' },
              { label: 'Vencidos', val: billings.filter(b => !b.pagado && b.fechaVencimiento && new Date(b.fechaVencimiento) < new Date()).length, color: '#ef4444' },
              { label: 'Pagados', val: billings.filter(b => b.pagado).length, color: '#10b981' },
            ].map(s => (
              <div key={s.label} className="card" style={{ padding: '0.6rem 1rem', textAlign: 'center', minWidth: 60 }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 900, color: s.color }}>{s.val}</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {cycles.length === 0 && (
          <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', borderStyle: 'dashed' }}>{emptyMsg}</div>
        )}

        {cycles.map(cycle => {
          const st = getStatus(cycle.billing);
          const total = cycle.ordersList.reduce((s, o) => s + calcOrderTotal(o), 0);
          return (
            <div key={cycle.id} className="card" style={{ padding: '1.5rem', borderLeft: `4px solid ${st.color}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>{MESES[cycle.month-1]} {cycle.year}</h3>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem', padding: '0.3rem 0.75rem', background: st.bg, borderRadius: 20, fontSize: '0.85rem', fontWeight: 700, color: st.color }}>
                    {st.icon} {st.label}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 900 }}>${fmt(total)}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{cycle.ordersList.length} vehículo{cycle.ordersList.length !== 1 ? 's' : ''}</div>
                </div>
              </div>

              <table className="data-table" style={{ marginBottom: '1rem' }}>
                <thead><tr><th>Placa</th><th>Cliente</th><th>Vehículo</th><th>Fecha</th><th>Total</th></tr></thead>
                <tbody>
                  {cycle.ordersList.map(o => (
                    <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedOrder(o)}>
                      <td style={{ fontWeight: 700 }}>{o.placa}</td>
                      <td style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>{o.cliente}</td>
                      <td>{o.marca} {o.modelo}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{o.fecha ? new Date(o.fecha).toLocaleDateString('es-CO') : '—'}</td>
                      <td style={{ fontWeight: 700 }}>${fmt(calcOrderTotal(o))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {!cycle.billing?.fechaEnvio && (
                  <button className="btn-primary" style={{ fontSize: '0.9rem' }}
                    onClick={() => { if(window.confirm(`¿Marcar factura de ${MESES[cycle.month-1]} ${cycle.year} como enviada hoy?`)) handlers.markFacturada(cycle.id, cycle.year, cycle.month); }}>
                    Marcar factura enviada
                  </button>
                )}
                {cycle.billing?.fechaEnvio && !cycle.billing?.pagado && (
                  <button className="btn-secondary" style={{ fontSize: '0.9rem', color: '#10b981', borderColor: '#10b981' }}
                    onClick={() => { if(window.confirm(`¿Confirmar pago recibido de ${MESES[cycle.month-1]} ${cycle.year}?`)) handlers.markPagada(cycle.id); }}>
                    <BadgeCheck size={15} /> Marcar pagado
                  </button>
                )}
                {cycle.billing?.fechaEnvio && (
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Factura enviada: {new Date(cycle.billing.fechaEnvio).toLocaleDateString('es-CO')}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      <div style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Building2 size={18} color="var(--primary)" />
          </div>
          <div>
            <h1 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, lineHeight: 1 }}>Panel Contable</h1>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Facturación de flotas y clientes corporativos</p>
          </div>
        </div>
        <button onClick={toggleTheme} className="theme-toggle" title="Cambiar tema" />
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
          {[
            { id: 'ALD', icon: <CreditCard size={16} />, label: 'ALD / Ayvens' },
            { id: 'ConsultNetworks', icon: <CreditCard size={16} />, label: 'Consult Networks' },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: activeTab === t.id ? 'var(--primary)' : 'transparent', color: activeTab === t.id ? 'white' : 'var(--text-muted)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600, fontSize: '1rem', transition: 'all 0.2s' }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'ALD' && renderBillingTab(IS_FLOTA, aldBillings, aldHandlers, 'Flotas (ALD / Ayvens)', 'No hay vehículos de flota entregados aún.')}
        {activeTab === 'ConsultNetworks' && renderBillingTab(IS_CN, cnBillings, cnHandlers, 'Consult Networks', 'No hay vehículos de Consult Networks entregados aún.')}
      </div>

      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onUpdate={() => { fetchAll(); setSelectedOrder(null); }}
        />
      )}
    </div>
  );
}
