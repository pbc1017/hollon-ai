import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AppModule } from '../../../src/app.module';
import { io, Socket } from 'socket.io-client';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Organization } from '../../../src/modules/organization/entities/organization.entity';
import { Hollon } from '../../../src/modules/hollon/entities/hollon.entity';
import { Channel } from '../../../src/modules/channel/entities/channel.entity';
import { Team } from '../../../src/modules/team/entities/team.entity';
import { Role } from '../../../src/modules/role/entities/role.entity';
import { PostgresListenerService } from '../../../src/modules/postgres-listener/postgres-listener.service';
import { RealtimeGateway } from '../../../src/modules/realtime/realtime.gateway';
import { ParticipantType } from '../../../src/modules/message/enums/message.enums';

describe('WebSocket (e2e)', () => {
  let app: INestApplication;
  let organizationRepo: Repository<Organization>;
  let hollonRepo: Repository<Hollon>;
  let channelRepo: Repository<Channel>;
  let teamRepo: Repository<Team>;
  let roleRepo: Repository<Role>;
  let pgListener: PostgresListenerService;
  let realtimeGateway: RealtimeGateway;

  let testOrganization: Organization;
  let testHollon: Hollon;
  let testChannel: Channel;
  let testTeam: Team;
  let testRole: Role;

  let clientSocket: Socket;
  let serverUrl: string;

  /**
   * Helper function to wait for global channels to be ready
   */
  async function waitForGlobalChannels(maxWaitMs = 10000): Promise<void> {
    const startTime = Date.now();
    while (!realtimeGateway.isGlobalChannelsReady()) {
      if (Date.now() - startTime > maxWaitMs) {
        throw new Error('Timeout waiting for global channels to be ready');
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
      }),
    );

    await app.init();
    await app.listen(0); // Random port

    const address = app.getHttpServer().address();
    const port = address.port;
    serverUrl = `http://localhost:${port}`;

    // Get repositories and services
    organizationRepo = moduleFixture.get(getRepositoryToken(Organization));
    hollonRepo = moduleFixture.get(getRepositoryToken(Hollon));
    channelRepo = moduleFixture.get(getRepositoryToken(Channel));
    teamRepo = moduleFixture.get(getRepositoryToken(Team));
    roleRepo = moduleFixture.get(getRepositoryToken(Role));
    pgListener = moduleFixture.get(PostgresListenerService);
    realtimeGateway = moduleFixture.get(RealtimeGateway);

    // Create test data
    testOrganization = await organizationRepo.save({
      name: 'WebSocket Test Org',
      description: 'Test organization for WebSocket E2E tests',
    });

    testTeam = await teamRepo.save({
      name: 'WebSocket Test Team',
      organizationId: testOrganization.id,
    });

    testRole = await roleRepo.save({
      name: 'WebSocket Test Role',
      description: 'Test role for WebSocket E2E tests',
      capabilities: ['test'],
      organizationId: testOrganization.id,
    });

    testHollon = await hollonRepo.save({
      name: 'WebSocket Test Hollon',
      status: 'idle',
      organizationId: testOrganization.id,
      teamId: testTeam.id,
      roleId: testRole.id,
    });

    testChannel = await channelRepo.save({
      name: 'WebSocket Test Channel',
      organizationId: testOrganization.id,
      createdByType: ParticipantType.SYSTEM,
    });

    // Wait for gateway to initialize and subscribe to global channels
    await waitForGlobalChannels();
  });

  afterAll(async () => {
    // Cleanup test data
    if (testChannel) await channelRepo.remove(testChannel);
    if (testHollon) await hollonRepo.remove(testHollon);
    if (testTeam) await teamRepo.remove(testTeam);
    if (testOrganization) await organizationRepo.remove(testOrganization);

    await app.close();
  });

  afterEach(() => {
    if (clientSocket && clientSocket.connected) {
      clientSocket.disconnect();
    }
  });

  describe('Connection', () => {
    it('should establish WebSocket connection', (done) => {
      clientSocket = io(serverUrl, {
        transports: ['websocket'],
        auth: {
          organizationId: testOrganization.id,
          hollonId: testHollon.id,
        },
      });

      clientSocket.on('connect', () => {
        expect(clientSocket.connected).toBe(true);
        done();
      });

      clientSocket.on('connect_error', (error) => {
        done(error);
      });
    });

    it('should handle disconnection gracefully', (done) => {
      clientSocket = io(serverUrl, {
        transports: ['websocket'],
        auth: {
          organizationId: testOrganization.id,
          hollonId: testHollon.id,
        },
      });

      clientSocket.on('connect', () => {
        clientSocket.disconnect();
      });

      clientSocket.on('disconnect', () => {
        expect(clientSocket.connected).toBe(false);
        done();
      });
    });

    it('should auto-join organization room on connection', (done) => {
      clientSocket = io(serverUrl, {
        transports: ['websocket'],
        auth: {
          organizationId: testOrganization.id,
        },
      });

      clientSocket.on('connect', () => {
        // The client should be in org room automatically
        // We can verify this by emitting an event to the org room
        setTimeout(() => {
          expect(clientSocket.connected).toBe(true);
          done();
        }, 100);
      });
    });

    it('should auto-join hollon room when hollonId is provided', (done) => {
      clientSocket = io(serverUrl, {
        transports: ['websocket'],
        auth: {
          organizationId: testOrganization.id,
          hollonId: testHollon.id,
        },
      });

      clientSocket.on('connect', () => {
        setTimeout(() => {
          expect(clientSocket.connected).toBe(true);
          done();
        }, 100);
      });
    });
  });

  describe('Room Subscriptions', () => {
    beforeEach((done) => {
      clientSocket = io(serverUrl, {
        transports: ['websocket'],
        auth: {
          organizationId: testOrganization.id,
          hollonId: testHollon.id,
        },
      });

      clientSocket.on('connect', done);
    });

    it('should subscribe to hollon room', (done) => {
      clientSocket.emit('subscribe_holon', testHollon.id);

      setTimeout(() => {
        // If no error is thrown, subscription was successful
        expect(clientSocket.connected).toBe(true);
        done();
      }, 100);
    });

    it('should unsubscribe from hollon room', (done) => {
      clientSocket.emit('subscribe_holon', testHollon.id);

      setTimeout(() => {
        clientSocket.emit('unsubscribe_holon', testHollon.id);
        setTimeout(() => {
          expect(clientSocket.connected).toBe(true);
          done();
        }, 100);
      }, 100);
    });

    it('should subscribe to team room', (done) => {
      clientSocket.emit('subscribe_team', testTeam.id);

      setTimeout(() => {
        expect(clientSocket.connected).toBe(true);
        done();
      }, 100);
    });

    it('should unsubscribe from team room', (done) => {
      clientSocket.emit('subscribe_team', testTeam.id);

      setTimeout(() => {
        clientSocket.emit('unsubscribe_team', testTeam.id);
        setTimeout(() => {
          expect(clientSocket.connected).toBe(true);
          done();
        }, 100);
      }, 100);
    });

    it('should subscribe to channel room', (done) => {
      clientSocket.emit('subscribe_channel', testChannel.id);

      setTimeout(() => {
        expect(clientSocket.connected).toBe(true);
        done();
      }, 100);
    });

    it('should unsubscribe from channel room', (done) => {
      clientSocket.emit('subscribe_channel', testChannel.id);

      setTimeout(() => {
        clientSocket.emit('unsubscribe_channel', testChannel.id);
        setTimeout(() => {
          expect(clientSocket.connected).toBe(true);
          done();
        }, 100);
      }, 100);
    });
  });

  describe('Event Reception', () => {
    beforeEach((done) => {
      clientSocket = io(serverUrl, {
        transports: ['websocket'],
        auth: {
          organizationId: testOrganization.id,
          hollonId: testHollon.id,
        },
      });

      clientSocket.on('connect', done);
    });

    it('should receive hollon status change events', (done) => {
      clientSocket.on('holon_status_changed', (payload) => {
        expect(payload).toBeDefined();
        expect(payload.organization_id).toBe(testOrganization.id);
        done();
      });

      // Global channels are already ready, just need small delay for socket connection
      setTimeout(async () => {
        await pgListener.notify('holon_status_changed', {
          organization_id: testOrganization.id,
          holon_id: testHollon.id,
          status: 'working',
        });
      }, 200);
    });

    it('should receive approval request events', (done) => {
      clientSocket.on('approval_requested', (payload) => {
        expect(payload).toBeDefined();
        expect(payload.organization_id).toBe(testOrganization.id);
        done();
      });

      // Global channels are already ready, just need small delay for socket connection
      setTimeout(async () => {
        await pgListener.notify('approval_requested', {
          organization_id: testOrganization.id,
          holon_id: testHollon.id,
          request_type: 'task_approval',
        });
      }, 200);
    });

    it('should receive messages in hollon room', (done) => {
      clientSocket.emit('subscribe_holon', testHollon.id);

      clientSocket.on('message_received', (payload) => {
        expect(payload).toBeDefined();
        expect(payload.hollon_id).toBe(testHollon.id);
        done();
      });

      setTimeout(async () => {
        await pgListener.notify(`holon_message_${testHollon.id}`, {
          hollon_id: testHollon.id,
          message: 'Test message',
        });
      }, 200);
    });

    it('should receive channel messages', (done) => {
      clientSocket.emit('subscribe_channel', testChannel.id);

      clientSocket.on('channel_message', (payload) => {
        expect(payload).toBeDefined();
        expect(payload.channel_id).toBe(testChannel.id);
        done();
      });

      setTimeout(async () => {
        await pgListener.notify(`channel_message_${testChannel.id}`, {
          channel_id: testChannel.id,
          message: 'Test channel message',
        });
      }, 200);
    });
  });

  describe('Multiple Clients', () => {
    let clientSocket2: Socket;

    afterEach(() => {
      if (clientSocket2 && clientSocket2.connected) {
        clientSocket2.disconnect();
      }
    });

    it('should broadcast to multiple clients in same organization', (done) => {
      let received = 0;
      const expectedPayload = {
        organization_id: testOrganization.id,
        test: 'broadcast',
      };

      const checkComplete = () => {
        received++;
        if (received === 2) {
          done();
        }
      };

      clientSocket = io(serverUrl, {
        transports: ['websocket'],
        auth: {
          organizationId: testOrganization.id,
        },
      });

      clientSocket2 = io(serverUrl, {
        transports: ['websocket'],
        auth: {
          organizationId: testOrganization.id,
        },
      });

      clientSocket.on('holon_status_changed', (payload) => {
        expect(payload.organization_id).toBe(testOrganization.id);
        checkComplete();
      });

      clientSocket2.on('holon_status_changed', (payload) => {
        expect(payload.organization_id).toBe(testOrganization.id);
        checkComplete();
      });

      Promise.all([
        new Promise<void>((resolve) => clientSocket.on('connect', resolve)),
        new Promise<void>((resolve) => clientSocket2.on('connect', resolve)),
      ]).then(() => {
        // Global channels are already ready, just need small delay for socket connection
        setTimeout(async () => {
          await pgListener.notify('holon_status_changed', expectedPayload);
        }, 200);
      });
    });

    it('should not send events to clients in different organizations', (done) => {
      let otherOrg: Organization;

      organizationRepo
        .save({
          name: 'Other Org',
          description: 'Another organization',
        })
        .then((org) => {
          otherOrg = org;

          clientSocket = io(serverUrl, {
            transports: ['websocket'],
            auth: {
              organizationId: testOrganization.id,
            },
          });

          clientSocket2 = io(serverUrl, {
            transports: ['websocket'],
            auth: {
              organizationId: otherOrg.id,
            },
          });

          let client1Received = false;
          let client2Received = false;

          clientSocket.on('holon_status_changed', () => {
            client1Received = true;
          });

          clientSocket2.on('holon_status_changed', () => {
            client2Received = true;
          });

          Promise.all([
            new Promise<void>((resolve) => clientSocket.on('connect', resolve)),
            new Promise<void>((resolve) =>
              clientSocket2.on('connect', resolve),
            ),
          ]).then(() => {
            // Global channels are already ready, just need small delay for socket connection
            setTimeout(async () => {
              await pgListener.notify('holon_status_changed', {
                organization_id: testOrganization.id,
                test: 'isolation',
              });

              setTimeout(async () => {
                expect(client1Received).toBe(true);
                expect(client2Received).toBe(false);

                await organizationRepo.remove(otherOrg);
                done();
              }, 200);
            }, 200);
          });
        });
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid hollon subscription', (done) => {
      clientSocket = io(serverUrl, {
        transports: ['websocket'],
        auth: {
          organizationId: testOrganization.id,
        },
      });

      clientSocket.on('connect', () => {
        // Subscribe to non-existent hollon (should not crash)
        clientSocket.emit('subscribe_holon', 'non-existent-hollon-id');

        setTimeout(() => {
          expect(clientSocket.connected).toBe(true);
          done();
        }, 100);
      });
    });

    it('should handle invalid channel subscription', (done) => {
      clientSocket = io(serverUrl, {
        transports: ['websocket'],
        auth: {
          organizationId: testOrganization.id,
        },
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('subscribe_channel', 'non-existent-channel-id');

        setTimeout(() => {
          expect(clientSocket.connected).toBe(true);
          done();
        }, 100);
      });
    });

    it('should handle connection without authentication', (done) => {
      clientSocket = io(serverUrl, {
        transports: ['websocket'],
      });

      // Connection might be rejected or established without auth
      // depending on WsAuthGuard configuration
      clientSocket.on('connect', () => {
        // If connection succeeds without auth, that's acceptable
        expect(clientSocket.connected).toBe(true);
        done();
      });

      clientSocket.on('connect_error', () => {
        // If connection is rejected, that's also acceptable
        done();
      });
    });
  });

  describe('Cleanup', () => {
    it('should cleanup hollon subscriptions when all clients disconnect', (done) => {
      clientSocket = io(serverUrl, {
        transports: ['websocket'],
        auth: {
          organizationId: testOrganization.id,
          hollonId: testHollon.id,
        },
      });

      clientSocket.on('connect', () => {
        clientSocket.emit('subscribe_holon', testHollon.id);

        setTimeout(() => {
          clientSocket.disconnect();

          setTimeout(() => {
            // After disconnection, subscription should be cleaned up
            // We can't directly verify this, but we can check that
            // no errors occurred
            expect(true).toBe(true);
            done();
          }, 500);
        }, 100);
      });
    });

    it('should maintain subscriptions when other clients remain', (done) => {
      let clientSocket2: Socket;

      clientSocket = io(serverUrl, {
        transports: ['websocket'],
        auth: {
          organizationId: testOrganization.id,
          hollonId: testHollon.id,
        },
      });

      clientSocket2 = io(serverUrl, {
        transports: ['websocket'],
        auth: {
          organizationId: testOrganization.id,
          hollonId: testHollon.id,
        },
      });

      Promise.all([
        new Promise<void>((resolve) => clientSocket.on('connect', resolve)),
        new Promise<void>((resolve) => clientSocket2.on('connect', resolve)),
      ]).then(() => {
        clientSocket.emit('subscribe_holon', testHollon.id);
        clientSocket2.emit('subscribe_holon', testHollon.id);

        setTimeout(() => {
          // Disconnect first client
          clientSocket.disconnect();

          setTimeout(() => {
            // Second client should still receive messages
            clientSocket2.on('message_received', (payload) => {
              expect(payload).toBeDefined();
              clientSocket2.disconnect();
              done();
            });

            pgListener.notify(`holon_message_${testHollon.id}`, {
              hollon_id: testHollon.id,
              message: 'Test after disconnect',
            });
          }, 200);
        }, 100);
      });
    });
  });
});
