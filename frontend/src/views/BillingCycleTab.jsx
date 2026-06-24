import React, { useState } from 'react';
import { API_URL } from '../api';
import { BadgeCheck, Ban, Clock, X, MoveRight, Plus, Trash2 } from 'lucide-react';

const fmt = n => (parseFloat(n) || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 });
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const calcOrderTotal = (o) => {
  const q = o.quotes?.find(q => q.autorizada) || o.quotes?.[0];
  if (!q) return 0;
  return (q.items || []).reduce((sum, i) => {
    const lt = (Number(i.precio) || 0) * (Number(i.cantidad) || 1);
    return sum + lt + (i.aplicaIva ? lt * 0.19 : 0);
  }, 0);
};

const getCyclePeriodLabel = (year, month) => {
  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear  = month === 1 ? year - 1 : year;
  return {
    period: `20 de ${MESES[prevMonth - 1]} ${prevYear} — 20 de ${MESES[month - 1]} ${year}`,
    cutDate: `20 de ${MESES[month - 1]} ${year}`
  };
};

const getCycleIdFromDate = (fecha) => {
  const d = new Date(fecha);
  let cm = d.getMonth() + 1;
  let cy = d.getFullYear();
  if (d.getDate() >= 20) { cm++; if (cm > 12) { cm = 1; cy++; } }
  return `${cy}-${String(cm).padStart(2, '00')}`;
};

const EMPTY_MANUAL = { placa: '', cliente: '', vehiculo: '', fecha: '', total: '', descripcion: '' };

export default function BillingCycleTab({
  orders, clientFilter, billings, collection,
  onRefreshBillings, onRefreshOrders,
  title, emptyMsg, onOrderClick
}) {
  const [localSelected, setLocalSelected] = useState({});
  const [movingOrder, setMovingOrder]     = useState(null);
  const [moveTarget, setMoveTarget]       = useState('');
  const [manualModal, setManualModal]     = useState(null); // { cycleId, year, month, billing }
  const [manualForm, setManualForm]       = useState(EMPTY_MANUAL);

  // Build cycles — respect fleetCycleOverride per order
  const clientOrders = orders.filter(o => clientFilter(o.cliente) && o.estado === 'Entregado');
  const grouped = {};
  clientOrders.forEach(o => {
    if (!o.fecha) return;
    const key = o.fleetCycleOverride || getCycleIdFromDate(o.fecha);
    const [cy, cm] = key.split('-').map(Number);
    if (!grouped[key]) grouped[key] = { year: cy, month: cm, ordersList: [] };
    grouped[key].ordersList.push(o);
  });

  // Also include cycles that only have manual entries (no app orders)
  billings.forEach(b => {
    if (!grouped[b.id] && (b.manualEntries || []).length > 0) {
      grouped[b.id] = { year: b.year, month: b.month, ordersList: [] };
    }
  });

  const cycles = Object.entries(grouped).map(([key, data]) => ({
    ...data, id: key,
    billing: billings.find(b => b.id === key) || null,
    ordersList: data.ordersList.sort((a, b) => new Date(a.fecha) - new Date(b.fecha))
  })).sort((a, b) => b.id.localeCompare(a.id));

  // Available target cycles for the move modal (existing + next 3 months)
  const availableCycleIds = [...new Set(cycles.map(c => c.id))];
  const now = new Date();
  for (let i = 0; i < 4; i++) {
    let m = now.getMonth() + 1 + i;
    let y = now.getFullYear();
    if (m > 12) { m -= 12; y++; }
    const key = `${y}-${String(m).padStart(2, '0')}`;
    if (!availableCycleIds.includes(key)) availableCycleIds.push(key);
  }
  availableCycleIds.sort().reverse();

  // Status badge helper
  const getStatus = (billing) => {
    if (!billing || !billing.fechaEnvio)
      return { label: 'Pendiente de facturar', color: 'var(--text-muted)', bg: 'rgba(255,255,255,0.05)', icon: <Clock size={14}/> };
    if (billing.pagado)
      return { label: `Pagado · ${new Date(billing.fechaPago).toLocaleDateString('es-CO')}`, color: '#10b981', bg: 'rgba(16,185,129,0.1)', icon: <BadgeCheck size={14}/> };
    const venc = new Date(billing.fechaVencimiento);
    if (venc < new Date()) {
      const dias = Math.ceil((new Date() - venc) / 86400000);
      return { label: `VENCIDO hace ${dias}d · ${venc.toLocaleDateString('es-CO')}`, color: '#ef4444', bg: 'rgba(239,68,68,0.1)', icon: <Ban size={14}/> };
    }
    const dias = Math.ceil((venc - new Date()) / 86400000);
    return { label: `Esperando pago · vence ${venc.toLocaleDateString('es-CO')} (${dias}d)`, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', icon: <Clock size={14}/> };
  };

  // Selection
  const toggleSelect = (cycleId, rowId) => {
    setLocalSelected(prev => {
      const set = new Set(prev[cycleId] || []);
      const key = String(rowId);
      if (set.has(key)) set.delete(key); else set.add(key);
      return { ...prev, [cycleId]: set };
    });
  };

  const getAllRowIds = (cycle) => [
    ...cycle.ordersList.map(o => String(o.id)),
    ...(cycle.billing?.manualEntries || []).map(e => `m_${e.id}`)
  ];

  const toggleSelectAll = (cycleId, rowIds) => {
    setLocalSelected(prev => {
      const cur = prev[cycleId] || new Set();
      const allSel = rowIds.every(id => cur.has(id));
      return { ...prev, [cycleId]: allSel ? new Set() : new Set(rowIds) };
    });
  };

  // Mark selected OK
  const markSelectedOK = async (cycleId, cycle) => {
    const selected = [...(localSelected[cycleId] || new Set())];
    if (!selected.length) return;
    const existing = (cycle.billing?.approvedOrderIds || []).map(String);
    const merged = [...new Set([...existing, ...selected])];
    if (cycle.billing) {
      await fetch(`${API_URL}/${collection}/${cycleId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedOrderIds: merged })
      });
    } else {
      await fetch(`${API_URL}/${collection}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cycleId, year: cycle.year, month: cycle.month, fechaEnvio: null, fechaVencimiento: null, pagado: false, fechaPago: null, approvedOrderIds: merged, manualEntries: [] })
      });
    }
    setLocalSelected(prev => ({ ...prev, [cycleId]: new Set() }));
    onRefreshBillings();
  };

  const unmarkOK = async (cycleId, rowId, billing) => {
    if (!billing) return;
    const updated = (billing.approvedOrderIds || []).filter(id => String(id) !== String(rowId));
    await fetch(`${API_URL}/${collection}/${cycleId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approvedOrderIds: updated })
    });
    onRefreshBillings();
  };

  // Billing actions
  const markFacturada = async (cycleId, year, month, billing) => {
    const fechaEnvio = new Date().toISOString();
    const venc = new Date(); venc.setDate(venc.getDate() + 30);
    const fechaVencimiento = venc.toISOString();
    if (billing) {
      await fetch(`${API_URL}/${collection}/${cycleId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fechaEnvio, fechaVencimiento })
      });
    } else {
      await fetch(`${API_URL}/${collection}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cycleId, year, month, fechaEnvio, fechaVencimiento, pagado: false, fechaPago: null, approvedOrderIds: [], manualEntries: [] })
      });
    }
    onRefreshBillings();
  };

  const markPagada = async (cycleId) => {
    await fetch(`${API_URL}/${collection}/${cycleId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pagado: true, fechaPago: new Date().toISOString() })
    });
    onRefreshBillings();
  };

  // Move order
  const doMove = async () => {
    if (!movingOrder || !moveTarget) return;
    await fetch(`${API_URL}/orders/${movingOrder.orderId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fleetCycleOverride: moveTarget })
    });
    setMovingOrder(null);
    setMoveTarget('');
    onRefreshOrders();
  };

  // Manual entry helpers
  const openManualModal = (cycle) => {
    setManualModal({ cycleId: cycle.id, year: cycle.year, month: cycle.month, billing: cycle.billing });
    setManualForm(EMPTY_MANUAL);
  };

  const saveManualEntry = async () => {
    if (!manualForm.placa || !manualForm.total) return;
    const entry = {
      id: Date.now(),
      placa: manualForm.placa.toUpperCase().trim(),
      cliente: manualForm.cliente.trim(),
      vehiculo: manualForm.vehiculo.trim(),
      fecha: manualForm.fecha,
      total: parseFloat(manualForm.total) || 0,
      descripcion: manualForm.descripcion.trim(),
    };
    const { cycleId, year, month, billing } = manualModal;
    if (billing) {
      const existing = billing.manualEntries || [];
      await fetch(`${API_URL}/${collection}/${cycleId}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manualEntries: [...existing, entry] })
      });
    } else {
      await fetch(`${API_URL}/${collection}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: cycleId, year, month, fechaEnvio: null, fechaVencimiento: null, pagado: false, fechaPago: null, approvedOrderIds: [], manualEntries: [entry] })
      });
    }
    setManualModal(null);
    onRefreshBillings();
  };

  const deleteManualEntry = async (cycleId, entryId, billing) => {
    if (!billing) return;
    const updated = (billing.manualEntries || []).filter(e => e.id !== entryId);
    await fetch(`${API_URL}/${collection}/${cycleId}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ manualEntries: updated })
    });
    onRefreshBillings();
  };

  // Total helpers including manual entries
  const getManualTotal = (entry) => entry.total || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, margin: 0 }}>{title}</h2>
          <p style={{ color: 'var(--text-muted)', margin: '0.2rem 0 0' }}>Corte el día 20 de cada mes · pago a 30 días desde el corte</p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {[
            { label: 'Ciclos', val: cycles.length, color: 'var(--primary)' },
            { label: 'Pendientes', val: cycles.filter(c => !c.billing?.fechaEnvio).length, color: '#f59e0b' },
            { label: 'Vencidos', val: billings.filter(b => !b.pagado && b.fechaVencimiento && new Date(b.fechaVencimiento) < new Date()).length, color: '#ef4444' },
            { label: 'Pagados', val: billings.filter(b => b.pagado).length, color: '#10b981' },
          ].map(s => (
            <div key={s.label} className="card" style={{ padding: '0.6rem 1rem', textAlign: 'center', minWidth: 65 }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 900, color: s.color }}>{s.val}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {cycles.length === 0 && (
        <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', borderStyle: 'dashed' }}>{emptyMsg}</div>
      )}

      {/* Cycle cards */}
      {cycles.map(cycle => {
        const st = getStatus(cycle.billing);
        const { period, cutDate } = getCyclePeriodLabel(cycle.year, cycle.month);
        const approvedIds  = new Set((cycle.billing?.approvedOrderIds || []).map(String));
        const selectedIds  = localSelected[cycle.id] || new Set();
        const manualEntries = cycle.billing?.manualEntries || [];
        const allRowIds    = getAllRowIds(cycle);
        const allSel       = allRowIds.length > 0 && allRowIds.every(id => selectedIds.has(id));

        const appTotal     = cycle.ordersList.reduce((s, o) => s + calcOrderTotal(o), 0);
        const manualTotal  = manualEntries.reduce((s, e) => s + getManualTotal(e), 0);
        const totalAll     = appTotal + manualTotal;
        const totalOK      = [
          ...cycle.ordersList.filter(o => approvedIds.has(String(o.id))).map(o => calcOrderTotal(o)),
          ...manualEntries.filter(e => approvedIds.has(`m_${e.id}`)).map(e => getManualTotal(e))
        ].reduce((a, b) => a + b, 0);
        const totalSelected = [
          ...cycle.ordersList.filter(o => selectedIds.has(String(o.id))).map(o => calcOrderTotal(o)),
          ...manualEntries.filter(e => selectedIds.has(`m_${e.id}`)).map(e => getManualTotal(e))
        ].reduce((a, b) => a + b, 0);
        const selCount = selectedIds.size;
        const rowCount = cycle.ordersList.length + manualEntries.length;

        return (
          <div key={cycle.id} className="card" style={{ padding: '1.5rem', borderLeft: `4px solid ${st.color}` }}>

            {/* Card header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800, margin: 0 }}>Corte {cutDate}</h3>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>Período: {period}</div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.5rem', padding: '0.3rem 0.75rem', background: st.bg, borderRadius: 20, fontSize: '0.85rem', fontWeight: 700, color: st.color }}>
                  {st.icon} {st.label}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 900 }}>${fmt(totalAll)}</div>
                {totalOK > 0 && <div style={{ fontSize: '0.85rem', color: '#10b981', fontWeight: 700 }}>OK: ${fmt(totalOK)}</div>}
                {selCount > 0 && <div style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 700 }}>Selec: ${fmt(totalSelected)}</div>}
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{rowCount} factura{rowCount !== 1 ? 's' : ''}</div>
              </div>
            </div>

            {/* Selection action bar */}
            {selCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem 1rem', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 8, marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: '0.9rem', flex: 1 }}>
                  {selCount} seleccionado{selCount !== 1 ? 's' : ''} · ${fmt(totalSelected)}
                </span>
                <button className="btn-primary" style={{ fontSize: '0.82rem', padding: '0.3rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}
                  onClick={() => markSelectedOK(cycle.id, cycle)}>
                  <BadgeCheck size={13}/> Marcar OK
                </button>
                <button className="btn-secondary" style={{ fontSize: '0.82rem', padding: '0.3rem 0.7rem' }}
                  onClick={() => setLocalSelected(prev => ({ ...prev, [cycle.id]: new Set() }))}>
                  Limpiar
                </button>
              </div>
            )}

            {/* Table */}
            <div style={{ overflowX: 'auto' }}>
              <table className="data-table" style={{ marginBottom: '0.75rem', minWidth: 640 }}>
                <thead>
                  <tr>
                    <th style={{ width: 36, textAlign: 'center' }}>
                      <input type="checkbox" checked={allSel}
                        onChange={() => toggleSelectAll(cycle.id, allRowIds)}
                        style={{ cursor: 'pointer', width: 16, height: 16 }} />
                    </th>
                    <th>Placa</th>
                    <th>Cliente</th>
                    <th>Vehículo</th>
                    <th>Fecha entrega</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th style={{ textAlign: 'center' }}>Estado</th>
                    <th style={{ textAlign: 'center' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {/* App orders */}
                  {cycle.ordersList.map(o => {
                    const rowId    = String(o.id);
                    const isOK       = approvedIds.has(rowId);
                    const isSelected = selectedIds.has(rowId);
                    const oTotal     = calcOrderTotal(o);
                    return (
                      <tr key={o.id} style={{
                        background: isSelected ? 'rgba(99,102,241,0.08)' : isOK ? 'rgba(16,185,129,0.05)' : 'transparent',
                        outline: isSelected ? '1px solid rgba(99,102,241,0.25)' : 'none'
                      }}>
                        <td style={{ textAlign: 'center' }}>
                          <input type="checkbox" checked={isSelected}
                            onChange={() => toggleSelect(cycle.id, rowId)}
                            style={{ cursor: 'pointer', width: 16, height: 16 }} />
                        </td>
                        <td style={{ fontWeight: 700, cursor: 'pointer' }} onClick={() => onOrderClick(o)}>
                          {o.placa}
                          {o.fleetCycleOverride && <span title="Movido manualmente" style={{ marginLeft: '0.3rem', fontSize: '0.7rem', color: '#f59e0b', fontWeight: 800 }}>★</span>}
                        </td>
                        <td style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>{o.cliente}</td>
                        <td style={{ cursor: 'pointer' }} onClick={() => onOrderClick(o)}>{o.marca} {o.modelo}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                          {o.fecha ? new Date(o.fecha).toLocaleDateString('es-CO') : '—'}
                        </td>
                        <td style={{ fontWeight: 700, textAlign: 'right' }}>${fmt(oTotal)}</td>
                        <td style={{ textAlign: 'center' }}>
                          {isOK ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#10b981', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', padding: '0.2rem 0.5rem', background: 'rgba(16,185,129,0.12)', borderRadius: 12 }}
                              title="Clic para quitar OK"
                              onClick={() => { if (window.confirm('¿Quitar estado OK?')) unmarkOK(cycle.id, rowId, cycle.billing); }}>
                              <BadgeCheck size={13}/> OK
                            </span>
                          ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>—</span>}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button style={{ background: 'none', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.78rem', padding: '0.2rem 0.5rem', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                            onClick={() => { setMovingOrder({ orderId: o.id, placa: o.placa, fromCycleId: cycle.id }); setMoveTarget(''); }}>
                            <MoveRight size={12}/> Mover
                          </button>
                        </td>
                      </tr>
                    );
                  })}

                  {/* Manual entries */}
                  {manualEntries.map(e => {
                    const rowId    = `m_${e.id}`;
                    const isOK     = approvedIds.has(rowId);
                    const isSelected = selectedIds.has(rowId);
                    return (
                      <tr key={rowId} style={{
                        background: isSelected ? 'rgba(99,102,241,0.08)' : isOK ? 'rgba(16,185,129,0.05)' : 'rgba(245,158,11,0.04)',
                        outline: isSelected ? '1px solid rgba(99,102,241,0.25)' : 'none'
                      }}>
                        <td style={{ textAlign: 'center' }}>
                          <input type="checkbox" checked={isSelected}
                            onChange={() => toggleSelect(cycle.id, rowId)}
                            style={{ cursor: 'pointer', width: 16, height: 16 }} />
                        </td>
                        <td style={{ fontWeight: 700 }}>
                          {e.placa}
                          <span style={{ marginLeft: '0.4rem', fontSize: '0.68rem', color: '#f59e0b', fontWeight: 800, background: 'rgba(245,158,11,0.12)', padding: '0.1rem 0.4rem', borderRadius: 8 }}>Manual</span>
                        </td>
                        <td style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>{e.cliente || '—'}</td>
                        <td style={{ fontSize: '0.9rem' }}>{e.vehiculo || (e.descripcion || '—')}</td>
                        <td style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                          {e.fecha ? new Date(e.fecha).toLocaleDateString('es-CO') : '—'}
                        </td>
                        <td style={{ fontWeight: 700, textAlign: 'right' }}>${fmt(e.total)}</td>
                        <td style={{ textAlign: 'center' }}>
                          {isOK ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', color: '#10b981', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', padding: '0.2rem 0.5rem', background: 'rgba(16,185,129,0.12)', borderRadius: 12 }}
                              title="Clic para quitar OK"
                              onClick={() => { if (window.confirm('¿Quitar estado OK?')) unmarkOK(cycle.id, rowId, cycle.billing); }}>
                              <BadgeCheck size={13}/> OK
                            </span>
                          ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>—</span>}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <button style={{ background: 'none', border: '1px solid rgba(239,68,68,0.4)', cursor: 'pointer', color: '#ef4444', fontSize: '0.78rem', padding: '0.2rem 0.5rem', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}
                            onClick={() => { if (window.confirm(`¿Eliminar factura manual ${e.placa}?`)) deleteManualEntry(cycle.id, e.id, cycle.billing); }}>
                            <Trash2 size={12}/>
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals summary */}
            <div style={{ display: 'flex', gap: '1.5rem', padding: '0.6rem 1rem', background: 'rgba(255,255,255,0.03)', borderRadius: 8, marginBottom: '1rem', flexWrap: 'wrap', fontSize: '0.88rem', fontWeight: 600 }}>
              <span>Total: <strong>${fmt(totalAll)}</strong></span>
              <span style={{ color: '#10b981' }}>OK: <strong>${fmt(totalOK)}</strong></span>
              <span style={{ color: 'var(--text-muted)' }}>Pendiente: <strong>${fmt(totalAll - totalOK)}</strong></span>
            </div>

            {/* Billing actions */}
            <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button className="btn-secondary" style={{ fontSize: '0.88rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                onClick={() => openManualModal(cycle)}>
                <Plus size={14}/> Agregar factura manual
              </button>
              {!cycle.billing?.fechaEnvio && (
                <button className="btn-primary" style={{ fontSize: '0.9rem' }}
                  onClick={() => { if (window.confirm(`¿Marcar factura del Corte ${cutDate} como enviada hoy?`)) markFacturada(cycle.id, cycle.year, cycle.month, cycle.billing); }}>
                  Marcar factura enviada
                </button>
              )}
              {cycle.billing?.fechaEnvio && !cycle.billing?.pagado && (
                <button className="btn-secondary" style={{ fontSize: '0.9rem', color: '#10b981', borderColor: '#10b981', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  onClick={() => { if (window.confirm('¿Confirmar pago recibido?')) markPagada(cycle.id); }}>
                  <BadgeCheck size={15}/> Marcar pagado
                </button>
              )}
              {cycle.billing?.fechaEnvio && (
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Factura enviada: {new Date(cycle.billing.fechaEnvio).toLocaleDateString('es-CO')}
                  {cycle.billing.fechaVencimiento && ` · Vence: ${new Date(cycle.billing.fechaVencimiento).toLocaleDateString('es-CO')}`}
                </span>
              )}
            </div>
          </div>
        );
      })}

      {/* Move modal */}
      {movingOrder && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontWeight: 800, fontSize: '1.15rem', margin: 0 }}>
                Mover <span style={{ color: 'var(--primary)' }}>{movingOrder.placa}</span>
              </h3>
              <button onClick={() => setMovingOrder(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18}/>
              </button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              Selecciona el corte destino. El vehículo quedará fijado allí con una marca ★.
            </p>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.4rem' }}>Corte destino</label>
            <select value={moveTarget} onChange={e => setMoveTarget(e.target.value)} style={{ width: '100%', marginBottom: '1.25rem', padding: '0.6rem' }}>
              <option value="">-- Seleccionar corte --</option>
              {availableCycleIds.filter(id => id !== movingOrder.fromCycleId).map(id => {
                const [y, m] = id.split('-').map(Number);
                const { cutDate: cd, period: per } = getCyclePeriodLabel(y, m);
                return <option key={id} value={id}>Corte {cd} · {per}</option>;
              })}
            </select>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setMovingOrder(null)}>Cancelar</button>
              <button className="btn-primary" style={{ flex: 1 }} disabled={!moveTarget} onClick={doMove}>Confirmar</button>
            </div>
            {orders.find(o => o.id === movingOrder.orderId)?.fleetCycleOverride && (
              <button style={{ width: '100%', marginTop: '0.75rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', fontSize: '0.85rem', padding: '0.4rem' }}
                onClick={async () => {
                  await fetch(`${API_URL}/orders/${movingOrder.orderId}`, {
                    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ fleetCycleOverride: null })
                  });
                  setMovingOrder(null);
                  onRefreshOrders();
                }}>
                Restaurar al corte original (quitar ★)
              </button>
            )}
          </div>
        </div>
      )}

      {/* Manual entry modal */}
      {manualModal && (
        <div className="modal-overlay">
          <div className="modal-box" style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontWeight: 800, fontSize: '1.15rem', margin: 0 }}>
                Agregar factura manual
              </h3>
              <button onClick={() => setManualModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                <X size={18}/>
              </button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              Corte: <strong>{getCyclePeriodLabel(manualModal.year, manualModal.month).cutDate}</strong>
            </p>

            {[
              { label: 'Placa *', key: 'placa', placeholder: 'ABC123', type: 'text' },
              { label: 'Cliente', key: 'cliente', placeholder: 'Nombre del cliente', type: 'text' },
              { label: 'Vehículo / Descripción', key: 'vehiculo', placeholder: 'Ej. Toyota Hilux', type: 'text' },
              { label: 'Fecha de entrega', key: 'fecha', placeholder: '', type: 'date' },
              { label: 'Total (sin formato) *', key: 'total', placeholder: '350000', type: 'number' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: '0.9rem' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>{f.label}</label>
                <input
                  type={f.type}
                  placeholder={f.placeholder}
                  value={manualForm[f.key]}
                  onChange={e => setManualForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={{ width: '100%' }}
                />
              </div>
            ))}
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.3rem' }}>Notas adicionales</label>
              <textarea
                placeholder="Observaciones opcionales..."
                value={manualForm.descripcion}
                onChange={e => setManualForm(prev => ({ ...prev, descripcion: e.target.value }))}
                rows={2}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setManualModal(null)}>Cancelar</button>
              <button className="btn-primary" style={{ flex: 1 }} disabled={!manualForm.placa || !manualForm.total} onClick={saveManualEntry}>
                Guardar factura
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
