import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  pending?: boolean;
  /** Shown as an inline error banner, e.g. after a failed confirm attempt. */
  error?: string;
  onClose: () => void;
  onConfirm: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirmar',
  pending = false,
  error,
  onClose,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={() => !pending && onClose()} title={title}>
      <div className="confirm-dialog">
        <span className="confirm-dialog-mark" aria-hidden="true">!</span>
        <p>{description}</p>
        {error && <div className="alert alert-error">{error}</div>}
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
