export class BudgetAlertDto {
  clientId: string;
  clientName?: string;
  used: number;
  total: number;
  percentage: number;
  status: 'ok' | 'warning' | 'blocked';
}
