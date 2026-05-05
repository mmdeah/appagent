import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCircle, Wrench, Car } from 'lucide-react';

export default function LoginView() {
  const [role, setRole] = useState(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');

    if (role === 'admin' && password === 'admin123') {
      navigate('/admin');
    } else if (role === 'tecnico' && password === 'tecnico123') {
      navigate('/tecnico');
    } else if (role === 'cliente' && password === 'cliente123') {
      navigate('/cliente');
    } else {
      setError('Contraseña incorrecta');
    }
  };

  return (
    <div className="client-view" style={{ maxWidth: '500px', marginTop: '10vh' }}>
      <header className="hero" style={{ padding: '2rem 0', marginBottom: '2rem' }}>
        <h1>Taller Automotriz</h1>
        <p>Selecciona tu perfil para ingresar</p>
      </header>

      {!role ? (
        <div style={{ display: 'grid', gap: '1rem' }}>
          <button onClick={() => setRole('admin')} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '1.5rem', fontSize: '1.2rem' }}>
            <UserCircle size={24} /> Administrador
          </button>
          <button onClick={() => setRole('tecnico')} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '1.5rem', fontSize: '1.2rem' }}>
            <Wrench size={24} /> Técnico
          </button>
          <button onClick={() => setRole('cliente')} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1rem', padding: '1.5rem', fontSize: '1.2rem' }}>
            <Car size={24} /> Cliente
          </button>
        </div>
      ) : (
        <div className="card">
          <button onClick={() => { setRole(null); setPassword(''); setError(''); }} className="btn-secondary" style={{ marginBottom: '1rem' }}>
            &larr; Volver
          </button>
          <h2 style={{ textTransform: 'capitalize', marginBottom: '1rem', textAlign: 'center' }}>Ingreso {role}</h2>
          <form onSubmit={handleLogin}>
            <div className="input-group" style={{ maxWidth: '100%' }}>
              <input 
                type="password" 
                placeholder={`Contraseña (ej. ${role}123)`} 
                value={password} 
                onChange={e => setPassword(e.target.value)}
                style={{ paddingLeft: '1rem' }}
                autoFocus
              />
            </div>
            {error && <p style={{ color: 'var(--danger)', marginBottom: '1rem', textAlign: 'center' }}>{error}</p>}
            <button type="submit" className="btn-primary" style={{ width: '100%' }}>Entrar</button>
          </form>
        </div>
      )}
    </div>
  );
}
