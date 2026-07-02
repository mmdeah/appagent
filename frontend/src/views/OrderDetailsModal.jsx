import React, { useState, useRef } from 'react';
import { API_URL, BACKEND_URL } from '../api';
import { MessageCircle, Printer, CheckCircle, X, Plus, Trash2, Camera, Edit2, Save, FileText, Upload, Download } from 'lucide-react';

const fmt = (n) => (parseFloat(n) || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 });

const PAYMENT_METHODS = ['Efectivo', 'Nequi', 'Bancolombia', 'Banco de Bogota', 'Tarjeta'];

export default function OrderDetailsModal({ order, onClose, fleetMode = false, initialTab = 'info', onUpdate }) {
  const [activeTab, setActiveTab] = useState(initialTab);
  const [reportData, setReportData] = useState(order.reports?.[0] || null);
  const [quoteItems, setQuoteItems] = useState(
    order.quotes?.[0]?.items || [{ descripcion: '', cantidad: 1, precio: 0, aplicaIva: false }]
  );
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });
  const [showConfirm, setShowConfirm] = useState(false);
  const [lightboxSrc, setLightboxSrc] = useState(null);
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [notasEntrega, setNotasEntrega] = useState(order.notasEntrega || '');
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [showPriority, setShowPriority] = useState(() => localStorage.getItem('quote_show_priority') !== 'false');
  const [editedOrder, setEditedOrder] = useState({ ...order });
  const [showAddItem, setShowAddItem] = useState(false);
  const [newItem, setNewItem] = useState({ category: '', item: '', state: 'Malo', manoObra: '', requiereRepuesto: false, cantidadRepuesto: 1, valorRepuesto: '', recibeReparacion: false, valorReparacion: '' });
  const [savingApprovals, setSavingApprovals] = useState(false);

  const REPORT_CATEGORIES = ['Suspensión','Frenos','Dirección','Transmisión','Fugas','Batería / Eléctrico','Chequeo Visual Motor','Niveles','Otros','Insumos','Servicios Especializados'];
  const ITEM_STATES = ['Bueno','Regular','Malo'];

  const handleSaveApprovals = async () => {
    const quote = order.quotes?.[0];
    if (!quote) return;
    setSavingApprovals(true);
    try {
      await fetch(`${API_URL}/quotes/${quote.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: quoteItems }),
      });
      showStatus('Aprobaciones guardadas');
      onUpdate && onUpdate();
    } catch (e) { console.error(e); }
    finally { setSavingApprovals(false); }
  };

  const handleAddReportItem = async () => {
    if (!newItem.category || !newItem.item) return;
    const item = {
      category: newItem.category,
      item: newItem.item,
      state: newItem.state,
      manoObra: newItem.state !== 'Bueno' ? newItem.manoObra : '',
      requiereRepuesto: newItem.state !== 'Bueno' ? newItem.requiereRepuesto : false,
      cantidadRepuesto: newItem.requiereRepuesto ? newItem.cantidadRepuesto : 1,
      valorRepuesto: newItem.requiereRepuesto ? newItem.valorRepuesto : '',
      recibeReparacion: newItem.state !== 'Bueno' ? newItem.recibeReparacion : false,
      valorReparacion: newItem.recibeReparacion ? newItem.valorReparacion : '',
    };
    let updatedReport;
    if (!reportData || !reportData.items) {
      // Create new report from scratch
      const payload = { orderId: order.id, items: [item], scannerCodes: [], precioDiagnostico: 0, fecha: new Date().toISOString() };
      const res = await fetch(`${API_URL}/reports`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      updatedReport = await res.json();
    } else {
      updatedReport = { ...reportData, items: [...reportData.items, item] };
      await fetch(`${API_URL}/reports/${reportData.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedReport) });
    }
    setReportData(updatedReport);
    setNewItem({ category: '', item: '', state: 'Malo', manoObra: '', requiereRepuesto: false, cantidadRepuesto: 1, valorRepuesto: '', recibeReparacion: false, valorReparacion: '' });
    setShowAddItem(false);
    showStatus('Ítem agregado al reporte');
  };

  const handleDeleteReportItem = async (idx) => {
    const updatedReport = { ...reportData, items: reportData.items.filter((_, i) => i !== idx) };
    await fetch(`${API_URL}/reports/${reportData.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedReport) });
    setReportData(updatedReport);
    showStatus('Ítem eliminado');
  };

  const showStatus = (text, type = 'success') => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg({ text: '', type: '' }), 3000);
  };

  const handleSaveInfo = async () => {
    try {
      const res = await fetch(`${API_URL}/orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editedOrder)
      });
      if (res.ok) {
        showStatus('Información actualizada correctamente');
        setIsEditingInfo(false);
        // Recargar la página o actualizar el estado padre sería ideal, pero por ahora actualizamos el local
        Object.assign(order, editedOrder);
      }
    } catch (err) {
      showStatus('Error al actualizar la información', 'error');
    }
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

  const renderChecklistHtml = (chk) => {
    if (!chk) return '';
    return `
      <div class="section-header">Control de Calidad (Verificación Final)</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px;">
        <div style="padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; text-align: center;">
          <div style="font-size: 8px; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Prueba de Ruta</div>
          <div style="font-weight: 700; color: #059669; font-size: 10px;">✓ REALIZADA</div>
        </div>
        <div style="padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; text-align: center;">
          <div style="font-size: 8px; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Vehículo Limpio</div>
          <div style="font-weight: 700; color: #059669; font-size: 10px;">✓ VERIFICADO</div>
        </div>
        <div style="padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; text-align: center;">
          <div style="font-size: 8px; color: #64748b; text-transform: uppercase; margin-bottom: 4px;">Herramientas</div>
          <div style="font-weight: 700; color: #059669; font-size: 10px;">✓ COMPLETADO</div>
        </div>
      </div>
    `;
  };

  const printInfo = () => {
    printWindow(`Orden ${order.placa}`, `
      <div class="header-title">Orden de Servicio</div>
      
      <div class="section-header">Información de la Orden</div>
      <div style="margin-bottom: 24px">
        <div class="info-row" style="width: 300px"><span>Número de Orden:</span> <span>ORD-${String(order.id).substring(0,8).toUpperCase()}</span></div>
        <div class="info-row" style="width: 300px"><span>Fecha de Emisión:</span> <span>${new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
        <div class="info-row" style="width: 300px"><span>Estado:</span> <span>${order.estado}</span></div>
      </div>

      <div class="info-grid">
        <div class="info-block">
          <h3>Datos del Cliente</h3>
          <div class="info-row"><span>Nombre:</span> <span>${order.cliente}</span></div>
          ${order.documento ? `<div class="info-row"><span>CC / NIT:</span> <span>${order.documento}</span></div>` : ''}
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
      ${renderChecklistHtml(order.checklistFinal)}
    `);
  };

  const printReport = () => {
    if (!reportData || !reportData.items) return;
    const stateBadge = { Bueno: 'badge-good', Regular: 'badge-warn', Malo: 'badge-bad' };
    const rows = reportData.items.map((it, i) => `
      <tr>
        <td class="col-num">${i + 1}</td>
        <td class="col-desc"><strong>${it.item}</strong><br><small style="color: #64748b">${it.category}</small></td>
        <td style="text-align: center"><span class="badge ${stateBadge[it.state] || ''}">${it.state}</span></td>
        <td style="text-align: center">${it.requiereRepuesto ? 'SI' : 'NO'}</td>
        <td style="text-align: center">${it.recibeReparacion ? 'SI' : 'NO'}</td>
      </tr>
    `).join('');
    printWindow(`Reporte Técnico ${order.placa}`, `
      <div class="header-title">Reporte de Inspección</div>
      
      <div class="info-grid">
        <div class="info-block">
          <h3>Información General</h3>
          <div class="info-row"><span>Orden ID:</span> <span>ORD-${String(order.id).substring(0,8).toUpperCase()}</span></div>
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
            <th>#</th><th>Descripción / Sistema</th><th style="text-align: center">Estado</th><th style="text-align: center">Repuesto</th><th style="text-align: center">Reparación</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      ${order.servicios ? `<div class="section-header">Servicios Solicitados</div><p style="padding: 10px; background: #f8fafc; border-radius: 6px; margin-bottom: 12px;">${order.servicios}</p>` : ''}
      ${order.notas ? `<div class="section-header">Notas y Observaciones</div><p style="padding: 10px; background: #fffbeb; border-radius: 6px; color: #92400e;">${order.notas}</p>` : ''}
      ${renderChecklistHtml(order.checklistFinal)}
    `);
  };

  const printQuote = (forcedTitle = null) => {
    const sub = totals.sub, iva = totals.iva, total = totals.total;
    const mainTitle = forcedTitle || ((order.estado === 'Entregado' || order.estado === 'Ingresos Rápidos') ? 'CUENTA DE COBRO' : 'COTIZACIÓN');
    const isCuentaCobro = mainTitle === 'CUENTA DE COBRO' || !showPriority;
    const prioOrder = ['urgente', 'plazo_medio', 'plazo_largo'];
    const prioMap = {
      urgente:     { label: 'Urgente',     color: '#ef4444', bg: '#fef2f2', headerBg: '#fee2e2' },
      plazo_medio: { label: 'Plazo Medio', color: '#d97706', bg: '#fffbeb', headerBg: '#fef3c7' },
      plazo_largo: { label: 'Plazo Largo', color: '#059669', bg: '#f0fdf4', headerBg: '#dcfce7' },
    };

    let rows = '';
    let globalNum = 1;

    if (isCuentaCobro) {
      // Cuenta de cobro: simple list, no priority grouping
      rows = quoteItems.map((it, i) => {
        const lineTotal = it.precio * it.cantidad;
        const lineIva = it.aplicaIva ? lineTotal * 0.19 : 0;
        return `
          <tr>
            <td class="col-num">${i + 1}</td>
            <td class="col-desc">${it.descripcion}</td>
            <td style="text-align:center">${it.cantidad}</td>
            <td class="col-price">$${fmt(it.precio)} COP</td>
            <td class="col-iva">${lineIva > 0 ? '$' + fmt(lineIva) + ' COP' : '—'}</td>
            <td class="col-total">$${fmt(lineTotal + lineIva)} COP</td>
          </tr>`;
      }).join('');
    } else {
      // Cotización: sorted by priority with group headers and subtotals
      const sortedItems = [...quoteItems].sort((a, b) =>
        prioOrder.indexOf(a.prioridad || 'urgente') - prioOrder.indexOf(b.prioridad || 'urgente')
      );
      prioOrder.forEach(prioKey => {
        const group = sortedItems.filter(it => (it.prioridad || 'urgente') === prioKey);
        if (group.length === 0) return;
        const p = prioMap[prioKey];
        const groupTotal = group.reduce((acc, it) => {
          const lt = it.precio * it.cantidad;
          return acc + (it.aplicaIva ? lt * 1.19 : lt);
        }, 0);
        rows += `<tr><td colspan="7" style="background:${p.headerBg};color:${p.color};font-weight:800;font-size:0.85rem;padding:6px 10px;letter-spacing:0.03em">${p.label}</td></tr>`;
        group.forEach(it => {
          const lineTotal = it.precio * it.cantidad;
          const lineIva = it.aplicaIva ? lineTotal * 0.19 : 0;
          rows += `
            <tr>
              <td class="col-num">${globalNum++}</td>
              <td class="col-desc">${it.descripcion}</td>
              <td style="text-align:center"><span style="font-size:0.78rem;font-weight:700;padding:2px 8px;border-radius:6px;background:${p.bg};color:${p.color}">${p.label}</span></td>
              <td style="text-align:center">${it.cantidad}</td>
              <td class="col-price">$${fmt(it.precio)} COP</td>
              <td class="col-iva">${lineIva > 0 ? '$' + fmt(lineIva) + ' COP' : '—'}</td>
              <td class="col-total">$${fmt(lineTotal + lineIva)} COP</td>
            </tr>`;
        });
        rows += `<tr style="background:${p.headerBg}"><td colspan="6" style="text-align:right;font-weight:700;font-size:0.85rem;color:${p.color};padding:5px 10px">Subtotal ${p.label}:</td><td class="col-total" style="font-weight:800;color:${p.color}">$${fmt(groupTotal)} COP</td></tr>`;
      });
    }
    printWindow(`${mainTitle} ${order.placa}`, `
      <div class="header-title">${mainTitle}</div>
      
      <div class="section-header">Información de la Orden</div>
      <div style="margin-bottom: 24px">
        <div class="info-row" style="width: 300px"><span>Número de Orden:</span> <span>COT-${String(order.id).substring(0,8).toUpperCase()}</span></div>
        <div class="info-row" style="width: 300px"><span>Fecha de Emisión:</span> <span>${new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' })}</span></div>
        <div class="info-row" style="width: 300px"><span>Estado:</span> <span>${order.estado}</span></div>
      </div>

      <div class="info-grid">
        <div class="info-block">
          <h3>Datos del Cliente</h3>
          <div class="info-row"><span>Nombre:</span> <span>${order.cliente}</span></div>
          ${order.documento ? `<div class="info-row"><span>CC / NIT:</span> <span>${order.documento}</span></div>` : ''}
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
            <th>#</th><th>Descripción</th>${!isCuentaCobro ? '<th style="text-align:center">Prioridad</th>' : ''}<th style="text-align:center">Cant.</th><th style="text-align:right">Precio Unit.</th><th style="text-align:right">IVA</th><th style="text-align:right">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="totals-container">
        <div class="total-row"><span>Subtotal:</span> <span>$${fmt(sub)} COP</span></div>
        <div class="total-row"><span>IVA (19%):</span> <span>$${fmt(iva)} COP</span></div>
        <div class="total-row final"><span>TOTAL:</span> <span>$${fmt(total)} COP</span></div>
      </div>
      
      ${order.notasEntrega || notasEntrega ? `
        <div style="margin-top: 32px; padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
          <h3 style="font-size: 10px; text-transform: uppercase; color: #64748b; margin-bottom: 8px; font-weight: 700;">Notas y Garantía</h3>
          <p style="font-size: 11px; line-height: 1.6; color: #1e293b;">${order.notasEntrega || notasEntrega}</p>
        </div>
      ` : ''}
      
      ${order.servicios ? `
        <div class="section-header">Servicios Solicitados</div>
        <p style="padding: 10px; background: #f8fafc; border-radius: 6px; margin-bottom: 12px; font-size: 11px;">${order.servicios}</p>
      ` : ''}
      
      ${order.notas ? `
        <div class="section-header">Notas de Recepción</div>
        <p style="padding: 10px; border: 1px solid #e2e8f0; border-radius: 6px; color: #475569; font-size: 11px;">${order.notas}</p>
      ` : ''}

      ${renderChecklistHtml(order.checklistFinal)}

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

  const authorizeQuote = async () => {
    const payload = { 
      orderId: order.id, 
      items: quoteItems, 
      fecha: new Date().toISOString(),
      autorizada: true 
    };
    
    if (order.quotes?.length > 0) {
      await fetch(`${API_URL}/quotes/${order.quotes[0].id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
    } else {
      await fetch(`${API_URL}/quotes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
      });
    }

    await fetch(`${API_URL}/orders/${order.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'Proceso' })
    });

    showStatus('¡Cotización Autorizada! El técnico ya tiene el ticket.', 'success');
    setTimeout(() => onClose(), 1500);
  };

  const doDeliver = async () => {
    // Primero guardamos la cotización para asegurar que las estadísticas se actualicen
    await saveQuote();
    
    await fetch(`${API_URL}/orders/${order.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        estado: 'Entregado', 
        fechaEntrega: new Date().toISOString(), 
        metodoPago,
        notasEntrega 
      })
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

      const prio = it.prioridad || 'urgente';
      if (it.category === 'Insumos' && it.state === 'Necesario') {
        newItems.push({ descripcion: `Insumo: ${it.item}`, cantidad: parseInt(it.cantidad) || 1, precio: 0, aplicaIva: false, prioridad: prio });
      } else if (it.category === 'Servicios Especializados' && it.state === 'Realizar') {
        const desc = it.item === 'Diagnostico Profundo en' ? `Diagnóstico Profundo (${it.area || 'General'})` : it.item;
        newItems.push({ descripcion: desc, cantidad: 1, precio: mO, aplicaIva: false, prioridad: prio });
      } else {
        if (mO > 0) newItems.push({ descripcion: `Mano de obra: ${it.item}`, cantidad: 1, precio: mO, aplicaIva: false, prioridad: prio });
        if (vRep > 0) newItems.push({ descripcion: `Reparación: ${it.item}`, cantidad: 1, precio: vRep, aplicaIva: false, prioridad: prio });
        if (vRepuesto > 0) newItems.push({ descripcion: `Repuesto: ${it.item}`, cantidad: cRepuesto, precio: vRepuesto, aplicaIva: false, prioridad: prio });
      }
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

  const [pdfs, setPdfs] = useState(order.pdfs || []);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const pdfInputRef = useRef(null);

  const uploadPdf = async (file) => {
    if (!file) return;
    setUploadingPdf(true);
    const fd = new FormData();
    fd.append('pdf', file);
    try {
      const res = await fetch(`${BACKEND_URL}/api/orders/${order.id}/pdfs`, { method: 'POST', body: fd });
      if (!res.ok) throw new Error(await res.text());
      const newPdf = await res.json();
      setPdfs(prev => [...prev, newPdf]);
    } catch (e) {
      alert('Error al subir el PDF: ' + e.message);
    } finally {
      setUploadingPdf(false);
    }
  };

  const deletePdf = async (pdf) => {
    if (!window.confirm(`¿Eliminar "${pdf.originalName}"?`)) return;
    await fetch(`${BACKEND_URL}/api/orders/${order.id}/pdfs/${pdf.id}`, { method: 'DELETE' });
    setPdfs(prev => prev.filter(p => p.id !== pdf.id));
  };

  const tabs = [
    { id: 'info', label: 'Información' },
    { id: 'reporte', label: 'Reporte Técnico' },
    { id: 'cotizacion', label: 'Cotización' },
    { id: 'pdfs', label: `Documentos${pdfs.length ? ` (${pdfs.length})` : ''}` },
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
              {!fleetMode && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginBottom: '1rem' }} className="hide-on-print">
                {isEditingInfo && (
                  <button 
                    onClick={() => { setIsEditingInfo(false); setEditedOrder({ ...order }); }}
                    className="btn-secondary"
                    style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                  >
                    Cancelar
                  </button>
                )}
                <button 
                  onClick={() => isEditingInfo ? handleSaveInfo() : setIsEditingInfo(true)}
                  className={isEditingInfo ? 'btn-success' : 'btn-secondary'}
                  style={{ padding: '0.4rem 0.8rem', fontSize: '0.8rem' }}
                >
                  {isEditingInfo ? <><Save size={14} /> Guardar</> : <><Edit2 size={14} /> Editar</>}
                </button>
              </div>}

              <p className="section-title">Datos del Cliente</p>
              <div className="info-grid" style={{ marginBottom: '1.5rem' }}>
                {[
                  ['Cliente', 'cliente'],
                  ['CC / NIT', 'documento'],
                  ['Teléfono', 'telefono'],
                  ['Correo', 'correo'],
                ].map(([label, field]) => (
                  <div key={field} className="info-item">
                    <div className="info-label">{label}</div>
                    {isEditingInfo ? (
                      <input 
                        type="text" 
                        value={editedOrder[field] || ''} 
                        onChange={e => setEditedOrder({ ...editedOrder, [field]: e.target.value })}
                        className="price-input"
                        style={{ width: '100%', marginTop: '0.2rem' }}
                      />
                    ) : (
                      <div className="info-value">{order[field] || 'N/A'}</div>
                    )}
                  </div>
                ))}
                <div className="info-item">
                  <div className="info-label">Fecha Ingreso</div>
                  <div className="info-value">{order.fecha ? new Date(order.fecha).toLocaleDateString('es-CO') : 'N/A'}</div>
                </div>
              </div>

              <p className="section-title">Datos del Vehículo</p>
              <div className="info-grid" style={{ marginBottom: '1.5rem' }}>
                {[
                  ['Placa', 'placa'],
                  ['Marca', 'marca'],
                  ['Modelo', 'modelo'],
                  ['Año', 'anio'],
                  ['Kilometraje', 'kilometraje'],
                ].map(([label, field]) => (
                  <div key={field} className="info-item">
                    <div className="info-label">{label}</div>
                    {isEditingInfo ? (
                      <input 
                        type="text" 
                        value={editedOrder[field] || ''} 
                        onChange={e => setEditedOrder({ ...editedOrder, [field]: e.target.value })}
                        className="price-input"
                        style={{ width: '100%', marginTop: '0.2rem' }}
                      />
                    ) : (
                      <div className="info-value">{field === 'kilometraje' ? (order[field] ? `${fmt(order[field])} km` : 'N/A') : order[field]}</div>
                    )}
                  </div>
                ))}
                <div className="info-item">
                  <div className="info-label">Estado</div>
                  <div className="info-value">{order.estado}</div>
                </div>

                <div className="info-item" style={{ gridColumn: '1 / -1' }}>
                  <div className="info-label">Servicios a Realizar</div>
                  {isEditingInfo ? (
                    <textarea 
                      value={editedOrder.servicios || ''} 
                      onChange={e => setEditedOrder({ ...editedOrder, servicios: e.target.value })}
                      style={{ width: '100%', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem', marginTop: '0.2rem', minHeight: '60px' }}
                    />
                  ) : (
                    <div className="info-value">{order.servicios || 'Ninguno'}</div>
                  )}
                </div>

                <div className="info-item" style={{ gridColumn: '1 / -1' }}>
                  <div className="info-label">Notas / Observaciones</div>
                  {isEditingInfo ? (
                    <textarea 
                      value={editedOrder.notas || ''} 
                      onChange={e => setEditedOrder({ ...editedOrder, notas: e.target.value })}
                      style={{ width: '100%', background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 8, padding: '0.5rem', marginTop: '0.2rem', minHeight: '60px' }}
                    />
                  ) : (
                    <div className="info-value">{order.notas || 'Sin notas'}</div>
                  )}
                </div>
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

              {/* Checklist de salida */}
              {order.checklistFinal && (
                <div style={{ marginTop: '1.5rem', padding: '1.25rem', background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', borderRadius: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--success)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>✓</div>
                    <span style={{ fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--success)' }}>Control de Calidad Aprobado</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '1rem' }}>
                    {[
                      ['pruebaRuta', 'Prueba de Ruta'],
                      ['limpio', 'Limpieza'],
                      ['herramientas', 'Herramientas']
                    ].map(([k, l]) => (
                      <div key={k} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: 600 }}>
                        <CheckCircle size={14} color="var(--success)" /> {l}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!fleetMode && <div className="hide-on-print" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '1.5rem' }}>
                <a href={`https://wa.me/${order.telefono}?text=Hola%20${encodeURIComponent(order.cliente || '')},%20te%20escribimos%20del%20Taller%20Automotriz%20sobre%20tu%20veh%C3%ADculo%20${order.placa}`}
                  target="_blank" rel="noreferrer"
                  className="btn-success" style={{ textDecoration: 'none' }}>
                  <MessageCircle size={16} /> WhatsApp
                </a>
                <button onClick={printInfo} className="btn-secondary"><Printer size={16} /> Imprimir Orden</button>
                <button onClick={() => printQuote('COTIZACIÓN')} className="btn-secondary">
                  <Printer size={16} /> Cotización PDF
                </button>
                <button onClick={() => printQuote('CUENTA DE COBRO')} className="btn-success" style={{ background: '#3b82f6', borderColor: '#3b82f6' }}>
                  <Printer size={16} /> Cuenta de Cobro PDF
                </button>
                <button onClick={() => setShowConfirm(true)} className="btn-success" style={{ marginLeft: 'auto' }}>
                  <CheckCircle size={16} /> Entregar Vehículo
                </button>
              </div>}
            </div>
          )}

          {/* ── REPORTE TAB ── */}
          {activeTab === 'reporte' && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <p className="section-title" style={{ margin: 0 }}>Reporte Técnico del Técnico</p>
                {!fleetMode && <button className="btn-primary hide-on-print" style={{ fontSize: '0.82rem', padding: '0.4rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  onClick={() => setShowAddItem(v => !v)}>
                  <Plus size={14} /> Añadir ítem
                </button>}
              </div>

              {/* Form to add new item */}
              {showAddItem && (
                <div className="hide-on-print" style={{ background: 'rgba(99,102,241,0.06)', border: '1px solid var(--primary)', borderRadius: 12, padding: '1.25rem', marginBottom: '1.25rem' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>CATEGORÍA</label>
                      <select value={newItem.category} onChange={e => setNewItem({ ...newItem, category: e.target.value })}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: '0.9rem' }}>
                        <option value="">-- Seleccionar --</option>
                        {REPORT_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>ÍTEM / DESCRIPCIÓN</label>
                      <input type="text" placeholder="Ej: Amortiguador delantero" value={newItem.item}
                        onChange={e => setNewItem({ ...newItem, item: e.target.value })}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: '0.9rem' }} />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <div>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>ESTADO</label>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {ITEM_STATES.map(s => (
                          <button key={s} type="button" onClick={() => setNewItem({ ...newItem, state: s })}
                            style={{ flex: 1, padding: '0.4rem', borderRadius: 8, border: '1.5px solid', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s',
                              borderColor: newItem.state === s ? (s === 'Bueno' ? '#10b981' : s === 'Regular' ? '#f59e0b' : '#ef4444') : 'var(--border)',
                              background: newItem.state === s ? (s === 'Bueno' ? 'rgba(16,185,129,0.15)' : s === 'Regular' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)') : 'transparent',
                              color: newItem.state === s ? (s === 'Bueno' ? '#10b981' : s === 'Regular' ? '#f59e0b' : '#ef4444') : 'var(--text-muted)'
                            }}>{s}</button>
                        ))}
                      </div>
                    </div>
                    {newItem.state !== 'Bueno' && (
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>MANO DE OBRA ($)</label>
                        <input type="text" className="price-input" placeholder="0" value={newItem.manoObra ? fmt(newItem.manoObra) : ''}
                          onChange={e => setNewItem({ ...newItem, manoObra: e.target.value.replace(/\D/g, '') })}
                          style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: '0.9rem' }} />
                      </div>
                    )}
                  </div>

                  {newItem.state !== 'Bueno' && (
                    <div style={{ display: 'flex', gap: '1.5rem', marginBottom: '0.75rem', flexWrap: 'wrap' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={newItem.requiereRepuesto} onChange={e => setNewItem({ ...newItem, requiereRepuesto: e.target.checked })} />
                        Requiere repuesto
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer' }}>
                        <input type="checkbox" checked={newItem.recibeReparacion} onChange={e => setNewItem({ ...newItem, recibeReparacion: e.target.checked })} />
                        Recibe reparación
                      </label>
                    </div>
                  )}

                  {newItem.requiereRepuesto && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '0.75rem', marginBottom: '0.75rem' }}>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>CANT. REPUESTO</label>
                        <input type="number" min="0.1" step="any" value={newItem.cantidadRepuesto}
                          onChange={e => setNewItem({ ...newItem, cantidadRepuesto: parseFloat(e.target.value) || 1 })}
                          style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: '0.9rem' }} />
                      </div>
                      <div>
                        <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>VALOR REPUESTO ($)</label>
                        <input type="text" className="price-input" placeholder="0" value={newItem.valorRepuesto ? fmt(newItem.valorRepuesto) : ''}
                          onChange={e => setNewItem({ ...newItem, valorRepuesto: e.target.value.replace(/\D/g, '') })}
                          style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: '0.9rem' }} />
                      </div>
                    </div>
                  )}

                  {newItem.recibeReparacion && (
                    <div style={{ marginBottom: '0.75rem' }}>
                      <label style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem' }}>VALOR REPARACIÓN ($)</label>
                      <input type="text" className="price-input" placeholder="0" value={newItem.valorReparacion ? fmt(newItem.valorReparacion) : ''}
                        onChange={e => setNewItem({ ...newItem, valorReparacion: e.target.value.replace(/\D/g, '') })}
                        style={{ width: '100%', padding: '0.5rem', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg)', fontSize: '0.9rem' }} />
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                    <button className="btn-secondary" onClick={() => setShowAddItem(false)}>Cancelar</button>
                    <button className="btn-primary" onClick={handleAddReportItem} disabled={!newItem.category || !newItem.item}>
                      <Plus size={14} /> Agregar al reporte
                    </button>
                  </div>
                </div>
              )}

              {(!reportData || !reportData.items) ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  El técnico aún no ha subido el reporte de revisión.<br/>
                  <span style={{ fontSize: '0.85rem' }}>Puedes agregar ítems manualmente con el botón de arriba.</span>
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
                        <th className="hide-on-print" style={{ width: 36 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.items.map((it, idx) => (
                        <tr key={idx}>
                          <td style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{it.category}</td>
                          <td style={{ fontWeight: 500 }}>
                            {it.item}
                            {it.area && <span style={{ color: 'var(--primary)', fontWeight: 700, marginLeft: '0.4rem' }}>({it.area})</span>}
                            {it.cantidad && <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '0.4rem' }}>x{it.cantidad}</span>}
                          </td>
                          <td>
                            <span style={{ color: stateColor[it.state] || 'var(--text)', fontWeight: 600, fontSize: '0.82rem' }}>{it.state}</span>
                          </td>
                          <td>
                            {it.state === 'Bueno' ? <span style={{ color: 'var(--text-muted)' }}>—</span> : (
                              <>
                                <span className={fleetMode ? undefined : 'show-on-print'}>{it.manoObra ? `$${fmt(it.manoObra)}` : '—'}</span>
                                {!fleetMode && <input className="hide-on-print price-input" type="text" placeholder="0" value={it.manoObra ? fmt(it.manoObra) : ''}
                                  onChange={e => handleReportPrice(idx, 'manoObra', e.target.value.replace(/\D/g, ''))}
                                  style={{ width: 100, fontSize: '0.82rem' }} />}
                              </>
                            )}
                          </td>
                          <td style={{ fontSize: '0.82rem' }}>
                            {it.requiereRepuesto ? (
                               <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                                 <span style={{ fontWeight: 600, color: 'var(--warning)' }}>✓ Requiere</span>
                                 {!fleetMode && <div className="hide-on-print" style={{ display: 'flex', gap: '0.4rem' }}>
                                    <input type="number" step="any" min="0.1" placeholder="Cant" value={it.cantidadRepuesto || 1} onChange={e => handleReportPrice(idx, 'cantidadRepuesto', parseFloat(e.target.value.replace(',','.'))||1)} style={{ width: 55, fontSize: '0.8rem', padding: '0.4rem' }} />
                                    <input type="text" className="price-input" placeholder="$ Valor" value={it.valorRepuesto ? fmt(it.valorRepuesto) : ''} onChange={e => handleReportPrice(idx, 'valorRepuesto', e.target.value.replace(/\D/g, ''))} style={{ width: 90, fontSize: '0.8rem', padding: '0.4rem' }} />
                                 </div>}
                                 <span className={fleetMode ? undefined : 'show-on-print'}>
                                    {it.cantidadRepuesto || 1}x {it.valorRepuesto ? `$${fmt(it.valorRepuesto)}` : 'Pendiente'}
                                 </span>
                               </div>
                            ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>
                          <td>
                            {it.recibeReparacion ? (
                              <>
                                <span className={fleetMode ? undefined : 'show-on-print'}>{it.valorReparacion ? `$${fmt(it.valorReparacion)}` : 'Pendiente'}</span>
                                {!fleetMode && <input className="hide-on-print price-input" type="text" placeholder="Pendiente"
                                  value={it.valorReparacion ? fmt(it.valorReparacion) : ''}
                                  onChange={e => handleReportPrice(idx, 'valorReparacion', e.target.value.replace(/\D/g, ''))}
                                  style={{ width: 110, fontSize: '0.82rem' }} />}
                              </>
                            ) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                          </td>
                          <td className="hide-on-print" style={{ textAlign: 'center' }}>
                            {!fleetMode && <button onClick={() => handleDeleteReportItem(idx)}
                              style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', padding: '0.2rem', borderRadius: 6, opacity: 0.7 }}
                              title="Eliminar ítem">
                              <Trash2 size={14} />
                            </button>}
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
                    {!fleetMode && <button onClick={saveReport} className="btn-primary">Guardar Precios</button>}
                    {!fleetMode && <button onClick={transferToQuote} className="btn-success" style={{ marginLeft: 'auto' }}>
                      Pasar valores a Cotización
                    </button>}
                    <button onClick={printReport} className="btn-secondary" style={fleetMode ? { marginLeft: 'auto' } : undefined}><Printer size={16} /> Imprimir Reporte</button>
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
                    <th style={{ width: '35%' }}>Descripción</th>
                    <th style={{ textAlign: 'center' }}>Prioridad</th>
                    <th style={{ textAlign: 'center' }}>Cant.</th>
                    <th style={{ textAlign: 'center' }}>Vr. Unitario</th>
                    <th style={{ textAlign: 'center' }}>+IVA 19%</th>
                    <th style={{ textAlign: 'right' }}>Total</th>
                    <th className={fleetMode ? undefined : 'hide-on-print'} style={{ width: fleetMode ? 90 : 40, textAlign: 'center' }}>{fleetMode ? 'Aprobación' : ''}</th>
                  </tr>
                </thead>
                <tbody>
                  {quoteItems.map((it, idx) => {
                    const lt = it.precio * it.cantidad;
                    const total = it.aplicaIva ? lt * 1.19 : lt;
                    return (
                      <tr key={idx}>
                        <td>
                          {!fleetMode && <input className="hide-on-print" type="text" placeholder="Descripción" value={it.descripcion}
                            onChange={e => { const q=[...quoteItems]; q[idx].descripcion=e.target.value; setQuoteItems(q); }}
                            style={{ fontSize: '0.85rem' }} />}
                          <span className={fleetMode ? undefined : 'show-on-print'}>{it.descripcion}</span>
                        </td>
                        <td style={{ textAlign: 'center', whiteSpace: 'nowrap' }}>
                          {(() => {
                            const prioridades = [
                              { key: 'urgente',     label: 'Urgente',      bg: 'rgba(239,68,68,0.15)',   color: '#ef4444', border: '#ef4444' },
                              { key: 'plazo_medio', label: 'Plazo Medio',  bg: 'rgba(245,158,11,0.15)', color: '#f59e0b', border: '#f59e0b' },
                              { key: 'plazo_largo', label: 'Plazo Largo',  bg: 'rgba(16,185,129,0.15)', color: '#10b981', border: '#10b981' },
                            ];
                            const current = it.prioridad || 'urgente';
                            const p = prioridades.find(p => p.key === current) || prioridades[0];
                            return (
                              <>
                                {!fleetMode && <select
                                  className="hide-on-print"
                                  value={current}
                                  onChange={e => { const q=[...quoteItems]; q[idx].prioridad=e.target.value; setQuoteItems(q); }}
                                  style={{ fontSize: '0.78rem', fontWeight: 700, padding: '0.25rem 0.4rem', borderRadius: 8, border: `1.5px solid ${p.border}`, background: p.bg, color: p.color, cursor: 'pointer', outline: 'none' }}
                                >
                                  {prioridades.map(op => <option key={op.key} value={op.key}>{op.label}</option>)}
                                </select>}
                                <span className={fleetMode ? undefined : 'show-on-print'} style={{ fontSize: '0.78rem', fontWeight: 700, padding: '2px 7px', borderRadius: 6, background: p.bg, color: p.color }}>{p.label}</span>
                              </>
                            );
                          })()}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {!fleetMode && <input className="hide-on-print" type="number" step="any" min="0.1" value={it.cantidad}
                            onChange={e => { const q=[...quoteItems]; q[idx].cantidad=parseFloat(e.target.value.replace(',','.'))||1; setQuoteItems(q); }}
                            style={{ width: 80, textAlign: 'center', fontSize: '0.9rem', padding: '0.2rem' }} />}
                          <span className={fleetMode ? undefined : 'show-on-print'}>{it.cantidad}</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {!fleetMode && <input className="hide-on-print price-input" type="text" placeholder="0" value={it.precio ? fmt(it.precio) : ''}
                            onChange={e => { const q=[...quoteItems]; q[idx].precio=parseFloat(e.target.value.replace(/\D/g, ''))||0; setQuoteItems(q); }}
                            style={{ width: 140, textAlign: 'right', fontSize: '0.9rem', padding: '0.2rem' }} />}
                          <span className={fleetMode ? undefined : 'show-on-print'}>${fmt(it.precio)}</span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          {!fleetMode && <input className="hide-on-print" type="checkbox"
                            checked={it.aplicaIva}
                            onChange={e => { const q=[...quoteItems]; q[idx].aplicaIva=e.target.checked; setQuoteItems(q); }} />}
                          <span className={fleetMode ? undefined : 'show-on-print'}>
                            {fleetMode
                              ? (it.aplicaIva ? `$${fmt((it.precio || 0) * (it.cantidad || 1) * 0.19)}` : '—')
                              : (it.aplicaIva ? 'Sí' : 'No')}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700 }} className="price">${fmt(total)}</td>
                        <td className={fleetMode ? undefined : 'hide-on-print'} style={{ textAlign: 'center' }}>
                          {fleetMode ? (
                            <div style={{ display: 'flex', gap: '0.3rem', justifyContent: 'center' }}>
                              <button title="Aprobar"
                                onClick={() => { const q=[...quoteItems]; q[idx]={...q[idx], aprobadoFlota: q[idx].aprobadoFlota === true ? null : true}; setQuoteItems(q); }}
                                style={{ padding: '0.25rem 0.55rem', borderRadius: 6, border: '1.5px solid', fontSize: '0.85rem', fontWeight: 900, cursor: 'pointer',
                                  borderColor: it.aprobadoFlota === true ? '#10b981' : 'var(--border)',
                                  background: it.aprobadoFlota === true ? 'rgba(16,185,129,0.15)' : 'transparent',
                                  color: it.aprobadoFlota === true ? '#10b981' : 'var(--text-muted)' }}>✓</button>
                              <button title="Rechazar"
                                onClick={() => { const q=[...quoteItems]; q[idx]={...q[idx], aprobadoFlota: q[idx].aprobadoFlota === false ? null : false}; setQuoteItems(q); }}
                                style={{ padding: '0.25rem 0.55rem', borderRadius: 6, border: '1.5px solid', fontSize: '0.85rem', fontWeight: 900, cursor: 'pointer',
                                  borderColor: it.aprobadoFlota === false ? '#ef4444' : 'var(--border)',
                                  background: it.aprobadoFlota === false ? 'rgba(239,68,68,0.15)' : 'transparent',
                                  color: it.aprobadoFlota === false ? '#ef4444' : 'var(--text-muted)' }}>✗</button>
                            </div>
                          ) : (
                            <button onClick={() => setQuoteItems(quoteItems.filter((_, i) => i !== idx))}
                              style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
                              <Trash2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {!fleetMode && <div className="hide-on-print" style={{ marginTop: '0.75rem', marginBottom: '1.5rem' }}>
                <button className="btn-secondary" style={{ fontSize: '0.82rem' }} onClick={() => setQuoteItems([...quoteItems, { descripcion: '', cantidad: 1, precio: 0, aplicaIva: false, prioridad: 'urgente' }])}>
                  <Plus size={14} /> Añadir ítem
                </button>
              </div>}

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

              {!fleetMode && <div className="hide-on-print" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1rem', padding: '0.65rem 1rem', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border)', borderRadius: 10 }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Mostrar prioridades en PDF de cotización:</span>
                <button
                  onClick={() => {
                    const next = !showPriority;
                    setShowPriority(next);
                    localStorage.setItem('quote_show_priority', String(next));
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.4rem',
                    padding: '0.35rem 0.9rem', borderRadius: 20, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', transition: 'all 0.2s',
                    background: showPriority ? 'rgba(99,102,241,0.15)' : 'rgba(107,114,128,0.1)',
                    color: showPriority ? 'var(--primary)' : 'var(--text-muted)',
                    border: showPriority ? '1.5px solid var(--primary)' : '1.5px solid var(--border)',
                  }}
                >
                  <span style={{ width: 28, height: 16, borderRadius: 99, background: showPriority ? 'var(--primary)' : '#6b7280', display: 'inline-flex', alignItems: 'center', padding: '0 2px', transition: 'all 0.2s' }}>
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: 'white', marginLeft: showPriority ? 'auto' : 0, transition: 'margin 0.2s' }} />
                  </span>
                  {showPriority ? 'Activado' : 'Desactivado'}
                </button>
              </div>}

              <div className="hide-on-print" style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {!fleetMode && <button onClick={saveQuote} className="btn-secondary">Guardar Borrador</button>}
                {!fleetMode && <button onClick={authorizeQuote} className="btn-primary" style={{ background: 'var(--success)', borderColor: 'var(--success)' }}>
                  <CheckCircle size={16} /> Autorizar y Empezar Trabajo
                </button>}
                {fleetMode && (
                  <button onClick={handleSaveApprovals} disabled={savingApprovals} className="btn-primary">
                    {savingApprovals ? 'Guardando...' : '✓ Guardar aprobaciones'}
                  </button>
                )}
                <div style={{ marginLeft: fleetMode ? 0 : 'auto', display: 'flex', gap: '0.5rem' }}>
                  <button onClick={() => printQuote('COTIZACIÓN')} className="btn-secondary"><Printer size={16} /> Cotización PDF</button>
                  <button onClick={() => printQuote('CUENTA DE COBRO')} className="btn-secondary"><Printer size={16} /> Cta. Cobro PDF</button>
                </div>
              </div>
            </div>
          )}

          {/* ── DOCUMENTOS TAB ── */}
          {activeTab === 'pdfs' && (
            <div>
              <p className="section-title">Documentos PDF</p>

              {/* Upload area */}
              <div
                style={{ border: '2px dashed var(--border)', borderRadius: 10, padding: '2rem', textAlign: 'center', marginBottom: '1.5rem', cursor: 'pointer', transition: 'border-color 0.2s' }}
                onClick={() => pdfInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) uploadPdf(f); }}
              >
                <input ref={pdfInputRef} type="file" accept="application/pdf" style={{ display: 'none' }}
                  onChange={e => { if (e.target.files[0]) uploadPdf(e.target.files[0]); e.target.value = ''; }} />
                {uploadingPdf ? (
                  <div style={{ color: 'var(--primary)', fontWeight: 600 }}>Subiendo...</div>
                ) : (
                  <>
                    <Upload size={28} style={{ color: 'var(--text-muted)', marginBottom: '0.5rem' }} />
                    <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>Arrastra un PDF aquí o haz clic para seleccionar</div>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Máximo 20 MB · Solo archivos PDF</div>
                  </>
                )}
              </div>

              {/* Files list */}
              {pdfs.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem', fontSize: '0.9rem' }}>
                  No hay documentos adjuntos aún.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                  {pdfs.map(pdf => (
                    <div key={pdf.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'var(--card-bg)', border: '1px solid var(--border)', borderRadius: 8 }}>
                      <FileText size={20} color="var(--primary)" style={{ flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{pdf.originalName}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {(pdf.size / 1024).toFixed(0)} KB · {new Date(pdf.uploadedAt).toLocaleDateString('es-CO')}
                        </div>
                      </div>
                      <a
                        href={`${BACKEND_URL}/api/orders/${order.id}/pdfs/${pdf.filename}`}
                        download={pdf.originalName}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.35rem 0.75rem', background: 'rgba(99,102,241,0.12)', color: 'var(--primary)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 6, fontSize: '0.82rem', fontWeight: 600, textDecoration: 'none', flexShrink: 0 }}>
                        <Download size={13}/> Descargar
                      </a>
                      <button onClick={() => deletePdf(pdf)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.2rem', flexShrink: 0 }}>
                        <Trash2 size={16}/>
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
                <select value={metodoPago} onChange={e => setMetodoPago(e.target.value)} style={{ width: '100%', marginBottom: '1.25rem' }}>
                  {PAYMENT_METHODS.map(m => <option key={m} value={m}>{m}</option>)}
                </select>

                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem' }}>Notas de Entrega / Garantía:</label>
                <textarea 
                  placeholder="Ej: Garantía de 3 meses por mano de obra. Recomendaciones..." 
                  value={notasEntrega} 
                  onChange={e => setNotasEntrega(e.target.value)} 
                  style={{ width: '100%', minHeight: 80, fontSize: '0.85rem' }} 
                />
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
