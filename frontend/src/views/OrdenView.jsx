import React, { useState, useEffect, useRef } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { RefreshCw, WifiOff } from 'lucide-react';
import { API_URL } from '../api';
import OrderDetailsModal from './OrderDetailsModal';

// Enlace directo a una sola orden: /orden/123 (abre en "Reporte Técnico") o
// /orden/123?tab=info|cotizacion|pdfs. Carga SOLO esa orden en vez de toda la
// lista del Kanban (con todas sus fotos), así sirve con internet lento. Si la
// conexión falla reintenta sola unas veces y luego ofrece reintentar a mano.
const TABS = ['info', 'reporte', 'cotizacion', 'pdfs'];
const MAX_RETRIES = 4;

export default function OrdenView() {
  const { id } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const tab = TABS.includes(search.get('tab')) ? search.get('tab') : 'reporte';

  const [order, setOrder] = useState(null);
  const [estado, setEstado] = useState('cargando'); // cargando | error | noexiste
  const [intento, setIntento] = useState(0);
  const [fotos, setFotos] = useState(null); // null = aún cargando
  const [fotosError, setFotosError] = useState(false);
  const genRef = useRef(0);

  // Las fotos pesan MB: se piden aparte, después de mostrar el reporte.
  const cargarFotos = async (gen) => {
    for (let n = 0; n <= 4; n++) {
      try {
        const r = await fetch(`${API_URL}/api/orders/${encodeURIComponent(id)}/fotos`);
        if (!r.ok) throw new Error('no ok');
        const f = await r.json();
        if (genRef.current !== gen) return;
        setFotos(Array.isArray(f) ? f : []);
        return;
      } catch {
        if (genRef.current !== gen) return;
        await new Promise(ok => setTimeout(ok, (n + 1) * 3000));
      }
    }
    if (genRef.current === gen) setFotosError(true);
  };

  const cargar = () => {
    const gen = ++genRef.current;
    setOrder(null);
    setFotos(null);
    setFotosError(false);
    setEstado('cargando');
    setIntento(0);
    const probar = (n) => {
      fetch(`${API_URL}/api/orders/${encodeURIComponent(id)}/ligero`)
        .then(res => {
          if (res.status === 404) { if (genRef.current === gen) setEstado('noexiste'); return null; }
          if (!res.ok) throw new Error('respuesta no OK');
          return res.json();
        })
        .then(data => {
          if (!data || genRef.current !== gen) return;
          setOrder(data);
          cargarFotos(gen);
        })
        .catch(() => {
          if (genRef.current !== gen) return;
          if (n < MAX_RETRIES) {
            setIntento(n + 1);
            setTimeout(() => { if (genRef.current === gen) probar(n + 1); }, (n + 1) * 2500);
          } else {
            setEstado('error');
          }
        });
    };
    probar(0);
  };

  useEffect(() => { cargar(); }, [id]);

  if (order) {
    return (
      <>
        {fotosError && (
          <div className="toast toast-error" style={{ position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 2000 }}>
            No se pudieron cargar las fotos. <button onClick={() => { setFotosError(false); cargarFotos(genRef.current); }} style={{ marginLeft: 8, textDecoration: 'underline', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>Reintentar</button>
          </div>
        )}
        <OrderDetailsModal order={order} initialTab={tab} onClose={() => navigate('/buscar')}
          fotosCargando={fotos === null} fotosExternas={fotos} />
      </>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
      <div className="card" style={{ textAlign: 'center', padding: '2.5rem', maxWidth: 420, width: '100%' }}>
        {estado === 'cargando' && (
          <>
            <RefreshCw size={26} className="spin" style={{ marginBottom: '0.7rem' }} />
            <div style={{ fontWeight: 700 }}>Cargando orden {id}...{intento > 0 ? ` (reintento ${intento}/${MAX_RETRIES})` : ''}</div>
            {intento > 0 && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>La conexión está lenta, sigue intentando.</div>}
          </>
        )}
        {estado === 'error' && (
          <>
            <WifiOff size={28} color="var(--error)" style={{ marginBottom: '0.7rem' }} />
            <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>No se pudo cargar la orden</div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.2rem' }}>Revisa la conexión a internet e intenta de nuevo.</div>
            <button className="btn-primary" onClick={cargar} style={{ margin: '0 auto' }}><RefreshCw size={16} /> Reintentar</button>
          </>
        )}
        {estado === 'noexiste' && (
          <>
            <div style={{ fontWeight: 700, marginBottom: '0.4rem' }}>La orden {id} no existe</div>
            <button className="btn-secondary" onClick={() => navigate('/buscar')} style={{ margin: '0 auto' }}>Buscar otra orden</button>
          </>
        )}
      </div>
    </div>
  );
}
