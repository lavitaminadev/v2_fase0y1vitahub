import { Injectable } from '@nestjs/common';

interface MetricsState {
  requestCount: number;
  errorCount: number;
  totalResponseTime: number;
  responseTimeCount: number;
  averageResponseTime: number;
  activeUsers: Set<string>;
  startTime: number;
}

@Injectable()
export class MetricsService {
  private state: MetricsState = {
    requestCount: 0,
    errorCount: 0,
    totalResponseTime: 0,
    responseTimeCount: 0,
    averageResponseTime: 0,
    activeUsers: new Set<string>(),
    startTime: Date.now(),
  };

  incrementRequestCount(): void {
    this.state.requestCount++;
  }

  incrementErrorCount(): void {
    this.state.errorCount++;
  }

  trackResponseTime(ms: number): void {
    this.state.totalResponseTime += ms;
    this.state.responseTimeCount++;
    this.state.averageResponseTime = Math.round(
      this.state.totalResponseTime / this.state.responseTimeCount,
    );
  }

  trackActiveUser(userId: string): void {
    this.state.activeUsers.add(userId);
  }

  getMetrics() {
    return {
      requestCount: this.state.requestCount,
      errorCount: this.state.errorCount,
      errorRate:
        this.state.requestCount > 0
          ? Number(
              (
                (this.state.errorCount / this.state.requestCount) *
                100
              ).toFixed(2),
            )
          : 0,
      averageResponseTimeMs: this.state.averageResponseTime,
      activeUsers: this.state.activeUsers.size,
      uptimeSeconds: Math.floor(
        (Date.now() - this.state.startTime) / 1000,
      ),
      timestamp: new Date().toISOString(),
    };
  }

  reset(): void {
    this.state = {
      requestCount: 0,
      errorCount: 0,
      totalResponseTime: 0,
      responseTimeCount: 0,
      averageResponseTime: 0,
      activeUsers: new Set<string>(),
      startTime: Date.now(),
    };
  }
}
