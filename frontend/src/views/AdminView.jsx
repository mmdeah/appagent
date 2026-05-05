import React, { useState, useEffect, useContext } from 'react';
import { API_URL } from '../api';
import OrderDetailsModal from './OrderDetailsModal';
import PhotoUploadModal from './PhotoUploadModal';
import { ThemeContext } from '../App';
import { PlusCircle, BarChart3, Camera, X, Car } from 'lucide-react';

const fmt = (n) => (parseFloat(n) || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 });

const COLUMNS = ['Recepción', 'Proceso', 'Calidad'];

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
  const [formStatus, setFormStatus] = useState({ text: '', type: '' });

  const fetchOrders = async () => {
    try {
      const res = await fetch(`${API_URL}/orders?_embed=reports&_embed=quotes`);
      const data = await res.json();
      setOrders(data);
      let total = 0;
      data.forEach(o => o.quotes?.forEach(q => q.items?.forEach(it => {
        const sub = it.precio * it.cantidad;
        total += it.aplicaIva ? sub * 1.19 : sub;
      })));
      const active = data.filter(o => o.estado !== 'Entregado').length;
      setStats({ total, avg: active > 0 ? total / active : 0, active });
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchOrders(); }, []);

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

  const colColor = { 'Recepción': '#6366f1', 'Proceso': '#f59e0b', 'Calidad': '#10b981' };
  const colBg   = { 'Recepción': 'rgba(99,102,241,0.08)', 'Proceso': 'rgba(245,158,11,0.08)', 'Calidad': 'rgba(16,185,129,0.08)' };

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
            <div className="sub">Suma de todas las cotizaciones</div>
          </div>
          <div className="stat-card">
            <div className="label">Promedio por O.S.</div>
            <div className="value">${fmt(stats.avg)}</div>
            <div className="sub">Valor promedio por orden</div>
          </div>
        </div>

        {/* Kanban */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.25rem' }}>
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
                    <select
                      value={o.estado}
                      onClick={e => e.stopPropagation()}
                      onChange={e => { e.stopPropagation(); moveOrder(o.id, e.target.value); }}
                      style={{ fontSize: '0.75rem', padding: '0.2rem 0.4rem', width: 'auto', borderRadius: 6 }}>
                      {COLUMNS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
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
