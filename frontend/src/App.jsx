import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginView from './views/LoginView';
import ClientView from './views/ClientView';
import AdminView from './views/AdminView';
import TechnicianView from './views/TechnicianView';

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <Routes>
          <Route path="/" element={<LoginView />} />
          <Route path="/cliente" element={<ClientView />} />
          <Route path="/admin/*" element={<AdminView />} />
          <Route path="/tecnico/*" element={<TechnicianView />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

export default App;
