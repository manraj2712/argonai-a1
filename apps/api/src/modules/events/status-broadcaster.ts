import type { Logger } from '../../core/logger.js';
import type { NotificationListener } from '../../db/notification-listener.js';
import { IMAGE_STATUS_CHANNEL, parseStatusChange, type StatusChange } from './status-events.js';

type Subscriber = (change: StatusChange) => void;

/** Fans committed status changes out to the browsers of the owner they belong to. */
export class StatusBroadcaster {
  private readonly subscribers = new Map<string, Set<Subscriber>>();

  constructor(listener: NotificationListener, logger: Logger) {
    listener.on(IMAGE_STATUS_CHANNEL, (payload) => {
      const change = parseStatusChange(payload);
      if (!change) {
        logger.warn({ payload }, 'ignoring malformed status notification');
        return;
      }
      for (const subscriber of this.subscribers.get(change.ownerId) ?? []) subscriber(change);
    });
  }

  subscribe(ownerId: string, subscriber: Subscriber): () => void {
    let ownerSubscribers = this.subscribers.get(ownerId);
    if (!ownerSubscribers) {
      ownerSubscribers = new Set();
      this.subscribers.set(ownerId, ownerSubscribers);
    }
    ownerSubscribers.add(subscriber);

    return () => {
      ownerSubscribers.delete(subscriber);
      if (ownerSubscribers.size === 0) this.subscribers.delete(ownerId);
    };
  }
}
