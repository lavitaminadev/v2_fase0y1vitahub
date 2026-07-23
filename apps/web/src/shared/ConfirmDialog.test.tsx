import { describe, expect, it, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { ConfirmDialog } from './ConfirmDialog';

vi.mock('./Modal', () => ({
  Modal: ({ open, title, children, onClose }: { open: boolean; title: string; children: React.ReactNode; onClose: () => void }) =>
    open ? <div data-testid="modal"><h3>{title}</h3><button onClick={onClose}>x</button>{children}</div> : null,
}));

describe('ConfirmDialog', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<ConfirmDialog open={false} title="Test" description="Desc" onClose={() => {}} onConfirm={() => {}} />);
    expect(container.querySelector('[data-testid="modal"]')).toBeNull();
  });

  it('renders title and description when open', () => {
    const { getByText } = render(<ConfirmDialog open title="Delete item" description="Are you sure?" onClose={() => {}} onConfirm={() => {}} />);
    expect(getByText('Delete item')).toBeTruthy();
    expect(getByText('Are you sure?')).toBeTruthy();
  });

  it('shows custom confirm label', () => {
    const { getByText } = render(<ConfirmDialog open title="Test" description="Desc" confirmLabel="Eliminar" onClose={() => {}} onConfirm={() => {}} />);
    expect(getByText('Eliminar')).toBeTruthy();
  });

  it('calls onConfirm when confirm clicked', () => {
    const onConfirm = vi.fn();
    const { getByText } = render(<ConfirmDialog open title="Test" description="Desc" onClose={() => {}} onConfirm={onConfirm} />);
    fireEvent.click(getByText('Confirmar'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onClose when cancel clicked', () => {
    const onClose = vi.fn();
    const { getByText } = render(<ConfirmDialog open title="Test" description="Desc" onClose={onClose} onConfirm={() => {}} />);
    fireEvent.click(getByText('Cancelar'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('disables buttons when pending', () => {
    const { getByText } = render(<ConfirmDialog open title="Test" description="Desc" pending onClose={() => {}} onConfirm={() => {}} />);
    expect((getByText('Procesando...') as HTMLButtonElement).disabled).toBe(true);
    expect((getByText('Cancelar') as HTMLButtonElement).disabled).toBe(true);
  });
});
