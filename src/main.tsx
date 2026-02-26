import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Global error handler for uncaught exceptions
const handleError = (message: any) => {
  console.error("Global Error:", message);
  const root = document.getElementById('root');
  // Only replace if the app seems dead (e.g. empty or just a loader for too long)
  // But for now, let's just log it. The ErrorBoundary in App.tsx should handle React errors.
  // This is a last resort for non-React errors.
};

window.onerror = function(message, source, lineno, colno, error) {
  handleError(message);
};

window.onunhandledrejection = function(event) {
  handleError(event.reason);
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
