import {
  Entity,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Document } from './document.entity';
import { Task } from '../../task/entities/task.entity';

export enum ChangeType {
  CREATED = 'created',
  UPDATED = 'updated',
  CONTENT_CHANGED = 'content_changed',
  TAGS_CHANGED = 'tags_changed',
  METADATA_CHANGED = 'metadata_changed',
}

@Entity('knowledge_versions')
@Index(['documentId', 'version'], { unique: true })
@Index(['taskId'])
@Index(['createdAt'])
export class KnowledgeVersion extends BaseEntity {
  @Column({ name: 'document_id' })
  documentId: string;

  @Column({ name: 'task_id' })
  taskId: string;

  @Column({ type: 'int' })
  version: number;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  content: string;

  @Column({ type: 'text', array: true, nullable: true })
  tags: string[];

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown>;

  @Column({
    type: 'enum',
    enum: ChangeType,
    array: true,
  })
  changeTypes: ChangeType[];

  @Column({ type: 'text', nullable: true })
  changeSummary: string | null;

  @Column({ type: 'jsonb', nullable: true })
  diff: {
    title?: {
      old: string;
      new: string;
    };
    content?: {
      additions: number;
      deletions: number;
      changes: Array<{
        type: 'add' | 'remove' | 'modify';
        line?: number;
        content: string;
      }>;
    };
    tags?: {
      added: string[];
      removed: string[];
    };
    metadata?: {
      added: Record<string, unknown>;
      removed: string[];
      modified: Record<string, unknown>;
    };
  };

  @CreateDateColumn({ name: 'created_at' })
  declare createdAt: Date;

  // Relations
  @ManyToOne(() => Document, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'document_id' })
  document: Document;

  @ManyToOne(() => Task, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'task_id' })
  task: Task;
}
