import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Wrench, Car, ArrowLeft, Lock } from 'lucide-react';

const roles = [
  {
    id: 'admin',
    label: 'Administrador',
    desc: 'Panel completo con estadísticas y Kanban',
    icon: <Shield size={22} color="#818cf8" />,
    iconBg: 'rgba(99,102,241,0.15)',
    pass: 'admin123',
    path: '/admin'
  },
  {
    id: 'tecnico',
    label: 'Técnico',
    desc: 'Vehículos asignados y revisiones',
    icon: <Wrench size={22} color="#34d399" />,
    iconBg: 'rgba(16,185,129,0.15)',
    pass: 'tecnico123',
    path: '/tecnico'
  },
  {
    id: 'cliente',
    label: 'Cliente',
    desc: 'Consulta el estado de tu vehículo',
    icon: <Car size={22} color="#fbbf24" />,
    iconBg: 'rgba(245,158,11,0.15)',
    pass: 'cliente123',
    path: '/cliente'
  }
];

export default function LoginView() {
  const [selected, setSelected] = useState(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = (e) => {
    e.preventDefault();
    setError('');
    if (password === selected.pass) {
      navigate(selected.path);
    } else {
      setError('Contraseña incorrecta. Inténtalo de nuevo.');
    }
  };

  return (
    <div className="login-page">
      <div className="login-box">
        {/* Logo / Header */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg, #6366f1, #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <Wrench size={26} color="white" />
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '-0.025em' }}>Taller Automotriz</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            {selected ? `Ingreso — ${selected.label}` : 'Selecciona tu perfil para continuar'}
          </p>
        </div>

        {!selected ? (
          <div>
            {roles.map(role => (
              <div key={role.id} className="role-card" onClick={() => setSelected(role)}>
                <div className="role-icon" style={{ background: role.iconBg }}>{role.icon}</div>
                <div>
                  <div style={{ fontWeight: 600, marginBottom: '0.1rem' }}>{role.label}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{role.desc}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <form onSubmit={handleLogin}>
            <button type="button" onClick={() => { setSelected(null); setPassword(''); setError(''); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', marginBottom: '1.5rem', padding: 0 }}>
              <ArrowLeft size={16} /> Cambiar perfil
            </button>

            <div className="role-card" style={{ cursor: 'default', marginBottom: '1.5rem', pointerEvents: 'none' }}>
              <div className="role-icon" style={{ background: selected.iconBg }}>{selected.icon}</div>
              <div>
                <div style={{ fontWeight: 600 }}>{selected.label}</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{selected.desc}</div>
              </div>
            </div>

            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.4rem' }}>
              Contraseña
            </label>
            <div style={{ position: 'relative', marginBottom: '1rem' }}>
              <Lock size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="password"
                placeholder="Ingresa tu contraseña"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                style={{ paddingLeft: '2.5rem' }}
                autoFocus
              />
            </div>

            {error && (
              <div className="toast toast-error" style={{ marginBottom: '1rem' }}>{error}</div>
            )}

            <button type="submit" className="btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '0.8rem' }}>
              Ingresar
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
