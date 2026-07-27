import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import './FormBuilderDnD.css';
import { VitaIcons } from '../../shared/Icons';

interface Field {
  id: string;
  type: string;
  label: string;
  required?: boolean;
  system?: boolean;
  placeholder?: string;
}

interface SortableFieldProps {
  field: Field;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

function SortableField({ field, isSelected, onSelect, onEdit, onDelete }: SortableFieldProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: field.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`sortable-field ${isSelected ? 'selected' : ''}`}
      onClick={() => onSelect(field.id)}
      role="article"
      tabIndex={0}
    >
      <div className="drag-handle" {...attributes} {...listeners} title="Arrastrar para ordenar">
        <VitaIcons.menu />
      </div>
      <div className="field-info">
        <strong>{field.label}</strong>
        <span className="field-type">{field.type}</span>
        {field.required && <span className="required-badge">Requerido</span>}
        {field.system && <span className="system-badge">Protegido</span>}
      </div>
      <div className="field-actions">
        <button className="btn-icon" onClick={() => onEdit(field.id)} title="Editar">
          <VitaIcons.edit />
        </button>
        <button className="btn-icon danger" onClick={() => onDelete(field.id)} title="Eliminar">
          <VitaIcons.delete />
        </button>
      </div>
    </div>
  );
}

interface FormBuilderDnDProps {
  fields: Field[];
  selectedFieldId?: string | null;
  onReorder: (fields: Field[]) => void;
  onSelectField: (id: string) => void;
  onEditField: (id: string) => void;
  onDeleteField: (id: string) => void;
  onAddField: () => void;
}

export function FormBuilderDnD({
  fields,
  selectedFieldId,
  onReorder,
  onSelectField,
  onEditField,
  onDeleteField,
  onAddField
}: FormBuilderDnDProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor),
  );

  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = fields.findIndex(f => f.id === active.id);
    const newIndex = fields.findIndex(f => f.id === over.id);

    if (oldIndex === -1 || newIndex === -1) return;

    const newFields = Array.from(fields);
    newFields.splice(oldIndex, 1);
    newFields.splice(newIndex, 0, fields[oldIndex]);

    onReorder(newFields);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
        <div className="form-builder-dnd">
          {fields.length === 0 ? (
            <div className="empty-state">
              <p>Sin campos aún. ¡Comienza agregando uno!</p>
            </div>
          ) : (
            <div className="fields-list">
              {fields.map(field => (
                <SortableField
                  key={field.id}
                  field={field}
                  isSelected={selectedFieldId === field.id}
                  onSelect={onSelectField}
                  onEdit={onEditField}
                  onDelete={onDeleteField}
                />
              ))}
            </div>
          )}
          <button className="btn btn-primary" onClick={onAddField}>
            <VitaIcons.add /> Agregar campo
          </button>
        </div>
      </SortableContext>
    </DndContext>
  );
}
