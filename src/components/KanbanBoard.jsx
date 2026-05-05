import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MessageCircle } from 'lucide-react';

const KanbanBoard = ({ orders, onStatusChange }) => {
  const navigate = useNavigate();
  const columns = ['Recepción', 'Proceso', 'Calidad'];

  const handleDragStart = (e, orderId) => {
    e.dataTransfer.setData('orderId', orderId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e, status) => {
    e.preventDefault();
    const orderId = e.dataTransfer.getData('orderId');
    if (orderId) {
      onStatusChange(orderId, status);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Recepción': return 'badge-info';
      case 'Proceso': return 'badge-warning';
      case 'Calidad': return 'badge-success';
      default: return 'badge-info';
    }
  };

  return (
    <div className="kanban-board">
      {columns.map(column => (
        <div 
          key={column} 
          className="kanban-column"
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, column)}
        >
          <div className="kanban-column-header">
            <span>{column}</span>
            <span className="badge" style={{ background: 'rgba(255,255,255,0.1)' }}>
              {orders.filter(o => o.status === column).length}
            </span>
          </div>
          
          {orders.filter(o => o.status === column).map(order => (
            <div 
              key={order.id} 
              className="order-card"
              draggable
              onDragStart={(e) => handleDragStart(e, order.id)}
              onClick={() => navigate(`/admin/order/${order.id}`)}
            >
              <div className="order-card-header">
                <span className="order-plate">{order.plate}</span>
                <span className={`badge ${getStatusColor(order.status)}`}>{order.status}</span>
              </div>
              <div className="text-sm font-bold mb-2">{order.brand} {order.model}</div>
              <div className="text-secondary text-sm mb-4">{order.clientName}</div>
              
              <div className="flex justify-between items-center mt-2 pt-2" style={{ borderTop: '1px solid var(--border-color)' }}>
                <span className="text-secondary text-sm">ID: {order.id.slice(0, 8)}...</span>
                <button 
                  className="btn btn-whatsapp" 
                  style={{ padding: '0.3rem 0.6rem' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(`https://wa.me/${order.phone.replace(/[^0-9]/g, '')}`, '_blank');
                  }}
                  title="Contactar por WhatsApp"
                >
                  <MessageCircle size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default KanbanBoard;
