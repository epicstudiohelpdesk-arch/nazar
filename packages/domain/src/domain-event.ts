/**
 * Base Domain Event
 * Used for event-driven decoupled side-effects and outbox pattern.
 */
export interface DomainEvent<TPayload = unknown> {
  readonly eventId: string;
  readonly eventType: string;
  readonly aggregateId: string;
  readonly occurredOn: Date;
  readonly payload: TPayload;
}
