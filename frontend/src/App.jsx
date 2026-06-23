import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import LoginView from './views/LoginView';
import ClientView from './views/ClientView';
import AdminView from './views/AdminView';
import TechnicianView from './views/TechnicianView';
import ContableView from './views/ContableView';

export const ThemeContext = React.createContext({ theme: 'dark', toggleTheme: () => {} });

function App() {
  const [theme, setTheme] = useState(() => localStorage.getItem('appTema') || 'dark');

  useEffect(() => {
    document.body.setAttribute('data-theme', theme);
    localStorage.setItem('appTema', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <BrowserRouter>
        <div className="app-container">
          <Routes>
            <Route path="/" element={<LoginView />} />
            <Route path="/cliente" element={<ClientView />} />
            <Route path="/admin/*" element={<AdminView />} />
            <Route path="/tecnico/*" element={<TechnicianView />} />
            <Route path="/contable" element={<ContableView />} />
          </Routes>
        </div>
      </BrowserRouter>
    </ThemeContext.Provider>
  );
}

export default App;
