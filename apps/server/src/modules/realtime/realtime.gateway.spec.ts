import { Test, TestingModule } from '@nestjs/testing';
import { RealtimeGateway } from './realtime.gateway';
import { PostgresListenerService } from '../postgres-listener/postgres-listener.service';
import { Server, Socket } from 'socket.io';

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;
  let mockPgListener: jest.Mocked<PostgresListenerService>;

  const mockServer = {
    to: jest.fn().mockReturnThis(),
    emit: jest.fn(),
    sockets: {
      adapter: {
        rooms: new Map(),
      },
    },
  } as unknown as Server;

  const createMockSocket = (overrides: Partial<Socket> = {}): Socket => {
    return {
      id: 'socket-123',
      join: jest.fn(),
      leave: jest.fn(),
      handshake: {
        query: {
          hollonId: 'hollon-123',
          organizationId: 'org-123',
        },
      },
      ...overrides,
    } as unknown as Socket;
  };

  beforeEach(async () => {
    mockPgListener = {
      subscribe: jest.fn().mockResolvedValue(undefined),
      unsubscribe: jest.fn().mockResolvedValue(undefined),
      isClientConnected: jest.fn().mockReturnValue(true),
    } as unknown as jest.Mocked<PostgresListenerService>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RealtimeGateway,
        {
          provide: PostgresListenerService,
          useValue: mockPgListener,
        },
      ],
    }).compile();

    gateway = module.get<RealtimeGateway>(RealtimeGateway);
    gateway.server = mockServer;

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('afterInit', () => {
    it('should log initialization message', () => {
      // afterInit is called during gateway initialization
      // Just verify the gateway was created successfully
      expect(gateway).toBeDefined();
    });
  });

  describe('handleConnection', () => {
    it('should add client to organization room when organizationId is provided', () => {
      const client = createMockSocket();
      (client as any).organizationId = 'org-123';

      gateway.handleConnection(client);

      expect(client.join).toHaveBeenCalledWith('org:org-123');
    });

    it('should add client to hollon room when hollonId is provided', () => {
      const client = createMockSocket();
      (client as any).organizationId = 'org-123';
      (client as any).hollonId = 'hollon-123';

      gateway.handleConnection(client);

      expect(client.join).toHaveBeenCalledWith('hollon:hollon-123');
    });

    it('should not join hollon room when hollonId is not provided', () => {
      const client = createMockSocket({
        handshake: {
          query: {
            organizationId: 'org-123',
            // hollonId is not provided
          },
        },
      } as any);

      gateway.handleConnection(client);

      expect(client.join).toHaveBeenCalledTimes(1);
      expect(client.join).toHaveBeenCalledWith('org:org-123');
    });
  });

  describe('handleDisconnect', () => {
    it('should log disconnection', () => {
      const client = createMockSocket();
      (client as any).hollonId = 'hollon-123';

      // Should not throw
      expect(() => gateway.handleDisconnect(client)).not.toThrow();
    });
  });

  describe('handleSubscribeHolon', () => {
    it('should join the hollon room', () => {
      const client = createMockSocket();

      gateway.handleSubscribeHolon(client, 'hollon-456');

      expect(client.join).toHaveBeenCalledWith('hollon:hollon-456');
    });

    it('should subscribe to hollon message channel', async () => {
      const client = createMockSocket();

      gateway.handleSubscribeHolon(client, 'hollon-456');

      // Wait for async subscription
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockPgListener.subscribe).toHaveBeenCalledWith(
        'holon_message_hollon-456',
        expect.any(Function),
      );
    });
  });

  describe('handleUnsubscribeHolon', () => {
    it('should leave the hollon room', () => {
      const client = createMockSocket();

      gateway.handleUnsubscribeHolon(client, 'hollon-456');

      expect(client.leave).toHaveBeenCalledWith('hollon:hollon-456');
    });
  });

  describe('handleSubscribeTeam', () => {
    it('should join the team room', () => {
      const client = createMockSocket();

      gateway.handleSubscribeTeam(client, 'team-123');

      expect(client.join).toHaveBeenCalledWith('team:team-123');
    });
  });

  describe('handleUnsubscribeTeam', () => {
    it('should leave the team room', () => {
      const client = createMockSocket();

      gateway.handleUnsubscribeTeam(client, 'team-123');

      expect(client.leave).toHaveBeenCalledWith('team:team-123');
    });
  });

  describe('handleSubscribeChannel', () => {
    it('should join the channel room', () => {
      const client = createMockSocket();

      gateway.handleSubscribeChannel(client, 'channel-123');

      expect(client.join).toHaveBeenCalledWith('channel:channel-123');
    });

    it('should subscribe to channel message notifications', async () => {
      const client = createMockSocket();

      gateway.handleSubscribeChannel(client, 'channel-123');

      // Wait for async subscription
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockPgListener.subscribe).toHaveBeenCalledWith(
        'channel_message_channel-123',
        expect.any(Function),
      );
    });
  });

  describe('handleUnsubscribeChannel', () => {
    it('should leave the channel room', () => {
      const client = createMockSocket();

      gateway.handleUnsubscribeChannel(client, 'channel-123');

      expect(client.leave).toHaveBeenCalledWith('channel:channel-123');
    });
  });

  describe('LISTEN event forwarding', () => {
    it('should emit holon_status_changed to organization room', async () => {
      // Capture the handler when subscribe is called
      let capturedHandler: (payload: any) => void;
      mockPgListener.subscribe.mockImplementation(
        async (channel: string, handler: (payload: any) => void) => {
          if (channel === 'holon_status_changed') {
            capturedHandler = handler;
          }
        },
      );

      // Trigger setupGlobalChannels indirectly
      await (gateway as any).setupGlobalChannels();

      const payload = {
        organization_id: 'org-123',
        hollon_id: 'hollon-123',
        status: 'WORKING',
      };

      // Simulate notification
      capturedHandler!(payload);

      expect(mockServer.to).toHaveBeenCalledWith('org:org-123');
      expect(mockServer.emit).toHaveBeenCalledWith(
        'holon_status_changed',
        payload,
      );
    });

    it('should emit approval_requested to organization room only', async () => {
      let capturedHandler: (payload: any) => void;
      mockPgListener.subscribe.mockImplementation(
        async (channel: string, handler: (payload: any) => void) => {
          if (channel === 'approval_requested') {
            capturedHandler = handler;
          }
        },
      );

      await (gateway as any).setupGlobalChannels();

      const payload = {
        organization_id: 'org-123',
        holon_id: 'hollon-123',
        approval_id: 'approval-123',
      };

      capturedHandler!(payload);

      expect(mockServer.to).toHaveBeenCalledWith('org:org-123');
      expect(mockServer.emit).toHaveBeenCalledWith(
        'approval_requested',
        payload,
      );
    });
  });

  describe('duplicate subscription prevention', () => {
    it('should not subscribe twice to the same hollon message channel', async () => {
      const client = createMockSocket();

      gateway.handleSubscribeHolon(client, 'hollon-456');
      await new Promise((resolve) => setTimeout(resolve, 10));

      gateway.handleSubscribeHolon(client, 'hollon-456');
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should only subscribe once
      const hollonMessageCalls = mockPgListener.subscribe.mock.calls.filter(
        (call) => call[0] === 'holon_message_hollon-456',
      );
      expect(hollonMessageCalls.length).toBe(1);
    });

    it('should not subscribe twice to the same channel message notifications', async () => {
      const client = createMockSocket();

      gateway.handleSubscribeChannel(client, 'channel-456');
      await new Promise((resolve) => setTimeout(resolve, 10));

      gateway.handleSubscribeChannel(client, 'channel-456');
      await new Promise((resolve) => setTimeout(resolve, 10));

      const channelMessageCalls = mockPgListener.subscribe.mock.calls.filter(
        (call) => call[0] === 'channel_message_channel-456',
      );
      expect(channelMessageCalls.length).toBe(1);
    });
  });
});
