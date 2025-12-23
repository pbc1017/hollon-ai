import { Entity, Column, ManyToOne, JoinColumn, Index } from 'typeorm';
import { BaseEntity } from '../../../common/entities/base.entity';
import { Document } from './document.entity';

/**
 * DocumentEmbedding Entity
 * Stores vector embeddings for documents to enable similarity search and RAG
 * Vector embeddings are generated from document content using OpenAI embeddings (1536 dimensions)
 */
@Entity('document_embeddings')
@Index(['documentId'])
@Index(['documentId', 'createdAt'])
export class DocumentEmbedding extends BaseEntity {
  @Column({ name: 'document_id', type: 'uuid' })
  documentId: string;

  @Column({
    name: 'embedding',
    type: 'vector',
    precision: 1536, // OpenAI embedding dimension
  })
  embedding: string; // Stored as string representation of vector

  @Column({
    name: 'model',
    type: 'varchar',
    length: 100,
    default: 'text-embedding-3-small',
  })
  model: string;

  // Relations
  @ManyToOne(() => Document, (document) => document.embeddings, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'document_id' })
  document: Document;
}
