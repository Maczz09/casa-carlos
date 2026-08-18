import type { DomainEventName, DomainEvents } from "@casacarlos/contracts";
import type { EventBus, EventHandler, Unsubscribe, WildcardHandler } from "./event-bus.js";

/**
 * F1 implementation: handlers run in-process, sequentially, on the same tick
 * the event is published. A handler that throws is logged and does not stop
 * the others — a WebSocket broadcast failing must never roll back a sale.
 *
 * This is a simplification of the durable outbox pattern described in
 * docs/ARQUITECTURA.md §5: because everything lives in one SQLite-backed
 * process, there is no network partition between publish and delivery to
 * guard against. When a service is extracted to its own process, replace
 * this class with one that writes to `bus_outbox` and dispatches after
 * commit — `EventBus` is the seam, no call site changes.
 */
export class InProcessBus implements EventBus {
  private readonly handlers = new Map<DomainEventName, Set<EventHandler<DomainEventName>>>();
  private readonly wildcardHandlers = new Set<WildcardHandler>();

  async publish<K extends DomainEventName>(event: K, payload: DomainEvents[K]): Promise<void> {
    const subscribers = this.handlers.get(event);
    if (subscribers) {
      for (const handler of subscribers) {
        try {
          await handler(payload);
        } catch (err) {
          console.error(`[bus] handler for "${event}" failed:`, err);
        }
      }
    }
    for (const handler of this.wildcardHandlers) {
      try {
        await handler(event, payload);
      } catch (err) {
        console.error(`[bus] wildcard handler for "${event}" failed:`, err);
      }
    }
  }

  subscribe<K extends DomainEventName>(event: K, handler: EventHandler<K>): Unsubscribe {
    let set = this.handlers.get(event);
    if (!set) {
      set = new Set();
      this.handlers.set(event, set);
    }
    set.add(handler as EventHandler<DomainEventName>);
    return () => set!.delete(handler as EventHandler<DomainEventName>);
  }

  subscribeAll(handler: WildcardHandler): Unsubscribe {
    this.wildcardHandlers.add(handler);
    return () => this.wildcardHandlers.delete(handler);
  }
}
