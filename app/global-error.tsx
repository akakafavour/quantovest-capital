'use client';

import React, { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[Global error caught]:', error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, backgroundColor: '#0A0D0C', color: '#ffffff', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <div style={{ maxWidth: '450px', width: '100%', background: '#121614', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '1rem', padding: '2rem', textAlign: 'center' }}>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '0.75rem' }}>System Error</h1>
            <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>
              The application encountered a critical error. Please reload or try again.
            </p>
            <button
              onClick={() => reset()}
              style={{ padding: '0.75rem 1.5rem', background: '#10b981', color: '#000000', fontWeight: '600', fontSize: '0.875rem', borderRadius: '0.75rem', border: 'none', cursor: 'pointer' }}
            >
              Reload Application
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
