import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../../core/api';

type Provider = 'google' | 'meta';

const PROVIDER_LABELS: Record<Provider, string> = {
  google: 'Google',
  meta: 'Meta',
};

interface OAuthCallbackPageProps {
  provider: Provider;
}

export function OAuthCallbackPage({ provider }: OAuthCallbackPageProps) {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [message, setMessage] = useState(`Conectando ${PROVIDER_LABELS[provider]}...`);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      setMessage(`La autorización con ${PROVIDER_LABELS[provider]} fue cancelada o falló.`);
      window.opener?.postMessage({ type: 'oauth:error', provider, error }, window.location.origin);
      return;
    }

    if (!code || !state) {
      setMessage(`No se recibió el código OAuth de ${PROVIDER_LABELS[provider]}.`);
      return;
    }

    const redirectUri = window.location.href.split('?')[0];

    void api
      .post(`/integrations/${provider}/callback`, { code, state, redirectUri })
      .then(() => {
        setMessage(`${PROVIDER_LABELS[provider]} conectado correctamente.`);
        window.opener?.postMessage({ type: 'oauth:success', provider }, window.location.origin);
      })
      .catch((err: Error) => {
        setMessage(err.message || `No se pudo completar la conexión con ${PROVIDER_LABELS[provider]}.`);
        window.opener?.postMessage(
          { type: 'oauth:error', provider, error: err.message },
          window.location.origin,
        );
      })
      .finally(() => {
        window.setTimeout(() => {
          navigate('/integrations', { replace: true });
          window.close();
        }, 1200);
      });
  }, [navigate, provider, searchParams]);

  return (
    <div className="page oauth-callback-page">
      <div className="card oauth-callback-card">
        <h1>{PROVIDER_LABELS[provider]}</h1>
        <p>{message}</p>
      </div>
    </div>
  );
}
