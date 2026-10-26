
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Polyfill global para asegurar que process.env.API_KEY esté disponible para el SDK de Gemini
// tal como se requiere en las directrices técnicas.
if (typeof window !== 'undefined') {
  (window as any).process = {
    env: {
      // Intentamos capturar la clave de las variables de entorno de Vite
      API_KEY: (import.meta as any).env.VITE_GEMINI_API_KEY || (import.meta as any).env.VITE_API_KEY || ''
    }
  };
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
