import React, { useState, useEffect } from 'react';
import { API_URL } from '../api';
import OrderDetailsModal from './OrderDetailsModal';
import { PlusCircle } from 'lucide-react';

export default function AdminView() {
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({ avg: 0, total: 0, expenses: 0, active: 0 });
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showNewOrder, setShowNewOrder] = useState(false);
  const [newOrderForm, setNewOrderForm] = useState({ 
    placa: '', cliente: '', telefono: '', correo: '', marca: '', modelo: '', anio: '', kilometraje: '', servicios: '', notas: '' 
  });

  const fetchOrders = async () => {
    try {
      const res = await fetch(`${API_URL}/orders?_embed=reports&_embed=quotes`);
      const data = await res.json();
      setOrders(data);
      
      const active = data.length;
      let totalFacturado = 0;
      
      data.forEach(order => {
        if (order.quotes && order.quotes.length > 0) {
          order.quotes.forEach(quote => {
            if (quote.items) {
              quote.items.forEach(item => {
                const subtotal = (item.precio * item.cantidad);
                const totalItem = item.aplicaIva ? subtotal * 1.19 : subtotal;
                totalFacturado += totalItem;
              });
            }
          });
        }
      });
      
      const avg = active > 0 ? (totalFacturado / active) : 0;
      setStats({ avg, total: totalFacturado, expenses: 0, active });
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const kanbanColumns = ['Recepción', 'Proceso', 'Calidad'];

  const moveOrder = async (orderId, newStatus) => {
    await fetch(`${API_URL}/orders/${orderId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ estado: newStatus })
    });
    fetchOrders();
  };

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    if (!newOrderForm.placa) return;
    
    await fetch(`${API_URL}/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...newOrderForm,
        placa: newOrderForm.placa.toUpperCase(),
        estado: 'Recepción',
        fecha: new Date().toISOString()
      })
    });
    
    setShowNewOrder(false);
    setNewOrderForm({ placa: '', cliente: '', telefono: '', correo: '', marca: '', modelo: '', anio: '', kilometraje: '', servicios: '', notas: '' });
    fetchOrders();
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <h1>Panel de Administración</h1>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', margin: '2rem 0' }}>
        <div className="card" style={{ textAlign: 'center' }}>
          <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Órdenes Activas</h3>
          <p style={{ fontSize: '2rem', fontWeight: 'bold', color: 'var(--primary)' }}>{stats.active}</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Total Facturado</h3>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>${stats.total.toLocaleString()}</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Promedio O.S</h3>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>${stats.avg.toLocaleString()}</p>
        </div>
        <div className="card" style={{ textAlign: 'center' }}>
          <h3 style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Gastos Totales</h3>
          <p style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>${stats.expenses.toLocaleString()}</p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1.5rem' }}>
        {kanbanColumns.map(col => (
          <div key={col} style={{ background: '#f1f5f9', padding: '1.5rem', borderRadius: '12px', minHeight: '500px' }}>
            <h2 style={{ marginBottom: '1rem', borderBottom: '2px solid #cbd5e1', paddingBottom: '0.5rem' }}>{col}</h2>
            {orders.filter(o => o.estado === col).map(o => (
              <div 
                key={o.id} 
                className="card" 
                style={{ marginBottom: '1rem', cursor: 'pointer', transition: 'transform 0.2s' }} 
                onClick={() => setSelectedOrder(o)}
                onMouseOver={e => e.currentTarget.style.transform = 'translateY(-2px)'}
                onMouseOut={e => e.currentTarget.style.transform = 'translateY(0)'}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '1.2rem', margin: 0 }}>{o.placa}</h4>
                  <span style={{ fontSize: '0.8rem', background: 'var(--primary)', color: 'white', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>
                    {o.reports?.length > 0 ? '✓ Revisado' : '⏳ Pdte'}
                  </span>
                </div>
                <p style={{ margin: '0.5rem 0', color: 'var(--text-muted)' }}>{o.marca} {o.modelo}</p>
                <select 
                  value={o.estado} 
                  onChange={(e) => { e.stopPropagation(); moveOrder(o.id, e.target.value); }}
                  style={{ padding: '0.5rem', width: '100%', borderRadius: '4px', border: '1px solid var(--border)' }}
                >
                  {kanbanColumns.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            ))}
            {col === 'Recepción' && (
              <button className="btn-secondary" style={{ width: '100%', marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }} onClick={() => setShowNewOrder(true)}>
                <PlusCircle size={18} /> Nueva Orden
              </button>
            )}
          </div>
        ))}
      </div>

      {showNewOrder && (
        <div className="modal-overlay" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
          <div className="card" style={{ width: '90%', maxWidth: '600px', background: 'white', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2 style={{ marginBottom: '1rem' }}>Ingresar Vehículo</h2>
            <form onSubmit={handleCreateOrder} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <input placeholder="Placa (Ej. AAA123)" required value={newOrderForm.placa} onChange={e => setNewOrderForm({...newOrderForm, placa: e.target.value})} style={{ padding: '0.5rem' }} />
              <input placeholder="Kilometraje" required type="number" value={newOrderForm.kilometraje} onChange={e => setNewOrderForm({...newOrderForm, kilometraje: e.target.value})} style={{ padding: '0.5rem' }} />
              
              <input placeholder="Nombre Cliente" required value={newOrderForm.cliente} onChange={e => setNewOrderForm({...newOrderForm, cliente: e.target.value})} style={{ padding: '0.5rem' }} />
              <input placeholder="Teléfono" required value={newOrderForm.telefono} onChange={e => setNewOrderForm({...newOrderForm, telefono: e.target.value})} style={{ padding: '0.5rem' }} />
              
              <input placeholder="Correo" required type="email" value={newOrderForm.correo} onChange={e => setNewOrderForm({...newOrderForm, correo: e.target.value})} style={{ padding: '0.5rem', gridColumn: '1 / -1' }} />
              
              <input placeholder="Marca" required value={newOrderForm.marca} onChange={e => setNewOrderForm({...newOrderForm, marca: e.target.value})} style={{ padding: '0.5rem' }} />
              <input placeholder="Modelo" required value={newOrderForm.modelo} onChange={e => setNewOrderForm({...newOrderForm, modelo: e.target.value})} style={{ padding: '0.5rem' }} />
              <input placeholder="Año" required type="number" value={newOrderForm.anio} onChange={e => setNewOrderForm({...newOrderForm, anio: e.target.value})} style={{ padding: '0.5rem' }} />
              
              <textarea placeholder="Servicios a Realizar" required value={newOrderForm.servicios} onChange={e => setNewOrderForm({...newOrderForm, servicios: e.target.value})} style={{ padding: '0.5rem', gridColumn: '1 / -1', minHeight: '60px' }}></textarea>
              <textarea placeholder="Notas / Observaciones" value={newOrderForm.notas} onChange={e => setNewOrderForm({...newOrderForm, notas: e.target.value})} style={{ padding: '0.5rem', gridColumn: '1 / -1', minHeight: '60px' }}></textarea>
              
              <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem', gridColumn: '1 / -1' }}>
                <button type="button" className="btn-secondary" onClick={() => setShowNewOrder(false)} style={{ flex: 1 }}>Cancelar</button>
                <button type="submit" className="btn-primary" style={{ flex: 1 }}>Guardar Orden</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedOrder && (
        <OrderDetailsModal 
          order={selectedOrder} 
          onClose={() => { setSelectedOrder(null); fetchOrders(); }} 
        />
      )}
    </div>
  );
}
