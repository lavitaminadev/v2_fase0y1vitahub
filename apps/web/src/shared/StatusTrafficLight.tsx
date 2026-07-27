import { useState, useRef, useEffect } from 'react';
import './StatusTrafficLight.css';
import { RESERVATION_STATUS_OPTIONS, findStatusOption, type StatusOption } from './status-palette';

interface StatusTrafficLightProps {
  /** Valor de estado actual. Debe existir en `options`. */
  status: string;
  /** Recibe el nuevo valor cuando el usuario elige otra opción. */
  onChange: (newStatus: string) => void;
  /** Muestra el estado sin permitir cambiarlo. */
  disabled?: boolean;
  /** Conjunto de estados ofrecidos. Por defecto, el ciclo de reserva. */
  options?: StatusOption[];
  /** Nombre de la fila, para que el control se anuncie de forma única en listas. */
  label?: string;
}

const UNKNOWN: StatusOption = { value: '', color: '#596562', icon: '●', label: 'Sin estado' };

/**
 * Control de estado en un clic: muestra el estado actual y despliega el resto del ciclo.
 *
 * Lo usan la bandeja de reservas y el CRM de contactos, que comparten el mismo gesto
 * (marcar asistencia) sobre conjuntos de estados distintos.
 */
export function StatusTrafficLight({ status, onChange, disabled, options = RESERVATION_STATUS_OPTIONS, label }: StatusTrafficLightProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const current = findStatusOption(options, status) ?? UNKNOWN;

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  return (
    <div className="status-traffic-light" ref={containerRef}>
      <button
        className="status-button"
        style={{
          borderColor: current.color,
        }}
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        aria-label={label ? `Estado de ${label}: ${current.label}` : `Estado: ${current.label}`}
        aria-expanded={open}
        aria-haspopup="listbox"
      >
        <span className="icon" style={{ color: current.color }}>
          {current.icon}
        </span>
        <span className="label">{current.label}</span>
      </button>

      {open && (
        <div className="status-dropdown" role="listbox">
          {options.map((option) => (
            <button
              key={option.value}
              className={`status-option ${status === option.value ? 'active' : ''}`}
              style={{ borderLeftColor: option.color }}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              role="option"
              aria-selected={status === option.value}
            >
              <span className="dot" style={{ backgroundColor: option.color }}>
                {option.icon}
              </span>
              <span className="option-label">{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
