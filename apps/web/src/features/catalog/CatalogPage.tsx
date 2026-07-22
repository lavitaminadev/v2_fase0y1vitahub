import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';
import { CatalogServicesTab } from './CatalogServicesTab';
import { CatalogPacksTab } from './CatalogPacksTab';
import { CatalogQuotesTab } from './CatalogQuotesTab';

type Tab = 'services' | 'packs' | 'quotes';

export function CatalogPage() {
  const [tab, setTab] = useState<Tab>('services');
  const { data: services = [] } = useQuery<Array<{ category: string; unitPrice?: number }>>({ queryKey: ['catalog-services'], queryFn: () => api.get('/catalog/services') });
  const { data: packs = [] } = useQuery<Array<{ status: string }>>({ queryKey: ['catalog-packs'], queryFn: () => api.get('/catalog/packs') });
  const { data: quotes = [] } = useQuery<Array<{ status: string }>>({ queryKey: ['catalog-quotes'], queryFn: () => api.get('/catalog/quotes') });
  const categories = new Set(services.map((service) => service.category)).size;

  return (
    <div className="page catalog-page">
      <section className="module-hero catalog-hero">
        <div>
          <span className="page-eyebrow">ARQUITECTURA COMERCIAL</span>
          <h1>Catálogo de servicios</h1>
          <p>Define qué vende La Vitamina, cuánto vale y cuánta capacidad UD requiere antes de construir propuestas o contratos.</p>
        </div>
        <div className="module-hero-stats" aria-label="Resumen del catálogo">
          <span><small>Servicios activos</small><strong>{services.length}</strong></span>
          <span><small>Categorías</small><strong>{categories}</strong></span>
          <span><small>Cotizaciones abiertas</small><strong>{quotes.filter((quote) => ['draft', 'sent'].includes(quote.status)).length}</strong></span>
        </div>
      </section>
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
