import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../../src/app.module';
import { DataSource } from 'typeorm';
import request from 'supertest';

/**
 * Phase 3.8 Hierarchical Task Distribution End-to-End Test
 *
 * Tests the complete hierarchical task distribution flow:
 * 1. Create Organization, Teams with Managers, Hollons
 * 2. Create Goal
 * 3. Auto-decompose Goal → Team Tasks (TEAM_EPIC)
 * 4. Manager distributes Team Tasks → Hollon Tasks
 * 5. Validate hierarchical structure (depth levels)
 * 6. Validate assignments (Team → Hollon)
 *
 * This validates Phase 3.8 hierarchical distribution is working end-to-end.
 */
describe('Phase 3.8 Hierarchical Task Distribution (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  // Entity IDs created during the test
  let organizationId: string;
  let knowledgeTeamId: string;
  let performanceTeamId: string;
  let managerRoleId: string;
  let developerRoleId: string;
  let managerHollonId: string;
  let devHollon1Id: string;
  let devHollon2Id: string;
  let goalId: string;
  let projectId: string;
  let teamTaskIds: string[] = [];
  let hollonTaskIds: string[] = [];

  const testRunId = Date.now();

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    dataSource = moduleFixture.get<DataSource>(DataSource);

    // Clean up test data
    await dataSource.query(
      'TRUNCATE goals, tasks, projects, hollons, roles, teams, organizations RESTART IDENTITY CASCADE',
    );
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Hierarchical Distribution Complete Flow', () => {
    it('Step 1: Create Organization', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/organizations')
        .send({
          name: `Phase3.8 Test Org ${testRunId}`,
          description: 'Testing hierarchical task distribution',
          settings: {
            autonomousExecutionEnabled: true,
            maxConcurrentHolons: 10,
          },
        })
        .expect(201);

      organizationId = response.body.id;
      expect(organizationId).toBeDefined();
    });

    it('Step 2: Create Roles (Manager, Developer)', async () => {
      // Manager Role
      const managerResponse = await request(app.getHttpServer())
        .post('/api/roles')
        .send({
          name: 'Manager',
          description: 'Team manager role for task distribution',
          organizationId,
          capabilities: ['task-distribution', 'team-coordination', 'decision-making'],
        })
        .expect(201);

      managerRoleId = managerResponse.body.id;

      // Developer Role
      const devResponse = await request(app.getHttpServer())
        .post('/api/roles')
        .send({
          name: 'Developer',
          description: 'Software developer role',
          organizationId,
          capabilities: ['typescript', 'nestjs', 'postgresql'],
        })
        .expect(201);

      developerRoleId = devResponse.body.id;
      expect(managerRoleId).toBeDefined();
      expect(developerRoleId).toBeDefined();
    });

    it('Step 3: Create Teams (Knowledge Team, Performance Team)', async () => {
      // Knowledge Team
      const knowledgeTeamResponse = await request(app.getHttpServer())
        .post('/api/teams')
        .send({
          name: 'Knowledge Team',
          description: 'Handles knowledge system implementation',
          organizationId,
        })
        .expect(201);

      knowledgeTeamId = knowledgeTeamResponse.body.id;

      // Performance Team
      const performanceTeamResponse = await request(app.getHttpServer())
        .post('/api/teams')
        .send({
          name: 'Performance Team',
          description: 'Handles performance optimization',
          organizationId,
        })
        .expect(201);

      performanceTeamId = performanceTeamResponse.body.id;
      expect(knowledgeTeamId).toBeDefined();
      expect(performanceTeamId).toBeDefined();
    });

    it('Step 4: Create Manager Hollon', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/hollons')
        .send({
          name: 'Manager-KnowledgeTeam',
          organizationId,
          teamId: knowledgeTeamId,
          roleId: managerRoleId,
          personality: 'Strategic thinker focused on team efficiency',
        })
        .expect(201);

      managerHollonId = response.body.id;
      expect(managerHollonId).toBeDefined();
    });

    it('Step 5: Assign Manager to Knowledge Team', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/api/teams/${knowledgeTeamId}`)
        .send({
          managerHollonId: managerHollonId,
        })
        .expect(200);

      expect(response.body.managerHollonId).toBe(managerHollonId);
    });

    it('Step 6: Create Developer Hollons for Knowledge Team', async () => {
      // Developer 1
      const dev1Response = await request(app.getHttpServer())
        .post('/api/hollons')
        .send({
          name: 'DevBot-AI',
          organizationId,
          teamId: knowledgeTeamId,
          roleId: developerRoleId,
          personality: 'AI/ML specialist',
        })
        .expect(201);

      devHollon1Id = dev1Response.body.id;

      // Developer 2
      const dev2Response = await request(app.getHttpServer())
        .post('/api/hollons')
        .send({
          name: 'DevBot-Data',
          organizationId,
          teamId: knowledgeTeamId,
          roleId: developerRoleId,
          personality: 'Data engineering specialist',
        })
        .expect(201);

      devHollon2Id = dev2Response.body.id;
      expect(devHollon1Id).toBeDefined();
      expect(devHollon2Id).toBeDefined();
    });

    it('Step 7: Create Goal', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/goals')
        .send({
          title: 'Phase 4: Knowledge System & Self-Improvement',
          description:
            'Build autonomous knowledge extraction, learning, and self-improvement capabilities',
          organizationId,
          teamId: knowledgeTeamId,
          goalType: 'strategic',
          priority: 'P1',
          targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(), // 90 days
        })
        .expect(201);

      goalId = response.body.id;
      expect(goalId).toBeDefined();
    });

    it('Step 8: Decompose Goal with Team Distribution', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/goals/${goalId}/decompose`)
        .send({
          strategy: 'task_based',
          useTeamDistribution: true, // Enable hierarchical distribution
          autoAssign: false, // Don't auto-assign to hollons, assign to teams
        })
        .expect(201);

      expect(response.body.projectsCreated).toBeGreaterThan(0);
      expect(response.body.tasksCreated).toBeGreaterThan(0);
      expect(response.body.projects).toBeDefined();
      expect(response.body.tasks).toBeDefined();

      projectId = response.body.projects[0].id;
      
      // Filter for Team Tasks (TEAM_EPIC type)
      const teamTasks = response.body.tasks.filter(
        (task: any) => task.type === 'team_epic',
      );

      expect(teamTasks.length).toBeGreaterThan(0);
      teamTaskIds = teamTasks.map((t: any) => t.id);

      console.log(`Created ${teamTasks.length} Team Tasks (TEAM_EPIC)`);
    });

    it('Step 9: Verify Team Task Structure', async () => {
      for (const teamTaskId of teamTaskIds) {
        const response = await request(app.getHttpServer())
          .get(`/api/tasks/${teamTaskId}`)
          .expect(200);

        const teamTask = response.body;

        // Verify Team Task properties
        expect(teamTask.type).toBe('team_epic');
        expect(teamTask.depth).toBe(0); // Level 0 (Team Task)
        expect(teamTask.assignedTeamId).toBeDefined();
        expect(teamTask.assignedHollonId).toBeNull(); // Not assigned to individual hollon
        expect(teamTask.status).toBe('pending'); // Waiting for distribution

        console.log(
          `Team Task: "${teamTask.title}" assigned to team ${teamTask.assignedTeamId}`,
        );
      }
    });

    it('Step 10: Trigger Team Task Distribution (Manager)', async () => {
      // Get TeamTaskDistributionService from the app
      const orchestrationModule = app.get('OrchestrationModule');
      const teamDistributionService = app.get('TeamTaskDistributionService');
      
      expect(teamDistributionService).toBeDefined();

      for (const teamTaskId of teamTaskIds) {
        const subtasks = await teamDistributionService.distributeToTeam(teamTaskId);
        
        expect(subtasks).toBeDefined();
        expect(subtasks.length).toBeGreaterThan(0);
        expect(subtasks.length).toBeLessThanOrEqual(7); // Manager should create 3-7 subtasks
        
        hollonTaskIds.push(...subtasks.map((t: any) => t.id));
        
        console.log(
          `Manager distributed Team Task ${teamTaskId} into ${subtasks.length} subtasks`,
        );
      }

      expect(hollonTaskIds.length).toBeGreaterThan(0);
    });

    it('Step 11: Verify Hollon Task Structure', async () => {
      expect(hollonTaskIds.length).toBeGreaterThan(0);

      for (const hollonTaskId of hollonTaskIds) {
        const response = await request(app.getHttpServer())
          .get(`/api/tasks/${hollonTaskId}`)
          .expect(200);

        const hollonTask = response.body;

        // Verify Hollon Task properties
        expect(hollonTask.depth).toBe(1); // Level 1 (Hollon Task)
        expect(hollonTask.assignedHollonId).toBeDefined(); // Assigned to individual hollon
        expect(hollonTask.assignedTeamId).toBeNull(); // Not assigned to team
        expect(hollonTask.parentTaskId).toBeDefined(); // Has parent Team Task
        expect(hollonTask.status).toBe('ready'); // Ready for execution

        // Verify parent is a Team Task
        expect(teamTaskIds).toContain(hollonTask.parentTaskId);

        console.log(
          `Hollon Task: "${hollonTask.title}" assigned to hollon ${hollonTask.assignedHollonId}`,
        );
      }
    });

    it('Step 12: Verify Team Task Status Updated', async () => {
      for (const teamTaskId of teamTaskIds) {
        const response = await request(app.getHttpServer())
          .get(`/api/tasks/${teamTaskId}`)
          .expect(200);

        const teamTask = response.body;

        // After distribution, Team Task should be IN_PROGRESS
        expect(teamTask.status).toBe('in_progress');

        console.log(`Team Task ${teamTaskId} status: ${teamTask.status}`);
      }
    });

    it('Step 13: Verify Hierarchical Structure Integrity', async () => {
      // Load all tasks with relations
      const allTasks = await dataSource.query(
        `
        SELECT 
          t.id,
          t.title,
          t.type,
          t.depth,
          t.assigned_team_id,
          t.assigned_hollon_id,
          t.parent_task_id,
          t.status
        FROM tasks t
        WHERE t.project_id = $1
        ORDER BY t.depth ASC, t.created_at ASC
        `,
        [projectId],
      );

      console.log('\n=== Hierarchical Task Structure ===');
      
      // Level 0: Team Tasks
      const level0Tasks = allTasks.filter((t: any) => t.depth === 0);
      console.log(`\nLevel 0 (Team Tasks): ${level0Tasks.length}`);
      level0Tasks.forEach((t: any) => {
        console.log(`  - ${t.title} (${t.type}) → Team ${t.assigned_team_id}`);
      });

      // Level 1: Hollon Tasks
      const level1Tasks = allTasks.filter((t: any) => t.depth === 1);
      console.log(`\nLevel 1 (Hollon Tasks): ${level1Tasks.length}`);
      level1Tasks.forEach((t: any) => {
        console.log(
          `  - ${t.title} (${t.type}) → Hollon ${t.assigned_hollon_id} [Parent: ${t.parent_task_id}]`,
        );
      });

      // Assertions
      expect(level0Tasks.length).toBeGreaterThan(0);
      expect(level1Tasks.length).toBeGreaterThan(0);
      expect(level1Tasks.length).toBeGreaterThan(level0Tasks.length); // More hollon tasks than team tasks

      // Verify all Level 0 tasks are TEAM_EPIC
      level0Tasks.forEach((t: any) => {
        expect(t.type).toBe('team_epic');
        expect(t.assigned_team_id).not.toBeNull();
        expect(t.assigned_hollon_id).toBeNull();
      });

      // Verify all Level 1 tasks have hollon assignments
      level1Tasks.forEach((t: any) => {
        expect(t.assigned_hollon_id).not.toBeNull();
        expect(t.assigned_team_id).toBeNull();
        expect(t.parent_task_id).not.toBeNull();
      });
    });

    it('Step 14: Verify XOR Constraint (assignedTeamId XOR assignedHollonId)', async () => {
      const allTasks = await dataSource.query(
        `
        SELECT 
          id,
          title,
          assigned_team_id,
          assigned_hollon_id
        FROM tasks
        WHERE project_id = $1
        `,
        [projectId],
      );

      allTasks.forEach((task: any) => {
        const hasTeam = task.assigned_team_id !== null;
        const hasHollon = task.assigned_hollon_id !== null;

        // XOR: Either team OR hollon, but not both, and at least one
        const validXOR = (hasTeam && !hasHollon) || (!hasTeam && hasHollon);

        expect(validXOR).toBe(true);
      });

      console.log('✅ XOR constraint verified for all tasks');
    });
  });
});
