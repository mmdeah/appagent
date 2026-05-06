import React, { useState, useEffect, useContext } from 'react';
import { API_URL, getPicoYPlaca } from '../api';
import OrderDetailsModal from './OrderDetailsModal';
import PhotoUploadModal from './PhotoUploadModal';
import { ThemeContext } from '../App';
import { PlusCircle, BarChart3, Camera, X, Car, Trash2, Zap, LayoutDashboard, History, Receipt, CheckCircle, AlertTriangle, ClipboardList, Save, Settings } from 'lucide-react';

const fmt = (n) => (parseFloat(n) || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 });

const COLUMNS = ['Recepción', 'Proceso', 'Calidad', 'Docs Rápidos'];
const PAYMENT_METHODS = ['Efectivo', 'Nequi', 'Bancolombia', 'Banco de Bogota', 'Tarjeta'];

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
  const [expenseForm, setExpenseForm] = useState({ fecha: new Date().toISOString().split('T')[0], concepto: '', monto: '', metodoPago: 'Efectivo' });
  const [quickOrderForm, setQuickOrderForm] = useState({ placa: '', cliente: '', marca: '', modelo: '', anio: '', servicios: '' });
  const [formStatus, setFormStatus] = useState({ text: '', type: '' });
  const [orderToDelete, setOrderToDelete] = useState(null);
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState('');
  const [balancesByMethod, setBalancesByMethod] = useState({});
  const [formConfig, setFormConfig] = useState(null);
  const [newCategoryName, setNewCategoryName] = useState('');

  const fetchExpenses = async () => {
    try {
      const res = await fetch(`${API_URL}/expenses`);
      if (res.status === 404) {
        setExpenses([]);
        return;
      }
      const data = await res.json();
      setExpenses(Array.isArray(data) ? data : []);
    } catch (e) { 
      console.error(e);
      setExpenses([]);
    }
  };

  const fetchTodos = async () => {
    try {
      const res = await fetch(`${API_URL}/todos`);
      if (res.status === 404) {
        setTodos([]);
        return;
      }
      const data = await res.json();
      setTodos(Array.isArray(data) ? data : []);
    } catch (e) { 
      console.error(e);
      setTodos([]);
    }
  };

  const addTodo = async (e) => {
    e.preventDefault();
    if (!newTodo.trim()) return;
    try {
      await fetch(`${API_URL}/todos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newTodo, completed: false })
      });
      setNewTodo('');
      fetchTodos();
    } catch (e) { console.error(e); }
  };

  const toggleTodo = async (todo) => {
    try {
      await fetch(`${API_URL}/todos/${todo.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !todo.completed })
      });
      fetchTodos();
    } catch (e) { console.error(e); }
  };

  const deleteTodo = async (id) => {
    try {
      await fetch(`${API_URL}/todos/${id}`, { method: 'DELETE' });
      fetchTodos();
    } catch (e) { console.error(e); }
  };

  const updateBalances = () => {
    const balances = {};
    PAYMENT_METHODS.forEach(m => {
      const ingresos = orders.filter(o => o.estado === 'Entregado' && (o.metodoPago === m || (!o.metodoPago && m === 'Efectivo'))).reduce((acc, o) => {
        let t = 0;
        if (o.quotes && Array.isArray(o.quotes)) {
          o.quotes.forEach(q => {
            if (q.items && Array.isArray(q.items)) {
              q.items.forEach(it => {
                const p = parseFloat(it.precio) || 0;
                const c = parseFloat(it.cantidad) || 0;
                const sub = p * c;
                t += it.aplicaIva ? sub * 1.19 : sub;
              });
            }
          });
        }
        return acc + t;
      }, 0);

      const egresos = expenses.filter(g => g.metodoPago === m).reduce((acc, g) => acc + (parseFloat(g.monto) || 0), 0);
      
      balances[m] = Math.round(ingresos - egresos);
    });
    setBalancesByMethod(balances);
  };

  useEffect(() => {
    updateBalances();
  }, [orders, expenses]);

  const fetchOrders = async () => {
    try {
      const res = await fetch(`${API_URL}/orders?_embed=reports&_embed=quotes`);
      const data = await res.json();
      const ordersArr = Array.isArray(data) ? data : [];
      setOrders(ordersArr);
      
      let incomeTotal = 0;
      const entregadas = ordersArr.filter(o => o.estado === 'Entregado');
      
      entregadas.forEach(o => {
        if (o.quotes && Array.isArray(o.quotes)) {
          o.quotes.forEach(q => {
            if (q.items && Array.isArray(q.items)) {
              q.items.forEach(it => {
                const precio = parseFloat(it.precio) || 0;
                const cantidad = parseFloat(it.cantidad) || 0;
                const sub = precio * cantidad;
                incomeTotal += it.aplicaIva ? sub * 1.19 : sub;
              });
            }
          });
        }
      });

      const active = ordersArr.filter(o => o.estado !== 'Entregado').length;
      setStats({ 
        total: Math.round(incomeTotal), 
        avg: entregadas.length > 0 ? incomeTotal / entregadas.length : 0, 
        active 
      });
    } catch (e) { 
      console.error("Error fetching orders for stats:", e); 
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await fetch(`${API_URL}/settings`);
      const data = await res.json();
      const config = Array.isArray(data) ? data.find(s => s.id === 'revision_form') : data;
      if (config && config.categories) {
        setFormConfig(config.categories);
      } else {
        console.error("Configuración no encontrada en settings:", data);
      }
    } catch (e) { 
      console.error("Error al cargar configuración:", e);
    }
  };

  const saveConfig = async (newConfig) => {
    try {
      await fetch(`${API_URL}/settings/revision_form`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categories: newConfig })
      });
      setFormConfig(newConfig);
      setFormStatus({ text: 'Configuración guardada exitosamente', type: 'success' });
      setTimeout(() => setFormStatus({ text: '', type: '' }), 3000);
    } catch (e) { 
      setFormStatus({ text: 'Error al guardar la configuración', type: 'error' });
    }
  };

  useEffect(() => { fetchOrders(); fetchExpenses(); fetchTodos(); fetchConfig(); }, []);

  const deleteOrder = (id) => {
    setOrderToDelete(id);
  };

  const confirmDeleteOrder = async () => {
    if (!orderToDelete) return;
    try {
      await fetch(`${API_URL}/orders/${orderToDelete}`, { method: 'DELETE' });
      setOrderToDelete(null);
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
      setExpenseForm({ fecha: new Date().toISOString().split('T')[0], concepto: '', monto: '', metodoPago: 'Efectivo' });
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
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Taller Automotriz</div>
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

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '1.5rem 1.5rem 4rem' }}>
        {/* Stats row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.75rem' }}>
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
            <div className="label">Ganancia Neta</div>
            <div className="value" style={{ color: '#10b981' }}>${fmt(stats.total - expenses.reduce((acc, g) => acc + (parseFloat(g.monto) || 0), 0))}</div>
            <div className="sub">Facturado - Gastos</div>
          </div>
        </div>

        {/* Compact To-Do List Row */}
        <div className="card" style={{ padding: '1rem 1.5rem', marginBottom: '1.75rem', display: 'flex', alignItems: 'center', gap: '2rem', overflow: 'hidden' }}>
          <div style={{ flexShrink: 0, minWidth: 220 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <PlusCircle size={16} color="var(--primary)" />
              <h2 style={{ fontSize: '1rem', fontWeight: 800 }}>Tareas Pendientes</h2>
            </div>
            <form onSubmit={addTodo} style={{ display: 'flex', gap: '0.4rem' }}>
              <input type="text" placeholder="Nueva tarea..." value={newTodo} onChange={e => setNewTodo(e.target.value)} style={{ flex: 1, fontSize: '0.9rem', padding: '0.4rem 0.6rem' }} />
              <button type="submit" className="btn-primary" style={{ padding: '0.4rem' }}><PlusCircle size={16} /></button>
            </form>
          </div>
          
          <div style={{ display: 'flex', gap: '0.75rem', overflowX: 'auto', paddingBottom: '0.25rem', flex: 1, scrollbarWidth: 'none' }}>
            {todos.filter(t => !t.completed).length === 0 && (
              <span style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>No hay pendientes importantes hoy.</span>
            )}
            {todos.filter(t => !t.completed).map(t => (
              <div key={t.id} style={{ flexShrink: 0, padding: '0.5rem 0.85rem', background: 'var(--bg)', borderRadius: 10, display: 'flex', alignItems: 'center', gap: '0.6rem', border: '1px solid var(--border)', transition: 'all 0.2s' }}>
                <input type="checkbox" checked={t.completed} onChange={() => toggleTodo(t)} style={{ cursor: 'pointer' }} />
                <span style={{ fontSize: '0.92rem', fontWeight: 500, whiteSpace: 'nowrap' }}>{t.text}</span>
                <button onClick={() => deleteTodo(t.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: 0, opacity: 0.4 }}>
                  <X size={12} />
                </button>
              </div>
            ))}
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
                  style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', background: activeTab === t.id ? 'var(--primary)' : 'transparent', color: activeTab === t.id ? 'white' : 'var(--text-muted)', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontWeight: 600, fontSize: '1rem', transition: 'all 0.2s', whiteSpace: 'nowrap' }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'Kanban' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
                {COLUMNS.map(col => (
                  <div key={col} className="kanban-column">
                    <div className="kanban-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', background: colColor[col], display: 'inline-block' }}></span>
                        <span style={{ fontWeight: 600, fontSize: '1rem' }}>{col}</span>
                      </div>
                      <span style={{ background: colBg[col], color: colColor[col], borderRadius: 999, padding: '0.15rem 0.6rem', fontSize: '0.85rem', fontWeight: 700 }}>
                        {orders.filter(o => o.estado === col).length}
                      </span>
                    </div>

                    {orders.filter(o => o.estado === col).map(o => (
                      <div key={o.id} className="kanban-card" onClick={() => setSelectedOrder(o)}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.5rem' }}>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              <div style={{ fontWeight: 700, fontSize: '1rem' }}>{o.placa}</div>
                              {o.quotes?.some(q => q.autorizada) && (
                                <span title="Trabajo Autorizado" style={{ color: '#10b981', display: 'flex' }}><CheckCircle size={14} /></span>
                              )}
                            </div>
                            <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>{o.marca} {o.modelo}</div>
                            {getPicoYPlaca(o.placa) && (
                              <div style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 800, marginTop: '0.2rem', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                <AlertTriangle size={10} /> {getPicoYPlaca(o.placa)}
                              </div>
                            )}
                          </div>
                          <span style={{ fontSize: '0.82rem', background: o.reports?.length > 0 ? 'rgba(16,185,129,0.15)' : 'rgba(245,158,11,0.15)', color: o.reports?.length > 0 ? '#34d399' : '#fbbf24', padding: '0.2rem 0.5rem', borderRadius: 999, fontWeight: 600, whiteSpace: 'nowrap' }}>
                            {o.reports?.length > 0 ? '✓ Revisado' : '⏳ Pdte'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{o.cliente}</span>
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            <select
                              value={o.estado}
                              onClick={e => e.stopPropagation()}
                              onChange={e => { e.stopPropagation(); moveOrder(o.id, e.target.value); }}
                              style={{ fontSize: '0.85rem', padding: '0.2rem 0.4rem', width: 'auto', borderRadius: 6 }}>
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
                      <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--text-muted)', fontSize: '0.92rem' }}>Sin órdenes</div>
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
                      <th>Método Pago</th>
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
                        <td><span className="badge badge-blue" style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--primary)', border: 'none' }}>{o.metodoPago || 'Efectivo'}</span></td>
                        <td>
                          <div style={{ display: 'flex', gap: '0.5rem' }}>
                            <button className="btn-secondary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.9rem' }} onClick={() => setSelectedOrder(o)}>Ver Detalle</button>
                            <button className="btn-secondary" style={{ padding: '0.4rem 0.6rem', fontSize: '0.9rem', color: 'var(--error)' }} onClick={() => deleteOrder(o.id)}><Trash2 size={14} /></button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'Formulario' && (
              <div className="card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
                  <div>
                    <h2 style={{ fontSize: '1.4rem', fontWeight: 800 }}>Configuración del Formulario</h2>
                    <p style={{ color: 'var(--text-muted)' }}>Edita las categorías e ítems que aparecen en la revisión preventiva para los técnicos</p>
                  </div>
                  <button className="btn-primary" onClick={() => saveConfig(formConfig)} style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    <Save size={18} /> Guardar Cambios
                  </button>
                </div>

                {formStatus.text && <div className={`toast toast-${formStatus.type}`} style={{ marginBottom: '1.5rem' }}>{formStatus.text}</div>}

                {!formConfig ? (
                  <div style={{ textAlign: 'center', padding: '3rem' }}>Cargando configuración...</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                    {Object.entries(formConfig).map(([cat, items]) => (
                      <div key={cat} className="card" style={{ padding: '1.25rem', border: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem' }}>
                          <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--primary)', textTransform: 'uppercase' }}>{cat}</h3>
                          <button onClick={() => {
                            if(window.confirm(`¿Eliminar la categoría "${cat}" y todos sus ítems?`)) {
                              const newCfg = { ...formConfig };
                              delete newCfg[cat];
                              setFormConfig(newCfg);
                            }
                          }} style={{ color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer' }} title="Eliminar categoría">
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                          {items.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.4rem 0.6rem', background: 'rgba(255,255,255,0.03)', borderRadius: 6 }}>
                              <span style={{ fontSize: '1rem' }}>{item}</span>
                              <button onClick={() => {
                                const newItems = items.filter((_, i) => i !== idx);
                                setFormConfig({ ...formConfig, [cat]: newItems });
                              }} style={{ opacity: 0.5, border: 'none', background: 'none', cursor: 'pointer', color: 'var(--text)' }}>
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                            <input 
                              type="text" 
                              placeholder="Nuevo ítem..." 
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  const val = e.target.value.trim();
                                  if (val) {
                                    setFormConfig({ ...formConfig, [cat]: [...items, val] });
                                    e.target.value = '';
                                  }
                                }
                              }}
                              style={{ flex: 1, fontSize: '0.9rem', padding: '0.4rem' }} 
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    <div className="card" style={{ padding: '1.25rem', border: '2px dashed var(--border)', background: 'transparent', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '1rem' }}>
                      <h3 style={{ fontSize: '1.1rem', fontWeight: 800, textAlign: 'center', color: 'var(--text-muted)' }}>Nueva Categoría</h3>
                      <input 
                        type="text" 
                        placeholder="Ej: Iluminación o Interiores" 
                        value={newCategoryName}
                        onChange={e => setNewCategoryName(e.target.value)}
                        style={{ padding: '0.6rem' }}
                      />
                      <button className="btn-secondary" style={{ fontWeight: 700 }} onClick={() => {
                        if (newCategoryName.trim()) {
                          setFormConfig({ ...formConfig, [newCategoryName.trim()]: [] });
                          setNewCategoryName('');
                        }
                      }}>Añadir Categoría</button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'Gastos' && (
              <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: '1.5rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div className="card" style={{ padding: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', fontWeight: 700 }}>Registrar Gasto</h2>
                    <form onSubmit={handleExpenseSubmit}>
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Fecha</label>
                        <input type="date" required value={expenseForm.fecha} onChange={e => setExpenseForm({...expenseForm, fecha: e.target.value})} style={{ width: '100%' }} />
                      </div>
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Concepto</label>
                        <input type="text" required placeholder="Ej. Compra de repuestos" value={expenseForm.concepto} onChange={e => setExpenseForm({...expenseForm, concepto: e.target.value})} style={{ width: '100%' }} />
                      </div>
                      <div style={{ marginBottom: '1rem' }}>
                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Monto ($)</label>
                        <input type="number" required placeholder="0" value={expenseForm.monto} onChange={e => setExpenseForm({...expenseForm, monto: e.target.value})} style={{ width: '100%' }} />
                      </div>
                      <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Método de Pago</label>
                        <select value={expenseForm.metodoPago} onChange={e => setExpenseForm({...expenseForm, metodoPago: e.target.value})} style={{ width: '100%' }}>
                          {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                        </select>
                      </div>
                      <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Guardar Gasto</button>
                    </form>
                  </div>

                  <div className="card" style={{ padding: '1.5rem' }}>
                    <h2 style={{ fontSize: '1.1rem', marginBottom: '1rem', fontWeight: 700 }}>Balance por Cuenta</h2>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      {PAYMENT_METHODS.map(m => {
                        const balance = balancesByMethod[m] || 0;
                        return (
                          <div key={m} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.8rem', background: 'var(--bg)', borderRadius: 'var(--radius-sm)', borderLeft: `4px solid ${balance >= 0 ? 'var(--success)' : 'var(--error)'}` }}>
                            <span style={{ fontSize: '0.9rem', fontWeight: 700 }}>{m}</span>
                            <span style={{ fontSize: '1rem', fontWeight: 800, color: balance >= 0 ? 'var(--success)' : 'var(--error)' }}>${fmt(balance)}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="card" style={{ padding: '1.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Historial de Gastos</h2>
                    <div style={{ fontWeight: 700, color: 'var(--error)' }}>Total: ${fmt(expenses.reduce((acc, g) => acc + (parseFloat(g.monto) || 0), 0))}</div>
                  </div>
                  <table className="data-table">
                    <thead>
                      <tr><th>Fecha</th><th>Concepto</th><th>Método</th><th style={{ textAlign: 'right' }}>Monto</th></tr>
                    </thead>
                    <tbody>
                      {expenses.length === 0 && (<tr><td colSpan="4" style={{ textAlign: 'center', color: 'var(--text-muted)' }}>No hay gastos.</td></tr>)}
                      {expenses.map(g => (
                        <tr key={g.id}>
                          <td>{new Date(g.fecha).toLocaleDateString('es-CO')}</td>
                          <td>{g.concepto}</td>
                          <td><span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>{g.metodoPago}</span></td>
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
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.5rem' }}>Crea una orden rápida para cotizar o facturar inmediatamente.</p>
                </div>
                <form onSubmit={handleQuickOrder}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Placa</label>
                      <input required placeholder="AAA123" value={quickOrderForm.placa} onChange={e => setQuickOrderForm({...quickOrderForm, placa: e.target.value.toUpperCase()})} style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Cliente</label>
                      <input required placeholder="Nombre" value={quickOrderForm.cliente} onChange={e => setQuickOrderForm({...quickOrderForm, cliente: e.target.value})} style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Marca</label>
                      <input required placeholder="Ej. Toyota" value={quickOrderForm.marca} onChange={e => setQuickOrderForm({...quickOrderForm, marca: e.target.value})} style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Modelo / Año</label>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <input required placeholder="Corolla" value={quickOrderForm.modelo} onChange={e => setQuickOrderForm({...quickOrderForm, modelo: e.target.value})} style={{ flex: 2 }} />
                        <input placeholder="Año" type="number" value={quickOrderForm.anio} onChange={e => setQuickOrderForm({...quickOrderForm, anio: e.target.value})} style={{ flex: 1 }} />
                      </div>
                    </div>
                  </div>
                  <div style={{ marginBottom: '1.5rem' }}>
                    <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Servicios / Observaciones (opcional)</label>
                    <textarea placeholder="Detalle rápido de la revisión o servicio..." value={quickOrderForm.servicios} onChange={e => setQuickOrderForm({...quickOrderForm, servicios: e.target.value})} style={{ width: '100%', minHeight: 60 }}></textarea>
                  </div>
                  <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '1rem', fontSize: '1rem' }}>Crear y Facturar / Cotizar</button>
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
              <label style={{ display: 'block', border: '2px dashed var(--border)', borderRadius: 'var(--radius-sm)', padding: '1rem', textAlign: 'center', cursor: 'pointer', marginBottom: '0.75rem', color: 'var(--text-muted)', fontSize: '0.95rem', transition: 'border-color 0.2s' }}>
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

      {/* Delete Confirmation Modal */}
      {orderToDelete && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 400, textAlign: 'center' }}>
            <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--error)', width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
              <Trash2 size={28} />
            </div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>¿Eliminar Orden?</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
              Esta acción eliminará la orden de servicio permanentemente. ¿Deseas continuar?
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setOrderToDelete(null)}>Cancelar</button>
              <button className="btn-primary" style={{ flex: 1, justifyContent: 'center', background: 'var(--error)', borderColor: 'var(--error)', color: 'white' }} onClick={confirmDeleteOrder}>Sí, Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
