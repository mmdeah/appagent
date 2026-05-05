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
