import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowLeft } from 'lucide-react';
import { API_URL } from '../api';

const fmt = (n) => (parseFloat(n) || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 });

export default function ClientView() {
  const [placa, setPlaca] = useState('');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const searchOrder = async (e) => {
    e.preventDefault();
    if (!placa) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_URL}/orders?placa=${placa.trim().toUpperCase()}&_embed=reports&_embed=quotes`);
      const data = await res.json();
      if (data.length > 0) {
        setOrder(data[0]);
      } else {
        setError('No se encontró una orden para esta placa. Verifica e intenta de nuevo.');
        setOrder(null);
      }
    } catch {
      setError('Error al conectar. Intenta de nuevo en un momento.');
    } finally {
      setLoading(false);
    }
  };

  const stateColor = { Bueno: '#34d399', Regular: '#fbbf24', Malo: '#f87171' };
  const statusBadge = (s) => {
    const m = { 'Recepción': 'badge-blue', 'Proceso': 'badge-yellow', 'Calidad': 'badge-green', 'Entregado': 'badge-red' };
    return <span className={`badge ${m[s] || 'badge-blue'}`}>{s}</span>;
  };

  const report = order?.reports?.[0];
  const quote  = order?.quotes?.[0];

  const totals = quote?.items?.reduce((acc, it) => {
    const lt = it.precio * it.cantidad;
    acc.sub += lt;
    if (it.aplicaIva) acc.iva += lt * 0.19;
    return acc;
  }, { sub: 0, iva: 0 }) || { sub: 0, iva: 0 };

  if (!order) {
    return (
      <div className="login-page">
        <div style={{ width: '100%', maxWidth: 500, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '2.5rem', boxShadow: 'var(--shadow-lg)' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔍</div>
            <h1 style={{ fontWeight: 800, fontSize: '1.5rem', marginBottom: '0.25rem' }}>Consulta tu Vehículo</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Ingresa tu placa para ver el estado de tu orden de servicio</p>
          </div>

          <form onSubmit={searchOrder}>
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

          <p style={{ textAlign: 'center', marginTop: '1.25rem' }}>
            <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
              <ArrowLeft size={14} /> Volver al inicio
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', padding: '1.5rem' }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <button onClick={() => setOrder(null)} className="btn-secondary" style={{ marginBottom: '1.5rem' }}>
          <ArrowLeft size={16} /> Buscar otra placa
        </button>

        {/* Header card */}
        <div className="card" style={{ marginBottom: '1rem', background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(79,70,229,0.08))', border: '1px solid rgba(99,102,241,0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.6rem', letterSpacing: '0.03em' }}>{order.placa}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{order.marca} {order.modelo} {order.anio}</div>
            </div>
            {statusBadge(order.estado)}
          </div>
        </div>

        {/* Service info */}
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

        {/* Quote */}
        {quote?.items?.length > 0 && (
          <div className="card">
            <p className="section-title">Cotización de Servicios</p>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Servicio / Repuesto</th>
                  <th style={{ textAlign: 'center' }}>Cant.</th>
                  <th style={{ textAlign: 'right' }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {quote.items.map((it, i) => {
                  const lt = it.precio * it.cantidad;
                  const t = it.aplicaIva ? lt * 1.19 : lt;
                  return (
                    <tr key={i}>
                      <td>{it.descripcion || '—'}</td>
                      <td style={{ textAlign: 'center' }}>{it.cantidad}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }} className="price">${fmt(t)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <div style={{ width: 260, background: 'rgba(255,255,255,0.03)', borderRadius: 10, padding: '1rem', border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                  <span>Subtotal</span><span>${fmt(totals.sub)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                  <span>IVA</span><span>${fmt(totals.iva)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.1rem', color: 'var(--success)', borderTop: '1px solid var(--border)', paddingTop: '0.6rem' }}>
                  <span>TOTAL</span><span>${fmt(totals.sub + totals.iva)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
