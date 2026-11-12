import { useState } from 'react';

// El portal de flotas se ve en blanco por defecto (el resto de la app sigue en
// oscuro). La persona puede cambiarlo con el interruptor; se recuerda aparte
// del tema general para no afectar las demás vistas.
export function useFleetTheme() {
  const [tema, setTema] = useState(() => {
    try { return localStorage.getItem('fleetTema') || 'light'; } catch { return 'light'; }
  });
  const toggle = () => setTema(t => {
    const next = t === 'light' ? 'dark' : 'light';
    try { localStorage.setItem('fleetTema', next); } catch { /* sin almacenamiento */ }
    return next;
  });
  return [tema, toggle];
}

// Fondo más blanco que el gris claro general: las tarjetas (blancas) se separan con un borde suave.
export const fleetThemeStyle = (tema) => (tema === 'light'
  ? { '--bg': '#f8fafc', background: '#f8fafc', color: 'var(--text)' }
  : { color: 'var(--text)' });
