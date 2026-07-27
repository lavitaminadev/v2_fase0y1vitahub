import { useState, useRef, useEffect } from 'react';
import './StatusTrafficLight.css';

interface StatusTrafficLightProps {
  status: 'confirmed' | 'pending' | 'attended' | 'no_show' | 'cancelled_business' | 'rescheduled' | 'cancelled_client' | 'waitlist';
  onChange: (newStatus: string) => void;
  disabled?: boolean;
}

const statusColors = {
  confirmed: { color: '#16a34a', icon: '●', label: 'Confirmada' },
  pending: { color: '#f59e0b', icon: '●', label: 'Pendiente' },
  attended: { color: '#0EC6B8', icon: '✓', label: 'Asistida' },
  no_show: { color: '#EA0F63', icon: '✕', label: 'No asistió' },
  cancelled_business: { color: '#8A8D95', icon: '⊗', label: 'Cancelada (empresa)' },
  rescheduled: { color: '#3b82f6', icon: '↻', label: 'Reagendada' },
  cancelled_client: { color: '#6b7280', icon: '⊗', label: 'Cancelada (cliente)' },
  waitlist: { color: '#a78bfa', icon: '⏳', label: 'Lista de espera' },
};

export function StatusTrafficLight({ status, onChange, disabled }: StatusTrafficLightProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const current = statusColors[status];

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
        aria-label={`Estado: ${current.label}`}
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
          {Object.entries(statusColors).map(([key, val]) => (
            <button
              key={key}
              className={`status-option ${status === key ? 'active' : ''}`}
              style={{ borderLeftColor: val.color }}
              onClick={() => {
                onChange(key);
                setOpen(false);
              }}
              role="option"
              aria-selected={status === key}
            >
              <span className="dot" style={{ backgroundColor: val.color }}>
                {val.icon}
              </span>
              <span className="option-label">{val.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
