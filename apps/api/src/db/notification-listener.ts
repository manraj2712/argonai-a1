import pg from 'pg';
import type { Logger } from '../core/logger.js';

type NotificationHandler = (payload: string) => void;

const MAX_RECONNECT_DELAY_MS = 30_000;

/**
 * Holds one dedicated connection for LISTEN. Pooled connections can't be used for this
 * because a notification is only delivered to the session that issued LISTEN.
 */
export class NotificationListener {
  private client: pg.Client | null = null;
  private readonly handlers = new Map<string, Set<NotificationHandler>>();
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private stopped = false;

  constructor(
    private readonly connectionString: string,
    private readonly logger: Logger,
  ) {}

  async start(): Promise<void> {
    this.stopped = false;
    await this.connect();
  }

  async stop(): Promise<void> {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    const client = this.client;
    this.client = null;
    await client?.end().catch(() => undefined);
  }

  on(channel: string, handler: NotificationHandler): () => void {
    let channelHandlers = this.handlers.get(channel);
    if (!channelHandlers) {
      channelHandlers = new Set();
      this.handlers.set(channel, channelHandlers);
      void this.client?.query(`LISTEN ${pg.escapeIdentifier(channel)}`);
    }
    channelHandlers.add(handler);
    return () => channelHandlers.delete(handler);
  }

  private async connect(): Promise<void> {
    const client = new pg.Client({ connectionString: this.connectionString });
    client.on('notification', (message) => {
      for (const handler of this.handlers.get(message.channel) ?? []) {
        handler(message.payload ?? '');
      }
    });
    client.on('error', (error) => {
      this.logger.warn({ err: error }, 'notification connection lost');
      this.scheduleReconnect();
    });

    await client.connect();
    for (const channel of this.handlers.keys()) {
      await client.query(`LISTEN ${pg.escapeIdentifier(channel)}`);
    }
    this.client = client;
    this.reconnectAttempts = 0;
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    const stale = this.client;
    this.client = null;
    void stale?.end().catch(() => undefined);

    const delay = Math.min(1000 * 2 ** this.reconnectAttempts, MAX_RECONNECT_DELAY_MS);
    this.reconnectAttempts += 1;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch((error: unknown) => {
        this.logger.warn({ err: error }, 'notification reconnect failed');
        this.scheduleReconnect();
      });
    }, delay);
  }
}
