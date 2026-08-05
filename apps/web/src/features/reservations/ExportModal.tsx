import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../../core/api';
import './ExportModal.css';
import { VitaIcons } from '../../shared/Icons';
import { triggerToast } from '../../shared/Toast';

interface ExportOptions {
  format: 'csv' | 'json';
  dateFrom: string;
  dateTo: string;
  fields: string[];
}

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
  /** Formulario a exportar. Sin él no hay nada que descargar y el botón queda inhabilitado. */
  formId?: string;
  /** Oculta los campos de uso interno cuando la vista corresponde al cliente. */
  clientView?: boolean;
}

/** Campos exportables y si son de uso interno del equipo. */
const AVAILABLE_FIELDS: Array<{ id: string; label: string; internal?: boolean }> = [
  { id: 'name', label: 'Nombre' },
  { id: 'phone', label: 'Teléfono' },
  { id: 'email', label: 'Email' },
  { id: 'date', label: 'Fecha' },
  { id: 'status', label: 'Estado' },
  { id: 'attendance', label: 'Asistencia' },
  { id: 'notes', label: 'Notas internas', internal: true },
  { id: 'campaign', label: 'Campaña' },
];

export function ExportModal({ open, onClose, formId, clientView = false }: ExportModalProps) {
  const [options, setOptions] = useState<ExportOptions>({
    format: 'csv',
    dateFrom: '',
    dateTo: '',
    fields: ['name', 'phone', 'email', 'date', 'status', 'attendance'],
  });

  const availableFields = AVAILABLE_FIELDS.filter((field) => !field.internal || !clientView);

  const exportMutation = useMutation({
    mutationFn: async () => {
      if (!formId) throw new Error('Selecciona un formulario antes de exportar');
      // El cliente de API adjunta la sesión y renueva el token; una llamada directa a axios
      // no lleva la cabecera de autorización.
      return api.post<Blob>(
        `/reservations/forms/${formId}/export`,
        clientView ? { ...options, fields: options.fields.filter((field) => field !== 'notes') } : options,
        { responseType: 'blob' },
      );
    },
    onSuccess: (blob: Blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `reservas-${new Date().toISOString().slice(0, 10)}.${options.format}`;
      a.click();
      URL.revokeObjectURL(url);
      triggerToast('Archivo descargado exitosamente', 'success');
      onClose();
    },
    onError: (error: Error) => {
      triggerToast(error.message || 'Error al descargar el archivo', 'error');
    }
  });

  const handleFieldToggle = (fieldId: string, checked: boolean) => {
    if (checked) {
      setOptions({ ...options, fields: [...options.fields, fieldId] });
    } else {
      setOptions({ ...options, fields: options.fields.filter(f => f !== fieldId) });
    }
  };

  if (!open) return null;

  return (
    <>
      <div className="modal-overlay" onClick={onClose} />
      <div className="modal export-modal">
        <div className="modal-header">
          <h2>Exportar reservas</h2>
          <button className="close-btn" onClick={onClose} title="Cerrar">
            <VitaIcons.close />
          </button>
        </div>

        <div className="modal-content">
          <label>
            <span>Rango de fechas</span>
            <div className="date-range">
              <input
                type="date"
                value={options.dateFrom}
                onChange={(e) => setOptions({ ...options, dateFrom: e.target.value })}
              />
              <span>a</span>
              <input
                type="date"
                value={options.dateTo}
                onChange={(e) => setOptions({ ...options, dateTo: e.target.value })}
              />
            </div>
          </label>

          <label>
            <span>Formato</span>
            <select
              value={options.format}
              onChange={(e) => setOptions({ ...options, format: e.target.value as 'csv' | 'json' })}
            >
              <option value="csv">CSV (Excel)</option>
              <option value="json">JSON</option>
            </select>
          </label>

          <fieldset>
            <legend>Campos a incluir</legend>
            <div className="fields-grid">
              {availableFields.map(field => (
                <label key={field.id} className="field-checkbox">
                  <input
                    type="checkbox"
                    checked={options.fields.includes(field.id)}
                    onChange={(e) => handleFieldToggle(field.id, e.target.checked)}
                  />
                  <span>{field.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn btn-primary"
            onClick={() => exportMutation.mutate()}
            disabled={exportMutation.isPending || !formId || options.fields.length === 0}
            title={!formId ? 'Filtra por un formulario para poder exportar' : undefined}
          >
            {exportMutation.isPending ? 'Descargando...' : 'Descargar'}
          </button>
        </div>
      </div>
    </>
  );
}
