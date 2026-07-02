import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';
import { ThemeContext } from '../App';
import OrderDetailsModal from './OrderDetailsModal';
import { LogOut, Car, Clock, CheckCircle, Search, X, ChevronRight, AlertTriangle } from 'lucide-react';

const IS_ALD = (c) => /(ald|ayvens)/i.test(c || '');
const IS_CN  = (c) => /consult.?networks/i.test(c || '');

const fmt = (n) => (parseFloat(n) || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 });

const ESTADO_COLOR = {
  'Recepción':    { bg: 'rgba(99,102,241,0.12)',  color: '#818cf8' },
  'Proceso':      { bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b' },
  'Calidad':      { bg: 'rgba(16,185,129,0.12)',  color: '#10b981' },
  'Docs Rápidos': { bg: 'rgba(139,92,246,0.12)',  color: '#a78bfa' },
  'Entregado':    { bg: 'rgba(16,185,129,0.12)',  color: '#10b981' },
};

const calcTotal = (o) => {
  if (!o.quotes?.length) return 0;
  const q = o.quotes[0];
  return (q.items || []).reduce((s, it) => {
    const base = (parseFloat(it.precio) || 0) * (parseFloat(it.cantidad) || 1);
    return s + base + (it.aplicaIva ? base * 0.19 : 0);
  }, 0);
};

export default function FleetView() {
  const { toggleTheme } = useContext(ThemeContext);
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [activeTab, setActiveTab] = useState('activos');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('fleetUser');
    if (!stored) { navigate('/flota-login'); return; }
    const u = JSON.parse(stored);
    setUser(u);

    fetch(`${API_URL}/orders?_embed=quotes&_embed=reports`)
      .then(r => r.json())
      .then(data => {
        const all = Array.isArray(data) ? data : [];
        const filtered = all.filter(o => {
          if (u.empresa === 'ald') return IS_ALD(o.cliente);
          if (u.empresa === 'cn')  return IS_CN(o.cliente);
          return IS_ALD(o.cliente) || IS_CN(o.cliente);
        });
        setOrders(filtered);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('fleetUser');
    navigate('/flota-login');
  };

  if (!user) return null;

  const companyLabel = user.empresa === 'ald' ? 'ALD / Ayvens' : user.empresa === 'cn' ? 'Consult Networks' : 'Flotas';
  const companyColor = user.empresa === 'ald' ? '#f59e0b' : '#818cf8';
  const companyBg   = user.empresa === 'ald' ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.15)';

  const activos    = orders.filter(o => o.estado !== 'Entregado');
  const entregados = orders.filter(o => o.estado === 'Entregado');

  const q = search.trim().toLowerCase();
  const applySearch = (list) => !q ? list : list.filter(o =>
    (o.placa || '').toLowerCase().includes(q) ||
    (o.marca || '').toLowerCase().includes(q) ||
    (o.modelo || '').toLowerCase().includes(q) ||
    (o.cliente || '').toLowerCase().includes(q)
  );

  const displayList = applySearch(activeTab === 'activos' ? activos : entregados);

  // KPIs
  const totalFacturado = entregados.reduce((s, o) => s + calcTotal(o), 0);
  const vehiculosMes = entregados.filter(o => {
    if (!o.fechaEntrega) return false;
    const d = new Date(o.fechaEntrega);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)' }}>
      {/* Header */}
      <div style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--border)', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: companyBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Car size={18} color={companyColor} />
          </div>
          <div>
            <h1 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, lineHeight: 1 }}>Portal {companyLabel}</h1>
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>{user.nombre}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button onClick={toggleTheme} className="theme-toggle" title="Cambiar tema" />
          <button onClick={handleLogout}
            style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.85rem', fontWeight: 600 }}>
            <LogOut size={14} /> Salir
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem' }}>
        {/* KPI cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
          {[
            { label: 'En taller ahora', value: activos.length, color: '#f59e0b', icon: <Clock size={18} color="#f59e0b" /> },
            { label: 'Entregados (total)', value: entregados.length, color: '#10b981', icon: <CheckCircle size={18} color="#10b981" /> },
            { label: 'Entregados este mes', value: vehiculosMes, color: 'var(--primary)', icon: <Car size={18} color="var(--primary)" /> },
            { label: 'Total facturado', value: `$${fmt(totalFacturado)}`, color: '#10b981', icon: <CheckCircle size={18} color="#10b981" /> },
          ].map(k => (
            <div key={k.label} className="card" style={{ padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
              <div style={{ width: 38, height: 38, borderRadius: 9, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{k.icon}</div>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>{k.label}</div>
                <div style={{ fontSize: '1.3rem', fontWeight: 900, color: k.color }}>{k.value}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs + search */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.4rem', background: 'var(--card-bg)', padding: '0.3rem', borderRadius: 10, border: '1px solid var(--border)' }}>
            {[
              { id: 'activos', label: `En taller (${activos.length})` },
              { id: 'historial', label: `Historial (${entregados.length})` },
            ].map(t => (
              <button key={t.id} onClick={() => { setActiveTab(t.id); setSearch(''); }}
                style={{ padding: '0.45rem 1rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', background: activeTab === t.id ? 'var(--primary)' : 'transparent', color: activeTab === t.id ? 'white' : 'var(--text-muted)', transition: '0.2s' }}>
                {t.label}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', minWidth: 220 }}>
            <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
            <input type="text" placeholder="Buscar placa, modelo..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ paddingLeft: '2rem', paddingRight: search ? '2rem' : undefined, width: '100%', boxSizing: 'border-box' }} />
            {search && (
              <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}>
                <X size={14} />
              </button>
            )}
          </div>
        </div>

        {/* Vehicle list */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Cargando vehículos...</div>
        ) : displayList.length === 0 ? (
          <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            {search ? 'Sin resultados para esta búsqueda.' : activeTab === 'activos' ? 'No hay vehículos en taller actualmente.' : 'No hay vehículos entregados aún.'}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {displayList.map(o => {
              const estado = ESTADO_COLOR[o.estado] || { bg: 'var(--bg)', color: 'var(--text-muted)' };
              const total = calcTotal(o);
              const diasTaller = o.fecha ? Math.floor((Date.now() - new Date(o.fecha)) / 86400000) : null;
              return (
                <div key={o.id} className="card card-hover" onClick={() => setSelectedOrder(o)}
                  style={{ padding: '1.1rem 1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                  {/* Placa */}
                  <div style={{ minWidth: 90 }}>
                    <div style={{ fontWeight: 900, fontSize: '1.05rem', letterSpacing: 1 }}>{o.placa}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{o.marca} {o.modelo} {o.anio || ''}</div>
                  </div>

                  {/* Cliente */}
                  <div style={{ flex: 1, minWidth: 140 }}>
                    <div style={{ fontSize: '0.88rem', fontWeight: 600 }}>{o.cliente}</div>
                    {o.servicios && <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>{o.servicios.slice(0, 60)}{o.servicios.length > 60 ? '…' : ''}</div>}
                  </div>

                  {/* Dates */}
                  <div style={{ display: 'flex', gap: '1.5rem', flexShrink: 0 }}>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.15rem' }}>Ingreso</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700 }}>{o.fecha ? new Date(o.fecha).toLocaleDateString('es-CO') : '—'}</div>
                      {activeTab === 'activos' && diasTaller !== null && (
                        <div style={{ fontSize: '0.7rem', color: diasTaller > 5 ? '#ef4444' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem', justifyContent: 'center' }}>
                          {diasTaller > 5 && <AlertTriangle size={9} />}{diasTaller}d
                        </div>
                      )}
                    </div>
                    {o.fechaEntrega && (
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '0.15rem' }}>Entrega</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#10b981' }}>{new Date(o.fechaEntrega).toLocaleDateString('es-CO')}</div>
                      </div>
                    )}
                  </div>

                  {/* Status + total */}
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, padding: '0.25rem 0.65rem', borderRadius: 99, background: estado.bg, color: estado.color, whiteSpace: 'nowrap' }}>
                      {o.estado}
                    </span>
                    {total > 0 && (
                      <span style={{ fontSize: '0.88rem', fontWeight: 800, color: '#10b981', whiteSpace: 'nowrap' }}>${fmt(total)}</span>
                    )}
                    <ChevronRight size={16} color="var(--text-muted)" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          fleetMode={true}
          onUpdate={() => {
            setSelectedOrder(null);
            fetch(`${API_URL}/orders?_embed=quotes&_embed=reports`)
              .then(r => r.json())
              .then(data => {
                const all = Array.isArray(data) ? data : [];
                setOrders(all.filter(o => {
                  if (user.empresa === 'ald') return IS_ALD(o.cliente);
                  if (user.empresa === 'cn')  return IS_CN(o.cliente);
                  return IS_ALD(o.cliente) || IS_CN(o.cliente);
                }));
              });
          }}
        />
      )}
    </div>
  );
}
