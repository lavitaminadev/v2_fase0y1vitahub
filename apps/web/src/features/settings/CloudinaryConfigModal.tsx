import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Modal } from '../../shared/Modal';
import { api } from '../../core/api';

interface CloudinaryConfigModalProps {
  open: boolean;
  onClose: () => void;
}

interface CloudinaryStatus {
  connected: boolean;
  cloudName: string;
  apiKey: string;
  hasApiKey: boolean;
  hasApiSecret: boolean;
  source: 'integration' | 'environment' | 'none';
}

function looksLikeEmail(value: string): boolean {
  return /\S+@\S+\.\S+/.test(value);
}

function isValidCloudName(value: string): boolean {
  return /^[a-zA-Z0-9_-]{2,120}$/.test(value);
}

function isValidApiKey(value: string): boolean {
  return /^\d{6,40}$/.test(value);
}

function explainCloudinaryError(message: string): string {
  const lower = message.toLowerCase();
  if (message.includes('401') || lower.includes('unauthorized')) {
    return 'Tu sesión local venció. Vuelve a ingresar como admin y guarda Cloudinary nuevamente.';
  }
  if (lower.includes('unknown api_key')) {
    return 'Cloudinary rechazó la API Key. Usa la API Key numérica del dashboard de Cloudinary, no el correo ni la contraseña de VitaHub.';
  }
  if (lower.includes('cloud_name mismatch')) {
    return 'El Cloud name no coincide con esa API Key. Copia el Cloud name exacto desde Cloudinary Dashboard; "Root" normalmente es una carpeta o entorno, no el Cloud name.';
  }
  if (lower.includes('cloud name') || lower.includes('api key') || lower.includes('api secret')) {
    return message;
  }
  if (lower.includes('cloudinary rechaz')) {
    return 'Cloudinary rechazó las credenciales. Revisa Cloud name, API Key y API Secret en el dashboard de Cloudinary.';
  }
  return message;
}

export function CloudinaryConfigModal({ open, onClose }: CloudinaryConfigModalProps) {
  const qc = useQueryClient();
  const [cloudName, setCloudName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [localError, setLocalError] = useState('');

  const statusQuery = useQuery<CloudinaryStatus>({
    queryKey: ['cloudinary-config'],
    queryFn: () => api.get('/cloudinary/config'),
    enabled: open,
  });

  useEffect(() => {
    if (statusQuery.data) {
      setCloudName(statusQuery.data.cloudName);
      setApiKey(statusQuery.data.apiKey && !statusQuery.data.apiKey.includes('*') ? statusQuery.data.apiKey : '');
      setLocalError('');
    }
  }, [statusQuery.data]);

  const connected = statusQuery.data?.connected ?? false;
  const isEnvironment = statusQuery.data?.source === 'environment';
  const isConfiguredInApp = statusQuery.data?.source === 'integration';
  const hasSavedApiKey = Boolean(statusQuery.data?.hasApiKey);
  const hasSavedApiSecret = Boolean(statusQuery.data?.hasApiSecret);
  const canUseSavedCredentials = connected && hasSavedApiKey && hasSavedApiSecret;

  const validationMessage = useMemo(() => {
    const normalizedCloudName = cloudName.trim();
    const normalizedApiKey = apiKey.trim();
    const normalizedApiSecret = apiSecret.trim();

    if (!normalizedCloudName) return 'Falta el Cloud name de Cloudinary.';
    if (normalizedCloudName.toLowerCase() === 'root') return '"Root" es el nombre de la API key, no el Cloud name. En tu captura el Cloud name correcto es "fjkem3d7".';
    if (!isValidCloudName(normalizedCloudName)) return 'El Cloud name sólo debe tener letras, números, guion o guion bajo. No uses “Root” salvo que sea realmente tu cloud name.';
    if (!canUseSavedCredentials && !normalizedApiKey) return 'Falta la API Key numérica de Cloudinary.';
    if (normalizedApiKey && looksLikeEmail(normalizedApiKey)) return 'La API Key no es un correo. No uses el usuario de VitaHub; usa la API Key numérica de Cloudinary.';
    if (normalizedApiKey && !isValidApiKey(normalizedApiKey)) return 'La API Key de Cloudinary normalmente es numérica. Copia el valor desde Cloudinary > Dashboard > API Key.';
    if (!canUseSavedCredentials && !normalizedApiSecret) return 'Falta el API Secret de Cloudinary.';
    if (normalizedApiSecret && looksLikeEmail(normalizedApiSecret)) return 'El API Secret no es un correo ni la contraseña de VitaHub. Copia el API Secret desde Cloudinary.';
    return '';
  }, [apiKey, apiSecret, canUseSavedCredentials, cloudName]);

  const saveMutation = useMutation({
    mutationFn: () => api.put('/cloudinary/config', {
      cloudName: cloudName.trim() || undefined,
      apiKey: apiKey.trim() || undefined,
      apiSecret: apiSecret.trim() || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cloudinary-config'] });
      setApiSecret('');
      setLocalError('');
      onClose();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => api.delete('/cloudinary/config'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cloudinary-config'] });
      setCloudName('');
      setApiKey('');
      setApiSecret('');
      setLocalError('');
      onClose();
    },
  });

  const saveError = localError || saveMutation.error?.message || deleteMutation.error?.message || '';
  const friendlyError = saveError ? explainCloudinaryError(saveError) : '';

  return (
    <Modal open={open} onClose={onClose} title="Cloudinary global">
      <div className="cloudinary-config-modal">
        <p className="page-subtitle">
          Cloudinary permite subir logos e imágenes de fondo para los formularios de reserva.
          Esta configuración aplica a toda la organización y usa credenciales propias de Cloudinary, no las de VitaHub.
        </p>

        <div className={`cloudinary-status ${connected ? 'connected' : 'disconnected'}`}>
          <span>{connected ? '● Conectado' : '○ Desconectado'}</span>
          <small>{isEnvironment ? 'Configurado por variables de entorno' : isConfiguredInApp ? 'Configurado en VITAHUB' : 'Sin credenciales guardadas'}</small>
        </div>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (validationMessage) {
              setLocalError(validationMessage);
              return;
            }
            setLocalError('');
            saveMutation.mutate();
          }}
        >
          <label>
            Cloud name de Cloudinary
            <input
              className="input"
              value={cloudName}
              onChange={(event) => setCloudName(event.target.value)}
              placeholder="ejemplo: mi-restaurante"
              required={!connected}
            />
            <small>Está en Cloudinary Dashboard como “Cloud name”. No es el nombre de usuario de VitaHub.</small>
          </label>
          <label>
            API Key de Cloudinary
            <input
              className="input"
              inputMode="numeric"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={hasSavedApiKey ? 'API Key guardada; escribe una nueva sólo si quieres cambiarla' : 'ejemplo: 123456789012345'}
              required={!canUseSavedCredentials}
            />
            {hasSavedApiKey
              ? <small>Ya hay una API Key guardada. Por seguridad no mostramos el valor completo.</small>
              : <small>Debe ser la API Key numérica de Cloudinary. No uses admin@vitahub.local.</small>}
          </label>
          <label>
            API Secret de Cloudinary
            <div className="secret-field">
              <input
                className="input"
                type={showSecret ? 'text' : 'password'}
                value={apiSecret}
                onChange={(event) => setApiSecret(event.target.value)}
                placeholder={hasSavedApiSecret ? 'API Secret guardado; escribe uno nuevo sólo si quieres cambiarlo' : 'pega aquí el API Secret de Cloudinary'}
                required={!canUseSavedCredentials}
              />
              <button type="button" className="btn btn-outline btn-sm" onClick={() => setShowSecret((current) => !current)}>
                {showSecret ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <small>El API Secret tampoco es la contraseña de VitaHub.</small>
          </label>

          {friendlyError && (
            <div className="alert alert-error" role="alert">
              {friendlyError}
            </div>
          )}
          <div className="alert alert-info">
            Ruta: Cloudinary → Dashboard → Product Environment Credentials. Copia Cloud name, API Key y API Secret.
          </div>

          <div className="cloudinary-actions">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cerrar</button>
            {connected && !isEnvironment && (
              <button
                type="button"
                className="btn btn-outline btn-danger"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                {deleteMutation.isPending ? 'Eliminando...' : 'Desconectar'}
              </button>
            )}
            <button type="submit" className="btn btn-primary" disabled={saveMutation.isPending}>
              {saveMutation.isPending ? 'Validando y guardando...' : connected ? 'Validar y actualizar' : 'Validar y conectar'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
