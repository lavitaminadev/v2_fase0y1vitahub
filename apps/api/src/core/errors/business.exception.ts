import { HttpException } from '@nestjs/common';

export class BusinessException extends HttpException {
  constructor(message: string, code: string, statusCode: number = 400) {
    super({ message, code, statusCode }, statusCode);
  }
}

export class UdBudgetExceededException extends BusinessException {
  constructor(message = 'UD budget exceeded for this client') {
    super(message, 'UD_BUDGET_EXCEEDED', 400);
  }
}

export class MaxCorrectionsExceededException extends BusinessException {
  constructor(message = 'Maximum corrections (3) exceeded') {
    super(message, 'MAX_CORRECTIONS_EXCEEDED', 400);
  }
}

export class NamingInvalidException extends BusinessException {
  constructor(message = 'File naming convention is invalid') {
    super(message, 'NAMING_INVALID', 400);
  }
}

export class LeadAlreadyConvertedException extends BusinessException {
  constructor(message = 'Lead has already been converted') {
    super(message, 'LEAD_ALREADY_CONVERTED', 409);
  }
}

export class OrganizationQuotaExceededException extends BusinessException {
  constructor(message = 'Organization quota exceeded') {
    super(message, 'ORGANIZATION_QUOTA_EXCEEDED', 403);
  }
}
