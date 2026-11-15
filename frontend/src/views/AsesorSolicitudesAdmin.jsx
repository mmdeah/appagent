import React, { useState, useEffect, useCallback } from 'react';
import { Check, X, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react';
import { API_URL } from '../api';

// Pestaña del admin: solicitudes de cambio que envía el asesor de Ayvens. Nada
// llega a la orden hasta que se aprueba aquí; al aprobar se aplica el cambio al
// vehículo y a la cotización y queda guardada la versión aprobada.

const fmt = (n) => (parseFloat(n) || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 });
const money = (n) => `$${fmt(Math.abs(n))}`;
const CAMPOS = { placa: 'Placa', marca: 'Marca', modelo: 'Modelo', anio: 'Año', kilometraje: 'Kilometraje' };

const Delta = ({ valor }) => {
  if (!valor) return <span style={{ color: 'var(--text-muted)' }}>$0</span>;
  const sube = valor > 0;
  const Icono = sube ? TrendingUp : TrendingDown;
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 800, color: sube ? '#059669' : '#dc2626', whiteSpace: 'nowrap' }}><Icono size={14} /> {sube ? '+' : '−'}{money(valor)}</span>;
};

export default function AsesorSolicitudesAdmin({ onResuelta }) {
  const [lista, setLista] = useState(null);
  const [error, setError] = useState('');
  const [ocupada, setOcupada] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const r = await fetch(`${API_URL}/api/asesor/solicitudes`);
      if (!r.ok) throw new Error('no ok');
      setLista(await r.json());
    } catch { setError('No se pudieron cargar las solicitudes.'); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const resolver = async (s, accion) => {
    let nota = '';
    if (accion === 'rechazar') {
      nota = window.prompt('Motivo del rechazo (opcional, lo verá el asesor):', '') ?? null;
      if (nota === null) return;
    } else if (!window.confirm(`¿Aprobar los cambios de ${s.placa}? Se aplicarán a la orden y a la cotización.`)) return;
    setOcupada(s.id); setError('');
    try {
      const r = await fetch(`${API_URL}/api/asesor/solicitudes/${s.id}/${accion === 'aprobar' ? 'aprobar' : 'rechazar'}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nota })
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || 'No se pudo resolver la solicitud.'); return; }
      await cargar();
      onResuelta && onResuelta();
    } catch { setError('Error de conexión. Intenta de nuevo.'); }
    finally { setOcupada(null); }
  };

  if (lista === null) return <div style={{ color: 'var(--text-muted)', padding: '2rem', textAlign: 'center' }}>{error || 'Cargando solicitudes...'}</div>;
  const pendientes = lista.filter(s => s.estado === 'pendiente');
  const resueltas = lista.filter(s => s.estado !== 'pendiente').slice(0, 15);

  const detalle = (s) => (
    <div style={{ fontSize: '0.88rem' }}>
      {Object.entries(s.vehiculo || {}).map(([k, v]) => (
        <div key={k} style={{ padding: '0.25rem 0' }}><span style={{ color: 'var(--text-muted)' }}>{CAMPOS[k] || k}:</span> {v.antes || '—'} → <strong>{v.despues || '—'}</strong></div>
      ))}
      {(s.items || []).map((c, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.3rem 0', borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          <span>
            <span style={{ fontSize: '0.66rem', fontWeight: 700, marginRight: 6, color: c.tipo === 'nuevo' ? '#0ea5e9' : '#8b5cf6', background: c.tipo === 'nuevo' ? 'rgba(14,165,233,0.12)' : 'rgba(139,92,246,0.12)', padding: '0.05rem 0.45rem', borderRadius: 999 }}>{c.tipo === 'nuevo' ? 'NUEVO' : 'EDITADO'}</span>
            {c.descripcion}
            {c.tipo === 'editado' && c.antes && c.despues && c.antes.cantidad !== c.despues.cantidad && <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}> · cant. {c.antes.cantidad} → {c.despues.cantidad}</span>}
            {c.tipo === 'nuevo' && c.despues && <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}> · {c.despues.cantidad} × ${fmt(c.despues.precio)}</span>}
          </span>
          <span style={{ whiteSpace: 'nowrap' }}>{c.tipo === 'nuevo' ? '' : `${money(c.valorAntes)} → `}<strong>{money(c.valorDespues)}</strong> <Delta valor={c.delta} /></span>
        </div>
      ))}
    </div>
  );

  return (
    <div style={{ maxWidth: 900, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 800 }}>Solicitudes del asesor ({pendientes.length} por aprobar)</h2>
        <button className="btn-secondary" onClick={cargar} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.35rem 0.8rem', fontSize: '0.8rem' }}><RefreshCw size={13} /> Actualizar</button>
      </div>
      {error && <div className="toast toast-error">{error}</div>}

      {pendientes.length === 0 && <div className="card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>No hay solicitudes pendientes.</div>}
      {pendientes.map(s => (
        <div key={s.id} className="card" style={{ padding: '1.1rem 1.25rem', borderLeft: '4px solid #f59e0b' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.6rem' }}>
            <div>
              <span style={{ fontWeight: 900, letterSpacing: 1, fontSize: '1.1rem' }}>{s.placa}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.84rem', marginLeft: 10 }}>{s.asesor || 'Asesor'} · {new Date(s.creada).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}</span>
            </div>
            {(s.items || []).length > 0 && <div style={{ textAlign: 'right' }}><div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' }}>Cambio total</div><Delta valor={s.totalDelta} /></div>}
          </div>
          {detalle(s)}
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.9rem' }}>
            <button className="btn-primary" disabled={ocupada === s.id} onClick={() => resolver(s, 'aprobar')} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Check size={15} /> Aprobar</button>
            <button className="btn-secondary" disabled={ocupada === s.id} onClick={() => resolver(s, 'rechazar')} style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--error)' }}><X size={15} /> Rechazar</button>
          </div>
        </div>
      ))}

      {resueltas.length > 0 && (
        <>
          <h3 style={{ fontSize: '0.8rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '0.5rem' }}>Resueltas recientemente</h3>
          {resueltas.map(s => (
            <div key={s.id} className="card" style={{ padding: '0.9rem 1.25rem', opacity: 0.85 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                <span><strong style={{ letterSpacing: 1 }}>{s.placa}</strong> <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>· {new Date(s.resuelta || s.creada).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}</span></span>
                <span style={{ fontSize: '0.72rem', fontWeight: 800, color: s.estado === 'aprobada' ? '#059669' : '#dc2626', background: s.estado === 'aprobada' ? 'rgba(16,185,129,0.12)' : 'rgba(239,68,68,0.12)', padding: '0.15rem 0.6rem', borderRadius: 999 }}>{s.estado === 'aprobada' ? 'Aprobada' : 'Rechazada'}</span>
              </div>
              {detalle(s)}
              {s.notaAdmin && <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 4 }}>Nota: {s.notaAdmin}</div>}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
