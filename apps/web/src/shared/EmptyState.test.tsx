import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders default values', () => {
    const { getByText } = render(<EmptyState />);
    expect(getByText('Sin datos')).toBeTruthy();
    expect(getByText('No hay información disponible aún.')).toBeTruthy();
  });

  it('renders icon, title, description', () => {
    const { getByText } = render(<EmptyState icon="📡" title="No results" description="Try a different filter." />);
    expect(getByText('📡')).toBeTruthy();
    expect(getByText('No results')).toBeTruthy();
    expect(getByText('Try a different filter.')).toBeTruthy();
  });

  it('renders action element', () => {
    const { getByText } = render(<EmptyState action={<button>Retry</button>} />);
    expect(getByText('Retry')).toBeTruthy();
  });
});
