import { ConsoleLogger, Injectable } from '@nestjs/common';

@Injectable()
export class LoggerService extends ConsoleLogger {
  private requestId?: string;
  private userId?: string;
  private organizationId?: string;

  setRequestId(requestId: string) {
    this.requestId = requestId;
  }

  setUserId(userId: string) {
    this.userId = userId;
  }

  setOrganizationId(organizationId: string) {
    this.organizationId = organizationId;
  }

  private buildLogEntry(level: string, message: any, context?: string, trace?: string): Record<string, any> {
    const entry: Record<string, any> = {
      level,
      timestamp: new Date().toISOString(),
      context: context || this.context,
      message: typeof message === 'string' ? message : JSON.stringify(message),
    };
    if (this.requestId) entry.requestId = this.requestId;
    if (this.userId) entry.userId = this.userId;
    if (this.organizationId) entry.organizationId = this.organizationId;
    if (trace) entry.trace = trace;
    return entry;
  }

  log(message: any, context?: string) {
    if (process.env.NODE_ENV === 'production') {
      const entry = this.buildLogEntry('info', message, context);
      process.stdout.write(JSON.stringify(entry) + '\n');
    } else {
      super.log(message, context);
    }
  }

  info(message: any, context?: string) {
    this.log(message, context);
  }

  warn(message: any, context?: string) {
    if (process.env.NODE_ENV === 'production') {
      const entry = this.buildLogEntry('warn', message, context);
      process.stdout.write(JSON.stringify(entry) + '\n');
    } else {
      super.warn(message, context);
    }
  }

  error(message: any, trace?: string, context?: string) {
    if (process.env.NODE_ENV === 'production') {
      const entry = this.buildLogEntry('error', message, context, trace);
      process.stderr.write(JSON.stringify(entry) + '\n');
    } else {
      super.error(message, trace, context);
    }
  }

  debug(message: any, context?: string) {
    if (process.env.NODE_ENV !== 'production') {
      super.debug(message, context);
    }
  }
}
