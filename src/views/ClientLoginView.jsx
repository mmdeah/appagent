import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import { Search } from 'lucide-react';

const ClientLoginView = () => {
  const [plate, setPlate] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!plate.trim()) return;

    setLoading(true);
    setError('');
    
    try {
      const orders = await api.getOrders();
      // Search for the active order with this plate
      const order = orders.find(o => o.plate.toUpperCase() === plate.toUpperCase().trim() && o.status !== 'Entregado');
      
      if (order) {
        navigate(`/client/order/${order.id}`);
      } else {
        setError('No se encontró ninguna orden activa para esta placa.');
      }
    } catch (err) {
      console.error(err);
      setError('Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex-col items-center justify-center" style={{ minHeight: '60vh' }}>
      <div className="card" style={{ maxWidth: '400px', width: '100%' }}>
        <h2 className="text-center mb-6">Consulta tu Vehículo</h2>
        
        <form onSubmit={handleSearch}>
          <div className="form-group">
            <label className="form-label">Placa del Vehículo</label>
            <input 
              type="text" 
              className="form-control text-center" 
              style={{ fontSize: '1.5rem', letterSpacing: '2px', textTransform: 'uppercase' }}
              placeholder="ABC-123"
              value={plate}
              onChange={(e) => setPlate(e.target.value)}
              required
            />
          </div>

          {error && <div className="text-sm text-center mb-4" style={{ color: 'var(--danger-color)' }}>{error}</div>}

          <button type="submit" className="btn btn-primary w-full justify-center" disabled={loading}>
            {loading ? 'Buscando...' : <><Search size={18} /> Buscar Orden</>}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ClientLoginView;
