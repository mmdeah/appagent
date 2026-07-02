import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL } from '../api';
import { ThemeContext } from '../App';
import OrderDetailsModal from './OrderDetailsModal';
import {
  LogOut, Car, Clock, CheckCircle, Search, X, ChevronRight,
  AlertTriangle, Download, Settings, TrendingUp, TrendingDown,
  BarChart2, DollarSign,
} from 'lucide-react';

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
const KANBAN_COLS = ['Recepción', 'Proceso', 'Calidad', 'Docs Rápidos'];

const calcTotal = (o) => {
  if (!o.quotes?.length) return 0;
  const q = o.quotes[0];
  return (q.items || []).reduce((s, it) => {
    const base = (parseFloat(it.precio) || 0) * (parseFloat(it.cantidad) || 1);
    return s + base + (it.aplicaIva ? base * 0.19 : 0);
  }, 0);
};

const sameMonth = (dateStr, y, m) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d.getFullYear() === y && d.getMonth() === m;
};

export default function FleetView() {
  const { toggleTheme } = useContext(ThemeContext);
  const navigate = useNavigate();

  const [user, setUser] = useState(null);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [modalInitialTab, setModalInitialTab] = useState('info');
  const [activeTab, setActiveTab] = useState('resumen');
  const [search, setSearch] = useState('');
  // Budget config
  const [budget, setBudget] = useState({ enabled: false, amount: 0 });
  const [budgetInput, setBudgetInput] = useState('');
  const [showBudgetEdit, setShowBudgetEdit] = useState(false);

  // Days threshold config
  const [daysThreshold, setDaysThreshold] = useState(5);
  const [showDaysEdit, setShowDaysEdit] = useState(false);
  const [daysInput, setDaysInput] = useState('5');

  useEffect(() => {
    const stored = localStorage.getItem('fleetUser');
    if (!stored) { navigate('/flota-login'); return; }
    const u = JSON.parse(stored);
    setUser(u);

    const savedBudget = localStorage.getItem(`fleetBudget_${u.id}`);
    if (savedBudget) {
      const b = JSON.parse(savedBudget);
      setBudget(b);
      setBudgetInput(b.amount ? String(b.amount) : '');
    }
    const savedDays = localStorage.getItem(`fleetDays_${u.id}`);
    if (savedDays) {
      const d = parseInt(savedDays) || 5;
      setDaysThreshold(d);
      setDaysInput(String(d));
    }

    fetch(`${API_URL}/orders?_embed=quotes&_embed=reports`)
      .then(r => r.json())
      .then(data => {
        const all = Array.isArray(data) ? data : [];
        setOrders(all.filter(o => {
          if (u.empresa === 'ald') return IS_ALD(o.cliente);
          if (u.empresa === 'cn')  return IS_CN(o.cliente);
          return IS_ALD(o.cliente) || IS_CN(o.cliente);
        }));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const refreshOrders = (u = user) => {
    fetch(`${API_URL}/orders?_embed=quotes&_embed=reports`)
      .then(r => r.json())
      .then(data => {
        const all = Array.isArray(data) ? data : [];
        setOrders(all.filter(o => {
          if (u.empresa === 'ald') return IS_ALD(o.cliente);
          if (u.empresa === 'cn')  return IS_CN(o.cliente);
          return IS_ALD(o.cliente) || IS_CN(o.cliente);
        }));
      });
  };

  const handleLogout = () => {
    localStorage.removeItem('fleetUser');
    navigate('/flota-login');
  };

  const saveBudget = () => {
    const amount = parseFloat(budgetInput.replace(/\D/g, '')) || 0;
    const next = { ...budget, amount };
    setBudget(next);
    localStorage.setItem(`fleetBudget_${user.id}`, JSON.stringify(next));
    setShowBudgetEdit(false);
  };

  const toggleBudgetEnabled = () => {
    const next = { ...budget, enabled: !budget.enabled };
    setBudget(next);
    localStorage.setItem(`fleetBudget_${user.id}`, JSON.stringify(next));
  };

  const saveDays = () => {
    const d = parseInt(daysInput) || 5;
    setDaysThreshold(d);
    localStorage.setItem(`fleetDays_${user.id}`, String(d));
    setShowDaysEdit(false);
  };

  const exportCSV = () => {
    const rows = [['Placa', 'Cliente', 'Marca', 'Modelo', 'Servicios', 'Ingreso', 'Entrega', 'Total COP']];
    entregados.forEach(o => {
      rows.push([
        o.placa || '', o.cliente || '', o.marca || '', o.modelo || '',
        (o.servicios || '').replace(/"/g, '""'),
        o.fecha ? new Date(o.fecha).toLocaleDateString('es-CO') : '',
        o.fechaEntrega ? new Date(o.fechaEntrega).toLocaleDateString('es-CO') : '',
        calcTotal(o),
      ]);
    });
    const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `flota_${user?.empresa}_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!user) return null;

  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth();
  const prevDate = new Date(thisYear, thisMonth - 1, 1);
  const prevYear = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth();

  const activos    = orders.filter(o => o.estado !== 'Entregado');
  const entregados = orders.filter(o => o.estado === 'Entregado');
  const thisMoOrders = entregados.filter(o => sameMonth(o.fechaEntrega, thisYear, thisMonth));
  const prevMoOrders = entregados.filter(o => sameMonth(o.fechaEntrega, prevYear, prevMonth));

  const totalMes      = thisMoOrders.reduce((s, o) => s + calcTotal(o), 0);
  const totalPrevMes  = prevMoOrders.reduce((s, o) => s + calcTotal(o), 0);
  const trend = totalPrevMes > 0 ? ((totalMes - totalPrevMes) / totalPrevMes * 100) : null;
  const avgCost = entregados.length > 0
    ? entregados.reduce((s, o) => s + calcTotal(o), 0) / entregados.length
    : 0;

  // By-plate stats
  const byPlacaMap = {};
  entregados.forEach(o => {
    const p = o.placa || '—';
    if (!byPlacaMap[p]) byPlacaMap[p] = { placa: p, count: 0, total: 0, lastDate: '' };
    byPlacaMap[p].count++;
    byPlacaMap[p].total += calcTotal(o);
    if ((o.fechaEntrega || '') > byPlacaMap[p].lastDate) byPlacaMap[p].lastDate = o.fechaEntrega;
  });
  const placaList = Object.values(byPlacaMap).sort((a, b) => b.total - a.total);
  const maxCostVehicle = placaList[0] || null;

  const budgetPct = budget.enabled && budget.amount > 0
    ? Math.min((totalMes / budget.amount) * 100, 100)
    : 0;
  const budgetColor = budgetPct >= 90 ? '#ef4444' : budgetPct >= 70 ? '#f59e0b' : '#10b981';

  const companyLabel = user.empresa === 'ald' ? 'ALD / Ayvens' : user.empresa === 'cn' ? 'Consult Networks' : 'Flotas';
  const companyColor = user.empresa === 'ald' ? '#f59e0b' : '#818cf8';
  const companyBg   = user.empresa === 'ald' ? 'rgba(245,158,11,0.15)' : 'rgba(99,102,241,0.15)';

  const q = search.trim().toLowerCase();
  const applySearch = (list) => !q ? list : list.filter(o =>
    (o.placa || '').toLowerCase().includes(q) ||
    (o.marca || '').toLowerCase().includes(q) ||
    (o.modelo || '').toLowerCase().includes(q) ||
    (o.cliente || '').toLowerCase().includes(q)
  );

  const overDaysVehicles = activos.filter(o => {
    const d = o.fecha ? Math.floor((Date.now() - new Date(o.fecha)) / 86400000) : 0;
    return d > daysThreshold;
  });

  const TABS = [
    { id: 'resumen',   label: 'Resumen' },
    { id: 'kanban',    label: `Kanban (${activos.length})` },
    { id: 'historial', label: `Historial (${entregados.length})` },
  ];

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

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1.5rem' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.4rem', background: 'var(--card-bg)', padding: '0.3rem', borderRadius: 10, border: '1px solid var(--border)', marginBottom: '1.5rem', width: 'fit-content' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => { setActiveTab(t.id); setSearch(''); }}
              style={{ padding: '0.45rem 1rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', background: activeTab === t.id ? 'var(--primary)' : 'transparent', color: activeTab === t.id ? 'white' : 'var(--text-muted)', transition: '0.2s' }}>
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Cargando vehículos...</div>
        ) : (
          <>
            {/* ── RESUMEN ── */}
            {activeTab === 'resumen' && (
              <div>
                {/* KPI row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                  {[
                    { label: 'En taller ahora',       value: activos.length,          color: '#f59e0b', icon: <Clock size={18} color="#f59e0b" /> },
                    { label: 'Total entregados',       value: entregados.length,       color: '#10b981', icon: <CheckCircle size={18} color="#10b981" /> },
                    { label: 'Facturado este mes',     value: `$${fmt(totalMes)}`,     color: '#10b981', icon: <DollarSign size={18} color="#10b981" /> },
                    { label: 'Costo prom. vehículo',  value: `$${fmt(avgCost)}`,      color: 'var(--primary)', icon: <BarChart2 size={18} color="var(--primary)" /> },
                  ].map(k => (
                    <div key={k.label} className="card" style={{ padding: '1.1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.9rem' }}>
                      <div style={{ width: 38, height: 38, borderRadius: 9, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{k.icon}</div>
                      <div>
                        <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.2rem' }}>{k.label}</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 900, color: k.color }}>{k.value}</div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Trend + most expensive */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.25rem' }}>
                  <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Tendencia vs mes anterior</div>
                    {trend === null ? (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Sin datos del mes anterior</div>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        {trend >= 0 ? <TrendingUp size={22} color="#ef4444" /> : <TrendingDown size={22} color="#10b981" />}
                        <span style={{ fontSize: '1.4rem', fontWeight: 900, color: trend >= 0 ? '#ef4444' : '#10b981' }}>
                          {trend >= 0 ? '+' : ''}{trend.toFixed(1)}%
                        </span>
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                          (ant: ${fmt(totalPrevMes)})
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Vehículo más costoso</div>
                    {maxCostVehicle ? (
                      <div>
                        <div style={{ fontSize: '1.1rem', fontWeight: 900, letterSpacing: 1 }}>{maxCostVehicle.placa}</div>
                        <div style={{ color: '#10b981', fontWeight: 700 }}>${fmt(maxCostVehicle.total)} · {maxCostVehicle.count} servicio{maxCostVehicle.count !== 1 ? 's' : ''}</div>
                      </div>
                    ) : <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Sin datos aún</div>}
                  </div>
                </div>

                {/* Budget */}
                <div className="card" style={{ padding: '1.1rem 1.25rem', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: (budget.enabled && budget.amount > 0) ? '0.75rem' : showBudgetEdit ? '0.75rem' : 0 }}>
                    <div>
                      <span style={{ fontWeight: 700 }}>Presupuesto mensual</span>
                      {budget.enabled && budget.amount > 0 && (
                        <span style={{ marginLeft: '0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>${fmt(budget.amount)} / mes</span>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <button onClick={() => setShowBudgetEdit(v => !v)}
                        style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 7, padding: '0.3rem 0.65rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                        <Settings size={13} /> Configurar
                      </button>
                      <button onClick={toggleBudgetEnabled}
                        style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.75rem', borderRadius: 20, fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer', transition: 'all 0.2s',
                          background: budget.enabled ? 'rgba(99,102,241,0.15)' : 'rgba(107,114,128,0.1)',
                          color: budget.enabled ? 'var(--primary)' : 'var(--text-muted)',
                          border: budget.enabled ? '1.5px solid var(--primary)' : '1.5px solid var(--border)' }}>
                        {budget.enabled ? 'Activo' : 'Inactivo'}
                      </button>
                    </div>
                  </div>
                  {showBudgetEdit && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem', alignItems: 'center' }}>
                      <input type="text" placeholder="Ej: 5000000" value={budgetInput}
                        onChange={e => setBudgetInput(e.target.value.replace(/[^0-9]/g, ''))}
                        style={{ flex: 1, padding: '0.45rem 0.75rem' }} />
                      <button onClick={saveBudget} className="btn-primary" style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}>Guardar</button>
                      <button onClick={() => setShowBudgetEdit(false)} className="btn-secondary" style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}>Cancelar</button>
                    </div>
                  )}
                  {budget.enabled && budget.amount > 0 && (
                    <>
                      <div style={{ background: 'var(--bg)', borderRadius: 99, height: 10, overflow: 'hidden', marginBottom: '0.4rem' }}>
                        <div style={{ height: '100%', width: `${budgetPct}%`, background: budgetColor, borderRadius: 99, transition: 'width 0.5s' }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                        <span style={{ color: budgetColor, fontWeight: 700 }}>{budgetPct.toFixed(1)}% — ${fmt(totalMes)} de ${fmt(budget.amount)}</span>
                        <span style={{ color: 'var(--text-muted)' }}>Disponible: ${fmt(Math.max(0, budget.amount - totalMes))}</span>
                      </div>
                      {budgetPct >= 90 && (
                        <div style={{ marginTop: '0.6rem', padding: '0.5rem 0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#ef4444', fontWeight: 600 }}>
                          <AlertTriangle size={14} /> Presupuesto {budgetPct >= 100 ? 'superado' : 'casi agotado'} este mes
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Days threshold */}
                <div className="card" style={{ padding: '1.1rem 1.25rem', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontWeight: 700 }}>Alerta de días en taller</span>
                      <span style={{ marginLeft: '0.75rem', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                        Alerta si supera <strong>{daysThreshold}</strong> días
                      </span>
                    </div>
                    <button onClick={() => setShowDaysEdit(v => !v)}
                      style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 7, padding: '0.3rem 0.65rem', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <Settings size={13} /> Cambiar
                    </button>
                  </div>
                  {showDaysEdit && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', alignItems: 'center' }}>
                      <input type="number" min="1" max="60" value={daysInput}
                        onChange={e => setDaysInput(e.target.value)}
                        style={{ width: 90, padding: '0.45rem 0.75rem' }} />
                      <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>días</span>
                      <button onClick={saveDays} className="btn-primary" style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}>Guardar</button>
                      <button onClick={() => setShowDaysEdit(false)} className="btn-secondary" style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}>Cancelar</button>
                    </div>
                  )}
                  {overDaysVehicles.length > 0 && (
                    <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {overDaysVehicles.map(o => {
                        const dias = Math.floor((Date.now() - new Date(o.fecha)) / 86400000);
                        return (
                          <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', padding: '0.4rem 0.75rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 8, fontSize: '0.85rem', cursor: 'pointer' }}
                            onClick={() => setSelectedOrder(o)}>
                            <AlertTriangle size={13} color="#ef4444" />
                            <span style={{ fontWeight: 700 }}>{o.placa}</span>
                            <span style={{ color: 'var(--text-muted)' }}>{o.marca} {o.modelo}</span>
                            <span style={{ fontWeight: 700, color: '#ef4444', marginLeft: 'auto' }}>{dias} días en taller</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Cost comparison by plate */}
                {placaList.length > 0 && (
                  <div className="card" style={{ padding: '1.1rem 1.25rem' }}>
                    <div style={{ fontWeight: 700, marginBottom: '1rem', fontSize: '0.95rem' }}>Comparativa de costos por vehículo</div>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Placa</th>
                          <th style={{ textAlign: 'center' }}>Visitas</th>
                          <th style={{ textAlign: 'right' }}>Total acumulado</th>
                          <th style={{ textAlign: 'right' }}>Costo promedio</th>
                          <th>Último servicio</th>
                        </tr>
                      </thead>
                      <tbody>
                        {placaList.map((p, i) => (
                          <tr key={p.placa}>
                            <td>
                              <span style={{ fontWeight: 900, letterSpacing: 1 }}>{p.placa}</span>
                              {i === 0 && <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', fontWeight: 700, padding: '2px 6px', borderRadius: 99, background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>Mayor costo</span>}
                            </td>
                            <td style={{ textAlign: 'center' }}>{p.count}</td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>${fmt(p.total)}</td>
                            <td style={{ textAlign: 'right', color: 'var(--text-muted)' }}>${fmt(p.total / p.count)}</td>
                            <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{p.lastDate ? new Date(p.lastDate).toLocaleDateString('es-CO') : '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── KANBAN ── */}
            {activeTab === 'kanban' && (
              <div style={{ overflowX: 'auto', paddingBottom: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem', minWidth: `${KANBAN_COLS.length * 265}px` }}>
                  {KANBAN_COLS.map(col => {
                    const colOrders = activos.filter(o => o.estado === col);
                    const ec = ESTADO_COLOR[col] || { bg: 'var(--bg)', color: 'var(--text-muted)' };
                    return (
                      <div key={col} style={{ flex: '0 0 260px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', padding: '0.5rem 0.75rem', borderRadius: 9, background: ec.bg }}>
                          <span style={{ fontWeight: 800, fontSize: '0.88rem', color: ec.color }}>{col}</span>
                          <span style={{ marginLeft: 'auto', fontWeight: 700, fontSize: '0.82rem', color: ec.color, background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: 99 }}>{colOrders.length}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                          {colOrders.length === 0 ? (
                            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', border: '1.5px dashed var(--border)', borderRadius: 10 }}>Sin vehículos</div>
                          ) : colOrders.map(o => {
                            const dias = o.fecha ? Math.floor((Date.now() - new Date(o.fecha)) / 86400000) : null;
                            const overDays = dias !== null && dias > daysThreshold;
                            const total = calcTotal(o);
                            const hasQuote = o.quotes?.length > 0 && (o.quotes[0].items || []).length > 0;
                            const quoteItems = o.quotes?.[0]?.items || [];
                            const aprobados  = quoteItems.filter(it => it.aprobadoFlota === true).length;
                            const rechazados = quoteItems.filter(it => it.aprobadoFlota === false).length;
                            const pendientes = quoteItems.filter(it => it.aprobadoFlota == null).length;
                            const openModal = (tab = 'info') => { setModalInitialTab(tab); setSelectedOrder(o); };
                            return (
                              <div key={o.id} className="card card-hover" onClick={() => openModal('info')}
                                style={{ padding: '0.9rem', cursor: 'pointer', borderLeft: overDays ? '3px solid #ef4444' : undefined }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.35rem' }}>
                                  <span style={{ fontWeight: 900, fontSize: '1rem', letterSpacing: 1 }}>{o.placa}</span>
                                  {dias !== null && (
                                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: overDays ? '#ef4444' : 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                      {overDays && <AlertTriangle size={10} />}{dias}d
                                    </span>
                                  )}
                                </div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>{o.marca} {o.modelo} {o.anio || ''}</div>
                                {o.servicios && <div style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.servicios}</div>}
                                {o.fecha && <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>Ingreso: {new Date(o.fecha).toLocaleDateString('es-CO')}</div>}
                                {total > 0 && <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#10b981', marginBottom: '0.4rem' }}>${fmt(total)}</div>}

                                {hasQuote && (
                                  <div onClick={e => e.stopPropagation()}>
                                    {aprobados === 0 && rechazados === 0 ? (
                                      <button onClick={() => openModal('cotizacion')}
                                        style={{ width: '100%', padding: '0.35rem', borderRadius: 7, border: '1.5px solid var(--primary)', background: 'rgba(99,102,241,0.08)', color: 'var(--primary)', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
                                        📋 Revisar {quoteItems.length} ítem{quoteItems.length !== 1 ? 's' : ''}
                                      </button>
                                    ) : (
                                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap', padding: '0.3rem 0.5rem', background: 'var(--bg)', borderRadius: 7 }}>
                                        {aprobados > 0 && <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#10b981' }}>✅ {aprobados} ap.</span>}
                                        {rechazados > 0 && <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ef4444' }}>❌ {rechazados} rech.</span>}
                                        {pendientes > 0 && <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#f59e0b' }}>⏳ {pendientes} pdte.</span>}
                                        <button onClick={() => openModal('cotizacion')}
                                          style={{ fontSize: '0.72rem', color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 700, marginLeft: 'auto' }}>
                                          Editar →
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── HISTORIAL ── */}
            {activeTab === 'historial' && (
              <div>
                <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                    <input type="text" placeholder="Buscar placa, modelo..." value={search} onChange={e => setSearch(e.target.value)}
                      style={{ paddingLeft: '2rem', width: '100%', boxSizing: 'border-box' }} />
                    {search && (
                      <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 0 }}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                  <button onClick={exportCSV} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', whiteSpace: 'nowrap' }}>
                    <Download size={15} /> Exportar CSV
                  </button>
                </div>

                {applySearch(entregados).length === 0 ? (
                  <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    {search ? 'Sin resultados.' : 'No hay vehículos entregados aún.'}
                  </div>
                ) : (
                  <div className="card" style={{ overflow: 'auto' }}>
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Placa</th>
                          <th>Vehículo</th>
                          <th>Cliente</th>
                          <th>Servicios</th>
                          <th>Ingreso</th>
                          <th>Entrega</th>
                          <th style={{ textAlign: 'right' }}>Total</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {applySearch(entregados).map(o => {
                          const total = calcTotal(o);
                          return (
                            <tr key={o.id} style={{ cursor: 'pointer' }} onClick={() => setSelectedOrder(o)}>
                              <td style={{ fontWeight: 900, letterSpacing: 1 }}>{o.placa}</td>
                              <td style={{ fontSize: '0.85rem' }}>{o.marca} {o.modelo} {o.anio || ''}</td>
                              <td style={{ fontSize: '0.85rem' }}>{o.cliente}</td>
                              <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.servicios || '—'}</td>
                              <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{o.fecha ? new Date(o.fecha).toLocaleDateString('es-CO') : '—'}</td>
                              <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap', color: '#10b981', fontWeight: 600 }}>{o.fechaEntrega ? new Date(o.fechaEntrega).toLocaleDateString('es-CO') : '—'}</td>
                              <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{total > 0 ? `$${fmt(total)}` : '—'}</td>
                              <td><ChevronRight size={14} color="var(--text-muted)" /></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          fleetMode={true}
          initialTab={modalInitialTab}
          onUpdate={() => { setSelectedOrder(null); refreshOrders(); }}
        />
      )}
    </div>
  );
}
