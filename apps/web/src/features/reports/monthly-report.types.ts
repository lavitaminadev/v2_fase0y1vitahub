export interface MonthlyReport {
  id: string;
  clientId: string;
  clientName?: string;
  year: number;
  month: number;
  title: string;
  status: 'draft' | 'published';
  executiveSummary?: string;
  metrics: Record<string, number>;
  insights?: string[];
  recommendations?: string;
  salesGenerated: number;
  adSpend: number;
  leads: number;
  bookings: number;
  conversions: number;
  publishedAt?: string;
}

export const reportPeriod = (report: Pick<MonthlyReport, 'year' | 'month'>) => new Date(report.year, report.month - 1, 1).toLocaleDateString('es-CL', { month: 'long', year: 'numeric' });
export const reportMoney = (value: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value || 0);
