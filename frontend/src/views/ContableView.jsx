import React, { useState, useEffect, useContext } from 'react';
import { API_URL } from '../api';
import { ThemeContext } from '../App';
import OrderDetailsModal from './OrderDetailsModal';
import { CreditCard, Building2, Banknote } from 'lucide-react';
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

  // Compute balance per bank method: ingresos (delivered orders) - egresos (expenses)
  const bankBalances = BANK_METHODS.map(method => {
    const ingresos = orders
      .filter(o => o.estado === 'Entregado' && o.metodoPago === method)
      .reduce((sum, o) => sum + calcOrderTotal(o), 0);
    const egresos = expenses
      .filter(g => g.metodoPago === method)
      .reduce((sum, g) => sum + (parseFloat(g.monto) || 0), 0);
    const recentOrders = orders
      .filter(o => o.estado === 'Entregado' && o.metodoPago === method)
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
      .slice(0, 10);
    return { method, ingresos, egresos, balance: ingresos - egresos, recentOrders };
  });

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
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Ingresos y egresos registrados por método de pago bancario.
            </p>

            {/* Summary cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              {bankBalances.map(({ method, ingresos, egresos, balance }) => (
                <div key={method} className="card" style={{ padding: '1.25rem', borderLeft: `4px solid ${balance >= 0 ? 'var(--success)' : 'var(--error)'}` }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem', letterSpacing: '0.05em' }}>{method}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Ingresos</span>
                      <span style={{ fontWeight: 700, color: 'var(--success)' }}>${fmt(ingresos)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.88rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Egresos</span>
                      <span style={{ fontWeight: 700, color: 'var(--error)' }}>${fmt(egresos)}</span>
                    </div>
                    <div style={{ borderTop: '1px solid var(--border)', marginTop: '0.4rem', paddingTop: '0.4rem', display: 'flex', justifyContent: 'space-between', fontSize: '1rem' }}>
                      <span style={{ fontWeight: 700 }}>Balance</span>
                      <span style={{ fontWeight: 800, color: balance >= 0 ? 'var(--success)' : 'var(--error)' }}>${fmt(balance)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Recent orders per method */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
              {bankBalances.map(({ method, recentOrders }) => (
                <div key={method} className="card" style={{ padding: '1.25rem' }}>
                  <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1rem' }}>Últimos pagos — {method}</h3>
                  {recentOrders.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Sin registros.</p>
                  ) : (
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Fecha</th>
                          <th>Placa</th>
                          <th>Cliente</th>
                          <th style={{ textAlign: 'right' }}>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentOrders.map(o => (
                          <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedOrder(o)}>
                            <td style={{ fontSize: '0.82rem' }}>{o.fecha ? new Date(o.fecha).toLocaleDateString('es-CO') : '—'}</td>
                            <td style={{ fontWeight: 700 }}>{o.placa}</td>
                            <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{o.cliente}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--success)' }}>${fmt(calcOrderTotal(o))}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}
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
