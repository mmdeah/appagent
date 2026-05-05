import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Printer, Download, CheckCircle, ArrowLeft } from 'lucide-react';

const AdminOrderView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [report, setReport] = useState(null);
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      if (id === 'new') {
        setOrder({ clientName: '', phone: '', email: '', plate: '', brand: '', model: '', year: new Date().getFullYear(), servicesToPerform: '', notes: '', mileage: 0, status: 'Recepción' });
        setLoading(false);
        return;
      }
      
      const fetchedOrder = await api.getOrderById(id);
      const fetchedReport = await api.getReportByOrderId(id);
      const fetchedQuote = await api.getQuoteByOrderId(id);
      
      setOrder(fetchedOrder);
      setReport(fetchedReport || { serviceOrderId: id, items: [] });
      setQuote(fetchedQuote || { serviceOrderId: id, items: [] });
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveOrder = async () => {
    if (id === 'new') {
      const newOrder = await api.createOrder(order);
      navigate(`/admin/order/${newOrder.id}`);
    } else {
      await api.updateOrder(id, order);
      alert('Orden actualizada');
    }
  };

  const handleDeliver = async () => {
    if (!window.confirm('¿Marcar como Entregado? Esto generará un archivo de respaldo y removerá la orden activa.')) return;
    
    // Create backup payload
    const backupData = {
      order,
      report,
      quote,
      deliveredAt: new Date().toISOString()
    };
    
    // Trigger download of the backup file
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `backup_order_${order.plate}_${order.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    
    // Update order status to delivered
    await api.updateOrder(id, { status: 'Entregado', deliveredAt: backupData.deliveredAt });
    navigate('/admin');
  };

  if (loading) return <div className="spinner"></div>;

  return (
    <div className="flex-col gap-4">
      <div className="flex justify-between items-center no-print">
        <button className="btn btn-secondary" onClick={() => navigate('/admin')}>
          <ArrowLeft size={18} /> Volver
        </button>
        <div className="flex gap-2">
          {id !== 'new' && (
            <>
              <button className="btn btn-outline" onClick={() => window.print()}>
                <Printer size={18} /> Imprimir / PDF
              </button>
              <button className="btn btn-success" style={{ backgroundColor: 'var(--success-color)', color: 'white' }} onClick={handleDeliver}>
                <CheckCircle size={18} /> Entregar Vehículo
              </button>
            </>
          )}
          <button className="btn btn-primary" onClick={handleSaveOrder}>
            Guardar Orden
          </button>
        </div>
      </div>

      <div className="card">
        <h2>{id === 'new' ? 'Nueva Orden de Servicio' : `Orden: ${order.plate}`}</h2>
        
        <div className="grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
          <div className="form-group">
            <label className="form-label">Cliente</label>
            <input className="form-control" value={order.clientName} onChange={e => setOrder({...order, clientName: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Teléfono</label>
            <input className="form-control" value={order.phone} onChange={e => setOrder({...order, phone: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Placa</label>
            <input className="form-control" value={order.plate} onChange={e => setOrder({...order, plate: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Marca</label>
            <input className="form-control" value={order.brand} onChange={e => setOrder({...order, brand: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Modelo</label>
            <input className="form-control" value={order.model} onChange={e => setOrder({...order, model: e.target.value})} />
          </div>
          <div className="form-group">
            <label className="form-label">Kilometraje</label>
            <input className="form-control" type="number" value={order.mileage} onChange={e => setOrder({...order, mileage: parseInt(e.target.value) || 0})} />
          </div>
        </div>

        <div className="form-group mt-4">
          <label className="form-label">Servicios a Realizar</label>
          <textarea className="form-control" rows="3" value={order.servicesToPerform} onChange={e => setOrder({...order, servicesToPerform: e.target.value})}></textarea>
        </div>
      </div>

      {/* Placeholders for Report & Quote components, will implement them next */}
      {id !== 'new' && (
        <>
          <div className="card">
            <h3>Reporte de Revisión (Completar Precios)</h3>
            <p className="text-secondary text-sm mb-4">Administra los valores que el técnico dejó pendientes.</p>
            {report?.items?.length === 0 ? (
              <p className="text-secondary">El técnico aún no ha enviado el reporte.</p>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Categoría</th>
                      <th>Estado</th>
                      <th>Mano de Obra</th>
                      <th>Repuesto</th>
                      <th>Reparación</th>
                    </tr>
                  </thead>
                  <tbody>
                    {report?.items?.map(item => (
                      <tr key={item.id}>
                        <td className="font-bold">{item.category}</td>
                        <td><span className={`badge ${item.status === 'Bueno' ? 'badge-success' : item.status === 'Regular' ? 'badge-warning' : 'badge-danger'}`}>{item.status}</span></td>
                        <td>${item.laborCost || 0}</td>
                        <td>{item.needsPart ? 'Sí' : 'No'}</td>
                        <td>
                          {item.needsRepair ? (
                            <input 
                              type="number" 
                              className="form-control" 
                              style={{ width: '120px', padding: '0.25rem 0.5rem' }} 
                              placeholder="Valor rep." 
                              value={item.repairCost || ''} 
                              onChange={(e) => {
                                const newItems = report.items.map(i => i.id === item.id ? {...i, repairCost: parseInt(e.target.value) || 0, isPendingAdmin: false} : i);
                                setReport({...report, items: newItems});
                              }}
                            />
                          ) : 'No'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-4 flex justify-end">
                  <button className="btn btn-secondary no-print" onClick={() => api.saveReport(report)}>Actualizar Reporte</button>
                </div>
              </div>
            )}
          </div>

          <div className="card">
            <h3>Cotización / Factura</h3>
            <div className="table-container mb-4">
              <table>
                <thead>
                  <tr>
                    <th>Descripción</th>
                    <th>Cantidad</th>
                    <th>Valor Unit.</th>
                    <th>IVA (+19%)</th>
                    <th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {quote?.items?.map((item, idx) => (
                    <tr key={item.id || idx}>
                      <td>
                        <input className="form-control" value={item.description} onChange={(e) => {
                          const newItems = [...quote.items];
                          newItems[idx].description = e.target.value;
                          setQuote({...quote, items: newItems});
                        }} />
                      </td>
                      <td>
                        <input type="number" className="form-control" style={{ width: '80px' }} value={item.quantity} onChange={(e) => {
                          const newItems = [...quote.items];
                          newItems[idx].quantity = parseInt(e.target.value) || 1;
                          setQuote({...quote, items: newItems});
                        }} />
                      </td>
                      <td>
                        <input type="number" className="form-control" style={{ width: '120px' }} value={item.unitPrice} onChange={(e) => {
                          const newItems = [...quote.items];
                          newItems[idx].unitPrice = parseInt(e.target.value) || 0;
                          setQuote({...quote, items: newItems});
                        }} />
                      </td>
                      <td>
                        <input type="checkbox" checked={item.applyVat} onChange={(e) => {
                          const newItems = [...quote.items];
                          newItems[idx].applyVat = e.target.checked;
                          setQuote({...quote, items: newItems});
                        }} />
                      </td>
                      <td className="font-bold">
                        ${((item.quantity * item.unitPrice) * (item.applyVat ? 1.19 : 1)).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            
            <div className="flex justify-between items-center no-print">
              <button className="btn btn-outline" onClick={() => {
                setQuote({
                  ...quote, 
                  items: [...(quote.items || []), { id: `q-item-${Date.now()}`, description: '', quantity: 1, unitPrice: 0, applyVat: false }]
                });
              }}>+ Agregar Ítem</button>
              
              <div className="flex items-center gap-4">
                <span className="font-bold text-lg">
                  Total Estimado: ${quote?.items?.reduce((sum, item) => sum + ((item.quantity * item.unitPrice) * (item.applyVat ? 1.19 : 1)), 0).toLocaleString()}
                </span>
                <button className="btn btn-primary" onClick={() => api.saveQuote(quote)}>Guardar Cotización</button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AdminOrderView;
