import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import LandingView from './views/LandingView';
import AdminView from './views/AdminView';
import AdminOrderView from './views/AdminOrderView';
import TechnicianView from './views/TechnicianView';
import TechnicianReportView from './views/TechnicianReportView';
import ClientLoginView from './views/ClientLoginView';
import ClientOrderView from './views/ClientOrderView';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<LandingView />} />
          <Route path="admin" element={<AdminView />} />
          <Route path="admin/order/:id" element={<AdminOrderView />} />
          <Route path="technician" element={<TechnicianView />} />
          <Route path="technician/report/:id" element={<TechnicianReportView />} />
          <Route path="client" element={<ClientLoginView />} />
          <Route path="client/order/:id" element={<ClientOrderView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
