interface CrmScopeBannerProps {
  mode: 'operations' | 'commercial';
  title: string;
  description: string;
  clientName?: string;
  globalLabel?: string;
}

export function CrmScopeBanner({
  mode,
  title,
  description,
  clientName,
  globalLabel,
}: CrmScopeBannerProps) {
  const contextLabel = clientName ? `Cliente activo: ${clientName}` : (globalLabel ?? 'Vista global');
  const audience = mode === 'operations'
    ? 'Operacion de reservas y contactos por cliente'
    : 'Comercial de La Vitamina';

  return (
    <section className={`crm-scope-banner is-${mode}`}>
      <div>
        <span className="page-eyebrow">{audience}</span>
        <h1>{title}</h1>
        <p className="page-subtitle">{description}</p>
      </div>
      <div className="crm-scope-banner-meta">
        <span className="crm-scope-pill">{contextLabel}</span>
        <small>
          {mode === 'operations'
            ? 'Nunca mezclar contactos de distintos clientes sin filtro visible.'
            : 'Este flujo corresponde a La Vitamina -> prospecto o cliente de agencia.'}
        </small>
      </div>
    </section>
  );
}
