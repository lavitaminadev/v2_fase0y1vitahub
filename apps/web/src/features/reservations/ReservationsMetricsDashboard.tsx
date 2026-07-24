import { useMemo } from 'react';
import { ConversionChart, CampaignChart, FunnelChart, MetricRow, DataTable, DashCard, PALETTE } from '../../shared/DashboardComponents';

interface Metrics {
  totals: { total: string; pending: string; confirmed: string; attended: string; no_show: string; waitlist: string; cancelled: string };
  funnel: { views: number; starts: number; completed: number; conversionRate: number | null };
  daily: Array<{ day: string; hour: number; total: string }>;
  sources: Array<{ source: string; campaign: string; total: string; attended: string }>;
}

interface Reservation {
  id: string; referenceCode: string; guestName: string; guestPhone?: string; guestEmail?: string;
  startsAt: string; status: string;
}

export function ReservationsMetricsDashboard({
  metrics, bookingPage, metricsDays, onMetricsDaysChange,
}: { metrics: Metrics | undefined; bookingPage?: { items: Reservation[] }; metricsDays: number; onMetricsDaysChange: (days: number) => void }) {
  // ─── METRICS COMPUTED ───
  const total = Number(metrics?.totals.total || 0);
  const attended = Number(metrics?.totals.attended || 0);
  const noShow = Number(metrics?.totals.no_show || 0);
  const cancelled = Number(metrics?.totals.cancelled || 0);
  const pending = Number(metrics?.totals.pending || 0);
  const confirmed = Number(metrics?.totals.confirmed || 0);
  const waitlist = Number(metrics?.totals.waitlist || 0);

  const attendanceRate = total > 0 ? Math.round((attended / total) * 100) : 0;
  const cancellationRate = total > 0 ? Math.round((cancelled / total) * 100) : 0;
  const confirmationRate = total > 0 ? Math.round((confirmed / (total - pending)) * 100) : 0;

  // ─── FUNNEL DATA ───
  const funnelData = useMemo(() => {
    const views = metrics?.funnel.views || 0;
    const starts = metrics?.funnel.starts || 0;
    const completed = metrics?.funnel.completed || 0;
    const totalSteps = views + starts + completed;

    return [
      { stage: 'Visitas', count: views, pct: totalSteps > 0 ? Math.round((views / totalSteps) * 100) : 0 },
      { stage: 'Inicios', count: starts, pct: totalSteps > 0 ? Math.round((starts / totalSteps) * 100) : 0 },
      { stage: 'Reservas', count: completed, pct: totalSteps > 0 ? Math.round((completed / totalSteps) * 100) : 0 },
    ];
  }, [metrics?.funnel]);

  // ─── TIME SERIES DATA (for charts) ───
  const timeSeriesData = useMemo(() => {
    const byDate: Record<string, { date: string; reservas: number; asistidas: number; conversion: number }> = {};

    (metrics?.daily || []).forEach((entry) => {
      if (!byDate[entry.day]) {
        byDate[entry.day] = { date: entry.day, reservas: 0, asistidas: 0, conversion: 0 };
      }
      byDate[entry.day].reservas += Number(entry.total);
    });

    (metrics?.sources || []).forEach((source) => {
      Object.keys(byDate).forEach((day) => {
        if (byDate[day].reservas > 0) {
          byDate[day].asistidas += Number(source.attended);
          byDate[day].conversion = Math.round((byDate[day].asistidas / byDate[day].reservas) * 100);
        }
      });
    });

    return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
  }, [metrics]);

  // ─── CAMPAIGN DATA (for charts) ───
  const campaignData = useMemo(() => {
    return (metrics?.sources || []).map((source) => ({
      campaign: source.campaign.substring(0, 20), total: Number(source.total), attended: Number(source.attended),
    }));
  }, [metrics]);

  // ─── RECENT BOOKINGS FOR TABLE ───
  const recentBookings = useMemo(() => {
    return (bookingPage?.items || []).slice(0, 10).map((r) => ({
      guest: r.guestName, contact: r.guestPhone || r.guestEmail || '—',
      date: new Date(r.startsAt).toLocaleDateString('es-CL'), status: r.status, code: r.referenceCode,
    }));
  }, [bookingPage]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* HEADER + FILTER */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <span style={{ fontSize: '12px', fontWeight: 600, color: PALETTE.text.muted, textTransform: 'uppercase' }}>ANALYTICS</span>
            <h2 style={{ margin: '4px 0 0 0', fontSize: '28px', fontWeight: 700, color: PALETTE.text.primary }}>Embudo, demanda y asistencia</h2>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            {[7, 14, 30, 60, 90, 180, 365].map((d) => (
              <button
                key={d}
                onClick={() => onMetricsDaysChange(d)}
                style={{
                  padding: '6px 12px', borderRadius: '6px', border: 'none', fontSize: '12px', fontWeight: 500,
                  background: metricsDays === d ? PALETTE.categorical[0] : PALETTE.surface.lighter, color: metricsDays === d ? 'white' : PALETTE.text.primary, cursor: 'pointer',
                }}
              >
                {d}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* MAIN METRICS */}
      <MetricRow
        items={[
          { label: 'Total de reservas', value: total, color: 'blue' },
          { label: 'Tasa de asistencia', value: `${attendanceRate}%`, color: 'green' },
          { label: 'Tasa de cancelación', value: `${cancellationRate}%`, color: 'red' },
          { label: 'Tasa de confirmación', value: `${confirmationRate}%`, color: 'amber' },
          { label: 'Pendientes', value: pending, color: 'blue' },
          { label: 'Lista de espera', value: waitlist, color: 'amber' },
        ]}
      />

      {/* FUNNEL */}
      <FunnelChart data={funnelData} />

      {/* TIME SERIES + CAMPAIGNS */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
        {timeSeriesData.length > 0 && <ConversionChart data={timeSeriesData} />}
        {campaignData.length > 0 && <CampaignChart data={campaignData} />}
      </div>

      {/* RECENT BOOKINGS TABLE */}
      {recentBookings.length > 0 && (
        <DataTable
          columns={[
            { key: 'guest', label: 'Visitante' },
            { key: 'contact', label: 'Contacto' },
            { key: 'date', label: 'Fecha' },
            { key: 'status', label: 'Estado', render: (v) => <span style={{ fontSize: '12px', fontWeight: 500, color: v === 'attended' ? PALETTE.status.good : v === 'no_show' ? PALETTE.status.serious : PALETTE.text.muted }}>{v}</span> },
            { key: 'code', label: 'Código', render: (v) => <code style={{ fontSize: '12px', color: PALETTE.text.muted }}>#{v}</code> },
          ]}
          data={recentBookings}
          footer={`Mostrando últimas 10 de ${total} reservas`}
        />
      )}

      {/* HEAT MAP */}
      {metrics && (
        <DashCard title="Mapa de ocupación - Últimos 30 días">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
            {Array.from({ length: 30 }, (_, i) => {
              const date = new Date();
              date.setDate(date.getDate() - (30 - 1) + i);
              const key = date.toISOString().slice(0, 10);
              const count = (metrics.daily || []).filter((d) => d.day === key).reduce((sum, d) => sum + Number(d.total), 0);
              const maxCount = Math.max(...(metrics.daily || []).map((d) => Number(d.total)), 1);
              const intensity = Math.min(count / maxCount, 1);

              return (
                <div
                  key={key}
                  title={`${date.toLocaleDateString('es-CL')}: ${count} reserva(s)`}
                  style={{
                    padding: '8px', borderRadius: '6px', textAlign: 'center', fontSize: '11px',
                    background: `rgba(37, 99, 235, ${intensity * 0.8 + 0.1})`, color: intensity > 0.5 ? 'white' : PALETTE.text.primary,
                  }}
                >
                  <div style={{ fontWeight: 600 }}>{date.getDate()}</div>
                  <div style={{ fontSize: '10px' }}>{count}</div>
                </div>
              );
            })}
          </div>
        </DashCard>
      )}
    </div>
  );
}
