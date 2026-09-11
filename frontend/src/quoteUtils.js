// Cada orden puede tener hasta 2 cotizaciones ("slots"), pero solo el slot 1
// es la cotización real: la que ve el cliente y la flota, la que se autoriza,
// la que cuenta para facturación/ingresos y la que usan los informes IA. El
// slot 2 es un borrador privado del admin — solo se ve dentro del panel
// admin, para ir moviendo ítems de un lado a otro antes de decidir cuáles
// quedan en la cotización real.
//
// Las cotizaciones creadas antes de este campo no tienen `slot` — se tratan
// como slot 1 para que las órdenes viejas con una sola cotización sigan
// funcionando sin ninguna migración de datos.
export const getQuoteSlot = (order, slot) => {
  const quotes = (order?.quotes || []).slice().sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  if (slot === 2) return quotes.find(q => q.slot === 2) || null;
  return quotes.find(q => q.slot === 1) || quotes.find(q => q.slot !== 2) || null;
};

export const calcQuoteTotals = (items) => {
  let sub = 0, iva = 0;
  (items || []).forEach(it => {
    const lt = (Number(it.precio) || 0) * (Number(it.cantidad) || 1);
    sub += lt;
    if (it.aplicaIva) iva += lt * 0.19;
  });
  return { sub, iva, total: sub + iva };
};

// Total/IVA de la orden: SIEMPRE a partir de la cotización real (slot 1)
// únicamente — el borrador (slot 2) nunca cuenta para ingresos/facturación.
export const getRealQuoteTotal = (order) => calcQuoteTotals(getQuoteSlot(order, 1)?.items).total;
export const getRealQuoteIva = (order) => calcQuoteTotals(getQuoteSlot(order, 1)?.items).iva;
