import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { ToastContainer, triggerToast } from './Toast';

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
    expect(toast!.textContent).toBe('Test message');
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
});
