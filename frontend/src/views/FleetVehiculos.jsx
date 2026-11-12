import React, { useMemo, useState } from 'react';
import { Search, X, ChevronRight, ChevronLeft, AlertTriangle, Droplets, Wrench, Settings } from 'lucide-react';
import { getQuoteSlot } from '../quoteUtils';

// Panel "Mis vehículos" del portal de flotas: una ficha por placa con el último
// ingreso, cuántas veces entró al taller en el periodo elegido, el último
// cambio de aceite (buscado dentro de las órdenes de servicio), un resumen de
// lo realizado y, al hacer clic, la vista detallada de todo lo hecho.
//
// El mantenimiento se calcula con intervalos que configura quien administra la
// flota (cada X km o cada Y meses, lo que llegue primero). Como no se registra
// el kilometraje actual, los km de hoy se ESTIMAN con el ritmo que ha llevado el
// vehículo entre sus servicios; por eso se rotulan "estimado".

const DIA = 86400000;
const fmt = (n) => (parseFloat(n) || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 });
const kmNum = (k) => parseInt(String(k ?? '').replace(/\D/g, ''), 10) || 0;
// Las fechas sin hora ("2026-03-01") se leen como mediodía local para que la zona horaria no las corra un día.
const parseF = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(String(d)) ? new Date(`${d}T12:00:00`) : new Date(d));
const fechaTxt = (d) => (d ? parseF(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const normItem = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
const ingresoFecha = (o) => o.fecha || o.fechaEntrega || null; // día en que entró al taller
const servicioFecha = (o) => o.fechaEntrega || o.fecha || null; // día en que salió (o entró, si aún no sale)
const haceTxt = (d) => {
  if (!d) return '';
  const dias = Math.floor((Date.now() - parseF(d)) / DIA);
  if (dias <= 0) return 'hoy';
  if (dias === 1) return 'ayer';
  if (dias < 31) return `hace ${dias} días`;
  const meses = Math.floor(dias / 30.4);
  if (meses < 12) return `hace ${meses} ${meses === 1 ? 'mes' : 'meses'}`;
  const anios = Math.floor(meses / 12), resto = meses % 12;
  return `hace ${anios} ${anios === 1 ? 'año' : 'años'}${resto ? ` y ${resto} m` : ''}`;
};

// Cambio de aceite de MOTOR: cualquier línea con "aceite" que no sea de caja,
// transmisión, diferencial, hidráulico, dirección, etc.
const NO_MOTOR = /caja|transmision|diferencial|hidraul|direccion|atf|valvulina|freno|refrigerante/;
const esAceite = (txt) => { const n = normItem(txt); return n.includes('aceite') && !NO_MOTOR.test(n); };
// "Mantenimiento General" incluye el cambio de aceite, los filtros y una revisión
// (no es lo mismo que "Mantenimiento de Frenos", que no cuenta).
const esMantGeneral = (txt) => { const n = normItem(txt); return /mantenimiento general/.test(n) && !n.includes('freno'); };
const esCambioAceite = (txt) => esAceite(txt) || esMantGeneral(txt);

const ESTADO = {
  vencido: { label: 'Vencido', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', orden: 0 },
  proximo: { label: 'Próximo', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', orden: 1 },
  ok:      { label: 'Al día',  color: '#10b981', bg: 'rgba(16,185,129,0.12)', orden: 2 },
  sin:     { label: 'Sin servicios', color: 'var(--text-muted)', bg: 'rgba(107,114,128,0.12)', orden: 3 },
};

const PERIODOS = [
  { id: '3', label: 'Últimos 3 meses' },
  { id: '6', label: 'Últimos 6 meses' },
  { id: '12', label: 'Últimos 12 meses' },
  { id: 'todo', label: 'Todo el historial' },
];

function analizar(placa, ordenes, calcTotal, cfg, periodo) {
  // Solo órdenes que ya ingresaron al taller (una cita no cuenta como ingreso).
  const lista = [...ordenes].sort((a, b) => parseF(ingresoFecha(b) || 0) - parseF(ingresoFecha(a) || 0));
  const entregadas = lista.filter(o => o.estado === 'Entregado');
  const activa = lista.find(o => o.estado !== 'Entregado') || null;
  const ref = lista[0];
  const costoTotal = entregadas.reduce((s, o) => s + calcTotal(o), 0);

  // Ingresos al taller dentro del periodo elegido.
  const corte = periodo === 'todo' ? null : (() => { const d = new Date(); d.setMonth(d.getMonth() - parseInt(periodo, 10)); return d; })();
  const ingresosPeriodo = lista.filter(o => !corte || parseF(ingresoFecha(o)) >= corte).length;
  const ultimoIngreso = ingresoFecha(lista[0]);

  // Lo realizado: líneas de la cotización real de cada orden (lo que se cobró).
  const trabajos = [];
  lista.forEach(o => {
    const items = (getQuoteSlot(o, 1)?.items || []).filter(it => (it.descripcion || '').trim());
    items.forEach(it => trabajos.push({
      desc: it.descripcion.trim(), cantidad: it.cantidad, precio: it.precio, orden: o,
      fecha: servicioFecha(o),
    }));
  });
  // Resumen: descripciones distintas, de la más reciente a la más antigua.
  const vistos = new Set();
  const resumen = [];
  trabajos.forEach(t => {
    const k = normItem(t.desc);
    if (vistos.has(k)) return;
    vistos.add(k);
    resumen.push(t.desc);
  });

  // Último cambio de aceite: busca en la cotización y en el texto de "servicios"
  // de las órdenes ENTREGADAS y toma la más reciente.
  let aceite = null;
  for (const o of entregadas) {
    const enCotizacion = (getQuoteSlot(o, 1)?.items || []).find(it => esCambioAceite(it.descripcion));
    const enServicios = (o.servicios || '').split(/[,;\n]+/).find(esCambioAceite);
    const hit = enCotizacion?.descripcion || enServicios;
    if (hit) { aceite = { fecha: ingresoFecha(o), km: kmNum(o.kilometraje), orden: o, desc: hit.trim(), porMantenimiento: esMantGeneral(hit) && !esAceite(hit) }; break; }
  }
  const kmMax = Math.max(0, ...lista.map(o => kmNum(o.kilometraje)));
  const refKm = lista.find(o => kmNum(o.kilometraje) > 0);
  const kmActual = refKm ? kmNum(refKm.kilometraje) : 0; // último kilometraje registrado
  let aceiteEstado = 'sin', kmDesdeAceite = null;
  if (aceite) {
    const dias = (Date.now() - parseF(aceite.fecha)) / DIA;
    kmDesdeAceite = aceite.km > 0 && kmActual > aceite.km ? kmActual - aceite.km : null;
    // cfg.km = 0 significa "solo por tiempo": el kilometraje no se tiene en cuenta.
    const usaKm = cfg.km > 0;
    const vencido = dias > cfg.meses * 30.4 || (usaKm && kmDesdeAceite !== null && kmDesdeAceite >= cfg.km);
    const proximo = dias > cfg.meses * 30.4 * 0.85 || (usaKm && kmDesdeAceite !== null && kmDesdeAceite >= cfg.km * 0.85);
    aceiteEstado = vencido ? 'vencido' : proximo ? 'proximo' : 'ok';
  }
  const aceiteEnCurso = !!(activa && ((getQuoteSlot(activa, 1)?.items || []).some(it => esCambioAceite(it.descripcion)) || (activa.servicios || '').split(/[,;\n]+/).some(esCambioAceite)));

  // Fallas (ítems en Malo) que aparecen en 2 o más órdenes distintas.
  const fallas = new Map();
  lista.forEach(o => {
    const rep = (o.reports || []).slice().sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0];
    const v = new Set();
    (rep?.items || []).forEach(it => {
      if (it.state !== 'Malo') return;
      const k = normItem(it.item);
      if (!k || v.has(k)) return;
      v.add(k);
      const f = fallas.get(k) || { item: it.item, veces: 0, ultima: null };
      f.veces += 1;
      const d = ingresoFecha(o);
      if (!f.ultima || parseF(d) > parseF(f.ultima)) f.ultima = d;
      fallas.set(k, f);
    });
  });
  const repetidas = [...fallas.values()].filter(f => f.veces >= 2).sort((a, b) => b.veces - a.veces);

  // Próximo mantenimiento general a partir del último servicio entregado.
  let estado = 'sin', detalle = null;
  const ultimo = entregadas[0];
  if (ultimo) {
    const base = parseF(servicioFecha(ultimo));
    const kmUltimo = kmNum(ultimo.kilometraje) || Math.max(0, ...entregadas.map(o => kmNum(o.kilometraje)));
    const dueFecha = new Date(base); dueFecha.setMonth(dueFecha.getMonth() + cfg.meses);
    const dueKm = kmUltimo > 0 && cfg.km > 0 ? kmUltimo + cfg.km : null;

    // Ritmo de uso: km entre el servicio más antiguo y el más reciente con km.
    const conKm = entregadas.filter(o => kmNum(o.kilometraje) > 0 && servicioFecha(o));
    let kmDia = null;
    if (conKm.length >= 2) {
      const nuevo = conKm[0], viejo = conKm[conKm.length - 1];
      const dias = (parseF(servicioFecha(nuevo)) - parseF(servicioFecha(viejo))) / DIA;
      const dk = kmNum(nuevo.kilometraje) - kmNum(viejo.kilometraje);
      if (dias >= 15 && dk > 0) kmDia = dk / dias;
    }
    // Km de hoy: parte del último kilometraje conocido (de cualquier orden, aunque
    // siga en el taller) y suma el uso estimado desde esa fecha.
    const diasRef = refKm ? Math.max(0, (Date.now() - parseF(ingresoFecha(refKm))) / DIA) : 0;
    const kmEstimado = kmActual > 0 ? Math.round(kmActual + (kmDia ? kmDia * diasRef : 0)) : null;

    const vencePorFecha = Date.now() > dueFecha;
    const vencePorKm = dueKm && kmEstimado ? kmEstimado >= dueKm : false;
    const proxFecha = Date.now() > dueFecha - 30 * DIA;
    const proxKm = dueKm && kmEstimado ? kmEstimado >= dueKm - cfg.km * 0.1 : false;
    estado = (vencePorFecha || vencePorKm) ? 'vencido' : (proxFecha || proxKm) ? 'proximo' : 'ok';
    detalle = { base, dueFecha, dueKm, kmUltimo, kmEstimado, vencePorFecha, vencePorKm };
  }

  return {
    placa, ordenes: lista, ref, activa, estado, detalle, repetidas,
    servicios: entregadas.length, costoTotal, trabajos, resumen,
    ingresosTotal: lista.length, ingresosPeriodo, ultimoIngreso,
    aceite, aceiteEstado, kmDesdeAceite, aceiteEnCurso,
    kmMax, kmActual,
  };
}

const Etiqueta = ({ children }) => (
  <div style={{ color: 'var(--text-muted)', fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>{children}</div>
);

function BloqueAceite({ v, grande }) {
  const e = ESTADO[v.aceiteEstado];
  return (
    <div style={{ borderRadius: 10, padding: grande ? '0.85rem 1rem' : '0.6rem 0.75rem', background: v.aceite ? e.bg : 'rgba(107,114,128,0.08)', border: `1px solid ${v.aceite ? e.color : 'var(--border)'}33` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
        <Droplets size={grande ? 16 : 14} color={v.aceite ? e.color : 'var(--text-muted)'} />
        <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: v.aceite ? e.color : 'var(--text-muted)' }}>Último cambio de aceite</span>
        {v.aceite && <span style={{ marginLeft: 'auto', fontSize: '0.68rem', fontWeight: 800, color: e.color }}>{e.label}</span>}
      </div>
      {v.aceite ? (
        <>
          <div style={{ fontWeight: 800, fontSize: grande ? '1.1rem' : '0.98rem' }}>{fechaTxt(v.aceite.fecha)} <span style={{ fontWeight: 500, fontSize: '0.8rem', color: 'var(--text-muted)' }}>· {haceTxt(v.aceite.fecha)}</span></div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 1 }}>
            {v.aceite.km > 0 ? `a los ${fmt(v.aceite.km)} km` : 'km no registrado'}
            {v.kmDesdeAceite ? ` · ${fmt(v.kmDesdeAceite)} km desde entonces` : ''}
          </div>
          {v.aceite.porMantenimiento && <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>Incluido en el Mantenimiento General</div>}
        </>
      ) : (
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>No hay cambio de aceite en las órdenes entregadas.</div>
      )}
      {v.aceiteEnCurso && <div style={{ fontSize: '0.74rem', color: '#d97706', marginTop: 4, fontWeight: 600 }}>Hay uno incluido en la orden actual (en taller).</div>}
    </div>
  );
}

// Cada cuánto se hace el mantenimiento (cambio de aceite y revisión general):
// la persona que administra la flota lo decide ella misma. Los meses se eligen
// con un toque (4, 6, 8, 12) o se escribe cualquier número; el kilometraje es
// opcional: sin él, el aviso se calcula solo por tiempo.
const MESES_RAPIDOS = [3, 4, 6, 8, 12];
function ConfigMantenimiento({ cfg, onSave }) {
  const [meses, setMeses] = useState(String(cfg.meses));
  const [km, setKm] = useState(cfg.km > 0 ? String(cfg.km) : '');
  const [usaKm, setUsaKm] = useState(cfg.km > 0);
  // Si la configuración llega del servidor después de montar, se refleja aquí.
  React.useEffect(() => { setMeses(String(cfg.meses)); setKm(cfg.km > 0 ? String(cfg.km) : ''); setUsaKm(cfg.km > 0); }, [cfg.meses, cfg.km]);

  const aplicar = (m, k, u) => {
    const mm = Math.min(60, Math.max(1, parseInt(m, 10) || cfg.meses));
    const kk = u ? (parseInt(k, 10) || 5000) : 0;
    if (mm !== cfg.meses || kk !== cfg.km) onSave({ meses: mm, km: kk });
  };
  const elegir = (m) => { setMeses(String(m)); aplicar(m, km, usaKm); };

  return (
    <div className="card" style={{ padding: '0.9rem 1.1rem', marginBottom: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.9rem' }}>
          <Settings size={15} color="var(--primary)" /> Mantenimiento cada
        </span>
        {MESES_RAPIDOS.map(m => (
          <button key={m} onClick={() => elegir(m)}
            style={{ padding: '0.3rem 0.8rem', borderRadius: 20, cursor: 'pointer', fontSize: '0.82rem', fontWeight: 700,
              border: `1.5px solid ${cfg.meses === m ? 'var(--primary)' : 'var(--border)'}`,
              background: cfg.meses === m ? 'var(--primary)' : 'transparent', color: cfg.meses === m ? '#fff' : 'var(--text)' }}>
            {m}
          </button>
        ))}
        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>o</span>
        <input type="text" inputMode="numeric" value={meses} onChange={e => setMeses(e.target.value.replace(/\D/g, ''))}
          onBlur={() => aplicar(meses, km, usaKm)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
          style={{ width: 52, padding: '0.3rem 0.4rem', textAlign: 'center' }} aria-label="Meses entre mantenimientos" />
        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>meses</span>

        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', cursor: 'pointer', color: 'var(--text-muted)' }}>
            <input type="checkbox" checked={usaKm} onChange={e => { setUsaKm(e.target.checked); aplicar(meses, km, e.target.checked); }} />
            también cada
          </label>
          <input type="text" inputMode="numeric" disabled={!usaKm} value={km} placeholder="5000"
            onChange={e => setKm(e.target.value.replace(/\D/g, ''))} onBlur={() => aplicar(meses, km, usaKm)}
            onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
            style={{ width: 80, padding: '0.3rem 0.4rem', textAlign: 'right', opacity: usaKm ? 1 : 0.5 }} aria-label="Kilómetros entre mantenimientos" />
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>km</span>
        </span>
      </div>
      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: 6 }}>
        Con esto se marca cada vehículo como Al día, Próximo o Vencido. Se guarda automáticamente.
      </div>
    </div>
  );
}

export default function FleetVehiculos({ orders, calcTotal, cfg, onSaveCfg, onOpenOrder }) {
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState('todos'); // todos | vencido | proximo
  const [periodo, setPeriodo] = useState('6');
  const [abierta, setAbierta] = useState(null); // placa con la vista detallada

  const vehiculos = useMemo(() => {
    const grupos = new Map();
    orders.forEach(o => {
      if (o.estado === 'Con Cita') return; // una cita aún no es un ingreso
      const p = (o.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!p) return;
      if (!grupos.has(p)) grupos.set(p, []);
      grupos.get(p).push(o);
    });
    return [...grupos.entries()]
      .map(([p, os]) => analizar(p, os, calcTotal, cfg, periodo))
      .sort((a, b) => ESTADO[a.estado].orden - ESTADO[b.estado].orden || a.placa.localeCompare(b.placa));
  }, [orders, cfg, periodo]);

  const conteo = { vencido: 0, proximo: 0 };
  vehiculos.forEach(v => { if (conteo[v.estado] !== undefined) conteo[v.estado]++; });
  const enTaller = vehiculos.filter(v => v.activa).length;
  const ingresosPeriodoTotal = vehiculos.reduce((s, v) => s + v.ingresosPeriodo, 0);
  const periodoTxt = (PERIODOS.find(p => p.id === periodo) || PERIODOS[1]).label.toLowerCase();

  const t = q.trim().toLowerCase();
  const visibles = vehiculos.filter(v =>
    (filtro === 'todos' || v.estado === filtro) &&
    (!t || v.placa.toLowerCase().includes(t) || `${v.ref?.marca || ''} ${v.ref?.modelo || ''}`.toLowerCase().includes(t))
  );

  // ───────────── Vista detallada de un vehículo ─────────────
  const detalle = abierta ? vehiculos.find(v => v.placa === abierta) : null;
  if (detalle) {
    const v = detalle, e = ESTADO[v.estado];
    return (
      <div>
        <button onClick={() => setAbierta(null)} className="btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: '1rem', padding: '0.4rem 0.9rem', fontSize: '0.85rem' }}>
          <ChevronLeft size={15} /> Todos los vehículos
        </button>

        <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '1.7rem', fontWeight: 900, letterSpacing: 1.5, lineHeight: 1.1 }}>{v.placa}</div>
              <div style={{ color: 'var(--text-muted)', marginTop: 2 }}>{v.ref?.marca} {v.ref?.modelo} {v.ref?.anio || ''}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              {v.activa && <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.15)', padding: '0.2rem 0.6rem', borderRadius: 999 }}>En taller</span>}
              <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '0.2rem 0.65rem', borderRadius: 999, background: e.bg, color: e.color }}>Mantenimiento: {e.label}</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem', marginTop: '1.1rem' }}>
            <div><Etiqueta>Último ingreso</Etiqueta><div style={{ fontWeight: 800 }}>{fechaTxt(v.ultimoIngreso)}</div><div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{haceTxt(v.ultimoIngreso)}</div></div>
            <div><Etiqueta>Ingresos ({periodoTxt})</Etiqueta><div style={{ fontWeight: 800, fontSize: '1.3rem' }}>{v.ingresosPeriodo}</div></div>
            <div><Etiqueta>Ingresos totales</Etiqueta><div style={{ fontWeight: 800, fontSize: '1.3rem' }}>{v.ingresosTotal}</div></div>
            <div><Etiqueta>Km registrado</Etiqueta><div style={{ fontWeight: 800 }}>{v.kmActual ? `${fmt(v.kmActual)} km` : '—'}</div>{v.detalle?.kmEstimado && v.detalle.kmEstimado !== v.kmActual && <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>≈ {fmt(v.detalle.kmEstimado)} hoy (estimado)</div>}</div>
            <div><Etiqueta>Costo total</Etiqueta><div style={{ fontWeight: 800, color: '#10b981' }}>{v.costoTotal > 0 ? `$${fmt(v.costoTotal)}` : '—'}</div><div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{v.servicios} servicio{v.servicios !== 1 ? 's' : ''} entregado{v.servicios !== 1 ? 's' : ''}</div></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginTop: '1.1rem' }}>
            <BloqueAceite v={v} grande />
            {v.detalle && (
              <div style={{ borderRadius: 10, padding: '0.85rem 1rem', background: e.bg }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                  <Wrench size={16} color={e.color} />
                  <span style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.04em', color: e.color }}>Próximo mantenimiento</span>
                </div>
                <div style={{ fontSize: '0.85rem' }}>
                  Por fecha: <strong style={{ color: v.detalle.vencePorFecha ? '#ef4444' : undefined }}>{fechaTxt(v.detalle.dueFecha)}</strong>
                  {v.detalle.dueKm && <> · por km: <strong style={{ color: v.detalle.vencePorKm ? '#ef4444' : undefined }}>{fmt(v.detalle.dueKm)}</strong></>}
                </div>
              </div>
            )}
          </div>

          {v.repetidas.length > 0 && (
            <div style={{ marginTop: '1rem', padding: '0.7rem 0.9rem', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.82rem', color: '#d97706', marginBottom: 4 }}>
                <AlertTriangle size={14} /> Fallas que se repiten
              </div>
              {v.repetidas.map(f => (
                <div key={f.item} style={{ fontSize: '0.84rem' }}>{f.item} — <strong>{f.veces} veces</strong> <span style={{ color: 'var(--text-muted)' }}>(última: {fechaTxt(f.ultima)})</span></div>
              ))}
            </div>
          )}
        </div>

        <div style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '1.25rem 0 0.6rem' }}>Todo lo realizado</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {v.ordenes.map(o => {
            const items = (getQuoteSlot(o, 1)?.items || []).filter(it => (it.descripcion || '').trim());
            const entregada = o.estado === 'Entregado';
            return (
              <div key={o.id} className="card" style={{ padding: '1rem 1.1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontWeight: 800 }}>{fechaTxt(ingresoFecha(o))}</span>
                    <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {kmNum(o.kilometraje) > 0 ? ` · ${fmt(kmNum(o.kilometraje))} km` : ''}
                      {entregada && o.fechaEntrega ? ` · entregado ${fechaTxt(o.fechaEntrega)}` : ''}
                    </span>
                    {!entregada && <span style={{ marginLeft: 8, fontSize: '0.7rem', fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.15)', padding: '0.05rem 0.45rem', borderRadius: 999 }}>{o.estado}</span>}
                  </div>
                  <button onClick={() => onOpenOrder(o)} className="btn-secondary" style={{ padding: '0.3rem 0.8rem', fontSize: '0.78rem' }}>Abrir orden</button>
                </div>
                {o.servicios && <div style={{ fontSize: '0.84rem', color: 'var(--text-muted)', marginTop: 6 }}>Solicitado: {o.servicios}</div>}
                {items.length > 0 ? (
                  <div style={{ marginTop: 8 }}>
                    {items.map((it, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.35rem 0', borderTop: '1px solid var(--border)', fontSize: '0.85rem' }}>
                        <span>{it.descripcion}{esCambioAceite(it.descripcion) && <span style={{ marginLeft: 6, fontSize: '0.66rem', fontWeight: 700, color: '#0ea5e9', background: 'rgba(14,165,233,0.12)', padding: '0.05rem 0.4rem', borderRadius: 999 }}>{esMantGeneral(it.descripcion) && !esAceite(it.descripcion) ? 'incluye aceite' : 'aceite'}</span>}</span>
                        <span style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>{(parseFloat(it.cantidad) || 1) > 1 ? `${it.cantidad} × ` : ''}${fmt(it.precio)}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 8, borderTop: '1px solid var(--border)', fontWeight: 800 }}>
                      <span>Total</span><span style={{ color: '#10b981' }}>${fmt(calcTotal(o))}</span>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 6 }}>Aún sin cotización detallada.</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // ───────────── Panel con las fichas ─────────────
  const chip = (id, label, color) => (
    <button key={id} onClick={() => setFiltro(id)}
      style={{ padding: '0.35rem 0.8rem', borderRadius: 20, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700,
        border: `1.5px solid ${filtro === id ? color : 'var(--border)'}`, background: filtro === id ? 'var(--bg)' : 'transparent', color: filtro === id ? color : 'var(--text-muted)' }}>
      {label}
    </button>
  );

  const kpis = [
    { label: 'Vehículos', value: vehiculos.length, color: 'var(--primary)' },
    { label: 'En taller ahora', value: enTaller, color: '#f59e0b' },
    { label: `Ingresos (${periodoTxt})`, value: ingresosPeriodoTotal, color: '#818cf8' },
    { label: 'Mantenimiento vencido', value: conteo.vencido, color: conteo.vencido ? '#ef4444' : '#10b981' },
  ];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
        {kpis.map(k => (
          <div key={k.label} className="card" style={{ padding: '0.85rem 1rem' }}>
            <Etiqueta>{k.label}</Etiqueta>
            <div style={{ fontSize: '1.5rem', fontWeight: 900, color: k.color, lineHeight: 1.1 }}>{k.value}</div>
          </div>
        ))}
      </div>

      <ConfigMantenimiento cfg={cfg} onSave={onSaveCfg} />

      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 180 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input type="text" placeholder="Buscar placa o modelo..." value={q} onChange={e => setQ(e.target.value)} style={{ paddingLeft: '2rem', width: '100%', boxSizing: 'border-box' }} />
          {q && <button onClick={() => setQ('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={14} /></button>}
        </div>
        <select value={periodo} onChange={e => setPeriodo(e.target.value)} title="Periodo para contar los ingresos al taller" style={{ padding: '0.4rem 0.6rem' }}>
          {PERIODOS.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
        </select>
        {chip('todos', `Todos (${vehiculos.length})`, 'var(--primary)')}
        {chip('vencido', `Vencidos (${conteo.vencido})`, '#ef4444')}
        {chip('proximo', `Próximos (${conteo.proximo})`, '#f59e0b')}
      </div>

      {visibles.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          {vehiculos.length === 0 ? 'Aún no hay vehículos.' : 'Sin resultados.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '1rem' }}>
          {visibles.map(v => {
            const e = ESTADO[v.estado];
            const mostrar = v.resumen.slice(0, 5);
            return (
              <div key={v.placa} className="card" onClick={() => setAbierta(v.placa)}
                style={{ padding: '1.1rem', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '0.85rem', borderTop: `3px solid ${e.color}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: '1.35rem', fontWeight: 900, letterSpacing: 1.2, lineHeight: 1.1 }}>{v.placa}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{v.ref?.marca} {v.ref?.modelo} {v.ref?.anio || ''}</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                    {v.activa && <span style={{ fontSize: '0.66rem', fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.15)', padding: '0.05rem 0.45rem', borderRadius: 999 }}>en taller</span>}
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, padding: '0.15rem 0.55rem', borderRadius: 999, background: e.bg, color: e.color, whiteSpace: 'nowrap' }}>{e.label}</span>
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: '0.6rem' }}>
                  <div><Etiqueta>Último ingreso</Etiqueta><div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{fechaTxt(v.ultimoIngreso)}</div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{haceTxt(v.ultimoIngreso)}</div></div>
                  <div><Etiqueta>Ingresos</Etiqueta><div style={{ fontWeight: 800, fontSize: '1.25rem', lineHeight: 1.1 }}>{v.ingresosPeriodo}</div><div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{periodo === 'todo' ? 'en total' : `en ${periodo} meses`}</div></div>
                  <div><Etiqueta>Km</Etiqueta><div style={{ fontWeight: 700, fontSize: '0.88rem' }}>{v.kmActual ? fmt(v.kmActual) : '—'}</div></div>
                </div>

                <BloqueAceite v={v} />

                <div>
                  <Etiqueta>Lo realizado · {v.servicios} servicio{v.servicios !== 1 ? 's' : ''}{v.costoTotal > 0 ? ` · $${fmt(v.costoTotal)}` : ''}</Etiqueta>
                  {mostrar.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
                      {mostrar.map(d => (
                        <span key={d} style={{ fontSize: '0.74rem', padding: '0.15rem 0.5rem', borderRadius: 6, background: 'var(--bg)', border: '1px solid var(--border)', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d}</span>
                      ))}
                      {v.resumen.length > mostrar.length && <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', alignSelf: 'center' }}>+{v.resumen.length - mostrar.length} más</span>}
                    </div>
                  ) : (
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: 3 }}>Sin trabajos cotizados aún.</div>
                  )}
                </div>

                <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 2, fontSize: '0.8rem', fontWeight: 700, color: 'var(--primary)' }}>
                  Ver detalle <ChevronRight size={15} />
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
        El cambio de aceite se busca en la cotización y en los servicios de las órdenes entregadas (cuenta el "Mantenimiento General", que lo incluye). Los km de hoy son una estimación según el ritmo del vehículo.
      </div>
    </div>
  );
}
