import { Hollon } from '../../hollon/entities/hollon.entity';
import { Task } from '../../task/entities/task.entity';
import { Message } from '../../message/entities/message.entity';

export type WSEvent =
  | {
      type: 'holon_status_changed';
      hollonId: string;
      organizationId: string;
      oldStatus: string;
      newStatus: string;
    }
  | { type: 'holon_created'; hollon: Hollon }
  | { type: 'holon_deleted'; hollonId: string }
  | { type: 'message_received'; message: Message }
  | { type: 'task_updated'; task: Task }
  | {
      type: 'approval_requested';
      id: string;
      organizationId: string;
      hollonId: string | null;
      approvalType: string;
      title: string;
      escalationLevel: number;
    }
  | { type: 'log_entry'; hollonId: string; log: string };
