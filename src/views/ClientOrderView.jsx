import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { ArrowLeft, CheckCircle, Clock, AlertTriangle } from 'lucide-react';

const ClientOrderView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [report, setReport] = useState(null);
  const [quote, setQuote] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const fetchedOrder = await api.getOrderById(id);
        const fetchedReport = await api.getReportByOrderId(id);
        const fetchedQuote = await api.getQuoteByOrderId(id);
        
        setOrder(fetchedOrder);
        setReport(fetchedReport);
        setQuote(fetchedQuote);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id]);

  if (loading) return <div className="spinner"></div>;
  if (!order) return <div className="text-center mt-8">Orden no encontrada.</div>;

  const getStatusIcon = (status) => {
    switch (status) {
      case 'Recepción': return <Clock className="text-secondary" size={24} />;
      case 'Proceso': return <AlertTriangle color="var(--warning-color)" size={24} />;
      case 'Calidad': return <CheckCircle color="var(--success-color)" size={24} />;
      default: return null;
    }
  };

  return (
    <div className="flex-col gap-6">
      <div>
        <button className="btn btn-secondary mb-4" onClick={() => navigate('/client')}>
          <ArrowLeft size={18} /> Salir
        </button>
      </div>

      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2>Información del Vehículo</h2>
          <div className="flex items-center gap-2">
            <span className="text-secondary font-bold text-sm">ESTADO:</span>
            <div className="flex items-center gap-2 px-3 py-1 rounded bg-opacity-20" style={{ background: 'var(--surface-hover)' }}>
              {getStatusIcon(order.status)}
              <span className="font-bold text-lg">{order.status}</span>
            </div>
          </div>
        </div>

        <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div>
            <div className="text-secondary text-sm">Vehículo</div>
            <div className="font-bold text-lg">{order.brand} {order.model} ({order.year})</div>
          </div>
          <div>
            <div className="text-secondary text-sm">Placa</div>
            <div className="font-bold text-lg">{order.plate}</div>
          </div>
          <div>
            <div className="text-secondary text-sm">Servicios Solicitados</div>
            <div>{order.servicesToPerform}</div>
          </div>
        </div>
      </div>

      {quote && quote.items && quote.items.length > 0 && (
        <div className="card">
          <h2>Cotización Autorizada</h2>
          <div className="table-container mb-4">
            <table>
              <thead>
                <tr>
                  <th>Descripción</th>
                  <th>Cantidad</th>
                  <th>Valor Unit.</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {quote.items.map((item, idx) => {
                  const subtotal = item.quantity * item.unitPrice;
                  const total = item.applyVat ? subtotal * 1.19 : subtotal;
                  return (
                    <tr key={item.id || idx}>
                      <td>{item.description} {item.applyVat && <span className="badge badge-info ml-2">IVA inc.</span>}</td>
                      <td>{item.quantity}</td>
                      <td>${item.unitPrice.toLocaleString()}</td>
                      <td className="font-bold">${total.toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="text-right font-bold text-xl">
            Total Estimado: ${quote.items.reduce((sum, item) => sum + ((item.quantity * item.unitPrice) * (item.applyVat ? 1.19 : 1)), 0).toLocaleString()}
          </div>
        </div>
      )}

      {report && report.items && report.items.length > 0 && (
        <div className="card">
          <h2>Reporte de Revisión General</h2>
          <p className="text-secondary text-sm mb-4">Este reporte muestra el estado general de su vehículo diagnosticado por nuestros técnicos.</p>
          
          <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
            {report.items.map((item) => (
              <div key={item.id} className="p-3 border rounded" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--surface-hover)' }}>
                <div className="font-bold mb-2">{item.category}</div>
                <div className="flex justify-between items-center">
                  <span className="text-sm">Estado Técnico:</span>
                  <span className={`badge ${item.status === 'Bueno' ? 'badge-success' : item.status === 'Regular' ? 'badge-warning' : 'badge-danger'}`}>
                    {item.status}
                  </span>
                </div>
                {(item.needsPart || item.needsRepair) && (
                  <div className="mt-2 pt-2 text-sm text-secondary" style={{ borderTop: '1px solid var(--border-color)' }}>
                    {item.needsPart && <div>• Requiere repuesto</div>}
                    {item.needsRepair && <div>• Requiere reparación</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientOrderView;
