import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import { ToastContainer, triggerToast } from './Toast';
import { API_ERROR_EVENT, type ApiErrorEventDetail } from '../core/api';

describe('ToastContainer', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => { vi.useRealTimers(); });

  it('renders nothing initially', () => {
    const { container } = render(<ToastContainer />);
    expect(container.querySelector('.toast')).toBeNull();
  });

  it('shows a toast when triggered', () => {
    const { container } = render(<ToastContainer />);
    act(() => { triggerToast('Test message'); });
    const toast = container.querySelector('.toast');
    expect(toast).toBeTruthy();
    expect(container.querySelector('.toast-message')!.textContent).toBe('Test message');
    expect(toast!.className).toContain('toast-success');
  });

  it('shows error toast with correct kind', () => {
    const { container } = render(<ToastContainer />);
    act(() => { triggerToast('Error!', 'error'); });
    const toast = container.querySelector('.toast');
    expect(toast!.className).toContain('toast-error');
  });

  it('auto-dismisses after 4 seconds for success', () => {
    const { container } = render(<ToastContainer />);
    act(() => { triggerToast('Will disappear'); });
    expect(container.querySelector('.toast')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(4000); });
    expect(container.querySelector('.toast')).toBeNull();
  });

  it('auto-dismisses after 7 seconds for error', () => {
    const { container } = render(<ToastContainer />);
    act(() => { triggerToast('Error!', 'error'); });
    act(() => { vi.advanceTimersByTime(4000); });
    expect(container.querySelector('.toast')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(3000); });
    expect(container.querySelector('.toast')).toBeNull();
  });

  it('handles multiple toasts', () => {
    const { container } = render(<ToastContainer />);
    act(() => { triggerToast('First'); triggerToast('Second'); });
    const toasts = container.querySelectorAll('.toast');
    expect(toasts.length).toBe(2);
  });

  it('dismisses a toast when its close button is clicked', () => {
    const { container } = render(<ToastContainer />);
    act(() => { triggerToast('Dismiss me'); });
    expect(container.querySelector('.toast')).toBeTruthy();
    fireEvent.click(container.querySelector('.toast-close')!);
    expect(container.querySelector('.toast')).toBeNull();
  });

  it('renders API connection errors with a retry action and 10s duration', () => {
    const { container } = render(<ToastContainer />);
    const detail: ApiErrorEventDetail = { title: 'Sin conexión con el sistema', message: 'Revisa tu red', kind: 'connection' };
    act(() => { window.dispatchEvent(new CustomEvent<ApiErrorEventDetail>(API_ERROR_EVENT, { detail })); });

    const toast = container.querySelector('.toast');
    expect(toast!.className).toContain('toast-connection');
    expect(container.querySelector('.toast-title')!.textContent).toBe('Sin conexión con el sistema');
    expect(container.querySelector('.toast-action')).toBeTruthy();

    act(() => { vi.advanceTimersByTime(9999); });
    expect(container.querySelector('.toast')).toBeTruthy();
    act(() => { vi.advanceTimersByTime(1); });
    expect(container.querySelector('.toast')).toBeNull();
  });
});
