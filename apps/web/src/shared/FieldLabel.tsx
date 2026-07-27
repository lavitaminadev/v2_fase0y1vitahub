import { useState } from 'react';
import './FieldLabel.css';

interface FieldLabelProps {
  label: string;
  required?: boolean;
  fundamental?: boolean; // name, email - cannot be renamed
  editable?: boolean;
  onEdit?: (newLabel: string) => void;
  htmlFor?: string;
}

export function FieldLabel({
  label,
  required,
  fundamental,
  editable,
  onEdit,
  htmlFor,
}: FieldLabelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [newLabel, setNewLabel] = useState(label);

  const handleSave = () => {
    if (newLabel.trim()) {
      if (newLabel !== label) {
        onEdit?.(newLabel.trim());
      }
      setIsEditing(false);
    } else {
      setNewLabel(label);
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      setNewLabel(label);
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <div className="field-label field-label--editing">
        <input
          type="text"
          autoFocus
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="field-label-input"
          maxLength={80}
        />
      </div>
    );
  }

  return (
    <label htmlFor={htmlFor} className="field-label">
      <span className="field-label-content">
        {fundamental && <span className="field-label-lock" title="Campo fundamental">🔒</span>}
        <span className="field-label-text">{label}</span>
        {required && <span className="field-label-required" aria-label="requerido">*</span>}
      </span>
      {editable && (
        <button
          type="button"
          className="field-label-edit-btn"
          onClick={() => setIsEditing(true)}
          title="Editar nombre del campo"
          aria-label={`Editar "${label}"`}
        >
          ✏️
        </button>
      )}
    </label>
  );
}
