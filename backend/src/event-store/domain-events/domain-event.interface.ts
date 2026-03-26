export interface DomainEvent {
  eventType: string;
  aggregateId: string;
  aggregateType: string;
  payload: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  occurredAt?: Date;
}
