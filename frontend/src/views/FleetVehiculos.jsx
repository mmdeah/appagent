import React, { useMemo, useState } from 'react';
import { Search, X, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';

// Pestaña "Vehículos" del portal de flotas: una fila por placa con su hoja de
// vida (servicios, kilometraje, costo, fallas que se repiten) y la alerta de
// próximo mantenimiento según el último servicio entregado.
//
// El próximo mantenimiento se calcula con intervalos que configura quien
// administra la flota (cada X km o cada Y meses, lo que llegue primero). Como
// no se registra el kilometraje actual, los km de hoy se ESTIMAN con el ritmo
// que ha llevado el vehículo entre sus servicios; por eso se rotula "estimado".

const DIA = 86400000;
const fmt = (n) => (parseFloat(n) || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 });
const kmNum = (k) => parseInt(String(k ?? '').replace(/\D/g, ''), 10) || 0;
const fechaOrden = (o) => o.fechaEntrega || o.fecha || null;
// Las fechas sin hora ("2026-03-01") se leen como mediodía local para que la zona horaria no las corra un día.
const parseF = (d) => (/^\d{4}-\d{2}-\d{2}$/.test(String(d)) ? new Date(`${d}T12:00:00`) : new Date(d));
const fechaTxt = (d) => (d ? parseF(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');
const normItem = (t) => (t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

const ESTADO = {
  vencido: { label: 'Vencido', color: '#ef4444', bg: 'rgba(239,68,68,0.12)', orden: 0 },
  proximo: { label: 'Próximo', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', orden: 1 },
  ok:      { label: 'Al día',  color: '#10b981', bg: 'rgba(16,185,129,0.12)', orden: 2 },
  sin:     { label: 'Sin servicios', color: 'var(--text-muted)', bg: 'rgba(107,114,128,0.12)', orden: 3 },
};

function analizar(placa, ordenes, calcTotal, cfg) {
  const lista = [...ordenes].sort((a, b) => parseF(fechaOrden(b) || 0) - parseF(fechaOrden(a) || 0));
  const entregadas = lista.filter(o => o.estado === 'Entregado');
  const activa = lista.find(o => o.estado !== 'Entregado') || null;
  const ref = lista[0];
  const costoTotal = entregadas.reduce((s, o) => s + calcTotal(o), 0);

  // Fallas (ítems en Malo) que aparecen en 2 o más órdenes distintas.
  const fallas = new Map();
  lista.forEach(o => {
    const rep = (o.reports || []).slice().sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0];
    const vistos = new Set();
    (rep?.items || []).forEach(it => {
      if (it.state !== 'Malo') return;
      const k = normItem(it.item);
      if (!k || vistos.has(k)) return;
      vistos.add(k);
      const f = fallas.get(k) || { item: it.item, veces: 0, ultima: null };
      f.veces += 1;
      const d = fechaOrden(o);
      if (!f.ultima || new Date(d) > new Date(f.ultima)) f.ultima = d;
      fallas.set(k, f);
    });
  });
  const repetidas = [...fallas.values()].filter(f => f.veces >= 2).sort((a, b) => b.veces - a.veces);

  // Próximo mantenimiento a partir del último servicio entregado.
  let estado = 'sin', detalle = null;
  const ultimo = entregadas[0];
  if (ultimo) {
    const base = parseF(fechaOrden(ultimo));
    const kmUltimo = kmNum(ultimo.kilometraje) || Math.max(0, ...entregadas.map(o => kmNum(o.kilometraje)));
    const dueFecha = new Date(base); dueFecha.setMonth(dueFecha.getMonth() + cfg.meses);
    const dueKm = kmUltimo > 0 ? kmUltimo + cfg.km : null;

    // Ritmo de uso: km entre el servicio más antiguo y el más reciente con km.
    const conKm = entregadas.filter(o => kmNum(o.kilometraje) > 0 && fechaOrden(o));
    let kmDia = null;
    if (conKm.length >= 2) {
      const nuevo = conKm[0], viejo = conKm[conKm.length - 1];
      const dias = (parseF(fechaOrden(nuevo)) - parseF(fechaOrden(viejo))) / DIA;
      const dk = kmNum(nuevo.kilometraje) - kmNum(viejo.kilometraje);
      if (dias >= 15 && dk > 0) kmDia = dk / dias;
    }
    // Km de hoy: parte del último kilometraje conocido (de cualquier orden, aunque
    // siga en el taller) y suma el uso estimado desde esa fecha.
    const refKm = lista.find(o => kmNum(o.kilometraje) > 0 && fechaOrden(o));
    const kmBase = refKm ? kmNum(refKm.kilometraje) : 0;
    const diasRef = refKm ? Math.max(0, (Date.now() - parseF(fechaOrden(refKm))) / DIA) : 0;
    const kmEstimado = kmBase > 0 ? Math.round(kmBase + (kmDia ? kmDia * diasRef : 0)) : null;

    const vencePorFecha = Date.now() > dueFecha;
    const vencePorKm = dueKm && kmEstimado ? kmEstimado >= dueKm : false;
    const proxFecha = Date.now() > dueFecha - 30 * DIA;
    const proxKm = dueKm && kmEstimado ? kmEstimado >= dueKm - cfg.km * 0.1 : false;
    estado = (vencePorFecha || vencePorKm) ? 'vencido' : (proxFecha || proxKm) ? 'proximo' : 'ok';
    detalle = { base, dueFecha, dueKm, kmUltimo, kmEstimado, vencePorFecha, vencePorKm };
  }

  return {
    placa, ordenes: lista, ref, activa, estado, detalle, repetidas,
    servicios: entregadas.length, costoTotal,
    kmMax: Math.max(0, ...lista.map(o => kmNum(o.kilometraje))),
    ultimaFecha: ultimo ? fechaOrden(ultimo) : null,
  };
}

export default function FleetVehiculos({ orders, calcTotal, cfg, onSaveCfg, onOpenOrder }) {
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState('todos'); // todos | vencido | proximo
  const [abierto, setAbierto] = useState(null);
  const [kmInput, setKmInput] = useState(String(cfg.km));
  const [mesesInput, setMesesInput] = useState(String(cfg.meses));

  const vehiculos = useMemo(() => {
    const grupos = new Map();
    orders.forEach(o => {
      const p = (o.placa || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (!p) return;
      if (!grupos.has(p)) grupos.set(p, []);
      grupos.get(p).push(o);
    });
    return [...grupos.entries()]
      .map(([p, os]) => analizar(p, os, calcTotal, cfg))
      .sort((a, b) => ESTADO[a.estado].orden - ESTADO[b.estado].orden || b.servicios - a.servicios);
  }, [orders, cfg]);

  const conteo = { vencido: 0, proximo: 0 };
  vehiculos.forEach(v => { if (conteo[v.estado] !== undefined) conteo[v.estado]++; });

  const t = q.trim().toLowerCase();
  const visibles = vehiculos.filter(v =>
    (filtro === 'todos' || v.estado === filtro) &&
    (!t || v.placa.toLowerCase().includes(t) || `${v.ref?.marca || ''} ${v.ref?.modelo || ''}`.toLowerCase().includes(t))
  );

  const guardarCfg = () => {
    onSaveCfg({ km: parseInt(kmInput, 10) || 5000, meses: parseInt(mesesInput, 10) || 6 });
  };

  const chip = (id, label, color) => (
    <button key={id} onClick={() => setFiltro(id)}
      style={{ padding: '0.35rem 0.8rem', borderRadius: 20, cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700,
        border: `1.5px solid ${filtro === id ? color : 'var(--border)'}`, background: filtro === id ? 'var(--bg)' : 'transparent', color: filtro === id ? color : 'var(--text-muted)' }}>
      {label}
    </button>
  );

  return (
    <div>
      <div className="card" style={{ padding: '0.9rem 1.1rem', marginBottom: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: '0.88rem' }}>Mantenimiento cada</span>
        <input type="text" value={kmInput} onChange={e => setKmInput(e.target.value.replace(/\D/g, ''))} style={{ width: 90, padding: '0.35rem 0.5rem' }} />
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>km o</span>
        <input type="text" value={mesesInput} onChange={e => setMesesInput(e.target.value.replace(/\D/g, ''))} style={{ width: 55, padding: '0.35rem 0.5rem' }} />
        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>meses (lo que llegue primero)</span>
        <button className="btn-secondary" style={{ padding: '0.35rem 0.9rem', fontSize: '0.8rem' }} onClick={guardarCfg}
          disabled={String(cfg.km) === kmInput && String(cfg.meses) === mesesInput}>Guardar</button>
      </div>

      <div style={{ display: 'flex', gap: '0.6rem', marginBottom: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input type="text" placeholder="Buscar placa o modelo..." value={q} onChange={e => setQ(e.target.value)} style={{ paddingLeft: '2rem', width: '100%', boxSizing: 'border-box' }} />
          {q && <button onClick={() => setQ('')} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}><X size={14} /></button>}
        </div>
        {chip('todos', `Todos (${vehiculos.length})`, 'var(--primary)')}
        {chip('vencido', `Vencidos (${conteo.vencido})`, '#ef4444')}
        {chip('proximo', `Próximos (${conteo.proximo})`, '#f59e0b')}
      </div>

      {visibles.length === 0 ? (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          {vehiculos.length === 0 ? 'Aún no hay vehículos.' : 'Sin resultados.'}
        </div>
      ) : (
        <div className="card" style={{ overflow: 'auto', padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 24 }}></th>
                <th>Placa</th>
                <th>Vehículo</th>
                <th>Último servicio</th>
                <th style={{ textAlign: 'right' }}>Km</th>
                <th style={{ textAlign: 'center' }}>Servicios</th>
                <th style={{ textAlign: 'right' }}>Costo total</th>
                <th>Mantenimiento</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map(v => {
                const e = ESTADO[v.estado];
                const open = abierto === v.placa;
                return (
                  <React.Fragment key={v.placa}>
                    <tr style={{ cursor: 'pointer' }} onClick={() => setAbierto(open ? null : v.placa)}>
                      <td>{open ? <ChevronDown size={14} color="var(--text-muted)" /> : <ChevronRight size={14} color="var(--text-muted)" />}</td>
                      <td style={{ fontWeight: 900, letterSpacing: 1 }}>
                        {v.placa}
                        {v.activa && <span style={{ marginLeft: 6, fontSize: '0.66rem', fontWeight: 700, color: '#f59e0b', background: 'rgba(245,158,11,0.15)', padding: '0.05rem 0.4rem', borderRadius: 999 }}>en taller</span>}
                      </td>
                      <td style={{ fontSize: '0.85rem' }}>{v.ref?.marca} {v.ref?.modelo} {v.ref?.anio || ''}</td>
                      <td style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>{fechaTxt(v.ultimaFecha)}</td>
                      <td style={{ textAlign: 'right', fontSize: '0.85rem' }}>{v.kmMax ? fmt(v.kmMax) : '—'}</td>
                      <td style={{ textAlign: 'center' }}>{v.servicios}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#10b981' }}>{v.costoTotal > 0 ? `$${fmt(v.costoTotal)}` : '—'}</td>
                      <td>
                        <span style={{ fontSize: '0.74rem', fontWeight: 800, padding: '0.2rem 0.6rem', borderRadius: 999, background: e.bg, color: e.color, whiteSpace: 'nowrap' }}>{e.label}</span>
                      </td>
                    </tr>
                    {open && (
                      <tr>
                        <td colSpan={8} style={{ background: 'var(--bg)', padding: '1rem 1.25rem' }}>
                          {v.detalle ? (
                            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1rem', fontSize: '0.85rem' }}>
                              <div>
                                <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Por fecha</div>
                                <div style={{ fontWeight: 600, color: v.detalle.vencePorFecha ? '#ef4444' : undefined }}>{fechaTxt(v.detalle.dueFecha)}</div>
                              </div>
                              {v.detalle.dueKm && (
                                <div>
                                  <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Por kilometraje</div>
                                  <div style={{ fontWeight: 600, color: v.detalle.vencePorKm ? '#ef4444' : undefined }}>{fmt(v.detalle.dueKm)} km</div>
                                </div>
                              )}
                              {v.detalle.kmEstimado && (
                                <div>
                                  <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase' }}>Km hoy (estimado)</div>
                                  <div style={{ fontWeight: 600 }}>≈ {fmt(v.detalle.kmEstimado)} km</div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>Aún no tiene servicios entregados para calcular el mantenimiento.</div>
                          )}

                          {v.repetidas.length > 0 && (
                            <div style={{ marginBottom: '1rem', padding: '0.7rem 0.9rem', borderRadius: 10, background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, fontSize: '0.82rem', color: '#d97706', marginBottom: 4 }}>
                                <AlertTriangle size={14} /> Fallas que se repiten
                              </div>
                              {v.repetidas.map(f => (
                                <div key={f.item} style={{ fontSize: '0.84rem' }}>
                                  {f.item} — <strong>{f.veces} veces</strong> <span style={{ color: 'var(--text-muted)' }}>(última: {fechaTxt(f.ultima)})</span>
                                </div>
                              ))}
                            </div>
                          )}

                          <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 6 }}>Historial</div>
                          {v.ordenes.map(o => (
                            <div key={o.id} onClick={() => onOpenOrder(o)}
                              style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', padding: '0.5rem 0', borderTop: '1px solid var(--border)', cursor: 'pointer', fontSize: '0.84rem' }}>
                              <span style={{ minWidth: 0 }}>
                                <strong>{fechaTxt(fechaOrden(o))}</strong>
                                {kmNum(o.kilometraje) > 0 && <span style={{ color: 'var(--text-muted)' }}> · {fmt(kmNum(o.kilometraje))} km</span>}
                                <span style={{ display: 'block', color: 'var(--text-muted)', fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.servicios || 'Sin descripción'}</span>
                              </span>
                              <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                                <span style={{ fontWeight: 700, color: '#10b981' }}>{o.estado === 'Entregado' ? (calcTotal(o) > 0 ? `$${fmt(calcTotal(o))}` : '—') : o.estado}</span>
                              </span>
                            </div>
                          ))}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)', marginTop: '0.75rem' }}>
        El mantenimiento se calcula desde el último servicio entregado. Los km de hoy son una estimación según el ritmo del vehículo entre sus servicios.
      </div>
    </div>
  );
}
