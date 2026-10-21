import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './style.css';

// Ensure hash is set to #/telemetry on dedicated telemetry page
if (typeof window !== 'undefined' && !window.location.hash) {
  window.location.hash = '#/telemetry';
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
