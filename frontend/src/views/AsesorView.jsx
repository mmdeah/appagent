import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, ClipboardList, History, ChevronLeft, ChevronRight, Plus, Send, FileDown, RefreshCw, WifiOff, Search, TrendingUp, TrendingDown, Trash2 } from 'lucide-react';
import { API_URL } from '../api';
import { useFleetTheme, fleetThemeStyle } from '../fleetTheme';
import { imprimirCotizacionPdf } from '../quotePdf';

// Vista del asesor de Ayvens (p. ej. Saúl). Ve las órdenes ACTIVAS de Ayvens,
// puede proponer cambios (datos del vehículo, ítems nuevos o valores de ítems
// existentes) y esos cambios NO se reflejan en la orden hasta que el admin los
// apruebe. Solo puede descargar el PDF de la última versión aprobada. Tiene,
// además, un historial de cambios aprobados con totales por corte (del 20 de un
// mes al 20 del siguiente).

const fmt = (n) => (parseFloat(n) || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 });
const money = (n) => `$${fmt(Math.abs(n))}`;
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const CAMPOS_VEH = [['placa', 'Placa'], ['marca', 'Marca'], ['modelo', 'Modelo'], ['anio', 'Año'], ['kilometraje', 'Kilometraje']];
const valorLinea = (it) => (Number(it.precio) || 0) * (Number(it.cantidad) || 0) * (it.aplicaIva ? 1.19 : 1);

// Corte de Ayvens: del 20 de un mes al 20 del siguiente. Desde el día 20 en adelante
// pertenece al corte del mes siguiente (igual que en la pestaña de facturación).
const corteDe = (fecha) => {
  const d = new Date(fecha);
  let m = d.getMonth() + 1, y = d.getFullYear();
  if (d.getDate() >= 20) { m++; if (m > 12) { m = 1; y++; } }
  const pm = m === 1 ? 12 : m - 1, py = m === 1 ? y - 1 : y;
  return { id: `${y}-${String(m).padStart(2, '0')}`, titulo: `Corte 20 de ${MESES[m - 1]} ${y}`, periodo: `20 de ${MESES[pm - 1]} ${py} — 20 de ${MESES[m - 1]} ${y}` };
};

async function pedir(url, opciones, intentos = 3) {
  let ultimo;
  for (let n = 0; n < intentos; n++) {
    try {
      const r = await fetch(url, opciones);
      return r;
    } catch (e) { ultimo = e; await new Promise(ok => setTimeout(ok, (n + 1) * 1500)); }
  }
  throw ultimo;
}

const Etiqueta = ({ children }) => (
  <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{children}</div>
);

const Delta = ({ valor, grande }) => {
  if (!valor) return <span style={{ color: 'var(--text-muted)' }}>$0</span>;
  const sube = valor > 0;
  const Icono = sube ? TrendingUp : TrendingDown;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontWeight: 800, fontSize: grande ? '1.1rem' : '0.88rem', color: sube ? '#059669' : '#dc2626', whiteSpace: 'nowrap' }}>
      <Icono size={grande ? 17 : 14} /> {sube ? '+' : '−'}{money(valor)}
    </span>
  );
};

// ───────────────────────── Detalle de una orden ─────────────────────────
function OrdenAsesor({ orden, user, onBack, onRefrescar }) {
  const vehInicial = useMemo(() => Object.fromEntries(CAMPOS_VEH.map(([k]) => [k, String(orden[k] ?? '')])), [orden]);
  const itemsInicial = useMemo(() => (orden.items || []).map((it, i) => ({ ...it, idx: i })), [orden]);
  const [veh, setVeh] = useState(vehInicial);
  const [items, setItems] = useState(itemsInicial);
  const [solicitudes, setSolicitudes] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [mensaje, setMensaje] = useState(null); // { texto, tipo }
  const [descargando, setDescargando] = useState(false);

  // Si la orden se refresca (por ejemplo tras una aprobación), se descartan las ediciones locales.
  useEffect(() => { setVeh(vehInicial); setItems(itemsInicial); }, [vehInicial, itemsInicial]);

  const cargarSolicitudes = useCallback(async () => {
    try {
      const r = await pedir(`${API_URL}/api/asesor/solicitudes?orderId=${orden.id}`);
      if (r.ok) setSolicitudes(await r.json());
    } catch { /* se muestra vacío */ }
  }, [orden.id]);
  useEffect(() => { cargarSolicitudes(); }, [cargarSolicitudes]);

  const cambioVeh = (k) => String(veh[k] ?? '').trim() !== String(vehInicial[k] ?? '').trim();
  const itemCambiado = (it) => {
    if (it.idx === null) return !!(it.descripcion || '').trim();
    const o = itemsInicial[it.idx];
    return !o || o.descripcion !== it.descripcion || Number(o.cantidad) !== Number(it.cantidad) || Number(o.precio) !== Number(it.precio) || !!o.aplicaIva !== !!it.aplicaIva;
  };
  const hayCambios = CAMPOS_VEH.some(([k]) => cambioVeh(k)) || items.some(itemCambiado);
  const totalActual = itemsInicial.reduce((s, it) => s + valorLinea(it), 0);
  const totalPropuesto = items.filter(it => it.idx !== null || (it.descripcion || '').trim()).reduce((s, it) => s + valorLinea(it), 0);

  const setItem = (i, campo, valor) => setItems(prev => prev.map((it, j) => (j === i ? { ...it, [campo]: valor } : it)));

  const enviar = async () => {
    setEnviando(true); setMensaje(null);
    try {
      const body = {
        orderId: orden.id, asesor: user.nombre,
        vehiculo: Object.fromEntries(CAMPOS_VEH.filter(([k]) => cambioVeh(k)).map(([k]) => [k, veh[k]])),
        items: items.filter(itemCambiado).map(it => ({ idx: it.idx, descripcion: it.descripcion, cantidad: it.cantidad, precio: it.precio, aplicaIva: it.aplicaIva })),
      };
      const r = await pedir(`${API_URL}/api/asesor/solicitudes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMensaje({ texto: d.error || 'No se pudo enviar la solicitud.', tipo: 'error' }); return; }
      setMensaje({ texto: 'Solicitud enviada. Los cambios se verán en la orden cuando el administrador los apruebe.', tipo: 'success' });
      setVeh(vehInicial); setItems(itemsInicial); // la orden sigue igual hasta que se apruebe
      cargarSolicitudes(); onRefrescar();
    } catch {
      setMensaje({ texto: 'Error de conexión. Intenta de nuevo.', tipo: 'error' });
    } finally {
      setEnviando(false);
    }
  };

  const descargar = async () => {
    setDescargando(true);
    try {
      const r = await pedir(`${API_URL}/api/asesor/ordenes/${orden.id}/cotizacion-aprobada`);
      const d = await r.json();
      if (!r.ok) { setMensaje({ texto: d.error || 'No hay versión aprobada.', tipo: 'error' }); return; }
      imprimirCotizacionPdf({ orden: d.orden, items: d.items, aprobadaEn: d.aprobadaEn });
    } catch {
      setMensaje({ texto: 'No se pudo generar el PDF. Revisa tu conexión.', tipo: 'error' });
    } finally {
      setDescargando(false);
    }
  };

  const estadoSol = { pendiente: ['Pendiente de aprobación', '#d97706', 'rgba(245,158,11,0.12)'], aprobada: ['Aprobada', '#059669', 'rgba(16,185,129,0.12)'], rechazada: ['Rechazada', '#dc2626', 'rgba(239,68,68,0.12)'] };

  return (
    <div>
      <button onClick={onBack} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: '1rem', padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}>
        <ChevronLeft size={15} /> Órdenes activas
      </button>

      <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: '1.6rem', fontWeight: 900, letterSpacing: 1.5, lineHeight: 1.1 }}>{orden.placa}</div>
            <div style={{ color: 'var(--text-muted)' }}>{orden.marca} {orden.modelo} {orden.anio || ''} · {orden.cliente}</div>
          </div>
          <span style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f59e0b', background: 'rgba(245,158,11,0.15)', padding: '0.25rem 0.7rem', borderRadius: 999 }}>{orden.estado}</span>
        </div>
        {orden.servicios && <div style={{ marginTop: 10, fontSize: '0.88rem', color: 'var(--text-muted)' }}>Servicios: {orden.servicios}</div>}

        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '1.1rem 0 0.5rem' }}>Datos del vehículo</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem' }}>
          {CAMPOS_VEH.map(([k, etiqueta]) => (
            <label key={k}>
              <Etiqueta>{etiqueta}{cambioVeh(k) ? ' · modificado' : ''}</Etiqueta>
              <input type="text" value={veh[k] ?? ''} inputMode={k === 'kilometraje' || k === 'anio' ? 'numeric' : undefined}
                onChange={e => setVeh(prev => ({ ...prev, [k]: k === 'placa' ? e.target.value.toUpperCase() : (k === 'kilometraje' || k === 'anio') ? e.target.value.replace(/\D/g, '') : e.target.value }))}
                style={{ width: '100%', borderColor: cambioVeh(k) ? '#f59e0b' : undefined }} />
            </label>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cotización (versión de la orden)</div>
          <button className="btn-secondary" style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: 6 }}
            onClick={() => setItems(prev => [...prev, { idx: null, descripcion: '', cantidad: 1, precio: 0, aplicaIva: false }])}>
            <Plus size={14} /> Añadir ítem
          </button>
        </div>

        {items.length === 0 && <div style={{ color: 'var(--text-muted)', fontSize: '0.88rem', padding: '0.5rem 0' }}>Esta orden aún no tiene ítems en la cotización.</div>}
        {items.map((it, i) => {
          const cambiado = itemCambiado(it);
          return (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(160px, 3fr) 70px minmax(100px, 1.2fr) auto auto', gap: '0.5rem', alignItems: 'center', padding: '0.5rem 0', borderTop: '1px solid var(--border)' }}>
              <div>
                <input type="text" value={it.descripcion} placeholder="Descripción del ítem" onChange={e => setItem(i, 'descripcion', e.target.value)}
                  style={{ width: '100%', borderColor: cambiado ? '#f59e0b' : undefined }} />
                {cambiado && <div style={{ fontSize: '0.68rem', color: '#d97706', fontWeight: 700, marginTop: 2 }}>{it.idx === null ? 'ítem nuevo' : 'modificado'}</div>}
              </div>
              <input type="number" min="0" step="any" value={it.cantidad} title="Cantidad" onChange={e => setItem(i, 'cantidad', e.target.value === '' ? '' : Number(e.target.value))} style={{ width: '100%', borderColor: cambiado ? '#f59e0b' : undefined }} />
              <input type="text" inputMode="numeric" value={it.precio ? fmt(it.precio) : ''} placeholder="$ precio" title="Precio unitario"
                onChange={e => setItem(i, 'precio', Number(e.target.value.replace(/\D/g, '')) || 0)} style={{ width: '100%', textAlign: 'right', borderColor: cambiado ? '#f59e0b' : undefined }} />
              <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <input type="checkbox" checked={!!it.aplicaIva} onChange={e => setItem(i, 'aplicaIva', e.target.checked)} /> IVA
              </label>
              {it.idx === null
                ? <button onClick={() => setItems(prev => prev.filter((_, j) => j !== i))} title="Quitar" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', display: 'flex' }}><Trash2 size={15} /></button>
                : <span />}
            </div>
          );
        })}

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', marginTop: '0.9rem', paddingTop: '0.9rem', borderTop: '1px solid var(--border)' }}>
          <div style={{ fontSize: '0.85rem' }}>
            <span style={{ color: 'var(--text-muted)' }}>Total actual de la orden: </span><strong>{money(totalActual)}</strong>
            {hayCambios && Math.round(totalPropuesto) !== Math.round(totalActual) && <span style={{ marginLeft: 12 }}>Con tus cambios: <strong>{money(totalPropuesto)}</strong> <Delta valor={totalPropuesto - totalActual} /></span>}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button className="btn-secondary" disabled={descargando || !orden.aprobada} onClick={descargar}
              title={orden.aprobada ? 'Descarga la última versión aprobada' : 'Disponible cuando el administrador apruebe una versión'}
              style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: orden.aprobada ? 1 : 0.55 }}>
              <FileDown size={15} /> {descargando ? 'Generando...' : 'Cotización PDF'}
            </button>
            <button className="btn-primary" disabled={!hayCambios || enviando} onClick={enviar} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Send size={15} /> {enviando ? 'Enviando...' : 'Enviar al admin'}
            </button>
          </div>
        </div>
        {!orden.aprobada && <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: 8 }}>El PDF se habilita cuando el administrador apruebe una versión de esta orden.</div>}
        {mensaje && <div className={`toast toast-${mensaje.tipo}`} style={{ marginTop: '0.75rem' }}>{mensaje.texto}</div>}
      </div>

      {solicitudes.length > 0 && (
        <div className="card" style={{ padding: '1.25rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>Solicitudes de esta orden</div>
          {solicitudes.slice(0, 8).map(s => {
            const [txt, color, bg] = estadoSol[s.estado] || estadoSol.pendiente;
            return (
              <div key={s.id} style={{ padding: '0.6rem 0', borderTop: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{new Date(s.creada).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color, background: bg, padding: '0.15rem 0.6rem', borderRadius: 999 }}>{txt}</span>
                </div>
                <div style={{ fontSize: '0.84rem', marginTop: 3 }}>
                  {Object.entries(s.vehiculo || {}).map(([k, v]) => <div key={k}>{(CAMPOS_VEH.find(c => c[0] === k) || [k, k])[1]}: {v.antes || '—'} → <strong>{v.despues || '—'}</strong></div>)}
                  {(s.items || []).map((c, i) => <div key={i}>{c.tipo === 'nuevo' ? 'Nuevo: ' : ''}{c.descripcion} · {money(c.valorAntes)} → <strong>{money(c.valorDespues)}</strong> <Delta valor={c.delta} /></div>)}
                </div>
                {s.estado === 'rechazada' && s.notaAdmin && <div style={{ fontSize: '0.8rem', color: '#dc2626', marginTop: 3 }}>Nota del admin: {s.notaAdmin}</div>}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Historial de cambios por corte ─────────────────────────
function Historial({ user }) {
  const [filas, setFilas] = useState(null);
  const [error, setError] = useState(false);
  const [marcadas, setMarcadas] = useState(() => new Set());

  const cargar = useCallback(async () => {
    setError(false);
    try {
      const r = await pedir(`${API_URL}/api/asesor/solicitudes?estado=aprobada`);
      if (!r.ok) throw new Error('no ok');
      const sols = (await r.json()).filter(s => !user.nombre || s.asesor === user.nombre);
      const rows = [];
      sols.forEach(s => (s.items || []).forEach((c, i) => rows.push({
        id: `${s.id}-${i}`, fecha: s.resuelta || s.creada, placa: s.placa, tipo: c.tipo, descripcion: c.descripcion,
        antes: c.valorAntes, despues: c.valorDespues, delta: c.delta,
      })));
      rows.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
      setFilas(rows);
    } catch { setError(true); }
  }, [user.nombre]);
  useEffect(() => { cargar(); }, [cargar]);

  const cortes = useMemo(() => {
    const m = new Map();
    (filas || []).forEach(f => {
      const c = corteDe(f.fecha);
      if (!m.has(c.id)) m.set(c.id, { ...c, filas: [] });
      m.get(c.id).filas.push(f);
    });
    return [...m.values()].sort((a, b) => b.id.localeCompare(a.id));
  }, [filas]);

  const totalGeneral = (filas || []).reduce((s, f) => s + f.delta, 0);
  const totalMarcado = (filas || []).filter(f => marcadas.has(f.id)).reduce((s, f) => s + f.delta, 0);
  const alternar = (ids, poner) => setMarcadas(prev => { const n = new Set(prev); ids.forEach(id => (poner ? n.add(id) : n.delete(id))); return n; });

  if (error) return (
    <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
      <WifiOff size={26} color="var(--error)" style={{ marginBottom: 8 }} />
      <div style={{ fontWeight: 700, marginBottom: 10 }}>No se pudo cargar el historial</div>
      <button className="btn-primary" onClick={cargar} style={{ margin: '0 auto' }}><RefreshCw size={15} /> Reintentar</button>
    </div>
  );
  if (filas === null) return <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando historial...</div>;
  if (filas.length === 0) return <div className="card" style={{ padding: '2.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>Aún no hay cambios aprobados. Aquí aparecerán los ítems que crees o edites, con el valor que cambió, cuando el administrador los apruebe.</div>;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
        <div className="card" style={{ padding: '0.9rem 1.1rem' }}><Etiqueta>Total de todos los cambios</Etiqueta><Delta valor={totalGeneral} grande /></div>
        <div className="card" style={{ padding: '0.9rem 1.1rem', borderColor: marcadas.size ? 'var(--primary)' : undefined }}>
          <Etiqueta>Total de lo marcado ({marcadas.size})</Etiqueta><Delta valor={totalMarcado} grande />
          {marcadas.size > 0 && <button onClick={() => setMarcadas(new Set())} style={{ marginLeft: 10, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.75rem', textDecoration: 'underline' }}>quitar marcas</button>}
        </div>
      </div>

      {cortes.map(c => {
        const subtotal = c.filas.reduce((s, f) => s + f.delta, 0);
        const ids = c.filas.map(f => f.id);
        const todas = ids.every(id => marcadas.has(id));
        const marcCorte = c.filas.filter(f => marcadas.has(f.id)).reduce((s, f) => s + f.delta, 0);
        return (
          <div key={c.id} className="card" style={{ padding: 0, marginBottom: '1rem', overflow: 'hidden' }}>
            <div style={{ padding: '0.85rem 1.1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', background: 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
              <div>
                <div style={{ fontWeight: 800 }}>{c.titulo}</div>
                <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>{c.periodo} · {c.filas.length} cambio{c.filas.length !== 1 ? 's' : ''}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Etiqueta>Total del corte</Etiqueta><Delta valor={subtotal} grande />
                {marcCorte !== 0 && <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>marcado: <Delta valor={marcCorte} /></div>}
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th style={{ width: 32 }}><input type="checkbox" checked={todas} onChange={e => alternar(ids, e.target.checked)} title="Marcar todo el corte" /></th>
                    <th>Aprobado</th><th>Placa</th><th>Ítem</th><th style={{ textAlign: 'right' }}>Antes</th><th style={{ textAlign: 'right' }}>Ahora</th><th style={{ textAlign: 'right' }}>Cambio</th>
                  </tr>
                </thead>
                <tbody>
                  {c.filas.map(f => (
                    <tr key={f.id} style={{ background: marcadas.has(f.id) ? 'rgba(99,102,241,0.07)' : undefined }}>
                      <td><input type="checkbox" checked={marcadas.has(f.id)} onChange={e => alternar([f.id], e.target.checked)} /></td>
                      <td style={{ whiteSpace: 'nowrap', fontSize: '0.84rem' }}>{new Date(f.fecha).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}</td>
                      <td style={{ fontWeight: 800, letterSpacing: 0.5 }}>{f.placa}</td>
                      <td style={{ fontSize: '0.88rem' }}>
                        {f.descripcion}
                        <span style={{ marginLeft: 6, fontSize: '0.66rem', fontWeight: 700, color: f.tipo === 'nuevo' ? '#0ea5e9' : '#8b5cf6', background: f.tipo === 'nuevo' ? 'rgba(14,165,233,0.12)' : 'rgba(139,92,246,0.12)', padding: '0.05rem 0.45rem', borderRadius: 999 }}>{f.tipo === 'nuevo' ? 'creado' : 'editado'}</span>
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{f.tipo === 'nuevo' ? '—' : money(f.antes)}</td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{money(f.despues)}</td>
                      <td style={{ textAlign: 'right' }}><Delta valor={f.delta} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
        Los valores incluyen IVA cuando el ítem lo aplica. Cada cambio cuenta en el corte de su fecha de aprobación (del 20 de un mes al 20 del siguiente).
      </div>
    </div>
  );
}

// ───────────────────────── Vista principal ─────────────────────────
export default function AsesorView() {
  const navigate = useNavigate();
  const [tema, toggleTema] = useFleetTheme();
  const [user, setUser] = useState(null);
  const [tab, setTab] = useState('ordenes');
  const [ordenes, setOrdenes] = useState(null);
  const [error, setError] = useState(false);
  const [abierta, setAbierta] = useState(null); // id de la orden abierta
  const [q, setQ] = useState('');

  useEffect(() => {
    let u = null;
    try { u = JSON.parse(localStorage.getItem('fleetUser') || 'null'); } catch { /* sin sesión */ }
    if (!u || u.rol !== 'asesor') { navigate('/flota-login'); return; }
    setUser(u);
  }, [navigate]);

  const cargar = useCallback(async () => {
    setError(false);
    try {
      const r = await pedir(`${API_URL}/api/asesor/ordenes`);
      if (!r.ok) throw new Error('no ok');
      setOrdenes(await r.json());
    } catch { setError(true); }
  }, []);
  useEffect(() => { if (user) cargar(); }, [user, cargar]);

  if (!user) return null;

  const salir = () => { localStorage.removeItem('fleetUser'); navigate('/flota-login'); };
  const filtro = q.trim().toLowerCase();
  const visibles = (ordenes || []).filter(o => !filtro || `${o.placa} ${o.marca} ${o.modelo}`.toLowerCase().includes(filtro));
  const orden = abierta != null ? (ordenes || []).find(o => o.id === abierta) : null;

  const tabBtn = (id, texto, Icono) => (
    <button key={id} onClick={() => { setTab(id); setAbierta(null); }}
      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0.45rem 1rem', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem',
        background: tab === id ? 'var(--primary)' : 'transparent', color: tab === id ? 'white' : 'var(--text-muted)' }}>
      <Icono size={15} /> {texto}
    </button>
  );

  return (
    <div data-theme={tema} style={{ minHeight: '100vh', background: 'var(--bg)', ...fleetThemeStyle(tema) }}>
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, lineHeight: 1.1 }}>Ayvens · Asesor {user.nombre}</h1>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: 0 }}>Órdenes activas y cambios por aprobar</p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button onClick={toggleTema} className="theme-toggle" title="Cambiar tema" />
          <button onClick={salir} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.45rem 0.9rem', background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, cursor: 'pointer', color: 'var(--text-muted)', fontWeight: 600, fontSize: '0.85rem' }}>
            <LogOut size={14} /> Salir
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '1.5rem' }}>
        <div style={{ display: 'inline-flex', gap: '0.4rem', background: 'var(--surface)', padding: '0.3rem', borderRadius: 10, border: '1px solid var(--border)', marginBottom: '1.25rem' }}>
          {tabBtn('ordenes', `Órdenes activas${ordenes ? ` (${ordenes.length})` : ''}`, ClipboardList)}
          {tabBtn('historial', 'Historial de cambios', History)}
        </div>

        {tab === 'historial' && <Historial user={user} />}

        {tab === 'ordenes' && (
          error ? (
            <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
              <WifiOff size={26} color="var(--error)" style={{ marginBottom: 8 }} />
              <div style={{ fontWeight: 700, marginBottom: 10 }}>No se pudieron cargar las órdenes</div>
              <button className="btn-primary" onClick={cargar} style={{ margin: '0 auto' }}><RefreshCw size={15} /> Reintentar</button>
            </div>
          ) : ordenes === null ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Cargando órdenes...</div>
          ) : orden ? (
            <OrdenAsesor key={orden.id} orden={orden} user={user} onBack={() => setAbierta(null)} onRefrescar={cargar} />
          ) : (
            <>
              <div style={{ position: 'relative', maxWidth: 360, marginBottom: '1rem' }}>
                <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
                <input type="text" placeholder="Buscar placa o modelo..." value={q} onChange={e => setQ(e.target.value)} style={{ paddingLeft: '2rem', width: '100%', boxSizing: 'border-box' }} />
              </div>
              {visibles.length === 0 ? (
                <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>{ordenes.length === 0 ? 'No hay órdenes activas de Ayvens.' : 'Sin resultados.'}</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                  {visibles.map(o => (
                    <div key={o.id} className="card" onClick={() => setAbierta(o.id)} style={{ padding: '1.1rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                        <div>
                          <div style={{ fontSize: '1.3rem', fontWeight: 900, letterSpacing: 1.2, lineHeight: 1.1 }}>{o.placa}</div>
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{o.marca} {o.modelo} {o.anio || ''}</div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#f59e0b', background: 'rgba(245,158,11,0.15)', padding: '0.1rem 0.55rem', borderRadius: 999 }}>{o.estado}</span>
                          {o.pendientes > 0 && <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#d97706', background: 'rgba(245,158,11,0.12)', padding: '0.05rem 0.45rem', borderRadius: 999 }}>{o.pendientes} por aprobar</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>{o.kilometraje ? `${fmt(o.kilometraje)} km` : 'Sin km'} · {o.items.length} ítem{o.items.length !== 1 ? 's' : ''}</span>
                        <strong>{money(o.total)}</strong>
                      </div>
                      <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem' }}>
                        <span style={{ color: o.aprobada ? '#059669' : 'var(--text-muted)', fontWeight: 600 }}>{o.aprobada ? '✓ PDF disponible' : 'Sin versión aprobada'}</span>
                        <span style={{ display: 'flex', alignItems: 'center', color: 'var(--primary)', fontWeight: 700 }}>Abrir <ChevronRight size={15} /></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )
        )}
      </div>
    </div>
  );
}
