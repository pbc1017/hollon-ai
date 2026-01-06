/**
 * Sample PR diff for testing code review functionality
 * Contains realistic code changes with various review points
 */

export const samplePrDiff = `diff --git a/src/modules/task/services/task.service.ts b/src/modules/task/services/task.service.ts
index 1234567..abcdefg 100644
--- a/src/modules/task/services/task.service.ts
+++ b/src/modules/task/services/task.service.ts
@@ -45,6 +45,18 @@ export class TaskService {
     return this.taskRepo.save(task);
   }

+  /**
+   * Assign task to a hollon
+   */
+  async assignTask(taskId: string, hollonId: string): Promise<Task> {
+    const task = await this.taskRepo.findOne({ where: { id: taskId } });
+    if (!task) {
+      throw new NotFoundException('Task not found');
+    }
+    task.assignedHollonId = hollonId;
+    return this.taskRepo.save(task);
+  }
+
   async updateTaskStatus(
     taskId: string,
     status: TaskStatus,
diff --git a/src/modules/hollon/services/hollon.service.ts b/src/modules/hollon/services/hollon.service.ts
index 7890abc..def1234 100644
--- a/src/modules/hollon/services/hollon.service.ts
+++ b/src/modules/hollon/services/hollon.service.ts
@@ -120,7 +120,7 @@ export class HollonService {
   async findAvailableHollon(
     organizationId: string,
   ): Promise<Hollon | null> {
-    return this.hollonRepo.findOne({
+    const hollon = await this.hollonRepo.findOne({
       where: {
         organizationId,
         status: HollonStatus.IDLE,
@@ -128,6 +128,13 @@ export class HollonService {
       relations: ['role', 'team'],
       order: { tasksCompleted: 'ASC' },
     });
+
+    if (hollon) {
+      // Update last assigned timestamp
+      hollon.metadata = { ...hollon.metadata, lastAssignedAt: new Date() };
+      await this.hollonRepo.save(hollon);
+    }
+    return hollon;
   }
 }`;

export const securityVulnerableDiff = `diff --git a/src/modules/auth/auth.controller.ts b/src/modules/auth/auth.controller.ts
index abc1234..def5678 100644
--- a/src/modules/auth/auth.controller.ts
+++ b/src/modules/auth/auth.controller.ts
@@ -20,8 +20,10 @@ export class AuthController {
   @Post('login')
   async login(@Body() loginDto: LoginDto) {
-    const user = await this.authService.validateUser(loginDto.email, loginDto.password);
-    return this.authService.generateToken(user);
+    const query = \`SELECT * FROM users WHERE email = '\${loginDto.email}' AND password = '\${loginDto.password}'\`;
+    const user = await this.db.query(query);
+    const token = jwt.sign({ userId: user.id }, 'hardcoded-secret-key');
+    return { token };
   }
 }`;

export const performanceIssueDiff = `diff --git a/src/modules/report/report.service.ts b/src/modules/report/report.service.ts
index 111aaaa..222bbbb 100644
--- a/src/modules/report/report.service.ts
+++ b/src/modules/report/report.service.ts
@@ -50,10 +50,15 @@ export class ReportService {
   async generateProjectReport(projectId: string): Promise<ReportData> {
     const project = await this.projectRepo.findOne({ where: { id: projectId } });

-    const tasks = await this.taskRepo.find({ where: { projectId } });
-
     const report: ReportData = {
       projectName: project.name,
-      totalTasks: tasks.length,
+      totalTasks: 0,
+      completedTasks: 0,
     };
+
+    // Count tasks by querying one by one
+    for (const task of await this.taskRepo.find({ where: { projectId } })) {
+      report.totalTasks++;
+      if (task.status === TaskStatus.COMPLETED) {
+        report.completedTasks++;
+      }
+    }

     return report;
   }
 }`;

export const architectureIssueDiff = `diff --git a/src/modules/task/task.controller.ts b/src/modules/task/task.controller.ts
index aaa1111..bbb2222 100644
--- a/src/modules/task/task.controller.ts
+++ b/src/modules/task/task.controller.ts
@@ -1,5 +1,6 @@
 import { Controller, Post, Body } from '@nestjs/common';
 import { TaskService } from './services/task.service';
+import { Repository } from 'typeorm';
+import { Hollon } from '../hollon/entities/hollon.entity';

 @Controller('tasks')
@@ -10,10 +11,25 @@ export class TaskController {
   @Post()
   async createTask(@Body() createTaskDto: CreateTaskDto) {
-    return this.taskService.createTask(createTaskDto);
+    // Directly access database in controller
+    const hollonRepo = this.taskService['hollonRepo'] as Repository<Hollon>;
+    const availableHollon = await hollonRepo.findOne({
+      where: { status: 'idle' },
+    });
+
+    const task = await this.taskService.createTask(createTaskDto);
+
+    if (availableHollon) {
+      task.assignedHollonId = availableHollon.id;
+      await this.taskService['taskRepo'].save(task);
+    }
+
+    return task;
   }
 }`;

/**
 * Get a sample diff for testing
 * @param type - Type of diff to return (clean, security, performance, architecture)
 */
export function getSampleDiff(
  type: 'clean' | 'security' | 'performance' | 'architecture' = 'clean',
): string {
  switch (type) {
    case 'security':
      return securityVulnerableDiff;
    case 'performance':
      return performanceIssueDiff;
    case 'architecture':
      return architectureIssueDiff;
    default:
      return samplePrDiff;
  }
}
