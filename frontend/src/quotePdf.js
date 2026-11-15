// PDF de la cotización con el mismo formato que el del admin (encabezado,
// datos del cliente y vehículo, tabla, totales con IVA y nota importante).
// Lo usa el asesor para descargar la última versión APROBADA.

const fmt = (n) => (parseFloat(n) || 0).toLocaleString('es-CO', { minimumFractionDigits: 0 });
const esc = (t) => String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const ESTILOS = `
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
  .disclaimer-box { margin-top: 24px; padding: 12px 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-left: 3px solid #64748b; border-radius: 6px; font-size: 10.5px; color: #475569; line-height: 1.6; }
  .disclaimer-box b { color: #1e293b; }
  @media print { body { padding: 0; } .header-title { margin-top: 0; } }
`;

export function imprimirCotizacionPdf({ orden, items, titulo = 'COTIZACIÓN', aprobadaEn = null }) {
  const lista = (items || []).filter(it => (it.descripcion || '').trim());
  // Reparto de insumos (si la orden lo tiene activado y hay más de 5 ítems): igual que en el PDF del admin.
  const conValor = lista.filter(it => (Number(it.precio) || 0) > 0);
  const extra = (orden.distribuirInsumos && lista.length > 5 && conValor.length > 0) ? (orden.insumosMonto ?? 30000) / conValor.length : 0;
  const precioEfectivo = (it) => {
    const base = Number(it.precio) || 0;
    return base === 0 ? 0 : base + extra / (Number(it.cantidad) || 1);
  };

  let sub = 0, iva = 0;
  const filas = lista.map((it, i) => {
    const lt = precioEfectivo(it) * (Number(it.cantidad) || 1);
    const li = it.aplicaIva ? lt * 0.19 : 0;
    sub += lt; iva += li;
    return `<tr>
      <td class="col-num">${i + 1}</td>
      <td class="col-desc">${esc(it.descripcion)}</td>
      <td style="text-align:center">${esc(it.cantidad)}</td>
      <td class="col-price">$${fmt(precioEfectivo(it))} COP</td>
      <td class="col-iva">${li > 0 ? '$' + fmt(li) + ' COP' : '—'}</td>
      <td class="col-total">$${fmt(lt + li)} COP</td>
    </tr>`;
  }).join('');
  const hoy = new Date().toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });

  const cuerpo = `
    <div class="header-title">${esc(titulo)}</div>
    <div class="section-header">Información de la Orden</div>
    <div style="margin-bottom: 24px">
      <div class="info-row" style="width: 300px"><span>Número de Orden:</span> <span>COT-${esc(String(orden.id).substring(0, 8).toUpperCase())}</span></div>
      <div class="info-row" style="width: 300px"><span>Fecha de Emisión:</span> <span>${hoy}</span></div>
      <div class="info-row" style="width: 300px"><span>Estado:</span> <span>${esc(orden.estado)}</span></div>
    </div>
    <div class="info-grid">
      <div class="info-block">
        <h3>Datos del Cliente</h3>
        <div class="info-row"><span>Nombre:</span> <span>${esc(orden.cliente)}</span></div>
        ${orden.documento ? `<div class="info-row"><span>CC / NIT:</span> <span>${esc(orden.documento)}</span></div>` : ''}
        <div class="info-row"><span>Teléfono:</span> <span>${esc(orden.telefono)}</span></div>
        <div class="info-row"><span>Email:</span> <span>${esc(orden.correo || 'N/A')}</span></div>
      </div>
      <div class="info-block">
        <h3>Datos del Vehículo</h3>
        <div class="info-row"><span>Marca/Modelo:</span> <span>${esc(`${orden.marca || ''} ${orden.modelo || ''}`)}</span></div>
        <div class="info-row"><span>Placa:</span> <span>${esc(orden.placa)}</span></div>
        <div class="info-row"><span>Año:</span> <span>${esc(orden.anio)}</span></div>
        <div class="info-row"><span>Kilometraje:</span> <span>${orden.kilometraje ? fmt(orden.kilometraje) + ' KM' : 'N/A'}</span></div>
      </div>
    </div>
    <div class="section-header">Servicios Cotizados</div>
    <table>
      <thead><tr><th>#</th><th>Descripción</th><th style="text-align:center">Cant.</th><th style="text-align:right">Precio Unit.</th><th style="text-align:right">IVA</th><th style="text-align:right">Total</th></tr></thead>
      <tbody>${filas}</tbody>
    </table>
    <div class="totals-container">
      <div class="total-row"><span>Subtotal:</span> <span>$${fmt(sub)} COP</span></div>
      <div class="total-row"><span>IVA (19%):</span> <span>$${fmt(iva)} COP</span></div>
      <div class="total-row final"><span>TOTAL:</span> <span>$${fmt(sub + iva)} COP</span></div>
    </div>
    ${orden.notasEntrega ? `<div style="margin-top: 32px; padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
      <h3 style="font-size: 10px; text-transform: uppercase; color: #64748b; margin-bottom: 8px; font-weight: 700;">Notas y Garantía</h3>
      <p style="font-size: 11px; line-height: 1.6; color: #1e293b; white-space: pre-wrap;">${esc(orden.notasEntrega)}</p></div>` : ''}
    <div class="disclaimer-box"><b>⚠ Nota importante:</b> lo reportado corresponde únicamente a lo observado en el estado visible del vehículo al momento de la revisión. Pueden existir desgastes, fallas o daños ocultos no detectables sin desarme completo, que se identificarán solo al momento de intervenir el vehículo o posterior.</div>
    <div style="margin-top: 60px; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 10px; color: #94a3b8; text-align: center;">
      Esta es una representación física de un documento digital. Generado por AppTaller2.${aprobadaEn ? ` Versión aprobada el ${new Date(aprobadaEn).toLocaleDateString('es-CO')}.` : ''}
    </div>`;

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) { window.alert('El navegador bloqueó la ventana del PDF. Permite las ventanas emergentes e inténtalo de nuevo.'); return; }
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8" /><title>${esc(titulo)} ${esc(orden.placa)}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
    <style>${ESTILOS}</style></head><body>${cuerpo}
    <script>window.onload = function(){ window.print(); }<\/script></body></html>`);
  win.document.close();
}
