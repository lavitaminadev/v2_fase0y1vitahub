import { useDeferredValue, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../core/api';
import { DataTable } from '../../shared/DataTable';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { Modal } from '../../shared/Modal';
import { matchesSearch } from '../../shared/search';

interface KnowledgeChunk {
  [key: string]: unknown;
  id: string;
  sourceName: string;
  chunkIndex: number;
  tokenCount: number;
  content: string;
  createdAt: number;
}

export function KnowledgePage() {
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const [source, setSource] = useState('');
  const [selected, setSelected] = useState<KnowledgeChunk | null>(null);
  const knowledgeQuery = useQuery<KnowledgeChunk[]>({ queryKey: ['knowledge'], queryFn: () => api.get('/knowledge') });
  if (knowledgeQuery.isLoading) return <LoadingSpinner text="Organizando conocimiento interno..." />;
  if (knowledgeQuery.error) return <div className="page"><div className="page-load-error"><span>!</span><h1>No pudimos abrir la base interna</h1><p>{knowledgeQuery.error.message}</p><button className="btn btn-primary" onClick={() => knowledgeQuery.refetch()}>Reintentar</button></div></div>;

  const chunks = Array.isArray(knowledgeQuery.data) ? knowledgeQuery.data : [];
  const sources = [...new Set(chunks.map((chunk) => chunk.sourceName))].sort();
  const totalTokens = chunks.reduce((sum, chunk) => sum + Number(chunk.tokenCount || 0), 0);
  const filtered = chunks.filter((chunk) => (!source || chunk.sourceName === source) && matchesSearch(deferredSearch, [chunk.sourceName, chunk.content]));

  return <div className="page knowledge-page">
    <section className="knowledge-hero"><div><span className="page-eyebrow">MEMORIA OPERATIVA</span><h1>Base de conocimiento</h1><p>Consultá políticas, manuales y documentos internos del equipo.</p></div><div className="knowledge-stats"><span><small>Fuentes</small><strong>{sources.length}</strong></span><span><small>Fragmentos</small><strong>{chunks.length}</strong></span><span><small>Volumen</small><strong>{totalTokens.toLocaleString('es-CL')} <i>tokens</i></strong></span></div></section>
    <div className="knowledge-explainer"><span>i</span><p><strong>¿Qué estás viendo?</strong> Cada documento se divide en fragmentos pequeños para conservar trazabilidad y facilitar búsquedas internas. La fuente original siempre permanece identificada.</p></div>
    <section className="knowledge-panel"><header><div><span className="page-eyebrow">EXPLORADOR</span><h2>Contenido indexado</h2></div><span>{filtered.length} resultados</span></header><div className="filters knowledge-filters"><input className="input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar dentro de fuentes y contenido..." aria-label="Buscar conocimiento" /><select className="input" value={source} onChange={(event) => setSource(event.target.value)} aria-label="Filtrar por fuente"><option value="">Todas las fuentes</option>{sources.map((item) => <option value={item} key={item}>{item}</option>)}</select>{(search || source) && <button className="btn btn-outline" onClick={() => { setSearch(''); setSource(''); }}>Limpiar</button>}</div>
      <DataTable<KnowledgeChunk> keyExtractor={(row) => row.id} emptyMessage={chunks.length ? 'No hay coincidencias con los filtros actuales.' : 'Aún no hay documentos procesados en la memoria operativa.'} columns={[
        { key: 'sourceName', label: 'Fuente', sortable: true, render: (row) => <span className="primary-cell"><strong>{row.sourceName}</strong><small>Fragmento {row.chunkIndex + 1}</small></span> },
        { key: 'content', label: 'Vista previa', render: (row) => <span className="knowledge-preview">{row.content.slice(0, 150)}{row.content.length > 150 ? '...' : ''}</span> },
        { key: 'tokenCount', label: 'Tamaño', sortable: true, render: (row) => `${row.tokenCount} tokens` },
        { key: 'createdAt', label: 'Indexado', render: (row) => new Date(row.createdAt).toLocaleDateString('es-CL') },
        { key: 'actions', label: 'Acciones', render: (row) => <button className="btn btn-sm btn-outline" onClick={() => setSelected(row)}>Leer</button> },
      ]} data={filtered} />
    </section>
    <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={selected?.sourceName || 'Detalle del fragmento'}><div className="knowledge-detail"><div><span>Fragmento {selected ? selected.chunkIndex + 1 : 0}</span><span>{selected?.tokenCount || 0} tokens</span><span>{selected ? new Date(selected.createdAt).toLocaleString('es-CL') : ''}</span></div><p>{selected?.content}</p></div></Modal>
  </div>;
}
