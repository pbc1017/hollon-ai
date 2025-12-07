import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

/**
 * WebSocket Authentication Guard
 * TODO: Implement proper authentication logic
 * For now, this is a placeholder that allows all connections
 */
@Injectable()
export class WsAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient<Socket>();

    // TODO: Implement authentication
    // For now, extract user/hollon info from query params or headers
    const hollonId = client.handshake.query.hollonId as string;
    const organizationId = client.handshake.query.organizationId as string;

    if (!organizationId) {
      throw new WsException('Missing organizationId in connection');
    }

    // Attach to client for later use
    (client as any).organizationId = organizationId;
    (client as any).hollonId = hollonId;

    return true;
  }
}
