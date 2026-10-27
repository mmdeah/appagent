import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, RefreshCw, WifiOff } from 'lucide-react';
import { API_URL } from '../api';

// Página liviana para encontrar una orden por placa (o cliente) y abrir su
// detalle completo —reporte para imprimir, cotizaciones— sin cargar el Kanban.
// La búsqueda devuelve solo un resumen (sin fotos); el detalle se carga recién
// al elegir la orden (/orden/ID).
export default function BuscarOrdenView() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [q, setQ] = useState(params.get('q') || '');
  const [res, setRes] = useState(null); // null = aún no buscó
  const [estado, setEstado] = useState('idle'); // idle | buscando | error
  const genRef = useRef(0);

  const buscar = async (texto = q) => {
    const t = texto.trim();
    if (t.replace(/[^a-zA-Z0-9]/g, '').length < 2) return;
    const gen = ++genRef.current;
    setEstado('buscando');
    // Con internet lento un intento puede fallar: se reintenta solo unas veces.
    for (let n = 0; n <= 3; n++) {
      try {
        const r = await fetch(`${API_URL}/api/buscar-ordenes?q=${encodeURIComponent(t)}`);
        if (!r.ok) throw new Error('no ok');
        const data = await r.json();
        if (genRef.current !== gen) return;
        // Una sola coincidencia: se abre directo.
        if (data.length === 1) { navigate(`/orden/${data[0].id}`); return; }
        setRes(data);
        setEstado('idle');
        return;
      } catch {
        if (genRef.current !== gen) return;
        await new Promise(ok => setTimeout(ok, (n + 1) * 1500));
      }
    }
    if (genRef.current === gen) setEstado('error');
  };

  useEffect(() => { if (params.get('q')) buscar(params.get('q')); }, []);

  return (
    <div style={{ maxWidth: 560, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.3rem' }}>Buscar orden</h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
        Escribe la placa para abrir el detalle, el reporte y las cotizaciones.
      </p>
      <form onSubmit={e => { e.preventDefault(); buscar(); }} style={{ display: 'flex', gap: '0.5rem' }}>
        <input autoFocus value={q} onChange={e => setQ(e.target.value.toUpperCase())} placeholder="Placa (ej. ABC123)"
          style={{ flex: 1, fontSize: '1.2rem', fontWeight: 700, letterSpacing: '0.05em', padding: '0.7rem 0.9rem' }} />
        <button className="btn-primary" type="submit" disabled={estado === 'buscando'} style={{ padding: '0 1.1rem' }}>
          {estado === 'buscando' ? <RefreshCw size={18} className="spin" /> : <Search size={18} />}
        </button>
      </form>

      {estado === 'error' && (
        <div className="card" style={{ marginTop: '1rem', textAlign: 'center', padding: '1.5rem' }}>
          <WifiOff size={24} color="var(--error)" style={{ marginBottom: '0.5rem' }} />
          <div style={{ fontWeight: 700, marginBottom: '0.8rem' }}>No hay conexión con el servidor</div>
          <button className="btn-primary" onClick={() => buscar()} style={{ margin: '0 auto' }}><RefreshCw size={16} /> Reintentar</button>
        </div>
      )}

      {estado !== 'error' && res && res.length === 0 && (
        <div className="card" style={{ marginTop: '1rem', textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
          No hay órdenes con "{q}".
        </div>
      )}

      {estado !== 'error' && res && res.length > 1 && (
        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {res.map(o => (
            <button key={o.id} className="card" onClick={() => navigate(`/orden/${o.id}`)}
              style={{ textAlign: 'left', padding: '0.8rem 1rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
              <span>
                <span style={{ fontWeight: 800, fontSize: '1.1rem' }}>{o.placa || 'SIN PLACA'}</span>
                <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {[o.marca, o.modelo, o.anio].filter(Boolean).join(' ')} · {o.cliente}
                </span>
              </span>
              <span style={{ textAlign: 'right', fontSize: '0.78rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                {o.estado}{o.conReporte ? ' · con reporte' : ''}
                {o.fecha ? <span style={{ display: 'block' }}>{new Date(o.fecha).toLocaleDateString('es-CO')}</span> : null}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
