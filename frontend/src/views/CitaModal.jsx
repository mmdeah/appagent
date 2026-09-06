import React, { useState } from 'react';
import { API_URL } from '../api';
import { Calendar, X, Trash2, Save } from 'lucide-react';

export const SERVICIOS = {
  Revision:       { label: 'Revisión',       badgeClass: 'badge-blue',  hex: '#818cf8' },
  Sincronizacion: { label: 'Sincronización', badgeClass: 'badge-green', hex: '#34d399' },
  Otro:           { label: 'Otro',           badgeClass: 'badge-red',   hex: '#f87171' },
};

/**
 * Modal para crear/editar una cita de vehículo.
 * Props:
 *  - mode: 'create' | 'edit'
 *  - cita: objeto cita (solo en modo edit)
 *  - initialFecha: 'YYYY-MM-DD' (solo en modo create, para prellenar desde el día clicado)
 *  - onClose: () => void
 *  - onSuccess: () => void  (recargar lista de citas)
 */
export default function CitaModal({ mode, cita, initialFecha, onClose, onSuccess }) {
  const [form, setForm] = useState(() => cita
    ? { nombre: cita.nombre || '', vehiculo: cita.vehiculo || '', placa: cita.placa || '', telefono: cita.telefono || '', servicio: cita.servicio || 'Revision', fecha: cita.fecha || '', hora: cita.hora || '09:00', notas: cita.notas || '' }
    : { nombre: '', vehiculo: '', placa: '', telefono: '', servicio: 'Revision', fecha: initialFecha || (() => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`; })(), hora: '09:00', notas: '' }
  );
  const [status, setStatus] = useState({ text: '', type: '' });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      if (mode === 'edit') {
        await fetch(`${API_URL}/citas/${cita.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form)
        });
      } else {
        // No mandamos "id": json-server lo genera solo. Si mandáramos uno propio
        // y chocara con otro existente (doble clic, dos pestañas), el POST falla.
        await fetch(`${API_URL}/citas`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, recordatorios: { h48: false, h24: false, h12: false }, creado: new Date().toISOString() })
        });
      }
      setStatus({ text: '✓ Cita guardada', type: 'success' });
      setTimeout(() => { onSuccess?.(); onClose(); }, 900);
    } catch {
      setStatus({ text: 'Error al guardar la cita', type: 'error' });
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setSaving(true);
    try {
      await fetch(`${API_URL}/citas/${cita.id}`, { method: 'DELETE' });
      onSuccess?.();
      onClose();
    } catch {
      setStatus({ text: 'Error al eliminar la cita', type: 'error' });
      setSaving(false);
    }
  };

  if (confirmDelete) {
    return (
      <div className="modal-overlay">
        <div className="modal-box" style={{ maxWidth: 400, textAlign: 'center' }}>
          <div style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--error)', width: 56, height: 56, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <Trash2 size={28} />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>¿Eliminar Cita?</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginBottom: '1.5rem', lineHeight: 1.5 }}>
            Se eliminará la cita de <strong>{cita?.placa}</strong> permanentemente. ¿Deseas continuar?
          </p>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setConfirmDelete(false)} disabled={saving}>Cancelar</button>
            <button className="btn-primary" style={{ flex: 1, justifyContent: 'center', background: 'var(--error)', borderColor: 'var(--error)', color: 'white' }} onClick={handleDelete} disabled={saving}>Sí, Eliminar</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 480 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg,#6366f1,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Calendar size={17} color="white" />
            </div>
            <div style={{ fontWeight: 700, fontSize: '1.05rem' }}>{mode === 'edit' ? 'Editar Cita' : 'Nueva Cita'}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <X size={20} />
          </button>
        </div>

        {status.text && <div className={`toast toast-${status.type}`} style={{ marginBottom: '1rem' }}>{status.text}</div>}

        <form onSubmit={handleSave}>
          <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <input required placeholder="Nombre del cliente" value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} />
            <input required placeholder="Vehículo (Ej. Mazda 3)" value={form.vehiculo} onChange={e => setForm({ ...form, vehiculo: e.target.value })} />
            <input required placeholder="Placa" value={form.placa} onChange={e => setForm({ ...form, placa: e.target.value.toUpperCase() })} />
            <input required placeholder="Teléfono" value={form.telefono} onChange={e => setForm({ ...form, telefono: e.target.value })} />
          </div>

          <div style={{ marginBottom: '0.75rem' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
              Servicio
            </label>
            <select value={form.servicio} onChange={e => setForm({ ...form, servicio: e.target.value })}>
              {Object.entries(SERVICIOS).map(([key, s]) => (
                <option key={key} value={key}>{s.label}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
              {Object.entries(SERVICIOS).map(([key, s]) => (
                <span key={key} className={`badge ${s.badgeClass}`} style={{ opacity: form.servicio === key ? 1 : 0.35 }}>{s.label}</span>
              ))}
            </div>
          </div>

          <div className="form-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
            <input required type="date" value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} />
            <input required type="time" value={form.hora} onChange={e => setForm({ ...form, hora: e.target.value })} />
          </div>

          <textarea placeholder="Notas (opcional)" value={form.notas} onChange={e => setForm({ ...form, notas: e.target.value })} style={{ minHeight: 55, marginBottom: '1.25rem' }} />

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            {mode === 'edit' && (
              <button type="button" onClick={() => setConfirmDelete(true)} style={{ background: 'none', border: '1px solid var(--error)', color: 'var(--error)', borderRadius: 'var(--radius-sm)', padding: '0 0.85rem', cursor: 'pointer' }} title="Eliminar cita">
                <Trash2 size={16} />
              </button>
            )}
            <button type="button" className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn-primary" style={{ flex: 2, justifyContent: 'center' }} disabled={saving}>
              <Save size={16} />
              {saving ? 'Guardando...' : 'Guardar Cita'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
