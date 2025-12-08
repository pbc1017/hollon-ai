import { Task } from '../../task/entities/task.entity';

export class StandupResponse {
  hollonId: string;
  hollonName: string;
  completedYesterday: Task[];
  todayPlan: Task[];
  blockers: {
    taskId: string;
    reason: string;
  }[];
}
