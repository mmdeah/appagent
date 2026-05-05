import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';
import { Camera, X, Upload, CheckCircle } from 'lucide-react';

/**
 * Modal flotante para subir una foto y asociarla a una orden activa.
 * Props:
 *  - onClose: () => void
 *  - onSuccess: () => void  (recargar lista de órdenes)
 */
export default function PhotoUploadModal({ onClose, onSuccess }) {
  const [activeOrders, setActiveOrders] = useState([]);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoB64, setPhotoB64] = useState(null);
  const [status, setStatus] = useState({ text: '', type: '' });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/orders`)
      .then(r => r.json())
      .then(data => {
        const activas = data.filter(o => o.estado !== 'Entregado');
        setActiveOrders(activas);
        if (activas.length > 0) setSelectedOrderId(String(activas[0].id));
      })
      .catch(() => {});
  }, []);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      setPhotoPreview(ev.target.result);
      setPhotoB64(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!photoB64 || !selectedOrderId) {
      setStatus({ text: 'Selecciona una foto y una orden', type: 'error' });
      return;
    }
    setUploading(true);
    try {
      // Obtener la orden actual
      const res = await fetch(`${API_URL}/orders/${selectedOrderId}`);
      const order = await res.json();
      const fotosActuales = order.fotos || [];

      await fetch(`${API_URL}/orders/${selectedOrderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fotos: [...fotosActuales, photoB64] })
      });

      setStatus({ text: '✓ Foto agregada exitosamente', type: 'success' });
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 1500);
    } catch {
      setStatus({ text: 'Error al subir la foto', type: 'error' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-box" style={{ maxWidth: 480 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Camera size={17} color="white" />
            </div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>Subir Foto al Vehículo</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {status.text && (
          <div className={`toast toast-${status.type}`} style={{ marginBottom: '1rem' }}>{status.text}</div>
        )}

        {/* Selección de orden */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
            ¿A qué vehículo corresponde?
          </label>
          {activeOrders.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No hay órdenes activas actualmente.</p>
          ) : (
            <select value={selectedOrderId} onChange={e => setSelectedOrderId(e.target.value)}>
              {activeOrders.map(o => (
                <option key={o.id} value={String(o.id)}>
                  {o.placa} — {o.marca} {o.modelo} ({o.cliente})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Zona de foto */}
        <div style={{ marginBottom: '1.25rem' }}>
          <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
            Foto
          </label>
          {photoPreview ? (
            <div style={{ position: 'relative' }}>
              <img src={photoPreview} alt="preview"
                style={{ width: '100%', maxHeight: 260, objectFit: 'cover', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }} />
              <button onClick={() => { setPhotoPreview(null); setPhotoB64(null); }}
                style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(0,0,0,0.6)', border: 'none', borderRadius: '50%', width: 26, height: 26, cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={14} />
              </button>
            </div>
          ) : (
            <label style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', border: '2px dashed var(--border)', borderRadius: 'var(--radius-sm)', padding: '2rem', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.88rem', transition: 'border-color 0.2s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
            >
              <Camera size={28} style={{ opacity: 0.4 }} />
              <span>Haz clic o arrastra una foto aquí</span>
              <input type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={handleFile} />
            </label>
          )}
        </div>

        {/* Botones */}
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-primary" style={{ flex: 2, justifyContent: 'center' }}
            onClick={handleUpload}
            disabled={!photoB64 || !selectedOrderId || uploading || activeOrders.length === 0}>
            <Upload size={16} />
            {uploading ? 'Subiendo...' : 'Guardar Foto'}
          </button>
        </div>
      </div>
    </div>
  );
}
