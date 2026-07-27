export class NamingValidationResult {
  constructor(
    public readonly fileName: string,
    public readonly isValid: boolean,
    public readonly errors: string[] = [],
  ) {}
}
