import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as pg from 'pg';

type NotificationHandler = (payload: any) => void | Promise<void>;

@Injectable()
export class PostgresListenerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PostgresListenerService.name);
  private client: pg.Client;
  private subscriptions = new Map<string, Set<NotificationHandler>>();
  private isConnected = false;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly reconnectDelay = 5000; // 5 seconds

  constructor(private readonly configService: ConfigService) {}

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.disconnect();
  }

  /**
   * Connect to PostgreSQL
   */
  private async connect(): Promise<void> {
    try {
      this.client = new pg.Client({
        host: this.configService.get<string>('DB_HOST'),
        port: this.configService.get<number>('DB_PORT'),
        database: this.configService.get<string>('DB_NAME'),
        user: this.configService.get<string>('DB_USER'),
        password: this.configService.get<string>('DB_PASSWORD'),
      });

      await this.client.connect();
      this.isConnected = true;
      this.reconnectAttempts = 0;

      this.logger.log('PostgreSQL LISTEN client connected');

      // Set up notification handler
      this.client.on('notification', (msg) => {
        this.handleNotification(msg);
      });

      // Set up error handler
      this.client.on('error', (err) => {
        this.logger.error('PostgreSQL LISTEN client error', err);
        this.isConnected = false;
        this.reconnect();
      });

      // Set up end handler
      this.client.on('end', () => {
        this.logger.warn('PostgreSQL LISTEN client connection ended');
        this.isConnected = false;
        this.reconnect();
      });
    } catch (error) {
      this.logger.error('Failed to connect PostgreSQL LISTEN client', error);
      this.reconnect();
    }
  }

  /**
   * Disconnect from PostgreSQL
   */
  private async disconnect(): Promise<void> {
    if (this.client) {
      this.isConnected = false;
      await this.client.end();
      this.logger.log('PostgreSQL LISTEN client disconnected');
    }
  }

  /**
   * Reconnect to PostgreSQL
   */
  private async reconnect(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error(
        `Max reconnect attempts (${this.maxReconnectAttempts}) reached. Giving up.`,
      );
      return;
    }

    this.reconnectAttempts++;
    this.logger.log(
      `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`,
    );

    setTimeout(async () => {
      await this.connect();

      // Re-subscribe to all channels
      if (this.isConnected) {
        for (const channel of this.subscriptions.keys()) {
          await this.executeQuery(`LISTEN "${channel}"`);
          this.logger.log(`Re-subscribed to channel: ${channel}`);
        }
      }
    }, this.reconnectDelay);
  }

  /**
   * Sanitize channel name for PostgreSQL LISTEN/NOTIFY
   * PostgreSQL channel names cannot contain hyphens or special characters
   */
  private sanitizeChannelName(channel: string): string {
    return channel.replace(/-/g, '_');
  }

  /**
   * Subscribe to a PostgreSQL NOTIFY channel
   */
  async subscribe(
    channel: string,
    handler: NotificationHandler,
  ): Promise<void> {
    if (!this.isConnected) {
      throw new Error('PostgreSQL LISTEN client is not connected');
    }

    const sanitizedChannel = this.sanitizeChannelName(channel);

    if (!this.subscriptions.has(sanitizedChannel)) {
      await this.executeQuery(`LISTEN "${sanitizedChannel}"`);
      this.subscriptions.set(sanitizedChannel, new Set());
      this.logger.log(`Subscribed to channel: ${sanitizedChannel}`);
    }

    this.subscriptions.get(sanitizedChannel)!.add(handler);
  }

  /**
   * Unsubscribe from a PostgreSQL NOTIFY channel
   */
  async unsubscribe(
    channel: string,
    handler: NotificationHandler,
  ): Promise<void> {
    const sanitizedChannel = this.sanitizeChannelName(channel);
    const handlers = this.subscriptions.get(sanitizedChannel);
    if (!handlers) {
      return;
    }

    handlers.delete(handler);

    if (handlers.size === 0) {
      await this.executeQuery(`UNLISTEN "${sanitizedChannel}"`);
      this.subscriptions.delete(sanitizedChannel);
      this.logger.log(`Unsubscribed from channel: ${sanitizedChannel}`);
    }
  }

  /**
   * Handle incoming notification
   */
  private handleNotification(msg: pg.Notification): void {
    const channel = msg.channel;
    const handlers = this.subscriptions.get(channel);

    if (!handlers || handlers.size === 0) {
      return;
    }

    let payload: any;
    try {
      payload = JSON.parse(msg.payload || '{}');
    } catch (error) {
      this.logger.error(
        `Failed to parse notification payload for channel ${channel}`,
        error,
      );
      return;
    }

    this.logger.debug(`Notification received on channel ${channel}`, payload);

    // Execute all handlers for this channel
    handlers.forEach(async (handler) => {
      try {
        await handler(payload);
      } catch (error) {
        this.logger.error(
          `Error executing handler for channel ${channel}`,
          error,
        );
      }
    });
  }

  /**
   * Execute a query
   */
  private async executeQuery(query: string): Promise<void> {
    if (!this.isConnected) {
      throw new Error('PostgreSQL LISTEN client is not connected');
    }

    try {
      await this.client.query(query);
    } catch (error) {
      this.logger.error(`Failed to execute query: ${query}`, error);
      throw error;
    }
  }

  /**
   * Check if connected
   */
  isClientConnected(): boolean {
    return this.isConnected;
  }

  /**
   * Notify - Send a NOTIFY command (for testing purposes)
   * This method sanitizes channel names and sends notifications via PostgreSQL NOTIFY
   */
  async notify(channel: string, payload: any): Promise<void> {
    if (!this.isConnected) {
      throw new Error('PostgreSQL LISTEN client is not connected');
    }

    const sanitizedChannel = this.sanitizeChannelName(channel);
    const payloadStr = JSON.stringify(payload);

    await this.executeQuery(
      `NOTIFY "${sanitizedChannel}", '${payloadStr.replace(/'/g, "''")}'`,
    );

    this.logger.debug(`Sent NOTIFY to channel ${sanitizedChannel}`, payload);
  }
}
