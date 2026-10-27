import React, { useState, useEffect, useRef } from 'react';
import { API_URL } from '../api';
import OrderDetailsModal from './OrderDetailsModal';

// Abre el detalle de una orden que viene de la lista liviana del Kanban (sin
// fotos): el reporte, la cotización y los datos salen al instante y las fotos
// —que pesan MB— se piden al servidor aparte, solo de esta placa.
export default function OrderDetailsLoader({ order, ...props }) {
  const yaTrae = Array.isArray(order.fotos);
  const [fotos, setFotos] = useState(yaTrae ? order.fotos : null); // null = cargando
  const [error, setError] = useState(false);
  const [intento, setIntento] = useState(0);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    return () => { vivo.current = false; };
  }, []);

  useEffect(() => {
    if (yaTrae) return;
    let cancelado = false;
    (async () => {
      setError(false);
      for (let n = 0; n <= 4; n++) {
        try {
          const r = await fetch(`${API_URL}/api/orders/${encodeURIComponent(order.id)}/fotos`);
          if (!r.ok) throw new Error('no ok');
          const f = await r.json();
          if (!cancelado) setFotos(Array.isArray(f) ? f : []);
          return;
        } catch {
          if (cancelado) return;
          await new Promise(ok => setTimeout(ok, (n + 1) * 3000));
        }
      }
      if (!cancelado) setError(true);
    })();
    return () => { cancelado = true; };
  }, [order.id, intento]);

  return (
    <>
      {error && (
        <div className="toast toast-error" style={{ position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 2000 }}>
          No se pudieron cargar las fotos.
          <button onClick={() => setIntento(i => i + 1)} style={{ marginLeft: 8, textDecoration: 'underline', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>Reintentar</button>
        </div>
      )}
      <OrderDetailsModal order={order} {...props} fotosCargando={fotos === null} fotosExternas={fotos} />
    </>
  );
}
