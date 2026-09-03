import { StrictMode, useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import App from './App';
import { bootstrapDb } from './seed/bootstrap';
import './index.css';

registerSW({ immediate: true });

function Root() {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    bootstrapDb()
      .then(() => setReady(true))
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Tietokantavirhe');
      });
  }, []);

  if (error) {
    return (
      <div className="loading">
        <p>{error}</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="loading">
        <p>Avataan Ravinto…</p>
      </div>
    );
  }

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
