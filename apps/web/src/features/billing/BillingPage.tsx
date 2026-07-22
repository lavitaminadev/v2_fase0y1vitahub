import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../core/api';
import { DataTable } from '../../shared/DataTable';
import { LoadingSpinner } from '../../shared/LoadingSpinner';
import { StatusBadge } from '../../shared/StatusBadge';

interface Invoice {
  id: string;
  number: string;
  clientId: string;
  total: number;
  status: string;
  issuedAt: string;
}

interface ChargeNote {
  id: string;
  reason: string;
  status: string;
  amount?: number;
}

export function BillingPage() {
  const queryClient = useQueryClient();
  const [prices, setPrices] = useState<Record<string, string>>({});
  const { data, isLoading, error } = useQuery<Invoice[]>({ queryKey: ['invoices'], queryFn: () => api.get('/billing/invoices') });
  const { data: chargeData } = useQuery<ChargeNote[]>({ queryKey: ['charge-notes'], queryFn: () => api.get('/billing/invoices/charge-notes') });
  const priceMutation = useMutation({
    mutationFn: ({ id, amount }: { id: string; amount: number }) => api.put(`/billing/invoices/charge-notes/${id}/price`, { amount }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['charge-notes'] }),
  });
  if (isLoading) return <LoadingSpinner />;
  if (error) return <div className="alert alert-error">Error al cargar facturas</div>;
  const invoices = Array.isArray(data) ? data : [];
  const chargeNotes = Array.isArray(chargeData) ? chargeData : [];
  return (
    <div className="page">
      <h1>Facturación</h1>
      <DataTable
        keyExtractor={(r) => r.id as string}
        columns={[
          { key: 'number', label: 'N° Factura', sortable: true },
          { key: 'clientId', label: 'Cliente' },
          { key: 'total', label: 'Monto', render: (r) => `$${Number(r.total).toLocaleString('es-CL')}` },
          { key: 'status', label: 'Estado', render: (r) => <StatusBadge status={r.status as string} /> },
          { key: 'issuedAt', label: 'Emisión', render: (r) => new Date(r.issuedAt as string).toLocaleDateString() },
        ]}
        data={invoices}
      />
      <div className="section">
        <h2>Extras por valorizar</h2>
        <p className="page-subtitle">La cuarta correccion y las siguientes quedan detenidas aqui antes de emitir una factura.</p>
        {chargeNotes.length === 0 ? <div className="alert alert-info">No hay cobros adicionales pendientes.</div> : (
          <div className="table-wrapper"><table className="data-table"><thead><tr><th>Motivo</th><th>Estado</th><th>Monto CLP</th><th>Accion</th></tr></thead><tbody>
            {chargeNotes.map((note) => <tr key={note.id}>
              <td>{note.reason}</td><td><StatusBadge status={note.status} /></td>
              <td>{note.amount ? `$${Number(note.amount).toLocaleString('es-CL')}` : <input className="input input-compact" type="number" min="1" value={prices[note.id] ?? ''} onChange={(event) => setPrices({ ...prices, [note.id]: event.target.value })} />}</td>
              <td>{note.status === 'pending_pricing' ? <button className="btn btn-primary btn-sm" disabled={!Number(prices[note.id]) || priceMutation.isPending} onClick={() => priceMutation.mutate({ id: note.id, amount: Number(prices[note.id]) })}>Confirmar valor</button> : 'Lista para facturar'}</td>
            </tr>)}
          </tbody></table></div>
        )}
        {priceMutation.error && <div className="alert alert-error">{priceMutation.error.message}</div>}
      </div>
    </div>
  );
}
