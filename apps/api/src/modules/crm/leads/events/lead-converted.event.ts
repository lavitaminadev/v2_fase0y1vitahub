export class LeadConvertedEvent {
  constructor(public readonly payload: { leadId: string; clientId: string }) {}
}
