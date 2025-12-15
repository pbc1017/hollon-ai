import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  PrimaryColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { Task } from '../../task/entities/task.entity';
import { Knowledge } from './knowledge.entity';

@Entity('task_knowledge')
@Index(['taskId', 'knowledgeId'], { unique: true })
@Index(['taskId'])
@Index(['knowledgeId'])
@Index(['createdAt'])
export class TaskKnowledge {
  @PrimaryColumn({ name: 'task_id', type: 'uuid' })
  taskId: string;

  @PrimaryColumn({ name: 'knowledge_id', type: 'uuid' })
  knowledgeId: string;

  @Column({
    name: 'context_notes',
    type: 'text',
    nullable: true,
  })
  contextNotes?: string;

  @Column({
    name: 'application_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
    nullable: true,
  })
  applicationScore?: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  // Relations
  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: Task;

  @ManyToOne(() => Knowledge, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'knowledge_id' })
  knowledge: Knowledge;
}
