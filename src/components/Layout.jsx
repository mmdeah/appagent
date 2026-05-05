import React from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Wrench } from 'lucide-react';

const Layout = () => {
  const location = useLocation();

  return (
    <div className="app-container">
      <nav className="navbar no-print">
        <Link to="/" className="navbar-brand flex items-center gap-2">
          <Wrench size={24} color="#3b82f6" />
          AutoRepair System
        </Link>
        <div className="navbar-nav">
          <Link to="/admin" className={`nav-link ${location.pathname.startsWith('/admin') ? 'active' : ''}`}>Admin</Link>
          <Link to="/technician" className={`nav-link ${location.pathname.startsWith('/technician') ? 'active' : ''}`}>Técnico</Link>
          <Link to="/client" className={`nav-link ${location.pathname.startsWith('/client') ? 'active' : ''}`}>Cliente</Link>
        </div>
      </nav>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;
