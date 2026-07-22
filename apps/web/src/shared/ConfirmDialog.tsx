import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  pending?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  pending = false,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={() => !pending && onClose()} title={title}>
      <div className="confirm-dialog">
        <span className="confirm-dialog-mark" aria-hidden="true">!</span>
        <p>{description}</p>
        <div className="modal-actions">
          <button className="btn btn-outline" type="button" onClick={onClose} disabled={pending}>Cancelar</button>
          <button className="btn btn-danger" type="button" onClick={onConfirm} disabled={pending}>
            {pending ? 'Procesando...' : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
