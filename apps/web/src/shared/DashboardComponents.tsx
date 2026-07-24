import { ReactNode, useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { CSSProperties } from 'react';

// ─── COLOR PALETTE (based on dataviz professional ramp) ───
export const PALETTE = {
  categorical: ['#2563eb', '#dc2626', '#16a34a', '#f59e0b', '#8b5cf6', '#06b6d4'],
  sequential: ['#f0f9ff', '#e0f2fe', '#bae6fd', '#7dd3fc', '#38bdf8', '#0ea5e9', '#0284c7', '#0369a1'],
  diverging: { cool: '#0284c7', neutral: '#e5e7eb', warm: '#dc2626' },
  status: { good: '#16a34a', warning: '#f59e0b', serious: '#dc2626', critical: '#7c2d12' },
  text: { primary: '#1f2937', secondary: '#6b7280', muted: '#9ca3af' },
  surface: { light: '#ffffff', lighter: '#f9fafb', dark: '#111827', darker: '#030712' },
};

// ─── STAT TILE ───
export function StatTile({ label, value, trend, icon, color = 'blue' }: {
  label: string; value: string | number; trend?: { pct: number; direction: 'up' | 'down' }; icon?: ReactNode; color?: keyof typeof PALETTE.status | 'blue' | 'indigo';
}) {
  const colorMap = { blue: '#2563eb', indigo: '#4f46e5', ...PALETTE.status };
  const bgColor = colorMap[color as keyof typeof colorMap] || '#2563eb';

  return (
    <div style={{ background: PALETTE.surface.lighter, padding: '20px', borderRadius: '12px', borderLeft: `4px solid ${bgColor}`, flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <span style={{ fontSize: '14px', color: PALETTE.text.muted, fontWeight: 500 }}>{label}</span>
        {icon && <div style={{ fontSize: '20px' }}>{icon}</div>}
      </div>
      <div style={{ fontSize: '32px', fontWeight: 700, color: PALETTE.text.primary, marginBottom: '8px' }}>{value}</div>
      {trend && (
        <div style={{ fontSize: '13px', color: trend.direction === 'up' ? PALETTE.status.good : PALETTE.status.serious, fontWeight: 500 }}>
          {trend.direction === 'up' ? '↑' : '↓'} {Math.abs(trend.pct)}% vs mes anterior
        </div>
      )}
    </div>
  );
}

// ─── CARD ───
export function DashCard({ title, children, footer }: { title?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div style={{ background: PALETTE.surface.light, borderRadius: '12px', border: `1px solid #e5e7eb`, padding: '24px' }}>
      {title && <h3 style={{ margin: '0 0 16px 0', fontSize: '18px', fontWeight: 600, color: PALETTE.text.primary }}>{title}</h3>}
      <div>{children}</div>
      {footer && <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: `1px solid #f3f4f6`, fontSize: '13px', color: PALETTE.text.secondary }}>{footer}</div>}
    </div>
  );
}

// ─── LINE CHART (Conversions over time) ───
export function ConversionChart({ data }: { data: Array<{ date: string; reservas: number; asistidas: number; conversion: number }> }) {
  return (
    <DashCard title="Conversiones en el tiempo">
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
          <defs>
            <linearGradient id="gradReservas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={PALETTE.categorical[0]} stopOpacity={0.3} />
              <stop offset="95%" stopColor={PALETTE.categorical[0]} stopOpacity={0} />
            </linearGradient>
            <linearGradient id="gradAsistidas" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={PALETTE.status.good} stopOpacity={0.3} />
              <stop offset="95%" stopColor={PALETTE.status.good} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="date" stroke={PALETTE.text.muted} style={{ fontSize: '12px' }} />
          <YAxis stroke={PALETTE.text.muted} style={{ fontSize: '12px' }} />
          <Tooltip contentStyle={{ background: PALETTE.surface.light, border: `1px solid #e5e7eb`, borderRadius: '8px' }} />
          <Legend />
          <Area type="monotone" dataKey="reservas" stackId="1" stroke={PALETTE.categorical[0]} fill="url(#gradReservas)" name="Reservas" />
          <Area type="monotone" dataKey="asistidas" stackId="2" stroke={PALETTE.status.good} fill="url(#gradAsistidas)" name="Asistidas" />
        </AreaChart>
      </ResponsiveContainer>
    </DashCard>
  );
}

// ─── BAR CHART (By campaign) ───
export function CampaignChart({ data }: { data: Array<{ campaign: string; total: number; attended: number }> }) {
  return (
    <DashCard title="Rendimiento por campaña">
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="campaign" stroke={PALETTE.text.muted} style={{ fontSize: '12px' }} angle={-45} textAnchor="end" height={80} />
          <YAxis stroke={PALETTE.text.muted} style={{ fontSize: '12px' }} />
          <Tooltip contentStyle={{ background: PALETTE.surface.light, border: `1px solid #e5e7eb`, borderRadius: '8px' }} />
          <Legend />
          <Bar dataKey="total" fill={PALETTE.categorical[0]} name="Reservas" radius={[8, 8, 0, 0]} />
          <Bar dataKey="attended" fill={PALETTE.status.good} name="Asistencias" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </DashCard>
  );
}

// ─── PIE CHART (Funnel: Views → Reservas → Asistencia) ───
export function FunnelChart({ data }: { data: Array<{ stage: string; count: number; pct: number }> }) {
  const colors = [PALETTE.categorical[0], PALETTE.categorical[1], PALETTE.status.good];

  return (
    <DashCard title="Funnel: Views → Reservas → Asistencia">
      <div style={{ display: 'flex', gap: '40px', alignItems: 'center', justifyContent: 'center' }}>
        <ResponsiveContainer width={200} height={200}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} dataKey="count">
              {data.map((_, idx) => <Cell key={`cell-${idx}`} fill={colors[idx % colors.length]} />)}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {data.map((item, idx) => (
            <div key={item.stage} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '2px', background: colors[idx % colors.length] }} />
              <span style={{ fontSize: '13px', color: PALETTE.text.primary }}>{item.stage}</span>
              <span style={{ fontSize: '13px', fontWeight: 600, color: PALETTE.text.muted }}>{item.count} ({item.pct}%)</span>
            </div>
          ))}
        </div>
      </div>
    </DashCard>
  );
}

// ─── DATA TABLE (Elegant) ───
export function DataTable({ columns, data, footer }: {
  columns: Array<{ key: string; label: string; render?: (value: any) => ReactNode }>;
  data: Array<Record<string, any>>;
  footer?: ReactNode;
}) {
  return (
    <DashCard title="Reservas recientes" footer={footer}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ borderBottom: `2px solid #e5e7eb` }}>
              {columns.map(col => (
                <th key={col.key} style={{ textAlign: 'left', padding: '12px 0', fontWeight: 600, color: PALETTE.text.muted }}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, idx) => (
              <tr key={idx} style={{ borderBottom: `1px solid #f3f4f6`, background: idx % 2 ? PALETTE.surface.lighter : 'transparent' }}>
                {columns.map(col => (
                  <td key={col.key} style={{ padding: '12px 0', color: PALETTE.text.primary }}>
                    {col.render ? col.render(row[col.key]) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashCard>
  );
}

// ─── METRIC ROW (Multiple stats) ───
export function MetricRow({ items }: { items: Array<{ label: string; value: string | number; color?: 'blue' | 'green' | 'amber' | 'red' }> }) {
  const colors = { blue: '#2563eb', green: '#16a34a', amber: '#f59e0b', red: '#dc2626' };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(200px, 1fr))`, gap: '16px', marginBottom: '24px' }}>
      {items.map(item => (
        <StatTile key={item.label} label={item.label} value={item.value} color={item.color as any} />
      ))}
    </div>
  );
}

// ─── STATUS BADGE ───
export function StatusBadge({ status, label }: { status: 'good' | 'warning' | 'serious' | 'critical'; label: string }) {
  const bg = { good: '#d1fae5', warning: '#fef3c7', serious: '#fee2e2', critical: '#fed7aa' };
  const color = { good: '#065f46', warning: '#78350f', serious: '#7f1d1d', critical: '#7c2d12' };
  const icons = { good: '✓', warning: '⚠', serious: '✕', critical: '!' };

  return (
    <span style={{ background: bg[status], color: color[status], padding: '4px 8px', borderRadius: '4px', fontSize: '12px', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
      {icons[status]} {label}
    </span>
  );
}
