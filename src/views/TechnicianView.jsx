import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { ClipboardList } from 'lucide-react';

const TechnicianView = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const data = await api.getOrders();
        // Technicians only see vehicles in Reception or Process
        setOrders(data.filter(o => o.status === 'Recepción' || o.status === 'Proceso'));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    loadOrders();
  }, []);

  if (loading) return <div className="spinner"></div>;

  return (
    <div>
      <h1 className="mb-8">Portal del Técnico</h1>
      <p className="text-secondary mb-4">Selecciona un vehículo para iniciar o continuar la revisión.</p>

      <div className="grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1.5rem' }}>
        {orders.map(order => (
          <div key={order.id} className="card flex-col gap-2">
            <div className="flex justify-between">
              <span className="order-plate text-lg">{order.plate}</span>
              <span className={`badge ${order.status === 'Recepción' ? 'badge-info' : 'badge-warning'}`}>{order.status}</span>
            </div>
            <div className="font-bold text-xl">{order.brand} {order.model}</div>
            <div className="text-secondary text-sm">Año: {order.year} • Km: {order.mileage.toLocaleString()}</div>
            
            <div className="mt-4 p-3 bg-opacity-20 rounded" style={{ backgroundColor: 'rgba(255,255,255,0.05)' }}>
              <div className="font-bold text-sm mb-1">Servicios solicitados:</div>
              <div className="text-sm">{order.servicesToPerform}</div>
            </div>

            <button className="btn btn-primary mt-4 w-full" onClick={() => navigate(`/technician/report/${order.id}`)}>
              <ClipboardList size={18} /> Llenar Revisión
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TechnicianView;
