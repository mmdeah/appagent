import React, { useState } from 'react';
import { API_URL } from '../api';
import { MessageCircle, Printer, CheckCircle, X, Plus, Trash2 } from 'lucide-react';

export default function OrderDetailsModal({ order, onClose }) {
  const [activeTab, setActiveTab] = useState('info');
  const [reportData, setReportData] = useState(order.reports?.[0] || null);
  
  // Quote State
  const [quoteItems, setQuoteItems] = useState(
    order.quotes?.[0]?.items || [{ descripcion: '', cantidad: 1, precio: 0, aplicaIva: false }]
  );
  
  const [statusMsg, setStatusMsg] = useState({ text: '', type: '' });
  const [showConfirmDelivery, setShowConfirmDelivery] = useState(false);

  const showStatus = (text, type = 'success') => {
    setStatusMsg({ text, type });
    setTimeout(() => setStatusMsg({ text: '', type: '' }), 3000);
  };

  const handleReportPriceChange = (index, val) => {
    const newReport = { ...reportData };
    newReport.items[index].valorReparacion = val;
    setReportData(newReport);
  };

  const saveReportPrices = async () => {
    if (!reportData) return;
    await fetch(`${API_URL}/reports/${reportData.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reportData)
    });
    showStatus("Precios del reporte actualizados");
  };

  const saveQuote = async () => {
    const payload = {
      orderId: order.id,
      items: quoteItems,
      fecha: new Date().toISOString()
    };
    
    if (order.quotes && order.quotes.length > 0) {
      await fetch(`${API_URL}/quotes/${order.quotes[0].id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    } else {
      await fetch(`${API_URL}/quotes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
    showStatus("Cotización guardada exitosamente");
  };

  const addQuoteItem = () => {
    setQuoteItems([...quoteItems, { descripcion: '', cantidad: 1, precio: 0, aplicaIva: false }]);
  };

  const executeDelivery = async () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(order, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `orden_${order.placa}_${Date.now()}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();

    await fetch(`${API_URL}/orders/${order.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: 'Entregado' })
    });
    onClose();
  };

  const deliverVehicle = () => {
    setShowConfirmDelivery(true);
  };

  const calculateTotal = () => {
    let subtotal = 0;
    let iva = 0;
    quoteItems.forEach(item => {
      const lineTotal = item.precio * item.cantidad;
      subtotal += lineTotal;
      if (item.aplicaIva) {
        iva += lineTotal * 0.19;
      }
    });
    return { subtotal, iva, total: subtotal + iva };
  };

  const totals = calculateTotal();

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, 
      backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000
    }}>
      <div className="modal-content" style={{
        background: 'white', width: '95%', maxWidth: '900px', maxHeight: '90vh', overflowY: 'auto', 
        borderRadius: '12px', padding: '2rem', position: 'relative'
      }}>
        <button onClick={onClose} className="hide-on-print" style={{ position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', cursor: 'pointer' }}>
          <X size={24} />
        </button>
        
        <h2 style={{ fontSize: '1.8rem', color: 'var(--primary-dark)', marginBottom: '0.5rem' }}>Orden de Servicio #{order.id} - {order.placa}</h2>
        <p style={{ color: 'var(--text-muted)' }}>Cliente: <strong>{order.cliente}</strong> | Tel: <strong>{order.telefono}</strong></p>

        {statusMsg.text && (
          <div className="hide-on-print" style={{ padding: '0.75rem', marginTop: '1rem', borderRadius: '8px', background: statusMsg.type === 'success' ? '#d1fae5' : '#fee2e2', color: statusMsg.type === 'success' ? '#065f46' : '#991b1b', textAlign: 'center', fontWeight: 'bold' }}>
            {statusMsg.text}
          </div>
        )}

        <div className="hide-on-print" style={{ display: 'flex', gap: '1rem', margin: '1.5rem 0', borderBottom: '2px solid var(--border)', paddingBottom: '0.5rem' }}>
          <button onClick={() => setActiveTab('info')} className={`btn-secondary ${activeTab === 'info' ? 'active-tab' : ''}`} style={{ background: activeTab === 'info' ? 'var(--primary)' : '', color: activeTab === 'info' ? 'white' : '' }}>Información</button>
          <button onClick={() => setActiveTab('reporte')} className={`btn-secondary ${activeTab === 'reporte' ? 'active-tab' : ''}`} style={{ background: activeTab === 'reporte' ? 'var(--primary)' : '', color: activeTab === 'reporte' ? 'white' : '' }}>Reporte Técnico</button>
          <button onClick={() => setActiveTab('cotizacion')} className={`btn-secondary ${activeTab === 'cotizacion' ? 'active-tab' : ''}`} style={{ background: activeTab === 'cotizacion' ? 'var(--primary)' : '', color: activeTab === 'cotizacion' ? 'white' : '' }}>Cotización</button>
        </div>

        <div className="printable-content">
          {activeTab === 'info' && (
            <div>
              <h3>Datos del Vehículo</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                <p><strong>Marca:</strong> {order.marca}</p>
                <p><strong>Modelo:</strong> {order.modelo} ({order.anio})</p>
                <p><strong>Kilometraje:</strong> {order.kilometraje || 'N/A'}</p>
                <p><strong>Notas:</strong> {order.notas || 'Ninguna'}</p>
              </div>

              <div className="hide-on-print" style={{ display: 'flex', gap: '1rem', marginTop: '3rem' }}>
                <a href={`https://wa.me/${order.telefono}?text=Hola%20${order.cliente},%20te%20escribimos%20de%20Taller%20Automotriz`} target="_blank" rel="noreferrer" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', textDecoration: 'none', background: '#25D366' }}>
                  <MessageCircle size={18} /> WhatsApp
                </a>
                <button onClick={() => window.print()} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Printer size={18} /> Imprimir Info
                </button>
                <button onClick={deliverVehicle} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto', background: 'var(--success)' }}>
                  <CheckCircle size={18} /> Entregar Vehículo
                </button>
              </div>
            </div>
          )}

          {activeTab === 'reporte' && (
            <div>
              <h3>Reporte Técnico</h3>
              {!reportData ? (
                <p>El técnico aún no ha subido el reporte.</p>
              ) : (
                <div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                    <thead>
                      <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
                        <th style={{ textAlign: 'left', padding: '0.5rem' }}>Categoría / Ítem</th>
                        <th style={{ textAlign: 'center', padding: '0.5rem' }}>Estado</th>
                        <th style={{ textAlign: 'center', padding: '0.5rem' }}>M. Obra</th>
                        <th style={{ textAlign: 'center', padding: '0.5rem' }}>Repuesto</th>
                        <th style={{ textAlign: 'center', padding: '0.5rem' }}>Val. Reparación</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.items.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '0.5rem' }}><strong>{item.category}</strong><br/><small>{item.item}</small></td>
                          <td style={{ textAlign: 'center', padding: '0.5rem' }}>{item.state}</td>
                          <td style={{ textAlign: 'center', padding: '0.5rem' }}>{item.manoObra ? `$${item.manoObra}` : '-'}</td>
                          <td style={{ textAlign: 'center', padding: '0.5rem' }}>{item.requiereRepuesto ? 'Sí' : 'No'}</td>
                          <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                            {item.recibeReparacion ? (
                              <input 
                                type="number" 
                                className="hide-on-print"
                                placeholder="Ingresar valor"
                                value={item.valorReparacion || ''}
                                onChange={(e) => handleReportPriceChange(idx, e.target.value)}
                                style={{ width: '100px', padding: '0.25rem' }}
                              />
                            ) : '-'}
                            <span className="show-on-print" style={{ display: 'none' }}>
                              {item.valorReparacion ? `$${item.valorReparacion}` : ''}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {reportData.scannerCodes?.length > 0 && (
                    <div style={{ marginTop: '2rem' }}>
                      <h4>Códigos de Escáner</h4>
                      <ul>
                        {reportData.scannerCodes.map((code, idx) => (
                          <li key={idx}>{code.prefix}{code.code} - {code.description}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <div className="hide-on-print" style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                    <button onClick={saveReportPrices} className="btn-primary">Guardar Precios</button>
                    <button onClick={() => window.print()} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <Printer size={18} /> Imprimir Reporte
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'cotizacion' && (
            <div>
              <h3>Cotización / Cuenta de Cobro</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                <thead>
                  <tr style={{ background: 'var(--bg)', borderBottom: '2px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '0.5rem', width: '40%' }}>Descripción</th>
                    <th style={{ textAlign: 'center', padding: '0.5rem' }}>Cant.</th>
                    <th style={{ textAlign: 'center', padding: '0.5rem' }}>Vr. Unitario</th>
                    <th style={{ textAlign: 'center', padding: '0.5rem' }}>+19% IVA</th>
                    <th style={{ textAlign: 'right', padding: '0.5rem' }}>Total</th>
                    <th className="hide-on-print"></th>
                  </tr>
                </thead>
                <tbody>
                  {quoteItems.map((item, idx) => {
                    const lineTotal = item.precio * item.cantidad;
                    const finalTotal = item.aplicaIva ? lineTotal * 1.19 : lineTotal;
                    
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '0.5rem' }}>
                          <input 
                            type="text" 
                            className="hide-on-print"
                            value={item.descripcion} 
                            onChange={(e) => {
                              const newQ = [...quoteItems]; newQ[idx].descripcion = e.target.value; setQuoteItems(newQ);
                            }}
                            style={{ width: '100%', padding: '0.25rem' }}
                            placeholder="Ej. Cambio de pastillas"
                          />
                          <span className="show-on-print" style={{ display: 'none' }}>{item.descripcion}</span>
                        </td>
                        <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                          <input 
                            type="number" 
                            className="hide-on-print"
                            value={item.cantidad} 
                            onChange={(e) => {
                              const newQ = [...quoteItems]; newQ[idx].cantidad = parseInt(e.target.value) || 0; setQuoteItems(newQ);
                            }}
                            style={{ width: '60px', padding: '0.25rem' }}
                          />
                          <span className="show-on-print" style={{ display: 'none' }}>{item.cantidad}</span>
                        </td>
                        <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                          <input 
                            type="number" 
                            className="hide-on-print"
                            value={item.precio} 
                            onChange={(e) => {
                              const newQ = [...quoteItems]; newQ[idx].precio = parseFloat(e.target.value) || 0; setQuoteItems(newQ);
                            }}
                            style={{ width: '100px', padding: '0.25rem' }}
                          />
                          <span className="show-on-print" style={{ display: 'none' }}>${item.precio}</span>
                        </td>
                        <td style={{ textAlign: 'center', padding: '0.5rem' }}>
                          <input 
                            type="checkbox" 
                            className="hide-on-print"
                            checked={item.aplicaIva} 
                            onChange={(e) => {
                              const newQ = [...quoteItems]; newQ[idx].aplicaIva = e.target.checked; setQuoteItems(newQ);
                            }}
                          />
                          <span className="show-on-print" style={{ display: 'none' }}>{item.aplicaIva ? 'Sí' : 'No'}</span>
                        </td>
                        <td style={{ textAlign: 'right', padding: '0.5rem' }}>
                          <strong>${finalTotal.toLocaleString()}</strong>
                        </td>
                        <td className="hide-on-print" style={{ textAlign: 'center', padding: '0.5rem' }}>
                          <button onClick={() => setQuoteItems(quoteItems.filter((_, i) => i !== idx))} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>
                            <Trash2 size={18} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              <div className="hide-on-print" style={{ marginTop: '1rem' }}>
                <button onClick={addQuoteItem} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                  <Plus size={16} /> Añadir Ítem
                </button>
              </div>

              <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end' }}>
                <div style={{ width: '300px', background: 'var(--bg)', padding: '1rem', borderRadius: '8px' }}>
                  <p style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span>Subtotal:</span> <span>${totals.subtotal.toLocaleString()}</span>
                  </p>
                  <p style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span>IVA (19%):</span> <span>${totals.iva.toLocaleString()}</span>
                  </p>
                  <p style={{ display: 'flex', justifyContent: 'space-between', fontSize: '1.2rem', fontWeight: 'bold', borderTop: '2px solid var(--border)', paddingTop: '0.5rem' }}>
                    <span>TOTAL:</span> <span>${totals.total.toLocaleString()}</span>
                  </p>
                </div>
              </div>

              <div className="hide-on-print" style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
                <button onClick={saveQuote} className="btn-primary">Guardar Cotización</button>
                <button onClick={() => window.print()} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Printer size={18} /> Imprimir Factura / PDF
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Confirmation Modal */}
        {showConfirmDelivery && (
          <div className="modal-overlay hide-on-print" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 2000 }}>
            <div className="card" style={{ background: 'white', width: '90%', maxWidth: '400px', textAlign: 'center' }}>
              <h3 style={{ marginBottom: '1rem', color: 'var(--danger)' }}>Confirmar Entrega</h3>
              <p style={{ marginBottom: '2rem' }}>¿Seguro que deseas entregar este vehículo? Se descargará un archivo con toda la información y la orden saldrá del tablero activo.</p>
              <div style={{ display: 'flex', gap: '1rem' }}>
                <button className="btn-secondary" style={{ flex: 1 }} onClick={() => setShowConfirmDelivery(false)}>Cancelar</button>
                <button className="btn-primary" style={{ flex: 1, background: 'var(--danger)' }} onClick={executeDelivery}>Sí, Entregar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
