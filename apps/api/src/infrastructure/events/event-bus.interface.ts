import type { DomainEvent } from '@platform/domain';

export type EventHandler<TEvent extends DomainEvent = DomainEvent> = (
  event: TEvent
) => Promise<void>;

export interface IEventBus {
  publish<TEvent extends DomainEvent>(event: TEvent): Promise<void>;
  publishAll(events: readonly DomainEvent[]): Promise<void>;
  subscribe<TEvent extends DomainEvent>(eventType: string, handler: EventHandler<TEvent>): void;
}

export const EVENT_BUS_TOKEN = Symbol('IEventBus');
