import React, { useState, useRef, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { API_URL, BACKEND_URL } from '../api';
import { ThemeContext } from '../App';
import { Camera, CheckCircle, ArrowLeft, RefreshCw, Image as ImageIcon, HelpCircle } from 'lucide-react';

// Mismas listas que en el panel Admin (frontend/src/views/AdminView.jsx) — se
// duplican aquí a propósito, siguiendo la convención ya usada en el resto del
// código (PAYMENT_METHODS también está duplicado en OrderDetailsModal.jsx),
// en vez de crear un archivo compartido para un par de constantes chicas.
const EXPENSE_CATEGORIES = ['Repuestos', 'Insumos', 'Nómina', 'Arriendo', 'Servicios Públicos', 'Herramientas', 'Impuestos', 'Otros'];
const PAYMENT_METHODS = ['Efectivo', 'Nequi', 'Bancolombia', 'Banco de Bogota', 'Tarjeta'];

const emptyForm = () => ({
  fecha: new Date().toISOString().split('T')[0],
  concepto: '', monto: '', metodoPago: 'Efectivo', categoria: 'Repuestos', vendedor: '', facturaIva: 'No', ordenId: '',
});

const fmtMiles = (digitsOnly) => digitsOnly ? parseInt(digitsOnly, 10).toLocaleString('es-CO') : '';

const label = { display: 'block', fontSize: '1.05rem', fontWeight: 800, color: 'var(--text)', marginBottom: '0.5rem' };
const detailLabel = { display: 'block', fontSize: '0.92rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem' };

/**
 * Vista independiente pensada para celular, con pasos simples y grandes,
 * para que cualquier persona (aunque no maneje bien la tecnología) pueda
 * registrar un gasto tomándole una foto al recibo. Guarda en la misma
 * colección "expenses" que usa el panel Admin, así que todo lo que se sube
 * aquí aparece automáticamente en la pestaña Gastos del Admin.
 */
export default function GastosUploadView() {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const navigate = useNavigate();
  const cameraInputRef = useRef(null);
  const galleryInputRef = useRef(null);

  const [step, setStep] = useState('foto'); // foto | analizando | revisar | listo
  const [photoPreview, setPhotoPreview] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [analyzeError, setAnalyzeError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [showOrderPicker, setShowOrderPicker] = useState(false);
  const [orders, setOrders] = useState([]);

  const stepNum = step === 'foto' ? 1 : step === 'listo' ? 3 : 2;

  // Órdenes activas (vehículos que siguen en el taller), para poder relacionar
  // el gasto con una placa y así sea fácil de encontrar en el historial.
  useEffect(() => {
    fetch(`${API_URL}/orders`)
      .then(r => r.json())
      .then(data => setOrders((data || []).filter(o => o.estado !== 'Entregado')))
      .catch(() => setOrders([]));
  }, []);

  const analyzePhoto = async (base64, mimeType, attempt = 0) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/analyze-expense-image`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: base64, mimeType }),
      });
      if (!res.ok) throw new Error('respuesta no OK');
      return await res.json();
    } catch (e) {
      // Con internet lento en el taller, un solo intento fallido no debería
      // obligar a la persona a llenar todo a mano — se reintenta un par de
      // veces antes de rendirse.
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 2000));
        return analyzePhoto(base64, mimeType, attempt + 1);
      }
      throw e;
    }
  };

  const handleFile = async (file) => {
    if (!file) return;
    setAnalyzeError(false);
    setStep('analizando');
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setPhotoPreview(dataUrl);
      const data = await analyzePhoto(dataUrl.split(',')[1], file.type);
      setForm(prev => ({
        ...prev,
        ...(data.fecha ? { fecha: data.fecha } : {}),
        ...(data.concepto ? { concepto: data.concepto } : {}),
        ...(data.monto ? { monto: String(data.monto) } : {}),
        ...(data.metodoPago ? { metodoPago: data.metodoPago } : {}),
        ...(data.categoria && EXPENSE_CATEGORIES.includes(data.categoria) ? { categoria: data.categoria } : {}),
        ...(data.vendedor ? { vendedor: data.vendedor } : {}),
        ...(typeof data.facturaConIva === 'boolean' ? { facturaIva: data.facturaConIva ? 'Sí' : 'No' } : {}),
      }));
    } catch (e) {
      setAnalyzeError(true);
    } finally {
      setStep('revisar');
    }
  };

  const handleRetakePhoto = () => {
    setPhotoPreview(null);
    setForm(emptyForm());
    setAnalyzeError(false);
    setShowOrderPicker(false);
    setStep('foto');
  };

  const handleSave = async () => {
    if (!form.monto || !form.concepto) return;
    setSaving(true);
    setSaveError(false);
    try {
      const ordenSeleccionada = orders.find(o => String(o.id) === String(form.ordenId));
      const concepto = ordenSeleccionada ? `[${ordenSeleccionada.placa}] ${form.concepto}` : form.concepto;
      const res = await fetch(`${API_URL}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          concepto,
          monto: parseInt(form.monto) || 0,
          ordenId: ordenSeleccionada ? ordenSeleccionada.id : null,
          placa: ordenSeleccionada ? ordenSeleccionada.placa : '',
        }),
      });
      if (!res.ok) throw new Error('respuesta no OK');
      setStep('listo');
    } catch (e) {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  const handleNuevo = () => {
    setPhotoPreview(null);
    setForm(emptyForm());
    setAnalyzeError(false);
    setSaveError(false);
    setShowOrderPicker(false);
    setStep('foto');
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
        <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.9rem', padding: '0.4rem' }}>
          <ArrowLeft size={18} /> Salir
        </button>
        <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>Registrar Gasto</div>
        <button onClick={toggleTheme} className="theme-toggle" title="Cambiar tema" />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '1.75rem 1.25rem 3rem', width: '100%' }}>
        <div style={{ width: '100%', maxWidth: 460 }}>

          {step !== 'listo' && (
            <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '2rem' }}>
              {[1, 2, 3].map(n => (
                <div key={n} style={{ height: 6, flex: 1, borderRadius: 99, background: n <= stepNum ? 'var(--primary)' : 'var(--border)', transition: 'background 0.2s' }} />
              ))}
            </div>
          )}

          {step === 'foto' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                <Camera size={40} color="var(--primary)" />
              </div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem' }}>Paso 1: Toma la foto</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '1.02rem', lineHeight: 1.5, marginBottom: '2rem' }}>
                Toma una foto clara del recibo o factura del gasto que quieres registrar.
              </p>

              <input type="file" accept="image/*" capture="environment" ref={cameraInputRef} style={{ display: 'none' }}
                onChange={e => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />
              <button onClick={() => cameraInputRef.current?.click()} className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '1.1rem', fontSize: '1.15rem', fontWeight: 800, borderRadius: 14, gap: '0.6rem' }}>
                <Camera size={22} /> Tomar Foto
              </button>

              <input type="file" accept="image/*" ref={galleryInputRef} style={{ display: 'none' }}
                onChange={e => { handleFile(e.target.files?.[0]); e.target.value = ''; }} />
              <button onClick={() => galleryInputRef.current?.click()}
                style={{ marginTop: '1rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.9rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', textDecoration: 'underline' }}>
                <ImageIcon size={15} /> o elige una foto que ya tengas
              </button>
            </div>
          )}

          {step === 'analizando' && (
            <div style={{ textAlign: 'center' }}>
              {photoPreview && <img src={photoPreview} alt="recibo" style={{ maxWidth: 220, maxHeight: 220, borderRadius: 12, marginBottom: '1.5rem', border: '1px solid var(--border)' }} />}
              <RefreshCw size={36} className="spin" color="var(--primary)" style={{ marginBottom: '1rem' }} />
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700 }}>Leyendo tu recibo...</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: '0.5rem' }}>Esto puede tardar unos segundos, no cierres la página.</p>
            </div>
          )}

          {step === 'revisar' && (
            <div>
              <h1 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '0.25rem', textAlign: 'center' }}>Paso 2: Confirma 3 cositas</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', textAlign: 'center', marginBottom: '1.5rem' }}>
                Revisa que esté bien y ya. Fácil.
              </p>

              {photoPreview && (
                <div style={{ textAlign: 'center', marginBottom: '1.25rem' }}>
                  <img src={photoPreview} alt="recibo" style={{ maxHeight: 130, borderRadius: 12, border: '1px solid var(--border)' }} />
                </div>
              )}

              {analyzeError && (
                <div className="toast toast-error" style={{ marginBottom: '1.25rem', fontSize: '0.9rem' }}>
                  No pudimos leer el recibo solos (revisa tu conexión). No hay problema, llena tú los datos abajo. 🙂
                </div>
              )}

              {/* ── Las 3 preguntas que de verdad importan ─────────────── */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.4rem', marginBottom: '1.5rem' }}>
                <div>
                  <label style={label}>📝 ¿Qué compraste?</label>
                  <input type="text" required placeholder="Ej. Aceite de motor, filtro..." value={form.concepto}
                    onChange={e => setForm({ ...form, concepto: e.target.value })}
                    style={{ fontSize: '1.15rem' }} />
                </div>

                <div>
                  <label style={label}>💰 ¿Cuánto costó?</label>
                  <div style={{ position: 'relative' }}>
                    <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', fontSize: '1.4rem', fontWeight: 800, color: 'var(--success)', pointerEvents: 'none' }}>$</span>
                    <input type="text" inputMode="numeric" required placeholder="0" className="price-input"
                      value={fmtMiles(form.monto)} onChange={e => setForm({ ...form, monto: e.target.value.replace(/\D/g, '') })}
                      style={{ paddingLeft: '2.15rem', fontSize: '1.5rem', fontWeight: 800 }} />
                  </div>
                </div>

                <div>
                  <label style={label}>🧾 ¿Tenía IVA?</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '0.6rem', lineHeight: 1.4 }}>
                    <HelpCircle size={14} style={{ flexShrink: 0 }} />
                    <span>El IVA es un impuesto. A veces la factura dice "IVA" o un número con % (ej. 19%).</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button type="button" onClick={() => setForm({ ...form, facturaIva: 'Sí' })}
                      style={{
                        flex: 1, padding: '1rem', borderRadius: 14, cursor: 'pointer', fontWeight: 800, fontSize: '1.15rem',
                        border: form.facturaIva === 'Sí' ? '2px solid var(--success)' : '1.5px solid var(--border)',
                        background: form.facturaIva === 'Sí' ? 'rgba(16,185,129,0.15)' : 'var(--bg)',
                        color: form.facturaIva === 'Sí' ? 'var(--success)' : 'var(--text)',
                      }}>
                      ✅ Sí
                    </button>
                    <button type="button" onClick={() => setForm({ ...form, facturaIva: 'No' })}
                      style={{
                        flex: 1, padding: '1rem', borderRadius: 14, cursor: 'pointer', fontWeight: 800, fontSize: '1.15rem',
                        border: form.facturaIva === 'No' ? '2px solid var(--error)' : '1.5px solid var(--border)',
                        background: form.facturaIva === 'No' ? 'rgba(239,68,68,0.12)' : 'var(--bg)',
                        color: form.facturaIva === 'No' ? 'var(--error)' : 'var(--text)',
                      }}>
                      ❌ No
                    </button>
                  </div>
                </div>

                <div>
                  <label style={label}>🚗 ¿Es para una orden de servicio?</label>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '0.6rem', lineHeight: 1.4 }}>
                    Si es un repuesto o servicio para un vehículo del taller, relaciónalo con su placa.
                  </p>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <button type="button" onClick={() => setShowOrderPicker(true)}
                      style={{
                        flex: 1, padding: '1rem', borderRadius: 14, cursor: 'pointer', fontWeight: 800, fontSize: '1.1rem',
                        border: showOrderPicker ? '2px solid var(--primary)' : '1.5px solid var(--border)',
                        background: showOrderPicker ? 'rgba(99,102,241,0.12)' : 'var(--bg)',
                        color: showOrderPicker ? 'var(--primary)' : 'var(--text)',
                      }}>
                      Sí
                    </button>
                    <button type="button" onClick={() => { setShowOrderPicker(false); setForm(f => ({ ...f, ordenId: '' })); }}
                      style={{
                        flex: 1, padding: '1rem', borderRadius: 14, cursor: 'pointer', fontWeight: 800, fontSize: '1.1rem',
                        border: !showOrderPicker ? '2px solid var(--text-muted)' : '1.5px solid var(--border)',
                        background: !showOrderPicker ? 'rgba(148,163,184,0.12)' : 'var(--bg)',
                        color: !showOrderPicker ? 'var(--text)' : 'var(--text)',
                      }}>
                      No
                    </button>
                  </div>
                  {showOrderPicker && (
                    <select style={{ marginTop: '0.75rem' }} value={form.ordenId} onChange={e => setForm({ ...form, ordenId: e.target.value })}>
                      <option value="">Selecciona la placa del vehículo...</option>
                      {orders.map(o => (
                        <option key={o.id} value={o.id}>{o.placa} — {o.marca} {o.modelo} ({o.cliente})</option>
                      ))}
                    </select>
                  )}
                  {showOrderPicker && orders.length === 0 && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '0.5rem' }}>No hay vehículos activos en el taller ahora mismo.</p>
                  )}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.5rem', padding: '1rem', background: 'var(--bg)', borderRadius: 14, border: '1px solid var(--border)' }}>
                <div>
                  <label style={detailLabel}>🏪 Vendedor</label>
                  <input type="text" placeholder="Ej. Repuestos del Valle" value={form.vendedor}
                    onChange={e => setForm({ ...form, vendedor: e.target.value })} />
                </div>
                <div>
                  <label style={detailLabel}>📅 Fecha</label>
                  <input type="date" required value={form.fecha} onChange={e => setForm({ ...form, fecha: e.target.value })} />
                </div>
                <div>
                  <label style={detailLabel}>🏷️ Categoría</label>
                  <select value={form.categoria} onChange={e => setForm({ ...form, categoria: e.target.value })}>
                    {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label style={detailLabel}>💳 Método de Pago</label>
                  <select value={form.metodoPago} onChange={e => setForm({ ...form, metodoPago: e.target.value })}>
                    {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
              </div>

              {saveError && <div className="toast toast-error" style={{ marginBottom: '1rem' }}>No se pudo guardar. Revisa tu conexión e intenta de nuevo.</div>}

              <button onClick={handleSave} disabled={saving || !form.monto || !form.concepto} className="btn-primary"
                style={{ width: '100%', justifyContent: 'center', padding: '1.15rem', fontSize: '1.2rem', fontWeight: 800, borderRadius: 14, marginBottom: '0.85rem', opacity: (saving || !form.monto || !form.concepto) ? 0.6 : 1 }}>
                <CheckCircle size={22} /> {saving ? 'Guardando...' : 'Listo, Guardar'}
              </button>
              <button onClick={handleRetakePhoto} className="btn-secondary" style={{ width: '100%', justifyContent: 'center', padding: '0.85rem', fontSize: '0.95rem' }}>
                <Camera size={16} /> Tomar otra foto
              </button>
            </div>
          )}

          {step === 'listo' && (
            <div style={{ textAlign: 'center' }}>
              <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem' }}>
                <CheckCircle size={44} color="var(--success)" />
              </div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.5rem' }}>¡Gasto guardado!</h1>
              <p style={{ color: 'var(--text-muted)', fontSize: '1rem', marginBottom: '2rem' }}>Ya quedó registrado, el administrador lo va a ver.</p>
              <button onClick={handleNuevo} className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '1.1rem', fontSize: '1.1rem', fontWeight: 800, borderRadius: 14 }}>
                <Camera size={20} /> Registrar otro gasto
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
