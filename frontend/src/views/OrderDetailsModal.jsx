import React, { useState } from 'react';
import { API_URL } from '../api';
import { MessageCircle, Printer, CheckCircle, X, Plus, Trash2, Camera } from 'lucide-react';

const fmt = (n) => (parseFloat(n) || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 });

export default function OrderDetailsModal({ order, onClose }) {
  const [activeTab, setActiveTab] = useState('info');
  const [reportData, setReportData] = useState(order.reports?.[0] || null);
  const [quoteItems, setQuoteItems] = useState(
    order.quotes?.[0]?.items || [{ descripcion: '', cantidad: 1, precio: 0, aplicaIva: false }]
  );
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });
  const [showConfirm, setShowConfirm] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);

  const showStatus = (text, type = 'success') => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg({ text: '', type: '' }), 3000);
  };

  const printWindow = (title, bodyHtml) => {
    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(`
      <!DOCTYPE html><html><head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; font-size: 13px; color: #111; padding: 24px; }
          h1 { font-size: 20px; font-weight: 800; margin-bottom: 4px; }
          h2 { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: #555; border-bottom: 1px solid #ddd; padding-bottom: 4px; margin: 16px 0 8px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          th { text-align: left; padding: 6px 10px; background: #f4f4f4; font-size: 11px; text-transform: uppercase; border-bottom: 2px solid #ddd; }
          td { padding: 6px 10px; border-bottom: 1px solid #eee; vertical-align: top; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 24px; margin-bottom: 16px; }
          .lbl { font-size: 10px; text-transform: uppercase; color: #888; font-weight: 600; }
          .val { font-size: 13px; font-weight: 500; }
          .total-box { width: 260px; margin-left: auto; border: 1px solid #ddd; border-radius: 8px; padding: 12px; }
          .total-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px; color: #555; }
          .total-final { display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; border-top: 2px solid #ddd; padding-top: 8px; color: #059669; }
          .badge-good { color: #059669; font-weight: 700; } .badge-warn { color: #d97706; font-weight: 700; } .badge-bad { color: #dc2626; font-weight: 700; }
          @media print { body { padding: 0; } }
        </style>
      </head><body>${bodyHtml}
      <script>window.onload = function(){ window.print(); }<\/script>
      </body></html>
    `);
    win.document.close();
  };

  const printInfo = () => {
    const rows = [
      ['Placa', order.placa], ['Marca', order.marca], ['Modelo', order.modelo],
      ['Año', order.anio], ['Kilometraje', order.kilometraje ? `${fmt(order.kilometraje)} km` : 'N/A'],
      ['Cliente', order.cliente], ['Teléfono', order.telefono], ['Estado', order.estado],
    ].map(([l,v]) => `<div><div class="lbl">${l}</div><div class="val">${v || '—'}</div></div>`).join('');
    printWindow(`Orden ${order.placa}`, `
      <h1>${order.placa} — ${order.marca} ${order.modelo} ${order.anio}</h1>
      <p style="color:#555;margin-bottom:16px">${order.cliente} &bull; ${order.telefono}</p>
      <h2>Datos del Vehículo y Cliente</h2><div class="grid">${rows}</div>
      ${order.servicios ? `<h2>Servicios a Realizar</h2><p>${order.servicios}</p>` : ''}
      ${order.notas ? `<h2>Notas</h2><p>${order.notas}</p>` : ''}
    `);
  };

  const printReport = () => {
    if (!reportData) return;
    const stateClass = { Bueno: 'badge-good', Regular: 'badge-warn', Malo: 'badge-bad' };
    const rows = reportData.items.map(it => `
      <tr>
        <td>${it.category}</td><td>${it.item}</td>
        <td class="${stateClass[it.state] || ''}">${it.state}</td>
        <td>${it.manoObra ? '$' + fmt(it.manoObra) : '—'}</td>
        <td>${it.requiereRepuesto ? (it.cantidadRepuesto||1)+'x $'+(it.valorRepuesto ? fmt(it.valorRepuesto) : '?') : '—'}</td>
        <td>${it.recibeReparacion ? (it.valorReparacion ? '$'+fmt(it.valorReparacion) : 'Pendiente') : '—'}</td>
      </tr>
    `).join('');
    printWindow(`Reporte Técnico ${order.placa}`, `
      <h1>Reporte Técnico — ${order.placa}</h1>
      <p style="color:#555;margin-bottom:16px">${order.marca} ${order.modelo} ${order.anio} &bull; ${order.cliente}</p>
      <h2>Revisión de Componentes</h2>
      <table><thead><tr><th>Categoría</th><th>Ítem</th><th>Estado</th><th>Mano de Obra</th><th>Repuesto</th><th>Reparación</th></tr></thead><tbody>${rows}</tbody></table>
    `);
  };

  const printQuote = () => {
    const sub = totals.sub, iva = totals.iva, total = totals.total;
    const rows = quoteItems.map(it => `
      <tr>
        <td>${it.descripcion}</td><td style="text-align:center">${it.cantidad}</td>
        <td style="text-align:right">$${fmt(it.precio)}</td>
        <td style="text-align:center">${it.aplicaIva ? 'Sí' : 'No'}</td>
        <td style="text-align:right;font-weight:700">$${fmt(it.precio*it.cantidad*(it.aplicaIva?1.19:1))}</td>
      </tr>
    `).join('');
    printWindow(`Cotización ${order.placa}`, `
      <h1>Cotización — ${order.placa}</h1>
      <p style="color:#555;margin-bottom:16px">${order.marca} ${order.modelo} ${order.anio} &bull; ${order.cliente} &bull; ${order.telefono}</p>
      <h2>Detalle de Servicios</h2>
      <table><thead><tr><th style="width:40%">Descripción</th><th>Cant.</th><th>Vr. Unitario</th><th>+IVA</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="total-box">
        <div class="total-row"><span>Subtotal</span><span>$${fmt(sub)}</span></div>
        <div class="total-row"><span>IVA (19%)</span><span>$${fmt(iva)}</span></div>
        <div class="total-final"><span>TOTAL</span><span>$${fmt(total)}</span></div>
      </div>
    `);
  };

  const handleReportPrice = (idx, field, val) => {
    const nr = { ...reportData, items: [...reportData.items] };
    nr.items[idx][field] = val;
    setReportData(nr);
  };

  const saveReport = async () => {
    if (!reportData) return;
    await fetch(`${API_URL}/reports/${reportData.id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reportData)
    });
    showStatus('Precios del reporte actualizados');
  };

  const saveQuote = async () => {
    const payload = { orderId: order.id, items: quoteItems, fecha: new Date().toISOString() };
    if (order.quotes?.length > 0) {
      await fetch(`${API_URL}/quotes/${order.quotes[0].id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
    } else {
      await fetch(`${API_URL}/quotes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
    }
    showStatus('Cotización guardada exitosamente');
  };

  const doDeliver = async () => {
    await fetch(`${API_URL}/orders/${order.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'Entregado', fechaEntrega: new Date().toISOString() })
    });
    onClose();
  };

  const transferToQuote = () => {
    if (!reportData || !reportData.items) return;
    const newItems = [];
    reportData.items.forEach(it => {
      const mO = parseFloat(it.manoObra) || 0;
      const vRep = parseFloat(it.valorReparacion) || 0;
      const vRepuesto = parseFloat(it.valorRepuesto) || 0;
      const cRepuesto = parseInt(it.cantidadRepuesto) || 1;

      if (mO > 0) newItems.push({ descripcion: `Mano de obra: ${it.item}`, cantidad: 1, precio: mO, aplicaIva: false });
      if (vRep > 0) newItems.push({ descripcion: `Reparación: ${it.item}`, cantidad: 1, precio: vRep, aplicaIva: false });
      if (vRepuesto > 0) newItems.push({ descripcion: `Repuesto: ${it.item}`, cantidad: cRepuesto, precio: vRepuesto, aplicaIva: false });
    });

    if (newItems.length > 0) {
      const current = quoteItems.filter(q => q.descripcion.trim() !== '' || q.precio > 0);
      setQuoteItems([...current, ...newItems]);
      setActiveTab('cotizacion');
      showStatus('Valores transferidos a la cotización', 'success');
    } else {
      showStatus('No hay valores mayores a $0 para transferir', 'warning');
    }
  };

  const calcTotals = () => {
    let sub = 0, iva = 0;
    quoteItems.forEach(it => {
      const lt = it.precio * it.cantidad;
      sub += lt;
      if (it.aplicaIva) iva += lt * 0.19;
    });
    return { sub, iva, total: sub + iva };
  };
  const totals = calcTotals();

  const stateColor = { Bueno: '#34d399', Regular: '#fbbf24', Malo: '#f87171' };

  const tabs = [
    { id: 'info', label: 'Información' },
    { id: 'reporte', label: 'Reporte Técnico' },
    { id: 'cotizacion', label: 'Cotización' },
  ];

  return (<>
    <div className="modal-overlay">
      <div className="modal-box" style={{ maxWidth: 960 }}>
        <button onClick={onClose} className="hide-on-print"
          style={{ position: 'absolute', top: '1.25rem', right: '1.25rem', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
          <X size={22} />
        </button>

        {/* Header */}
        <div style={{ marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
            <span style={{ fontWeight: 800, fontSize: '1.4rem' }}>{order.placa}</span>
            <span className={`badge ${order.estado === 'Calidad' ? 'badge-green' : order.estado === 'Proceso' ? 'badge-yellow' : 'badge-blue'}`}>{order.estado}</span>
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            {order.marca} {order.modelo} {order.anio} &nbsp;·&nbsp;
            <span style={{ color: 'var(--text)' }}>{order.cliente}</span> &nbsp;·&nbsp;
            {order.telefono}
          </p>
        </div>

        {statusMsg.text && (
          <div className={`toast toast-${statusMsg.type} hide-on-print`}>{statusMsg.text}</div>
        )}

        <div className="tabs hide-on-print">
          {tabs.map(t => (
            <button key={t.id} className={`tab-btn ${activeTab === t.id ? 'active' : ''}`} onClick={() => setActiveTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="printable-content">

          {/* ── INFO TAB ── */}
          {activeTab === 'info' && (
            <div>
              {/* Datos completos */}
              <p className="section-title">Datos del Cliente</p>
              <div className="info-grid" style={{ marginBottom: '1.5rem' }}>
                {[
                  ['Cliente', order.cliente],
                  ['Teléfono', order.telefono],
                  ['Correo', order.correo || 'No registrado'],
                  ['Fecha Ingreso', order.fecha ? new Date(order.fecha).toLocaleDateString('es-CO') : 'N/A'],
                ].map(([l,v]) => (
                  <div key={l} className="info-item">
                    <div className="info-label">{l}</div>
                    <div className="info-value">{v}</div>
                  </div>
                ))}
              </div>

              <p className="section-title">Datos del Vehículo</p>
              <div className="info-grid" style={{ marginBottom: '1.5rem' }}>
                {[
                  ['Placa', order.placa],
                  ['Marca', order.marca],
                  ['Modelo', order.modelo],
                  ['Año', order.anio],
                  ['Kilometraje', order.kilometraje ? `${fmt(order.kilometraje)} km` : 'N/A'],
                  ['Estado', order.estado],
                ].map(([l,v]) => (
                  <div key={l} className="info-item">
                    <div className="info-label">{l}</div>
                    <div className="info-value">{v}</div>
                  </div>
                ))}
                {order.servicios && (
                  <div className="info-item" style={{ gridColumn: '1 / -1' }}>
                    <div className="info-label">Servicios a Realizar</div>
                    <div className="info-value">{order.servicios}</div>
                  </div>
                )}
                {order.notas && (
                  <div className="info-item" style={{ gridColumn: '1 / -1' }}>
                    <div className="info-label">Notas</div>
                    <div className="info-value">{order.notas}</div>
                  </div>
                )}
              </div>

              {/* Fotos de ingreso */}
              {order.fotos?.length > 0 && (
                <>
                  <p className="section-title"><Camera size={12} style={{ display: 'inline', marginRight: 4 }} />Fotos de Ingreso</p>
                  <div className="img-grid" style={{ marginBottom: '1.5rem', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
                    {order.fotos.map((src, i) => (
                      <img key={i} src={src} className="img-thumb" alt={`ingreso-${i}`}
                        onClick={() => setLightboxSrc(src)}
                        title="Clic para ver en grande" />
                    ))}
                  </div>
                </>
              )}

              <div className="hide-on-print" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                <a href={`https://wa.me/${order.telefono}?text=Hola%20${encodeURIComponent(order.cliente || '')},%20te%20escribimos%20del%20Taller%20Automotriz%20sobre%20tu%20veh%C3%ADculo%20${order.placa}`}
                  target="_blank" rel="noreferrer"
                  className="btn-success" style={{ textDecoration: 'none' }}>
                  <MessageCircle size={16} /> WhatsApp
                </a>
                <button onClick={printInfo} className="btn-secondary"><Printer size={16} /> Imprimir</button>
                <button onClick={() => setShowConfirm(true)} className="btn-success" style={{ marginLeft: 'auto' }}>
                  <CheckCircle size={16} /> Entregar Vehículo
                </button>
              </div>
            </div>
          )}

          {/* ── REPORTE TAB ── */}
          {activeTab === 'reporte' && (
            <div>
              <p className="section-title">Reporte Técnico del Técnico</p>
              {!reportData ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  El técnico aún no ha subido el reporte de revisión.
                </div>
              ) : (
                <>
                  <table className="data-table" style={{ marginBottom: '1.5rem' }}>
                    <thead>
                      <tr>
                        <th>Categoría</th>
                        <th>Ítem</th>
                        <th>Estado</th>
                        <th>M. de Obra ($)</th>
                        <th>Repuesto</th>
                        <th>Vr. Reparación ($)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.items.map((it, idx) => (
                        <tr key={idx}>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{it.category}</td>
                          <td style={{ fontWeight: 500 }}>{it.item}</td>
                          <td>
                            <span style={{ color: stateColor[it.state] || 'var(--text)', fontWeight: 600, fontSize: '0.82rem' }}>{it.state}</span>
                          </td>
                          <td>
                            {it.state === 'Bueno' ? <span style={{ color: 'var(--text-muted)' }}>—</span> : (
                              <>
                                <span className="show-on-print">{it.manoObra ? `$${fmt(it.manoObra)}` : '—'}</span>
                                <input className="hide-on-print price-input" type="text" placeholder="0" value={it.manoObra ? fmt(it.manoObra) : ''}
                                  onChange={e => handleReportPrice(idx, 'manoObra', e.target.value.replace(/\D/g, ''))}
                                  style={{ width: 100, fontSize: '0.82rem' }} />
                              </>
                            )}
                          </td>
                          <td style={{ fontSize: '0.82rem' }}>
                            {it.requiereRepuesto ? (
                               <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                 <span style={{ fontWeight: 600, color: 'var(--warning)' }}>✓ Requiere</span>
                                 <div className="hide-on-print" style={{ display: 'flex', gap: '0.4rem' }}>
                                    <input type="number" min="1" placeholder="Cant" value={it.cantidadRepuesto || 1} onChange={e => handleReportPrice(idx, 'cantidadRepuesto', parseInt(e.target.value)||1)} style={{ width: 55, fontSize: '0.8rem', padding: '0.4rem' }} />
                                    <input type="text" className="price-input" placeholder="$ Valor" value={it.valorRepuesto ? fmt(it.valorRepuesto) : ''} onChange={e => handleReportPrice(idx, 'valorRepuesto', e.target.value.replace(/\D/g, ''))} style={{ width: 90, fontSize: '0.8rem', padding: '0.4rem' }} />
                                 </div>
                                 <span className="show-on-print">
                                    {it.cantidadRepuesto || 1}x {it.valorRepuesto ? `$${fmt(it.valorRepuesto)}` : 'Pendiente'}
                                 </span>
                               </div>
                            ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>
                          <td>
                            {it.recibeReparacion ? (
                              <>
                                <span className="show-on-print">{it.valorReparacion ? `$${fmt(it.valorReparacion)}` : 'Pendiente'}</span>
                                <input className="hide-on-print price-input" type="text" placeholder="Pendiente"
                                  value={it.valorReparacion ? fmt(it.valorReparacion) : ''}
                                  onChange={e => handleReportPrice(idx, 'valorReparacion', e.target.value.replace(/\D/g, ''))}
                                  style={{ width: 110, fontSize: '0.82rem' }} />
                              </>
                            ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {reportData.scannerCodes?.filter(c => c.code).length > 0 && (
                    <>
                      <p className="section-title">Códigos de Escáner</p>
                      <div style={{ display: 'grid', gap: '0.5rem', marginBottom: '1.5rem' }}>
                        {reportData.scannerCodes.filter(c => c.code).map((c, i) => (
                          <div key={i} style={{ display: 'flex', gap: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 6 }}>
                            <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#f87171' }}>{c.prefix}{c.code}</span>
                            <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{c.description}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}

                  <div className="hide-on-print" style={{ display: 'flex', gap: '0.75rem', marginTop: '1rem' }}>
                    <button onClick={saveReport} className="btn-primary">Guardar Precios</button>
                    <button onClick={transferToQuote} className="btn-success" style={{ marginLeft: 'auto' }}>
                      Pasar valores a Cotización
                    </button>
                    <button onClick={printReport} className="btn-secondary"><Printer size={16} /> Imprimir Reporte</button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── COTIZACIÓN TAB ── */}
          {activeTab === 'cotizacion' && (
            <div>
              <p className="section-title">Cotización / Cuenta de Cobro</p>
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '40%' }}>Descripción</th>
                    <th style={{ textAlign: 'center' }}>Cant.</th>
                    <th style={{ textAlign: 'center' }}>Vr. Unitario</th>
                    <th style={{ textAlign: 'center' }}>+IVA 19%</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th className="hide-on-print" style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {quoteItems.map((it, idx) => {
                    const lt = it.precio * it.cantidad;
                    const total = it.aplicaIva ? lt * 1.19 : lt;
                    return (
                      <tr key={idx}>
                        <td>
                          <input className="hide-on-print" type="text" placeholder="Descripción" value={it.descripcion}
                            onChange={e => { const q=[...quoteItems]; q[idx].descripcion=e.target.value; setQuoteItems(q); }}
                            style={{ fontSize: '0.85rem' }} />
                          <span className="show-on-print">{it.descripcion}</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input className="hide-on-print" type="number" min="1" value={it.cantidad}
                            onChange={e => { const q=[...quoteItems]; q[idx].cantidad=parseInt(e.target.value)||1; setQuoteItems(q); }}
                            style={{ width: 55, textAlign: 'center', fontSize: '0.85rem' }} />
                          <span className="show-on-print">{it.cantidad}</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input className="hide-on-print price-input" type="text" placeholder="0" value={it.precio ? fmt(it.precio) : ''}
                            onChange={e => { const q=[...quoteItems]; q[idx].precio=parseFloat(e.target.value.replace(/\D/g, ''))||0; setQuoteItems(q); }}
                            style={{ width: 110, textAlign: 'right', fontSize: '0.85rem' }} />
                          <span className="show-on-print">${fmt(it.precio)}</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <input className="hide-on-print" type="checkbox"
                            checked={it.aplicaIva}
                            onChange={e => { const q=[...quoteItems]; q[idx].aplicaIva=e.target.checked; setQuoteItems(q); }} />
                          <span className="show-on-print">{it.aplicaIva ? 'Sí' : 'No'}</span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }} className="price">${fmt(total)}</td>
                        <td className="hide-on-print" style={{ textAlign: 'center' }}>
                          <button onClick={() => setQuoteItems(quoteItems.filter((_, i) => i !== idx))}
                            style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="hide-on-print" style={{ marginTop: '0.75rem', marginBottom: '1.5rem' }}>
                <button className="btn-secondary" style={{ fontSize: '0.82rem' }} onClick={() => setQuoteItems([...quoteItems, { descripcion: '', cantidad: 1, precio: 0, aplicaIva: false }])}>
                  <Plus size={14} /> Añadir ítem
                </button>
              </div>

              {/* Totals box */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '1.5rem' }}>
                <div style={{ width: 300, background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 10, padding: '1rem' }}>
                  {[
                    ['Subtotal', `$${fmt(totals.sub)}`],
                    ['IVA (19%)', `$${fmt(totals.iva)}`],
                  ].map(([l,v]) => (
                    <div key={l} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                      <span>{l}</span><span>{v}</span>
                    </div>
                  ))}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 800, fontSize: '1.1rem', borderTop: '1px solid var(--border)', paddingTop: '0.75rem', color: 'var(--success)' }}>
                    <span>TOTAL</span><span>${fmt(totals.total)}</span>
                  </div>
                </div>
              </div>

              <div className="hide-on-print" style={{ display: 'flex', gap: '0.75rem' }}>
                <button onClick={saveQuote} className="btn-primary">Guardar Cotización</button>
                <button onClick={printQuote} className="btn-secondary"><Printer size={16} /> Imprimir / PDF</button>
              </div>
            </div>
          )}
        </div>

        {/* Confirm delivery */}
        {showConfirm && (
          <div className="modal-overlay hide-on-print" style={{ zIndex: 2000 }}>
            <div className="modal-box" style={{ maxWidth: 420, textAlign: 'center' }}>
              <h3 style={{ fontWeight: 700, marginBottom: '0.75rem', color: 'var(--warning)' }}>⚠ Confirmar Entrega</h3>
              <p style={{ color: 'var(--text-muted)', marginBottom: '2rem', lineHeight: 1.6, fontSize: '0.9rem' }}>
                ¿Seguro que deseas entregar el vehículo <strong style={{ color: 'var(--text)' }}>{order.placa}</strong>?<br/>
                Se descargará un archivo con toda la información y la orden saldrá del tablero.
              </p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowConfirm(false)}>Cancelar</button>
                <button className="btn-danger" style={{ flex: 1, justifyContent: 'center' }} onClick={doDeliver}>Sí, Entregar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Lightbox para fotos */}
    {lightboxSrc && (
      <div className="lightbox-overlay" onClick={() => setLightboxSrc(null)}>
        <button
          onClick={() => setLightboxSrc(null)}
          style={{ position: 'fixed', top: '1rem', right: '1.5rem', background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: '50%', width: 38, height: 38, cursor: 'pointer', color: 'white', fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}
        >×</button>
        <img src={lightboxSrc} alt="foto ampliada" onClick={e => e.stopPropagation()} />
      </div>
    )}
  </>);
}
