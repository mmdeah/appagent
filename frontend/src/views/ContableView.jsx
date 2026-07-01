import React, { useState, useEffect, useContext } from 'react';
import { API_URL } from '../api';
import { ThemeContext } from '../App';
import OrderDetailsModal from './OrderDetailsModal';
import { CreditCard, Building2, Banknote, ChevronRight } from 'lucide-react';
import BillingCycleTab from './BillingCycleTab';

const IS_FLOTA = (c) => /(ald|ayvens)/i.test(c || '');
const IS_CN    = (c) => /consult.?networks/i.test(c || '');

const fmt = (n) => (parseFloat(n) || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 });

const BANK_METHODS = ['Bancolombia', 'Tarjeta', 'Banco de Bogota'];

const calcOrderTotal = (o) => {
  if (!o.quotes || o.quotes.length === 0) return 0;
  const q = o.quotes[0];
  if (!q.items || q.items.length === 0) return 0;
  return q.items.reduce((sum, item) => {
    const base = (parseFloat(item.precio) || 0) * (parseFloat(item.cantidad) || 1);
    const iva  = item.aplicaIva ? base * 0.19 : 0;
    return sum + base + iva;
  }, 0);
};

export default function ContableView() {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [orders, setOrders] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [aldBillings, setAldBillings] = useState([]);
  const [cnBillings, setCnBillings] = useState([]);
  const [activeTab, setActiveTab] = useState('ALD');
  const [selectedOrder, setSelectedOrder] = useState(null);

  const fetchAll = () => {
    fetch(`${API_URL}/orders?_embed=quotes`)
      .then(r => r.json()).then(d => setOrders(Array.isArray(d) ? d : [])).catch(() => {});
    fetch(`${API_URL}/expenses`)
      .then(r => r.json()).then(d => setExpenses(Array.isArray(d) ? d : [])).catch(() => {});
    fetch(`${API_URL}/ald_billings`)
      .then(r => r.json()).then(d => setAldBillings(Array.isArray(d) ? d : [])).catch(() => {});
    fetch(`${API_URL}/cn_billings`)
      .then(r => r.json()).then(d => setCnBillings(Array.isArray(d) ? d : [])).catch(() => {});
  };

  useEffect(() => { fetchAll(); }, []);

  const [pagosFiltro, setPagosFiltro] = useState('Todos');

  // Compute balance per bank method: ingresos (delivered orders) - egresos (expenses)
  const bankBalances = BANK_METHODS.map(method => {
    const ingresos = orders
      .filter(o => o.estado === 'Entregado' && o.metodoPago === method)
      .reduce((sum, o) => sum + calcOrderTotal(o), 0);
    const egresos = expenses
      .filter(g => g.metodoPago === method)
      .reduce((sum, g) => sum + (parseFloat(g.monto) || 0), 0);
    return { method, ingresos, egresos, balance: ingresos - egresos };
  });

  const allBankOrders = orders
    .filter(o => o.estado === 'Entregado' && BANK_METHODS.includes(o.metodoPago))
    .filter(o => pagosFiltro === 'Todos' || o.metodoPago === pagosFiltro)
    .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));

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
            { id: 'Pagos', icon: <Banknote size={16} />, label: 'Pagos Bancarios' },
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: activeTab === t.id ? 'var(--primary)' : 'transparent', color: activeTab === t.id ? 'white' : 'var(--text-muted)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600, fontSize: '1rem', transition: 'all 0.2s' }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {activeTab === 'ALD' && (
          <BillingCycleTab
            orders={orders}
            clientFilter={IS_FLOTA}
            billings={aldBillings}
            collection="ald_billings"
            onRefreshBillings={() => fetch(`${API_URL}/ald_billings`).then(r => r.json()).then(d => setAldBillings(Array.isArray(d) ? d : []))}
            onRefreshOrders={fetchAll}
            title="Flotas (ALD / Ayvens)"
            emptyMsg="No hay vehículos de flota entregados aún."
            onOrderClick={setSelectedOrder}
          />
        )}
        {activeTab === 'ConsultNetworks' && (
          <BillingCycleTab
            orders={orders}
            clientFilter={IS_CN}
            billings={cnBillings}
            collection="cn_billings"
            onRefreshBillings={() => fetch(`${API_URL}/cn_billings`).then(r => r.json()).then(d => setCnBillings(Array.isArray(d) ? d : []))}
            onRefreshOrders={fetchAll}
            title="Consult Networks"
            emptyMsg="No hay vehículos de Consult Networks entregados aún."
            noCutDate
            onOrderClick={setSelectedOrder}
          />
        )}

        {activeTab === 'Pagos' && (
          <div>
            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem', marginBottom: '1.75rem' }}>
              {bankBalances.map(({ method, ingresos, egresos, balance }) => (
                <div
                  key={method}
                  className="card"
                  onClick={() => setPagosFiltro(pagosFiltro === method ? 'Todos' : method)}
                  style={{
                    padding: '1.25rem 1.5rem',
                    cursor: 'pointer',
                    borderLeft: `4px solid ${balance >= 0 ? 'var(--success)' : 'var(--error)'}`,
                    outline: pagosFiltro === method ? '2px solid var(--primary)' : 'none',
                    transition: 'all 0.15s'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>{method}</span>
                    {pagosFiltro === method && <span style={{ fontSize: '0.72rem', background: 'var(--primary)', color: '#fff', borderRadius: 99, padding: '0.1rem 0.5rem', fontWeight: 700 }}>activo</span>}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem 1.5rem' }}>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>Ingresos</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--success)' }}>${fmt(ingresos)}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>Egresos</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--error)' }}>${fmt(egresos)}</div>
                    </div>
                    <div style={{ gridColumn: '1 / -1', borderTop: '1px solid var(--border)', paddingTop: '0.6rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-muted)' }}>Balance neto</span>
                      <span style={{ fontSize: '1.15rem', fontWeight: 900, color: balance >= 0 ? 'var(--success)' : 'var(--error)' }}>${fmt(balance)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Unified orders table */}
            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontWeight: 700, fontSize: '1rem', margin: 0 }}>
                  Pagos recibidos
                  {pagosFiltro !== 'Todos' && <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', background: 'rgba(99,102,241,0.12)', color: 'var(--primary)', borderRadius: 99, padding: '0.15rem 0.6rem', fontWeight: 700 }}>{pagosFiltro}</span>}
                </h3>
                <div style={{ display: 'flex', gap: '0.4rem' }}>
                  {['Todos', ...BANK_METHODS].map(m => (
                    <button key={m} onClick={() => setPagosFiltro(m)}
                      style={{ padding: '0.3rem 0.75rem', border: '1px solid var(--border)', borderRadius: 99, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600, background: pagosFiltro === m ? 'var(--primary)' : 'var(--card-bg)', color: pagosFiltro === m ? '#fff' : 'var(--text-muted)', transition: 'all 0.15s' }}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              {allBankOrders.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>Sin pagos registrados para este filtro.</p>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Placa</th>
                      <th>Cliente</th>
                      <th>Vehículo</th>
                      <th>Servicio</th>
                      <th>Método</th>
                      <th style={{ textAlign: 'right' }}>Total</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {allBankOrders.map(o => (
                      <tr key={o.id} onClick={() => setSelectedOrder(o)} style={{ cursor: 'pointer' }}>
                        <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                          {o.fecha ? new Date(o.fecha).toLocaleDateString('es-CO') : '—'}
                        </td>
                        <td><span style={{ fontWeight: 800, fontSize: '0.95rem' }}>{o.placa}</span></td>
                        <td style={{ maxWidth: 160 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{o.cliente}</div>
                          {o.telefono && <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{o.telefono}</div>}
                        </td>
                        <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          {[o.marca, o.modelo, o.anio].filter(Boolean).join(' ')}
                        </td>
                        <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: 160 }}>
                          {o.servicios || o.motivoIngreso || '—'}
                        </td>
                        <td>
                          <span style={{ fontSize: '0.78rem', fontWeight: 700, background: 'rgba(99,102,241,0.1)', color: 'var(--primary)', padding: '0.2rem 0.55rem', borderRadius: 99 }}>
                            {o.metodoPago}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 800, fontSize: '0.95rem', color: 'var(--success)', whiteSpace: 'nowrap' }}>
                          ${fmt(calcOrderTotal(o))}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <ChevronRight size={15} color="var(--text-muted)" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
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
