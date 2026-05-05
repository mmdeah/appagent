import React from 'react';
import { Link } from 'react-router-dom';
import { Settings, Wrench, User } from 'lucide-react';

const LandingView = () => {
  return (
    <div className="flex-col items-center" style={{ marginTop: '4rem', textAlign: 'center' }}>
      <h1>Bienvenido al Sistema de Taller Automotriz</h1>
      <p className="text-secondary mb-8">Selecciona tu portal de acceso</p>

      <div className="flex gap-4 justify-center" style={{ flexWrap: 'wrap' }}>
        <Link to="/admin" className="card flex-col items-center gap-2" style={{ width: '250px', textDecoration: 'none' }}>
          <Settings size={48} color="var(--accent-color)" />
          <h2>Administrador</h2>
          <p className="text-secondary text-sm">Gestión completa de órdenes, reportes y cotizaciones.</p>
        </Link>
        
        <Link to="/technician" className="card flex-col items-center gap-2" style={{ width: '250px', textDecoration: 'none' }}>
          <Wrench size={48} color="var(--warning-color)" />
          <h2>Técnico</h2>
          <p className="text-secondary text-sm">Revisión de vehículos y reportes de estado.</p>
        </Link>

        <Link to="/client" className="card flex-col items-center gap-2" style={{ width: '250px', textDecoration: 'none' }}>
          <User size={48} color="var(--success-color)" />
          <h2>Cliente</h2>
          <p className="text-secondary text-sm">Consulta el estado de tu vehículo y cotizaciones.</p>
        </Link>
      </div>
    </div>
  );
};

export default LandingView;
