import React from 'react';
import { API_URL } from '../api';
import { MessageCircle, X } from 'lucide-react';
import { SERVICIOS } from './CitaModal';

const HOUR = 3600000;

// Limpia el teléfono y antepone el indicativo de Colombia solo si hace falta.
// Helper nuevo y local a este módulo — no toca los demás usos de wa.me en la app.
const buildWhatsAppLink = (telefono, mensaje) => {
  const digits = (telefono || '').replace(/\D/g, '');
  const withCountry = digits.length === 10 ? `57${digits}` : digits;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(mensaje)}`;
};

const mensajeRecordatorio = (c) =>
  `Hola ${c.nombre}! Te recordamos tu cita de ${SERVICIOS[c.servicio]?.label || c.servicio} para el vehículo ${c.vehiculo} (placa ${c.placa}) el ${c.fecha} a las ${c.hora}. Cualquier cambio avísanos, ¡te esperamos!`;

/**
 * Modal con los recordatorios de WhatsApp pendientes de enviar, agrupados por
 * cercanía a la hora de la cita (48h / 24h / menos de 12h). El envío es manual:
 * cada botón abre un enlace wa.me ya redactado y el admin confirma el envío
 * dentro de WhatsApp.
 * Props:
 *  - citas: array de citas ya cargado por AdminView
 *  - onClose: () => void
 *  - onRefresh: () => void  (recargar citas tras marcar un recordatorio enviado)
 */
export default function RecordatoriosModal({ citas, onClose, onRefresh }) {
  const now = new Date();
  const remainingMs = (c) => new Date(`${c.fecha}T${c.hora}:00`) - now;
  const bucket = (lo, hi, flag) => citas.filter(c => {
    const r = remainingMs(c);
    return r > lo && r <= hi && !(c.recordatorios && c.recordatorios[flag]);
  });

  const grupos = [
    { flag: 'h48', titulo: 'En 48 horas', items: bucket(24 * HOUR, 48 * HOUR, 'h48') },
    { flag: 'h24', titulo: 'En 24 horas', items: bucket(12 * HOUR, 24 * HOUR, 'h24') },
    { flag: 'h12', titulo: 'Menos de 12 horas', items: bucket(0, 12 * HOUR, 'h12') },
  ];
  const totalPendientes = grupos.reduce((sum, g) => sum + g.items.length, 0);

  const markSent = async (cita, flag) => {
    try {
      // PATCH es un merge superficial: hay que mandar el objeto "recordatorios"
      // completo o se borran los flags de los otros recordatorios ya enviados.
      await fetch(`${API_URL}/citas/${cita.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordatorios: { ...(cita.recordatorios || { h48: false, h24: false, h12: false }), [flag]: true } })
      });
      onRefresh?.();
    } catch { /* el enlace de WhatsApp ya se abrió; un fallo aquí solo implica que se podrá reenviar */ }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 560 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#10b981,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <MessageCircle size={17} color="white" />
            </div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>Recordatorios de Citas</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {totalPendientes === 0 ? (
          <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>No hay recordatorios pendientes por ahora.</p>
        ) : grupos.map(g => g.items.length > 0 && (
          <div key={g.flag} style={{ marginBottom: '1.25rem' }}>
            <p className="section-title">{g.titulo} ({g.items.length})</p>
            {g.items.map(c => (
              <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '0.6rem 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                  <div style={{ fontWeight: 600 }}>{c.nombre} — {c.placa}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {c.hora} · <span className={`badge ${SERVICIOS[c.servicio]?.badgeClass || ''}`}>{SERVICIOS[c.servicio]?.label || c.servicio}</span>
                  </div>
                </div>
                <a href={buildWhatsAppLink(c.telefono, mensajeRecordatorio(c))}
                   target="_blank" rel="noreferrer"
                   className="btn-success" style={{ textDecoration: 'none', padding: '0.5rem 0.85rem', whiteSpace: 'nowrap' }}
                   onClick={() => markSent(c, g.flag)}>
                  <MessageCircle size={14} /> Enviar
                </a>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
