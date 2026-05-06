import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowLeft, ChevronRight, Camera } from 'lucide-react';
import { API_URL } from '../api';

const fmt = (n) => (parseFloat(n) || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 });

const ESTADO_CONFIG = {
  'Recepción': { label: 'Recepción', color: '#818cf8', bg: 'rgba(99,102,241,0.12)', icon: '📋' },
  'Proceso':   { label: 'En Proceso', color: '#fbbf24', bg: 'rgba(245,158,11,0.12)', icon: '🔧' },
  'Calidad':   { label: 'Control de Calidad', color: '#34d399', bg: 'rgba(16,185,129,0.12)', icon: '✅' },
  'Entregado': { label: 'Entregado', color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', icon: '🏁' },
};

export default function ClientView() {
  const [placa, setPlaca] = useState('');
  const [orders, setOrders] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    document.body.setAttribute('data-theme', 'light');
  }, []);

  const searchOrders = async (e) => {
    e.preventDefault();
    if (!placa) return;
    setLoading(true); setError(''); setSelectedOrder(null);
    try {
      const res = await fetch(`${API_URL}/orders?placa=${placa.trim().toUpperCase()}&_embed=reports&_embed=quotes`);
      const data = await res.json();
      if (data.length > 0) {
        setOrders(data);
      } else {
        setError('No se encontraron órdenes para esta placa. Verifica e intenta de nuevo.');
        setOrders([]);
      }
    } catch {
      setError('Error al conectar. Intenta de nuevo en un momento.');
    } finally {
      setLoading(false);
    }
  };

  const stateColor = { Bueno: '#34d399', Regular: '#fbbf24', Malo: '#f87171' };

  // ── Vista de búsqueda (sin resultados aún)
  if (orders.length === 0) {
    return (
      <div className="login-page">
        <div style={{ width: '100%', maxWidth: 500, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '2.5rem', boxShadow: 'var(--shadow-lg)' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔍</div>
            <h1 style={{ fontWeight: 800, fontSize: '1.5rem', marginBottom: '0.25rem' }}>Consulta tu Vehículo</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Ingresa tu placa para ver el estado de tu orden de servicio</p>
          </div>

          <form onSubmit={searchOrders}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
              Número de Placa
            </label>
            <div style={{ position: 'relative', marginBottom: '1rem' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.9rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Ej. AAA123"
                value={placa}
                onChange={e => { setPlaca(e.target.value.toUpperCase()); setError(''); }}
                style={{ paddingLeft: '2.5rem', fontSize: '1.1rem', letterSpacing: '0.05em', fontWeight: 600, textTransform: 'uppercase' }}
                autoFocus
              />
            </div>
            {error && <div className="toast toast-error">{error}</div>}
            <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '0.85rem', fontSize: '1rem' }} disabled={loading}>
              {loading ? 'Buscando...' : 'Consultar Estado'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ── Vista de listado de tickets (sin orden seleccionada)
  if (!selectedOrder) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '1.5rem' }}>
        <div style={{ maxWidth: 700, margin: '0 auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <button onClick={() => setOrders([])} className="btn-secondary">
              <ArrowLeft size={16} /> Buscar otra placa
            </button>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
            <div style={{ fontWeight: 800, fontSize: '2rem', letterSpacing: '0.05em' }}>{placa}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {orders.length} orden{orders.length !== 1 ? 'es' : ''} encontrada{orders.length !== 1 ? 's' : ''}
            </div>
          </div>

          <div style={{ display: 'grid', gap: '0.85rem' }}>
            {orders.map(o => {
              const cfg = ESTADO_CONFIG[o.estado] || ESTADO_CONFIG['Recepción'];
              const fecha = o.fecha ? new Date(o.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
              const hasQuote = o.quotes?.length > 0 && o.quotes[0].items?.length > 0;
              return (
                <div key={o.id}
                  onClick={() => setSelectedOrder(o)}
                  style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem 1.5rem', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '1rem' }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
                >
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: cfg.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.4rem', flexShrink: 0 }}>
                    {cfg.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                      <span style={{ fontWeight: 700, fontSize: '1rem' }}>{o.marca} {o.modelo} {o.anio}</span>
                      <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 999, padding: '0.15rem 0.65rem', fontSize: '0.72rem', fontWeight: 700 }}>{cfg.label}</span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                      Ingreso: {fecha} · {o.servicios ? (o.servicios.length > 55 ? o.servicios.slice(0,55)+'...' : o.servicios) : 'Sin descripción'}
                    </div>
                  </div>
                  <ChevronRight size={18} color="var(--text-muted)" style={{ flexShrink: 0 }} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Vista detalle de la orden seleccionada
  const order = selectedOrder;
  const report = order?.reports?.[0];
  const quote  = order?.quotes?.[0];
  const totals = quote?.items?.reduce((acc, it) => {
    const lt = it.precio * it.cantidad;
    acc.sub += lt;
    if (it.aplicaIva) acc.iva += lt * 0.19;
    return acc;
  }, { sub: 0, iva: 0 }) || { sub: 0, iva: 0 };

  const cfg = ESTADO_CONFIG[order.estado] || ESTADO_CONFIG['Recepción'];

  return (<>
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '1.5rem' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <button onClick={() => setSelectedOrder(null)} className="btn-secondary">
            <ArrowLeft size={16} /> Ver todas las órdenes
          </button>
        </div>

        {/* Header ticket */}
        <div className="card" style={{ marginBottom: '1rem', background: `linear-gradient(135deg, ${cfg.bg}, transparent)`, border: `1px solid ${cfg.color}40` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.6rem', letterSpacing: '0.03em' }}>{order.placa}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{order.marca} {order.modelo} {order.anio}</div>
            </div>
            <span style={{ background: cfg.bg, color: cfg.color, borderRadius: 999, padding: '0.3rem 1rem', fontSize: '0.82rem', fontWeight: 700 }}>
              {cfg.icon} {cfg.label}
            </span>
          </div>
        </div>

        {/* Fotos de recepción */}
        {order.fotos?.length > 0 && (
          <div className="card">
            <p className="section-title"><Camera size={12} style={{ display: 'inline', marginRight: 4 }} />Fotos de Recepción</p>
            <div className="img-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))' }}>
              {order.fotos.map((src, i) => (
                <img key={i} src={src} className="img-thumb" alt={`foto-${i}`}
                  onClick={() => setLightboxSrc(src)}
                  title="Clic para ver en grande" />
              ))}
            </div>
          </div>
        )}

        {/* Order info */}
        <div className="card">
          <p className="section-title">Tu Orden de Servicio</p>
          <div className="info-grid">
            {[
              ['Placa', order.placa],
              ['Fecha Ingreso', order.fecha ? new Date(order.fecha).toLocaleDateString('es-CO') : 'N/A'],
              ['Kilometraje', order.kilometraje ? `${fmt(order.kilometraje)} km` : 'N/A'],
              ['Estado Actual', order.estado],
            ].map(([l,v]) => (
              <div key={l} className="info-item">
                <div className="info-label">{l}</div>
                <div className="info-value">{v}</div>
              </div>
            ))}
            {order.servicios && (
              <div className="info-item" style={{ gridColumn: '1 / -1' }}>
                <div className="info-label">Servicios Solicitados</div>
                <div className="info-value">{order.servicios}</div>
              </div>
            )}
          </div>
        </div>

        {/* Report (no prices) */}
        {report && (
          <div className="card">
            <p className="section-title">Reporte de Inspección</p>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Diagnóstico general de tu vehículo (sin incluir precios)</p>
            {report.items?.filter(it => it.state !== 'Bueno').length > 0 ? (
              <div style={{ display: 'grid', gap: '0.4rem' }}>
                {report.items.filter(it => it.state !== 'Bueno').map((it, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.03)', borderRadius: 8 }}>
                    <div>
                      <span style={{ fontWeight: 500, fontSize: '0.9rem' }}>{it.item}</span>
                      <span style={{ marginLeft: '0.5rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>{it.category}</span>
                    </div>
                    <span style={{ color: stateColor[it.state], fontWeight: 600, fontSize: '0.82rem' }}>{it.state}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p style={{ color: 'var(--success)', fontSize: '0.9rem' }}>✓ Todo en buen estado según la revisión.</p>
            )}
            {report.scannerCodes?.filter(c => c.code).length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <p style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>CÓDIGOS DE ESCÁNER</p>
                {report.scannerCodes.filter(c => c.code).map((c, i) => (
                  <div key={i} style={{ display: 'flex', gap: '0.75rem', padding: '0.4rem 0.75rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6, marginBottom: '0.4rem' }}>
                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#f87171' }}>{c.prefix}{c.code}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{c.description}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Cotización / Precios */}
        {quote?.items?.length > 0 && (
          <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
            <div style={{ padding: '1.5rem 1.5rem 0.5rem 1.5rem' }}>
              <p className="section-title" style={{ marginBottom: '0.5rem' }}>Cotización de Servicios</p>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Detalle de repuestos y mano de obra autorizados</p>
            </div>
            
            <table className="data-table" style={{ margin: 0 }}>
              <thead style={{ background: 'rgba(99,102,241,0.05)' }}>
                <tr>
                  <th style={{ padding: '1rem 1.5rem', color: 'var(--primary)', fontSize: '0.75rem' }}>DESCRIPCIÓN</th>
                  <th style={{ padding: '1rem 1.5rem', textAlign: 'center', color: 'var(--primary)', fontSize: '0.75rem', width: '80px' }}>CANT.</th>
                  <th style={{ padding: '1rem 1.5rem', textAlign: 'right', color: 'var(--primary)', fontSize: '0.75rem', width: '120px' }}>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {quote.items.map((it, i) => {
                  const lt = it.precio * it.cantidad;
                  const t = it.aplicaIva ? lt * 1.19 : lt;
                  return (
                    <tr key={i}>
                      <td style={{ padding: '1rem 1.5rem', fontSize: '0.95rem', fontWeight: 500 }}>{it.descripcion || '—'}</td>
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{it.cantidad}</td>
                      <td style={{ padding: '1rem 1.5rem', textAlign: 'right', fontWeight: 700, fontSize: '1rem' }}>${fmt(t)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div style={{ padding: '2rem 1.5rem', background: 'rgba(0,0,0,0.02)', borderTop: '1px solid var(--border)' }}>
              <div style={{ maxWidth: 320, marginLeft: 'auto' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.6rem', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>Subtotal</span>
                  <span style={{ fontWeight: 600 }}>${fmt(totals.sub)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>IVA (19%)</span>
                  <span style={{ fontWeight: 600 }}>${fmt(totals.iva)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 0 0 0', borderTop: '2px solid var(--primary)' }}>
                  <span style={{ fontWeight: 800, fontSize: '1.2rem', color: 'var(--text)' }}>TOTAL</span>
                  <span style={{ fontWeight: 900, fontSize: '1.6rem', color: 'var(--primary)' }}>${fmt(totals.sub + totals.iva)}</span>
                </div>
                <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', textAlign: 'right', marginTop: '1rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Valores expresados en Pesos Colombianos (COP)
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Lightbox */}
    {lightboxSrc && (
      <div className="lightbox-overlay" onClick={() => setLightboxSrc(null)}>
        <button onClick={() => setLightboxSrc(null)}
          style={{ position: 'fixed', top: '1rem', right: '1.5rem', background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%', width: 38, height: 38, cursor: 'pointer', color: 'white', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
          ×
        </button>
        <img src={lightboxSrc} alt="foto ampliada" onClick={e => e.stopPropagation()} />
      </div>
    )}
  </>);
}
