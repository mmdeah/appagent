import React, { useState, useEffect, useContext } from 'react';
import { API_URL } from '../api';
import { ThemeContext } from '../App';
import OrderDetailsModal from './OrderDetailsModal';
import { CreditCard, Building2 } from 'lucide-react';
import BillingCycleTab from './BillingCycleTab';

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
            onOrderClick={setSelectedOrder}
          />
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
