let envUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Asegurarse de que tenga http o https
if (envUrl && !envUrl.startsWith('http')) {
  envUrl = 'https://' + envUrl;
}

// Asegurarse de que no termine en '/'
if (envUrl.endsWith('/')) {
  envUrl = envUrl.slice(0, -1);
}

export const API_URL = envUrl;

// URL del servidor principal (appagent) — usado para endpoints como /api/generate-ai-report
let backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:4000';
if (backendUrl && !backendUrl.startsWith('http')) {
  backendUrl = 'https://' + backendUrl;
}
if (backendUrl.endsWith('/')) {
  backendUrl = backendUrl.slice(0, -1);
}
export const BACKEND_URL = backendUrl;

/**
 * Retorna un mensaje si la placa tiene restricción de Pico y Placa hoy.
 * Lunes (1): 0, 9
 * Martes (2): 1, 2
 * Miércoles (3): 3, 4
 * Jueves (4): 5, 6
 * Viernes (5): 7, 8
 */
export const getPicoYPlaca = (placa) => {
  if (!placa) return null;
  const digits = placa.match(/\d/g);
  if (!digits) return null;
  const lastDigit = parseInt(digits[digits.length - 1]);

  const day = new Date().getDay();
  const restrictions = {
    1: [0, 9],
    2: [1, 2],
    3: [3, 4],
    4: [5, 6],
    5: [7, 8],
  };

  if (restrictions[day]?.includes(lastDigit)) return "Hoy tiene Pico y Placa";
  return null;
};
