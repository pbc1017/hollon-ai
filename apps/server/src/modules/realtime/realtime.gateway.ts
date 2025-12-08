import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Logger } from '@nestjs/common';
import { Server, Socket } from 'socket.io';
import { PostgresListenerService } from '../postgres-listener/postgres-listener.service';

@WebSocketGateway({ cors: true })
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);
  private readonly hollonSubscriptions = new Map<
    string,
    Set<(payload: any) => void>
  >();
  private readonly channelSubscriptions = new Map<
    string,
    Set<(payload: any) => void>
  >();
  private globalChannelsReady = false;

  constructor(private readonly pgListener: PostgresListenerService) {}

  afterInit(): void {
    this.logger.log('WebSocket Gateway initialized');

    // Subscribe to global channels after PostgreSQL LISTEN is ready
    this.setupGlobalChannelsWithRetry();
  }

  private async setupGlobalChannelsWithRetry(
    maxAttempts = 10,
    delayMs = 1000,
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.setupGlobalChannels();
        this.globalChannelsReady = true;
        this.logger.log('Global channels subscribed successfully');
        return;
      } catch (error) {
        if (attempt < maxAttempts) {
          this.logger.warn(
            `Failed to setup global channels (attempt ${attempt}/${maxAttempts}). Retrying in ${delayMs}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        } else {
          this.logger.error(
            'Failed to setup global channels after max attempts',
            error,
          );
        }
      }
    }
  }

  handleConnection(client: Socket): void {
    const clientId = client.id;

    // Extract organizationId and hollonId from handshake
    const hollonId =
      (client.handshake.auth?.hollonId as string) ||
      (client.handshake.query.hollonId as string);
    const organizationId =
      (client.handshake.auth?.organizationId as string) ||
      (client.handshake.query.organizationId as string);

    this.logger.log(
      `Client connected: ${clientId} (org: ${organizationId}, hollon: ${hollonId})`,
    );

    if (!organizationId) {
      this.logger.error(`Client ${clientId} has no organizationId!`);
      client.disconnect();
      return;
    }

    // Attach to client for later use
    (client as any).organizationId = organizationId;
    (client as any).hollonId = hollonId;

    // Join organization room
    client.join(`org:${organizationId}`);
    this.logger.debug(`Client ${clientId} joined org:${organizationId}`);

    // Join hollon room
    if (hollonId) {
      client.join(`hollon:${hollonId}`);
      this.logger.debug(`Client ${clientId} joined hollon:${hollonId}`);
    }
  }

  handleDisconnect(client: Socket): void {
    const clientId = client.id;
    const hollonId = (client as any).hollonId;

    this.logger.log(`Client disconnected: ${clientId}`);

    // Cleanup hollon-specific subscriptions
    if (hollonId) {
      this.cleanupHollonSubscriptions(hollonId);
    }
  }

  /**
   * Subscribe to hollon-specific channels
   * Event: subscribe_holon
   */
  @SubscribeMessage('subscribe_holon')
  handleSubscribeHolon(client: Socket, hollonId: string): void {
    client.join(`hollon:${hollonId}`);
    this.logger.debug(`Client ${client.id} subscribed to hollon:${hollonId}`);

    // Subscribe to hollon's message channel
    this.subscribeToHollonMessages(hollonId);
  }

  /**
   * Unsubscribe from hollon-specific channels
   * Event: unsubscribe_holon
   */
  @SubscribeMessage('unsubscribe_holon')
  handleUnsubscribeHolon(client: Socket, hollonId: string): void {
    client.leave(`hollon:${hollonId}`);
    this.logger.debug(
      `Client ${client.id} unsubscribed from hollon:${hollonId}`,
    );
  }

  /**
   * Subscribe to team channels
   * Event: subscribe_team
   */
  @SubscribeMessage('subscribe_team')
  handleSubscribeTeam(client: Socket, teamId: string): void {
    client.join(`team:${teamId}`);
    this.logger.debug(`Client ${client.id} subscribed to team:${teamId}`);
  }

  /**
   * Unsubscribe from team channels
   * Event: unsubscribe_team
   */
  @SubscribeMessage('unsubscribe_team')
  handleUnsubscribeTeam(client: Socket, teamId: string): void {
    client.leave(`team:${teamId}`);
    this.logger.debug(`Client ${client.id} unsubscribed from team:${teamId}`);
  }

  /**
   * Subscribe to channel
   * Event: subscribe_channel
   */
  @SubscribeMessage('subscribe_channel')
  handleSubscribeChannel(client: Socket, channelId: string): void {
    client.join(`channel:${channelId}`);
    this.logger.debug(`Client ${client.id} subscribed to channel:${channelId}`);

    // Subscribe to channel message notifications
    this.subscribeToChannelMessages(channelId);
  }

  /**
   * Unsubscribe from channel
   * Event: unsubscribe_channel
   */
  @SubscribeMessage('unsubscribe_channel')
  handleUnsubscribeChannel(client: Socket, channelId: string): void {
    client.leave(`channel:${channelId}`);
    this.logger.debug(
      `Client ${client.id} unsubscribed from channel:${channelId}`,
    );
  }

  /**
   * Setup global PostgreSQL LISTEN channels
   */
  private async setupGlobalChannels(): Promise<void> {
    // Listen to hollon status changes
    await this.pgListener.subscribe('holon_status_changed', (payload) => {
      this.logger.debug(
        `Received holon_status_changed event:`,
        JSON.stringify(payload),
      );
      this.server
        .to(`org:${payload.organization_id}`)
        .emit('holon_status_changed', payload);
      this.logger.debug(
        `Emitted holon_status_changed to org:${payload.organization_id}`,
      );
    });

    // Listen to approval requests
    await this.pgListener.subscribe('approval_requested', (payload) => {
      this.logger.debug(
        `Received approval_requested event:`,
        JSON.stringify(payload),
      );
      // Send to organization room
      this.server
        .to(`org:${payload.organization_id}`)
        .emit('approval_requested', payload);
      this.logger.debug(
        `Emitted approval_requested to org:${payload.organization_id}`,
      );

      // Send to specific hollon if available
      if (payload.holon_id) {
        this.server
          .to(`hollon:${payload.holon_id}`)
          .emit('approval_requested', payload);
      }
    });

    this.logger.log(
      'Subscribed to global channels: holon_status_changed, approval_requested',
    );
  }

  /**
   * Subscribe to hollon-specific message notifications
   */
  private async subscribeToHollonMessages(hollonId: string): Promise<void> {
    const channel = `holon_message_${hollonId}`;

    // Avoid duplicate subscriptions
    if (this.hollonSubscriptions.has(channel)) {
      return;
    }

    const handler = (payload: any) => {
      this.server.to(`hollon:${hollonId}`).emit('message_received', payload);
    };

    try {
      await this.pgListener.subscribe(channel, handler);

      // Store handler for cleanup
      if (!this.hollonSubscriptions.has(channel)) {
        this.hollonSubscriptions.set(channel, new Set());
      }
      this.hollonSubscriptions.get(channel)!.add(handler);

      this.logger.debug(`Subscribed to ${channel}`);
    } catch (error) {
      this.logger.error(`Failed to subscribe to ${channel}`, error);
    }
  }

  /**
   * Subscribe to channel message notifications
   */
  private async subscribeToChannelMessages(channelId: string): Promise<void> {
    const channel = `channel_message_${channelId}`;

    // Avoid duplicate subscriptions
    if (this.channelSubscriptions.has(channel)) {
      return;
    }

    const handler = (payload: any) => {
      this.server.to(`channel:${channelId}`).emit('channel_message', payload);
    };

    try {
      await this.pgListener.subscribe(channel, handler);

      // Store handler for cleanup
      if (!this.channelSubscriptions.has(channel)) {
        this.channelSubscriptions.set(channel, new Set());
      }
      this.channelSubscriptions.get(channel)!.add(handler);

      this.logger.debug(`Subscribed to ${channel}`);
    } catch (error) {
      this.logger.error(`Failed to subscribe to ${channel}`, error);
    }
  }

  /**
   * Cleanup hollon subscriptions when no clients are connected
   */
  private async cleanupHollonSubscriptions(hollonId: string): Promise<void> {
    const room = this.server.sockets.adapter.rooms.get(`hollon:${hollonId}`);

    // If no more clients in this hollon room, unsubscribe
    if (!room || room.size === 0) {
      const channel = `holon_message_${hollonId}`;
      const handlers = this.hollonSubscriptions.get(channel);

      if (handlers) {
        for (const handler of handlers) {
          try {
            await this.pgListener.unsubscribe(channel, handler);
          } catch (error) {
            this.logger.error(`Failed to unsubscribe from ${channel}`, error);
          }
        }
        this.hollonSubscriptions.delete(channel);
        this.logger.debug(`Unsubscribed from ${channel}`);
      }
    }
  }
}
