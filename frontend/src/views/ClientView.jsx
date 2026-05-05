import React, { useState } from 'react';
import { Search } from 'lucide-react';
import { API_URL } from '../api';

export default function ClientView() {
  const [placa, setPlaca] = useState('');
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');

  const searchOrder = async (e) => {
    e.preventDefault();
    if (!placa) return;
    
    try {
      const res = await fetch(`${API_URL}/orders?placa=${placa}&_embed=reports&_embed=quotes`);
      const data = await res.json();
      if (data.length > 0) {
        setOrder(data[0]);
        setError('');
      } else {
        setError('No se encontró orden para esta placa. Por favor verifica.');
        setOrder(null);
      }
    } catch (error) {
      console.error(error);
      setError('Error al conectar con el servidor.');
    }
  };

  return (
    <div className="client-view">
      <header className="hero">
        <h1>Taller Automotriz</h1>
        <p>Revisa el estado de tu vehículo</p>
      </header>

      {!order ? (
        <form className="search-form" onSubmit={searchOrder}>
          <div className="input-group">
            <Search className="icon" />
            <input 
              type="text" 
              placeholder="¿Cuál es la placa de tu vehículo?" 
              value={placa} 
              onChange={e => { setPlaca(e.target.value.toUpperCase()); setError(''); }}
            />
          </div>
          {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem', fontWeight: '500' }}>{error}</p>}
          <button type="submit" className="btn-primary">Buscar</button>
        </form>
      ) : (
        <div className="card">
          <h2>Orden de Servicio #{order.id}</h2>
          <p>Estado: <strong>{order.estado}</strong></p>
          <p>Vehículo: {order.marca} {order.modelo} ({order.anio})</p>
          <button onClick={() => setOrder(null)} className="btn-secondary" style={{marginTop: '1rem'}}>
            Buscar otra placa
          </button>
        </div>
      )}
    </div>
  );
}
