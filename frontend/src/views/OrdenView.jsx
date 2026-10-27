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
  const genRef = useRef(0);

  const cargar = () => {
    const gen = ++genRef.current;
    setOrder(null);
    setEstado('cargando');
    setIntento(0);
    const probar = (n) => {
      fetch(`${API_URL}/orders/${encodeURIComponent(id)}?_embed=reports&_embed=quotes`)
        .then(res => {
          if (res.status === 404) { if (genRef.current === gen) setEstado('noexiste'); return null; }
          if (!res.ok) throw new Error('respuesta no OK');
          return res.json();
        })
        .then(data => {
          if (!data || genRef.current !== gen) return;
          setOrder(data);
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
    return <OrderDetailsModal order={order} initialTab={tab} onClose={() => navigate('/admin')} />;
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
            <button className="btn-secondary" onClick={() => navigate('/admin')} style={{ margin: '0 auto' }}>Ir al panel</button>
          </>
        )}
      </div>
    </div>
  );
}
