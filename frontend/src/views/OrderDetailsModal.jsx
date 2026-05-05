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
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const PAYMENT_METHODS = ['Efectivo', 'Nequi', 'Bancolombia', 'Banco de Bogota', 'Tarjeta'];

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
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: 'Inter', sans-serif; font-size: 12px; color: #1e293b; padding: 40px; line-height: 1.5; }
          .header-title { font-size: 24px; font-weight: 800; color: #2563eb; text-transform: uppercase; margin-bottom: 24px; border-bottom: 2px solid #f1f5f9; padding-bottom: 12px; }
          .section-header { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #2563eb; margin: 24px 0 12px; display: flex; align-items: center; gap: 8px; }
          .section-header::after { content: ''; flex: 1; height: 1px; background: #e2e8f0; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 24px; }
          .info-block h3 { font-size: 10px; text-transform: uppercase; color: #64748b; margin-bottom: 8px; font-weight: 700; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 4px; border-bottom: 1px solid #f8fafc; padding-bottom: 2px; }
          .info-row span:first-child { font-weight: 600; color: #475569; }
          .info-row span:last-child { color: #1e293b; font-weight: 500; }
          
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th { text-align: left; padding: 12px 8px; border-bottom: 2px solid #2563eb; color: #2563eb; font-size: 10px; text-transform: uppercase; font-weight: 700; }
          td { padding: 12px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
          .col-num { color: #94a3b8; font-weight: 600; width: 30px; }
          .col-desc { font-weight: 500; }
          .col-price { font-weight: 600; text-align: right; white-space: nowrap; }
          .col-iva { color: #10b981; font-weight: 700; text-align: right; white-space: nowrap; }
          .col-total { font-weight: 700; text-align: right; white-space: nowrap; }
          
          .totals-container { margin-top: 32px; display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
          .total-row { display: flex; justify-content: space-between; width: 240px; font-size: 13px; color: #64748b; }
          .total-row.final { font-size: 18px; font-weight: 800; color: #1e293b; border-top: 2px solid #e2e8f0; padding-top: 12px; margin-top: 4px; }
          
          .badge { padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; }
          .badge-good { background: #dcfce7; color: #166534; }
          .badge-warn { background: #fef9c3; color: #854d0e; }
          .badge-bad { background: #fee2e2; color: #991b1b; }
          
          @media print { body { padding: 0; } .header-title { margin-top: 0; } }
        </style>
      </head><body>${bodyHtml}
      <script>window.onload = function(){ window.print(); }<\/script>
      </body></html>
    `);
    win.document.close();
  };

  const printInfo = () => {
    printWindow(`Orden ${order.placa}`, `
      <div class="header-title">Orden de Servicio</div>
      
      <div class="section-header">Información de la Orden</div>
      <div style="margin-bottom: 24px">
        <div class="info-row" style="width: 300px"><span>Número de Orden:</span> <span>ORD-${order.id.substring(0,8).toUpperCase()}</span></div>
        <div class="info-row" style="width: 300px"><span>Fecha de Emisión:</span> <span>${new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
        <div class="info-row" style="width: 300px"><span>Estado:</span> <span>${order.estado}</span></div>
      </div>

      <div class="info-grid">
        <div class="info-block">
          <h3>Datos del Cliente</h3>
          <div class="info-row"><span>Nombre:</span> <span>${order.cliente}</span></div>
          <div class="info-row"><span>Teléfono:</span> <span>${order.telefono}</span></div>
          <div class="info-row"><span>Email:</span> <span>${order.correo || 'N/A'}</span></div>
        </div>
        <div class="info-block">
          <h3>Datos del Vehículo</h3>
          <div class="info-row"><span>Marca/Modelo:</span> <span>${order.marca} ${order.modelo}</span></div>
          <div class="info-row"><span>Placa:</span> <span>${order.placa}</span></div>
          <div class="info-row"><span>Año:</span> <span>${order.anio}</span></div>
          <div class="info-row"><span>Kilometraje:</span> <span>${order.kilometraje ? fmt(order.kilometraje) + ' KM' : 'N/A'}</span></div>
        </div>
      </div>

      ${order.servicios ? `<div class="section-header">Servicios Solicitados</div><p style="padding: 12px; background: #f8fafc; border-radius: 8px;">${order.servicios}</p>` : ''}
      ${order.notas ? `<div class="section-header">Notas Adicionales</div><p style="padding: 12px; background: #fffbeb; border-radius: 8px; color: #92400e;">${order.notas}</p>` : ''}
    `);
  };

  const printReport = () => {
    if (!reportData) return;
    const stateBadge = { Bueno: 'badge-good', Regular: 'badge-warn', Malo: 'badge-bad' };
    const rows = reportData.items.map((it, i) => `
      <tr>
        <td class="col-num">${i + 1}</td>
        <td class="col-desc"><strong>${it.item}</strong><br><small style="color: #64748b">${it.category}</small></td>
        <td style="text-align: center"><span class="badge ${stateBadge[it.state] || ''}">${it.state}</span></td>
        <td style="text-align: center">${it.requiereRepuesto ? 'SI' : 'NO'}</td>
        <td class="col-price">${it.manoObra > 0 ? '$' + fmt(it.manoObra) + ' COP' : '—'}</td>
      </tr>
    `).join('');
    printWindow(`Reporte Técnico ${order.placa}`, `
      <div class="header-title">Reporte de Inspección</div>
      
      <div class="info-grid">
        <div class="info-block">
          <h3>Información General</h3>
          <div class="info-row"><span>Orden ID:</span> <span>ORD-${order.id.substring(0,8).toUpperCase()}</span></div>
          <div class="info-row"><span>Fecha:</span> <span>${new Date(reportData.fecha).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
          <div class="info-row"><span>Placa:</span> <span>${order.placa}</span></div>
        </div>
        <div class="info-block">
          <h3>Vehículo</h3>
          <div class="info-row"><span>Marca:</span> <span>${order.marca}</span></div>
          <div class="info-row"><span>Modelo:</span> <span>${order.modelo}</span></div>
          <div class="info-row"><span>Kilometraje:</span> <span>${order.kilometraje ? fmt(order.kilometraje) + ' KM' : 'N/A'}</span></div>
        </div>
      </div>

      <div class="section-header">Resultados de la Revisión</div>
      <table>
        <thead>
          <tr>
            <th>#</th><th>Descripción / Sistema</th><th style="text-align: center">Estado</th><th style="text-align: center">Repuesto</th><th style="text-align: right">Mano de Obra</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `);
  };

  const printQuote = () => {
    const sub = totals.sub, iva = totals.iva, total = totals.total;
    const rows = quoteItems.map((it, i) => {
      const lineTotal = it.precio * it.cantidad;
      const lineIva = it.aplicaIva ? lineTotal * 0.19 : 0;
      return `
        <tr>
          <td class="col-num">${i + 1}</td>
          <td class="col-desc">${it.descripcion}</td>
          <td style="text-align: center">${it.cantidad}</td>
          <td class="col-price">$${fmt(it.precio)} COP</td>
          <td class="col-iva">${lineIva > 0 ? '$' + fmt(lineIva) + ' COP' : '—'}</td>
          <td class="col-total">$${fmt(lineTotal + lineIva)} COP</td>
        </tr>
      `;
    }).join('');
    printWindow(`Cotización ${order.placa}`, `
      <div class="header-title">${order.estado === 'Entregado' ? 'Factura de Venta' : 'Cotización'}</div>
      
      <div class="section-header">Información de la Orden</div>
      <div style="margin-bottom: 24px">
        <div class="info-row" style="width: 300px"><span>Número de Orden:</span> <span>COT-${order.id.substring(0,8).toUpperCase()}</span></div>
        <div class="info-row" style="width: 300px"><span>Fecha de Emisión:</span> <span>${new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
        <div class="info-row" style="width: 300px"><span>Estado:</span> <span>${order.estado}</span></div>
      </div>

      <div class="info-grid">
        <div class="info-block">
          <h3>Datos del Cliente</h3>
          <div class="info-row"><span>Nombre:</span> <span>${order.cliente}</span></div>
          <div class="info-row"><span>Teléfono:</span> <span>${order.telefono}</span></div>
          <div class="info-row"><span>Email:</span> <span>${order.correo || 'N/A'}</span></div>
        </div>
        <div class="info-block">
          <h3>Datos del Vehículo</h3>
          <div class="info-row"><span>Marca/Modelo:</span> <span>${order.marca} ${order.modelo}</span></div>
          <div class="info-row"><span>Placa:</span> <span>${order.placa}</span></div>
          <div class="info-row"><span>Año:</span> <span>${order.anio}</span></div>
        </div>
      </div>

      <div class="section-header">Servicios Cotizados</div>
      <table>
        <thead>
          <tr>
            <th>#</th><th>Descripción</th><th style="text-align: center">Cant.</th><th style="text-align: right">Precio Unit.</th><th style="text-align: right">IVA</th><th style="text-align: right">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="totals-container">
        <div class="total-row"><span>Subtotal:</span> <span>$${fmt(sub)} COP</span></div>
        <div class="total-row"><span>IVA (19%):</span> <span>$${fmt(iva)} COP</span></div>
        <div class="total-row final"><span>TOTAL:</span> <span>$${fmt(total)} COP</span></div>
      </div>
      
      <div style="margin-top: 60px; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 10px; color: #94a3b8; text-align: center;">
        Esta es una representación física de un documento digital. Generado por AppTaller2.
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
      body: JSON.stringify({ estado: 'Entregado', fechaEntrega: new Date().toISOString(), metodoPago })
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
              <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem', lineHeight: 1.6, fontSize: '0.9rem' }}>
                ¿Confirmas que el vehículo ha sido entregado y el cliente ha realizado el pago total?
              </p>
              <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Método de Pago del Cliente:</label>
                <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)} style={{ width: '100%' }}>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button className="btn-secondary" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setShowConfirm(false)}>Cancelar</button>
                <button className="btn-primary" style={{ flex: 1, justifyContent: 'center', background: 'var(--success)', borderColor: 'var(--success)', color: 'white' }} onClick={doDeliver}>Confirmar Pago y Entrega</button>
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
