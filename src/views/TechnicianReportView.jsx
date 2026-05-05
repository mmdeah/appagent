import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { CheckCircle, ArrowLeft } from 'lucide-react';

const CATEGORIES = [
  'Frenos Delanteros', 'Frenos Traseros', 'Suspensión', 'Dirección', 
  'Llantas', 'Aceite de Motor', 'Filtros', 'Sistema Eléctrico', 
  'Batería', 'Refrigeración'
];

const TechnicianReportView = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [reportItems, setReportItems] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const fetchedOrder = await api.getOrderById(id);
        const fetchedReport = await api.getReportByOrderId(id);
        
        setOrder(fetchedOrder);
        
        if (fetchedReport && fetchedReport.items) {
          const map = {};
          fetchedReport.items.forEach(item => {
            map[item.category] = item;
          });
          setReportItems(map);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [id]);

  const updateItem = (category, field, value) => {
    setReportItems(prev => {
      const current = prev[category] || { category, status: '', laborCost: 0, needsPart: false, needsRepair: false, repairCost: 0, isPendingAdmin: false };
      return { ...prev, [category]: { ...current, [field]: value } };
    });
  };

  const handleSave = async () => {
    // Filter only items that have a status selected
    const itemsToSave = Object.values(reportItems).filter(item => item.status !== '');
    
    // Check if any item needs repair but price wasn't provided -> leave for admin
    const finalItems = itemsToSave.map(item => {
      if (item.needsRepair && (!item.repairCost || item.repairCost === 0)) {
        return { ...item, isPendingAdmin: true, id: item.id || `item-${Date.now()}-${Math.random()}` };
      }
      return { ...item, isPendingAdmin: false, id: item.id || `item-${Date.now()}-${Math.random()}` };
    });

    const reportData = {
      serviceOrderId: id,
      items: finalItems
    };

    const existingReport = await api.getReportByOrderId(id);
    if (existingReport) {
      await api.saveReport({ ...existingReport, items: finalItems });
    } else {
      await api.saveReport(reportData);
    }
    
    // Also move order to process if it's in reception
    if (order.status === 'Recepción') {
      await api.updateOrder(id, { status: 'Proceso' });
    }

    alert('Reporte guardado exitosamente');
    navigate('/technician');
  };

  if (loading) return <div className="spinner"></div>;

  return (
    <div className="flex-col gap-4">
      <div className="flex justify-between items-center mb-4">
        <button className="btn btn-secondary" onClick={() => navigate('/technician')}>
          <ArrowLeft size={18} /> Volver
        </button>
        <button className="btn btn-primary" onClick={handleSave}>
          <CheckCircle size={18} /> Guardar Revisión
        </button>
      </div>

      <div className="card mb-4">
        <h2>Revisión: {order.brand} {order.model} ({order.plate})</h2>
        <p className="text-secondary">Notas del cliente: {order.notes}</p>
      </div>

      <div className="report-grid">
        {CATEGORIES.map(category => {
          const data = reportItems[category] || { status: '', needsPart: false, needsRepair: false };
          const isSelected = data.status !== '';

          return (
            <div key={category} className="report-item">
              <div className="font-bold text-lg mb-2">{category}</div>
              
              <div className="radio-group mb-4">
                <label className="radio-label">
                  <input type="radio" name={`status-${category}`} checked={data.status === 'Bueno'} onChange={() => updateItem(category, 'status', 'Bueno')} />
                  <span>Bueno</span>
                </label>
                <label className="radio-label">
                  <input type="radio" name={`status-${category}`} checked={data.status === 'Regular'} onChange={() => updateItem(category, 'status', 'Regular')} />
                  <span>Regular</span>
                </label>
                <label className="radio-label">
                  <input type="radio" name={`status-${category}`} checked={data.status === 'Malo'} onChange={() => updateItem(category, 'status', 'Malo')} />
                  <span>Malo</span>
                </label>
              </div>

              {isSelected && (
                <div className="flex-col gap-3 mt-4 pt-4" style={{ borderTop: '1px solid var(--border-color)' }}>
                  <div className="form-group mb-0">
                    <label className="form-label text-xs">Mano de Obra ($)</label>
                    <input type="number" className="form-control" value={data.laborCost || ''} onChange={e => updateItem(category, 'laborCost', parseInt(e.target.value) || 0)} />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id={`part-${category}`} checked={data.needsPart} onChange={e => updateItem(category, 'needsPart', e.target.checked)} />
                    <label htmlFor={`part-${category}`} className="text-sm">Requiere Repuesto</label>
                  </div>

                  <div className="flex items-center gap-2">
                    <input type="checkbox" id={`repair-${category}`} checked={data.needsRepair} onChange={e => updateItem(category, 'needsRepair', e.target.checked)} />
                    <label htmlFor={`repair-${category}`} className="text-sm">Requiere Reparación externa</label>
                  </div>

                  {data.needsRepair && (
                    <div className="form-group mb-0">
                      <label className="form-label text-xs">Costo Reparación (Opcional - dejar vacío si Admin debe llenar)</label>
                      <input type="number" className="form-control" placeholder="Pendiente" value={data.repairCost || ''} onChange={e => updateItem(category, 'repairCost', parseInt(e.target.value) || 0)} />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TechnicianReportView;
