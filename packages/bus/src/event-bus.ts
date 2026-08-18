import type { DomainEventName, DomainEvents } from "@casacarlos/contracts";

export type EventHandler<K extends DomainEventName> = (payload: DomainEvents[K]) => void | Promise<void>;
export type WildcardHandler = <K extends DomainEventName>(event: K, payload: DomainEvents[K]) => void | Promise<void>;
export type Unsubscribe = () => void;

/**
 * The only channel services use to react to each other. A service publishes
 * facts about its own domain; it never calls another service's handler
 * directly to react to those facts.
 *
 * `InProcessBus` runs handlers synchronously in-process. The interface is
 * deliberately transport-agnostic — swapping in a `NatsBus` when a service
 * is extracted to its own process changes zero call sites (see
 * docs/ARQUITECTURA.md §1 "Ruta de extracción").
 */
export interface EventBus {
  publish<K extends DomainEventName>(event: K, payload: DomainEvents[K]): Promise<void>;
  subscribe<K extends DomainEventName>(event: K, handler: EventHandler<K>): Unsubscribe;
  /** Used by the gateway to relay every domain event to connected WebSocket clients. */
  subscribeAll(handler: WildcardHandler): Unsubscribe;
}
