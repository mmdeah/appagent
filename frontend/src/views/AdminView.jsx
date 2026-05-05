import React, { useState, useEffect, useContext } from 'react';
import { API_URL } from '../api';
import OrderDetailsModal from './OrderDetailsModal';
import PhotoUploadModal from './PhotoUploadModal';
import { ThemeContext } from '../App';
import { PlusCircle, BarChart3, Camera, X, Car, Trash2, Zap, LayoutDashboard, History, Receipt } from 'lucide-react';

const fmt = (n) => (parseFloat(n) || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 });

const COLUMNS = ['Recepción', 'Proceso', 'Calidad', 'Docs Rápidos'];

const emptyForm = { placa: '', cliente: '', telefono: '', correo: '', marca: '', modelo: '', anio: '', kilometraje: '', servicios: '', notas: '' };

export default function AdminView() {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ avg: 0, total: 0, active: 0 });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [createdOrderData, setCreatedOrderData] = useState(null);
  const [showPhotoUpload, setShowPhotoUpload] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [photos, setPhotos] = useState([]);
  const [activeTab, setActiveTab] = useState('Kanban');
  const [expenses, setExpenses] = useState([]);
  const [expenseForm, setExpenseForm] = useState({ fecha: new Date().toISOString().split('T')[0], concepto: '', monto: '' });
  const [quickOrderForm, setQuickOrderForm] = useState({ placa: '', cliente: '', marca: '', modelo: '', anio: '', servicios: '' });
  const [formStatus, setFormStatus] = useState({ text: '', type: '' });

  const fetchExpenses = async () => {
    try {
      const res = await fetch(`${API_URL}/expenses`);
      const data = await res.json();
      setExpenses(data);
    } catch (e) { console.error(e); }
  };

  const fetchOrders = async () => {
    try {
      const res = await fetch(`${API_URL}/orders?_embed=reports&_embed=quotes`);
      const data = await res.json();
      setOrders(data);
      let total = 0;
      const entregadas = data.filter(o => o.estado === 'Entregado');
      entregadas.forEach(o => o.quotes?.forEach(q => q.items?.forEach(it => {
        const sub = it.precio * it.cantidad;
        total += it.aplicaIva ? sub * 1.19 : sub;
      })));
      const active = data.filter(o => o.estado !== 'Entregado').length;
      setStats({ total, avg: entregadas.length > 0 ? total / entregadas.length : 0, active });
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchOrders(); fetchExpenses(); }, []);

  const deleteOrder = async (id) => {
    if(!window.confirm('¿Estás seguro de eliminar esta orden permanentemente? Esta acción no se puede deshacer.')) return;
    try {
      await fetch(`${API_URL}/orders/${id}`, { method: 'DELETE' });
      fetchOrders();
    } catch (e) { console.error(e); }
  };

  const moveOrder = async (id, estado) => {
    await fetch(`${API_URL}/orders/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado })
    });
    fetchOrders();
  };

  // Mejora #2: Convertir fotos a Base64 para guardarlas en la orden
  const handlePhotos = (e) => {
    const files = Array.from(e.target.files);
    Promise.all(files.map(f => new Promise((res) => {
      const reader = new FileReader();
      reader.onload = ev => res(ev.target.result);
      reader.readAsDataURL(f);
    }))).then(results => setPhotos(prev => [...prev, ...results]));
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!form.placa) return;
    try {
      const payload = {
        ...form,
        placa: form.placa.toUpperCase(),
        estado: 'Recepción',
        fecha: new Date().toISOString(),
        fotos: photos
      };
      await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      setCreatedOrderData(payload);
      setForm(emptyForm);
      setPhotos([]);
      fetchOrders();
    } catch (e) {
      setFormStatus({ text: 'Error al crear la orden', type: 'error' });
    }
  };

  const handleExpenseSubmit = async (e) => {
    e.preventDefault();
    if(!expenseForm.monto || !expenseForm.concepto) return;
    try {
      await fetch(`${API_URL}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...expenseForm, monto: parseInt(expenseForm.monto) })
      });
      setExpenseForm({ fecha: new Date().toISOString().split('T')[0], concepto: '', monto: '' });
      fetchExpenses();
    } catch (e) { console.error(e); }
  };

  const handleQuickOrder = async (e) => {
    e.preventDefault();
    if(!quickOrderForm.placa) return;
    try {
      const payload = {
        ...quickOrderForm,
        placa: quickOrderForm.placa.toUpperCase(),
        estado: 'Docs Rápidos',
        fecha: new Date().toISOString(),
        fotos: []
      };
      const res = await fetch(`${API_URL}/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const newOrder = await res.json();
      setQuickOrderForm({ placa: '', cliente: '', marca: '', modelo: '', anio: '', servicios: '' });
      setSelectedOrder({ ...newOrder, reports: [], quotes: [] });
      fetchOrders();
    } catch (e) { console.error(e); }
  };

  const colColor = { 'Recepción': '#6366f1', 'Proceso': '#f59e0b', 'Calidad': '#10b981', 'Docs Rápidos': '#ec4899' };
  const colBg   = { 'Recepción': 'rgba(99,102,241,0.08)', 'Proceso': 'rgba(245,158,11,0.08)', 'Calidad': 'rgba(16,185,129,0.08)', 'Docs Rápidos': 'rgba(236,72,153,0.08)' };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Top nav */}
      <div style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border)', padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ width: 36, height: 36, borderRadius: 9, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <BarChart3 size={18} color="white" />
          </div>
          <div>
            <div style={{ fontWeight: 700, lineHeight: 1 }}>Panel Admin</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Taller Automotriz</div>
          </div>
        </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <button onClick={toggleTheme} className="theme-toggle" title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'} />
            <button className="btn-secondary" style={{ gap: '0.5rem' }} onClick={() => setShowPhotoUpload(true)}>
              <Camera size={16} /> Subir Foto
            </button>
            <button className="btn-primary" style={{ gap: '0.5rem' }} onClick={() => setShowNewOrder(true)}>
              <PlusCircle size={16} /> Nueva Orden
            </button>
          </div>
      </div>

      <div style={{ maxWidth: 1300, margin: '0 auto', padding: '1.5rem 1.5rem 4rem' }}>
        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
          <div className="stat-card">
            <div className="label">Órdenes Activas</div>
            <div className="value" style={{ color: '#818cf8' }}>{stats.active}</div>
            <div className="sub">En progreso actualmente</div>
          </div>
          <div className="stat-card">
            <div className="label">Total Facturado</div>
            <div className="value">${fmt(stats.total)}</div>
            <div className="sub">De órdenes entregadas</div>
          </div>
          <div className="stat-card">
            <div className="label">Gastos Registrados</div>
            <div className="value" style={{ color: 'var(--error)' }}>${fmt(expenses.reduce((acc, g) => acc + (parseFloat(g.monto) || 0), 0))}</div>
            <div className="sub">Salidas de dinero</div>
          </div>
          <div className="stat-card">
            <div className="label">Promedio O.S.</div>
            <div className="value">${fmt(stats.avg)}</div>
            <div className="sub">Valor por orden entregada</div>
          </div>
          <div className="stat-card">
            <div className="label">Ganancia Neta</div>
            <div className="value" style={{ color: '#10b981' }}>${fmt(stats.total - expenses.reduce((acc, g) => acc + (parseFloat(g.monto) || 0), 0))}</div>
            <div className="sub">Facturado - Gastos</div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', overflowX: 'auto' }}>
          {[
            { id: 'Kanban', icon: <LayoutDashboard size={16} />, label: 'Kanban' },
            { id: 'Historial', icon: <History size={16} />, label: 'Historial' },
            { id: 'Gastos', icon: <Receipt size={16} />, label: 'Gastos' },
            { id: 'Docs Rápidos', icon: <Zap size={16} />, label: 'Docs Rápidos' }
          ].map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: activeTab === t.id ? 'var(--primary)' : 'transparent', color: activeTab === t.id ? 'white' : 'var(--text-muted)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600, fontSize: '0.9rem', transition: 'all 0.2s', whiteSpace: 'nowrap' }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Content based on activeTab */}
        {activeTab === 'Kanban' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.25rem' }}>
            {COLUMNS.map(col => (
              <div key={col} className="kanban-column">
                <div className="kanban-header">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: colColor[col], display: 'inline-block' }}></span>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{col}</span>
                  </div>
                  <span style={{ background: colBg[col], color: colColor[col], borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.75rem', fontWeight: 700 }}>
                    {orders.filter(o => o.estado === col).length}
                  </span>
                </div>

                {orders.filter(o => o.estado === col).map(o => (
                  <div key={o.id} className="kanban-card" onClick={() => setSelectedOrder(o)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '1rem' }}>{o.placa}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{o.marca} {o.modelo}</div>
                      </div>
                      <span style={{ fontSize: '0.72rem', background: o.reports?.length > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: o.reports?.length > 0 ? '#34d399' : '#fbbf24', padding: '0.2rem 0.5rem', borderRadius: 999, fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {o.reports?.length > 0 ? '✓ Revisado' : '⏳ Pdte'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{o.cliente}</span>
                      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                        <select
                          value={o.estado}
                          onClick={e => e.stopPropagation()}
                          onChange={e => { e.stopPropagation(); moveOrder(o.id, e.target.value); }}
                          style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem', width: 'auto', borderRadius: 6 }}>
                          {COLUMNS.map(c => <option key={c} value={c}>{c}</option>)}
                          <option value="Entregado">Entregar ✅</option>
                        </select>
                        <button onClick={e => { e.stopPropagation(); deleteOrder(o.id); }} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', display: 'flex', padding: '0.2rem' }} title="Eliminar orden">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {orders.filter(o => o.estado === col).length === 0 && (
                  <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    Sin órdenes
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'Historial' && (
          <div className="card" style={{ padding: '1.5rem' }}>
            <h2 style={{ fontSize: '1.2rem', marginBottom: '1rem', fontWeight: 700 }}>Órdenes Entregadas</h2>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Placa</th>
                  <th>Cliente</th>
                  <th>Vehículo</th>
                  <th>Fecha Ingreso</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {orders.filter(o => o.estado === 'Entregado').length === 0 && (
                  <tr><td colSpan="5" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay órdenes entregadas.</td></tr>
                )}
                {orders.filter(o => o.estado === 'Entregado').map(o => (
                  <tr key={o.id}>
                    <td style={{ fontWeight: 700 }}>{o.placa}</td>
                    <td>{o.cliente}</td>
                    <td>{o.marca} {o.modelo}</td>
                    <td>{new Date(o.fecha).toLocaleDateString('es-CO')}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button className="btn-secondary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }} onClick={() => setSelectedOrder(o)}>Ver Detalle</button>
                        <button className="btn-secondary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem', color: 'var(--error)' }} onClick={() => deleteOrder(o.id)}><Trash2 size={14} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'Gastos' && (
          <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem' }}>
            <div className="card" style={{ padding: '1.5rem' }}>
              <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', fontWeight: 700 }}>Registrar Gasto</h2>
              <form onSubmit={handleExpenseSubmit}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Fecha</label>
                  <input type="date" required value={expenseForm.fecha} onChange={e => setExpenseForm({...expenseForm, fecha: e.target.value})} style={{ width: '100%' }} />
                </div>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Concepto</label>
                  <input type="text" required placeholder="Ej. Compra de repuestos" value={expenseForm.concepto} onChange={e => setExpenseForm({...expenseForm, concepto: e.target.value})} style={{ width: '100%' }} />
                </div>
                <div style={{ marginBottom: '1.5rem' }}>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Monto ($)</label>
                  <input type="number" required placeholder="0" value={expenseForm.monto} onChange={e => setExpenseForm({...expenseForm, monto: e.target.value})} style={{ width: '100%' }} />
                </div>
                <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Guardar Gasto</button>
              </form>
            </div>
            <div className="card" style={{ padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Historial de Gastos</h2>
                <div style={{ fontWeight: 700, color: 'var(--error)' }}>
                  Total: ${fmt(expenses.reduce((acc, g) => acc + (parseFloat(g.monto) || 0), 0))}
                </div>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Concepto</th>
                    <th style={{ textAlign: 'right' }}>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.length === 0 && (
                    <tr><td colSpan="3" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No se han registrado gastos.</td></tr>
                  )}
                  {expenses.map(g => (
                    <tr key={g.id}>
                      <td>{new Date(g.fecha).toLocaleDateString('es-CO')}</td>
                      <td>{g.concepto}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--error)' }}>${fmt(g.monto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'Docs Rápidos' && (
          <div className="card" style={{ padding: '1.5rem', maxWidth: 600, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
              <div style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--primary)', width: 48, height: 48, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 0.5rem' }}>
                <Zap size={24} />
              </div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Generador de Orden Exprés</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                Crea una orden rápida para cotizar o facturar inmediatamente. La orden quedará marcada como "Entregada" de forma automática.
              </p>
            </div>
            <form onSubmit={handleQuickOrder}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Placa</label>
                  <input required placeholder="AAA123" value={quickOrderForm.placa} onChange={e => setQuickOrderForm({...quickOrderForm, placa: e.target.value.toUpperCase()})} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Cliente</label>
                  <input required placeholder="Nombre" value={quickOrderForm.cliente} onChange={e => setQuickOrderForm({...quickOrderForm, cliente: e.target.value})} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Marca</label>
                  <input required placeholder="Ej. Toyota" value={quickOrderForm.marca} onChange={e => setQuickOrderForm({...quickOrderForm, marca: e.target.value})} style={{ width: '100%' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Modelo / Año</label>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input required placeholder="Corolla" value={quickOrderForm.modelo} onChange={e => setQuickOrderForm({...quickOrderForm, modelo: e.target.value})} style={{ flex: 2 }} />
                    <input placeholder="Año" type="number" value={quickOrderForm.anio} onChange={e => setQuickOrderForm({...quickOrderForm, anio: e.target.value})} style={{ flex: 1 }} />
                  </div>
                </div>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Servicios / Observaciones (opcional)</label>
                <textarea placeholder="Detalle rápido de la revisión o servicio..." value={quickOrderForm.servicios} onChange={e => setQuickOrderForm({...quickOrderForm, servicios: e.target.value})} style={{ width: '100%', minHeight: 60 }}></textarea>
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '1rem', fontSize: '1rem' }}>
                Crear y Facturar / Cotizar
              </button>
            </form>
          </div>
        )}
      </div>

      {/* New Order Modal */}
      {showNewOrder && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 640 }}>
            {createdOrderData ? (
              <div style={{ textAlign: 'center', padding: '1rem' }}>
                <div style={{ fontSize: '3.5rem', marginBottom: '1rem' }}>✅</div>
                <h2 style={{ fontWeight: 800, fontSize: '1.6rem', marginBottom: '0.5rem' }}>¡Orden Creada!</h2>
                <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', fontSize: '1.05rem' }}>El vehículo <strong>{createdOrderData.placa}</strong> ha sido ingresado al sistema.</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  <a href={`https://wa.me/57${createdOrderData.telefono}?text=${encodeURIComponent(`Buenos dias! Confirmamos recepcion del vehiculo de placas ${createdOrderData.placa}, puedes ver mas detalles del servicio aqui https://appagent.up.railway.app/cliente`)}`}
                     target="_blank" rel="noreferrer"
                     className="btn-success" style={{ padding: '0.85rem', width: '100%', justifyContent: 'center', fontSize: '1.05rem', textDecoration: 'none' }}>
                    📱 Notificar al Cliente (WhatsApp)
                  </a>
                  <button className="btn-secondary" style={{ width: '100%', justifyContent: 'center', padding: '0.85rem', fontSize: '1rem' }} onClick={() => { setShowNewOrder(false); setCreatedOrderData(null); }}>
                    Cerrar
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 style={{ fontWeight: 700, fontSize: '1.2rem' }}>📋 Ingresar Vehículo</h2>
                  <button onClick={() => { setShowNewOrder(false); setPhotos([]); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={20} /></button>
                </div>

                {formStatus.text && <div className={`toast toast-${formStatus.type}`}>{formStatus.text}</div>}

                <form onSubmit={handleCreateOrder}>
                  <p className="section-title">Vehículo</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <input required placeholder="Placa (Ej. AAA123)" value={form.placa} onChange={e => setForm({...form, placa: e.target.value.toUpperCase()})} />
                <input required placeholder="Kilometraje" type="number" value={form.kilometraje} onChange={e => setForm({...form, kilometraje: e.target.value})} />
                <input required placeholder="Marca" value={form.marca} onChange={e => setForm({...form, marca: e.target.value})} />
                <input required placeholder="Modelo" value={form.modelo} onChange={e => setForm({...form, modelo: e.target.value})} />
                <input required placeholder="Año" type="number" value={form.anio} onChange={e => setForm({...form, anio: e.target.value})} style={{ gridColumn: '1 / -1' }} />
              </div>

              <p className="section-title">Cliente</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <input required placeholder="Nombre completo" value={form.cliente} onChange={e => setForm({...form, cliente: e.target.value})} />
                <input required placeholder="Teléfono" value={form.telefono} onChange={e => setForm({...form, telefono: e.target.value})} />
                <input placeholder="Correo electrónico" type="email" value={form.correo} onChange={e => setForm({...form, correo: e.target.value})} style={{ gridColumn: '1 / -1' }} />
              </div>

              <p className="section-title">Servicio</p>
              <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <textarea required placeholder="Servicios a realizar" value={form.servicios} onChange={e => setForm({...form, servicios: e.target.value})} style={{ minHeight: 70 }} />
                <textarea placeholder="Notas / Observaciones" value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} style={{ minHeight: 55 }} />
              </div>

              {/* Mejora #2: Fotos de ingreso */}
              <p className="section-title">Fotos de Ingreso</p>
              <label style={{ display: 'block', border: '2px dashed var(--border)', borderRadius: 'var(--radius-sm)', padding: '1rem', textAlign: 'center', cursor: 'pointer', marginBottom: '0.75rem', color: 'var(--text-muted)', fontSize: '0.85rem', transition: 'border-color 0.2s' }}>
                📷 Haz clic para seleccionar fotos (o arrastra aquí)
                <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handlePhotos} />
              </label>
              {photos.length > 0 && (
                <div className="img-grid" style={{ marginBottom: '1.25rem' }}>
                  {photos.map((src, i) => (
                    <div key={i} style={{ position: 'relative' }}>
                      <img src={src} className="img-thumb" alt={`foto-${i}`} />
                      <button type="button" onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                        style={{ position: 'absolute', top: 2, right: 2, background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%', width: 18, height: 18, cursor: 'pointer', color: 'white', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button type="button" className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowNewOrder(false)}>Cancelar</button>
                <button type="submit" className="btn-primary" style={{ flex: 2, justifyContent: 'center' }}>Guardar Orden</button>
              </div>
            </form>
            </>
            )}
          </div>
        </div>
      )}

      {selectedOrder && (
        <OrderDetailsModal order={selectedOrder} onClose={() => { setSelectedOrder(null); fetchOrders(); }} />
      )}

      {showPhotoUpload && (
        <PhotoUploadModal onClose={() => setShowPhotoUpload(false)} onSuccess={fetchOrders} />
      )}
    </div>
  );
}
