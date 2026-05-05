import React, { useEffect, useState } from 'react';
import { api } from '../api';
import KanbanBoard from '../components/KanbanBoard';
import { Plus, Download } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AdminView = () => {
  const [orders, setOrders] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const loadData = async () => {
    setLoading(true);
    try {
      const [fetchedOrders, fetchedQuotes] = await Promise.all([
        api.getOrders(),
        api.getQuotes()
      ]);
      setOrders(fetchedOrders.filter(o => o.status !== 'Entregado'));
      setQuotes(fetchedQuotes);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleStatusChange = async (orderId, newStatus) => {
    // Optimistic UI update
    setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
    await api.updateOrder(orderId, { status: newStatus });
  };

  // Stats calculation
  const totalFacturado = quotes.reduce((acc, quote) => {
    const total = quote.items.reduce((sum, item) => {
      const sub = item.quantity * item.unitPrice;
      return sum + (item.applyVat ? sub * 1.19 : sub);
    }, 0);
    return acc + total;
  }, 0);

  const avgOrder = orders.length > 0 ? totalFacturado / orders.length : 0;
  
  // Note: Total expenses could be derived from reports (laborCost + repairCost)
  // For now, let's keep it simple or zero if not fully implemented in db.

  if (loading) return <div className="spinner"></div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1>Panel de Administración</h1>
        <button className="btn btn-primary" onClick={() => navigate('/admin/order/new')}>
          <Plus size={18} /> Nueva Orden
        </button>
      </div>

      <div className="stats-grid">
        <div className="card stat-card">
          <span className="stat-label">Órdenes Activas</span>
          <span className="stat-value">{orders.length}</span>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Total Facturado (Estimado)</span>
          <span className="stat-value">${totalFacturado.toLocaleString()}</span>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Promedio por Orden</span>
          <span className="stat-value">${avgOrder.toLocaleString()}</span>
        </div>
        <div className="card stat-card">
          <span className="stat-label">Total Gastos (Mano de obra)</span>
          <span className="stat-value text-secondary">Pendiente</span>
        </div>
      </div>

      <h2>Tablero de Órdenes</h2>
      <KanbanBoard orders={orders} onStatusChange={handleStatusChange} />
    </div>
  );
};

export default AdminView;
