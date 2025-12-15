import {
  Entity,
  Column,
  ManyToMany,
  Index,
} from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Task } from '../../task/entities/task.entity';

export enum KnowledgeCategory {
  TECHNICAL = 'technical',
  BUSINESS = 'business',
  PROCESS = 'process',
  ARCHITECTURE = 'architecture',
  TROUBLESHOOTING = 'troubleshooting',
  BEST_PRACTICE = 'best_practice',
  LESSON_LEARNED = 'lesson_learned',
  DOCUMENTATION = 'documentation',
}

@Entity('knowledge')
@Index(['category'])
@Index(['relevanceScore'])
@Index(['createdAt'])
export class Knowledge extends BaseEntity {
  @Column({
    type: 'enum',
    enum: KnowledgeCategory,
  })
  category: KnowledgeCategory;

  @Column({ type: 'text' })
  content: string;

  @Column({
    type: 'text',
    array: true,
    default: '{}',
  })
  tags: string[];

  @Column({
    type: 'jsonb',
    nullable: true,
  })
  metadata?: Record<string, unknown>;

  @Column({
    name: 'relevance_score',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 0,
  })
  relevanceScore: number;

  // Many-to-many relationship with Task through TaskKnowledge join table
  @ManyToMany(() => Task, (task) => task.knowledgeEntries)
  tasks?: Task[];
}
