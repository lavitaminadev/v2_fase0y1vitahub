import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';
import { CatalogServicesTab } from './CatalogServicesTab';
import { CatalogPacksTab } from './CatalogPacksTab';
import { CatalogQuotesTab } from './CatalogQuotesTab';
import { PageHero } from '../../shared/PageHero';

type Tab = 'services' | 'packs' | 'quotes';

export function CatalogPage() {
  const [tab, setTab] = useState<Tab>('services');
  const servicesQuery = useQuery<Array<{ category: string; unitPrice?: number }>>({ queryKey: ['catalog-services'], queryFn: () => api.get('/catalog/services') });
  const packsQuery = useQuery<Array<{ status: string }>>({ queryKey: ['catalog-packs'], queryFn: () => api.get('/catalog/packs') });
  const quotesQuery = useQuery<Array<{ status: string }>>({ queryKey: ['catalog-quotes'], queryFn: () => api.get('/catalog/quotes') });
  const services = servicesQuery.data ?? [];
  const packs = packsQuery.data ?? [];
  const quotes = quotesQuery.data ?? [];
  const categories = new Set(services.map((service) => service.category)).size;
  const summaryError = servicesQuery.error || packsQuery.error || quotesQuery.error;

  return (
    <div className="page catalog-page">
      <PageHero
        variant="feature"
        eyebrow="ARQUITECTURA COMERCIAL"
        title="Catálogo de servicios"
        subtitle="Servicios, precios y capacidad UD."
        aside={<div className="page-hero-stats" aria-label="Resumen del catálogo">
          <span><small>Servicios activos</small><strong>{services.length}</strong></span>
          <span><small>Categorías</small><strong>{categories}</strong></span>
          <span><small>Cotizaciones abiertas</small><strong>{quotes.filter((quote) => ['draft', 'sent'].includes(quote.status)).length}</strong></span>
        </div>}
      />
      {summaryError && <div className="alert alert-error">No fue posible cargar por completo el resumen del catálogo. Los totales pueden estar incompletos.</div>}
      <div className="workflow-note"><b>01</b><span><strong>Servicio</strong><small>Unidad vendible y costo base</small></span><i>→</i><b>02</b><span><strong>Pack</strong><small>Combinación comercial</small></span><i>→</i><b>03</b><span><strong>Cotización</strong><small>Propuesta versionada</small></span><i>→</i><b>04</b><span><strong>Contrato</strong><small>Activación automática</small></span></div>
      <div className="tabs catalog-tabs" role="tablist" aria-label="Tipo de catálogo">
        <button role="tab" aria-selected={tab === 'services'} className={`tab ${tab === 'services' ? 'active' : ''}`} onClick={() => setTab('services')}>Servicios <span>{services.length}</span></button>
        <button role="tab" aria-selected={tab === 'packs'} className={`tab ${tab === 'packs' ? 'active' : ''}`} onClick={() => setTab('packs')}>Packs <span>{packs.length}</span></button>
        <button role="tab" aria-selected={tab === 'quotes'} className={`tab ${tab === 'quotes' ? 'active' : ''}`} onClick={() => setTab('quotes')}>Cotizaciones <span>{quotes.length}</span></button>
      </div>
      {tab === 'services' ? <CatalogServicesTab /> : tab === 'packs' ? <CatalogPacksTab /> : <CatalogQuotesTab />}
    </div>
  );
}
