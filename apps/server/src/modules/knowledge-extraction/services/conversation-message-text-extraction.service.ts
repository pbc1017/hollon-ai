import { Injectable } from '@nestjs/common';
import { Message } from '../../message/entities/message.entity';
import { Conversation } from '../../message/entities/conversation.entity';
import {
  MessageType,
  ParticipantType,
  MessagePriority,
  ConversationContext,
} from '../../message/enums/message.enums';

/**
 * Structured text data extracted from a conversation message
 */
export interface ExtractedMessageText {
  /** Unique identifier of the message */
  messageId: string;

  /** Type of sender (hollon, human, system) */
  senderType: ParticipantType;

  /** ID of the sender (null for system messages) */
  senderId: string | null;

  /** Type of recipient */
  recipientType: ParticipantType;

  /** ID of the recipient */
  recipientId: string;

  /** Type of message */
  contentType: MessageType;

  /** Priority level of the message */
  priority: MessagePriority;

  /** Main text content */
  textContent: string;

  /** When the message was created */
  timestamp: Date;

  /** Whether this message requires a response */
  requiresResponse: boolean;

  /** Whether the message has been read */
  isRead: boolean;

  /** Additional metadata from the message */
  metadata: Record<string, any>;

  /** ID of the message this is replying to, if any */
  replyToMessageId: string | null;

  /** Conversation ID this message belongs to */
  conversationId: string;
}

/**
 * Structured data extracted from a conversation
 */
export interface ExtractedConversationContext {
  /** Unique identifier of the conversation */
  conversationId: string;

  /** First participant type */
  participant1Type: ParticipantType;

  /** First participant ID */
  participant1Id: string;

  /** Second participant type */
  participant2Type: ParticipantType;

  /** Second participant ID */
  participant2Id: string;

  /** Context of the conversation */
  context: ConversationContext;

  /** Additional context ID if applicable */
  contextId: string | null;

  /** When the conversation was created */
  createdAt: Date;

  /** When the conversation was last updated */
  updatedAt: Date;

  /** Last message timestamp */
  lastMessageAt: Date | null;

  /** Count of unread messages */
  unreadCount: number;
}

/**
 * Complete extracted data from message(s) with conversation context
 */
export interface ExtractedConversationData {
  /** Conversation context information */
  conversation: ExtractedConversationContext;

  /** Extracted message(s) */
  messages: ExtractedMessageText[];

  /** Combined text content from all messages */
  fullText: string;

  /** Number of messages */
  messageCount: number;
}

/**
 * Service for extracting and structuring text content from conversation messages.
 * This service handles the conversion of Message and Conversation entities into
 * structured data suitable for knowledge base storage and NLP processing.
 */
@Injectable()
export class ConversationMessageTextExtractionService {
  /**
   * Extract structured text data from a single message
   * @param message - The message entity to extract from
   * @returns Structured message text data
   */
  extractFromMessage(message: Message): ExtractedMessageText {
    return {
      messageId: message.id,
      senderType: message.fromType,
      senderId: message.fromId,
      recipientType: message.toType,
      recipientId: message.toId,
      contentType: message.messageType,
      priority: message.priority,
      textContent: this.cleanTextContent(message.content),
      timestamp: message.createdAt,
      requiresResponse: message.requiresResponse,
      isRead: message.isRead,
      metadata: message.metadata || {},
      replyToMessageId: message.repliedToId,
      conversationId: message.conversationId,
    };
  }

  /**
   * Extract structured context data from a conversation
   * @param conversation - The conversation entity to extract from
   * @returns Structured conversation context data
   */
  extractConversationContext(
    conversation: Conversation,
  ): ExtractedConversationContext {
    return {
      conversationId: conversation.id,
      participant1Type: conversation.participant1Type,
      participant1Id: conversation.participant1Id,
      participant2Type: conversation.participant2Type,
      participant2Id: conversation.participant2Id,
      context: conversation.context,
      contextId: conversation.contextId,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      lastMessageAt: conversation.lastMessageAt,
      unreadCount: conversation.unreadCount,
    };
  }

  /**
   * Extract complete conversation data including messages and context
   * @param conversation - The conversation entity with messages relation loaded
   * @returns Complete extracted conversation data
   */
  extractConversationWithMessages(
    conversation: Conversation,
  ): ExtractedConversationData {
    if (!conversation.messages || conversation.messages.length === 0) {
      throw new Error(
        'Conversation must have messages relation loaded with at least one message',
      );
    }

    const messages = conversation.messages.map((msg) =>
      this.extractFromMessage(msg),
    );

    // Combine all message text content, ordered by timestamp
    const sortedMessages = [...messages].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );

    const fullText = sortedMessages
      .map((msg) => this.formatMessageForFullText(msg))
      .join('\n\n');

    return {
      conversation: this.extractConversationContext(conversation),
      messages,
      fullText,
      messageCount: messages.length,
    };
  }

  /**
   * Extract text from multiple messages without conversation context
   * Useful for processing a list of messages from a conversation history
   * @param messages - Array of message entities
   * @returns Array of structured message text data
   */
  extractFromMessages(messages: Message[]): ExtractedMessageText[] {
    return messages.map((msg) => this.extractFromMessage(msg));
  }

  /**
   * Extract and combine text content from multiple messages into a single text
   * @param messages - Array of message entities
   * @returns Combined text content with message metadata
   */
  extractCombinedText(messages: Message[]): string {
    const extracted = this.extractFromMessages(messages);

    // Sort by timestamp
    const sorted = [...extracted].sort(
      (a, b) => a.timestamp.getTime() - b.timestamp.getTime(),
    );

    return sorted.map((msg) => this.formatMessageForFullText(msg)).join('\n\n');
  }

  /**
   * Format a message for inclusion in combined full text
   * Includes sender information and content
   * @param message - Extracted message data
   * @returns Formatted message text
   */
  private formatMessageForFullText(message: ExtractedMessageText): string {
    const senderLabel = this.getSenderLabel(message);
    const timestamp = message.timestamp.toISOString();
    const contentType = this.formatContentType(message.contentType);

    return `[${timestamp}] ${senderLabel} (${contentType}): ${message.textContent}`;
  }

  /**
   * Get a human-readable label for the message sender
   * @param message - Extracted message data
   * @returns Sender label string
   */
  private getSenderLabel(message: ExtractedMessageText): string {
    if (message.senderType === ParticipantType.SYSTEM) {
      return 'System';
    }

    const typeLabel =
      message.senderType === ParticipantType.HOLLON ? 'Hollon' : 'Human';
    const idShort = message.senderId ? message.senderId.substring(0, 8) : 'N/A';

    return `${typeLabel}-${idShort}`;
  }

  /**
   * Format message content type for display
   * @param contentType - Message type enum value
   * @returns Formatted content type string
   */
  private formatContentType(contentType: MessageType): string {
    return contentType
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (l) => l.toUpperCase());
  }

  /**
   * Clean and normalize text content
   * Removes excessive whitespace and normalizes line breaks
   * @param content - Raw text content
   * @returns Cleaned text content
   */
  private cleanTextContent(content: string): string {
    if (!content) {
      return '';
    }

    return (
      content
        // Normalize line breaks
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        // Remove excessive blank lines (more than 2 consecutive newlines)
        .replace(/\n{3,}/g, '\n\n')
        // Normalize whitespace within lines
        .replace(/[^\S\n]+/g, ' ')
        // Trim each line
        .split('\n')
        .map((line) => line.trim())
        .join('\n')
        // Final trim
        .trim()
    );
  }

  /**
   * Filter messages by content type
   * @param messages - Array of extracted messages
   * @param contentTypes - Message types to include
   * @returns Filtered messages
   */
  filterByContentType(
    messages: ExtractedMessageText[],
    contentTypes: MessageType[],
  ): ExtractedMessageText[] {
    const typeSet = new Set(contentTypes);
    return messages.filter((msg) => typeSet.has(msg.contentType));
  }

  /**
   * Filter messages by sender type
   * @param messages - Array of extracted messages
   * @param senderTypes - Participant types to include
   * @returns Filtered messages
   */
  filterBySenderType(
    messages: ExtractedMessageText[],
    senderTypes: ParticipantType[],
  ): ExtractedMessageText[] {
    const typeSet = new Set(senderTypes);
    return messages.filter((msg) => typeSet.has(msg.senderType));
  }

  /**
   * Filter messages by priority
   * @param messages - Array of extracted messages
   * @param priorities - Priority levels to include
   * @returns Filtered messages
   */
  filterByPriority(
    messages: ExtractedMessageText[],
    priorities: MessagePriority[],
  ): ExtractedMessageText[] {
    const prioritySet = new Set(priorities);
    return messages.filter((msg) => prioritySet.has(msg.priority));
  }

  /**
   * Get messages that require a response
   * @param messages - Array of extracted messages
   * @returns Messages requiring response
   */
  getMessagesRequiringResponse(
    messages: ExtractedMessageText[],
  ): ExtractedMessageText[] {
    return messages.filter((msg) => msg.requiresResponse && !msg.isRead);
  }

  /**
   * Group messages by content type
   * @param messages - Array of extracted messages
   * @returns Map of content type to messages
   */
  groupByContentType(
    messages: ExtractedMessageText[],
  ): Map<MessageType, ExtractedMessageText[]> {
    const grouped = new Map<MessageType, ExtractedMessageText[]>();

    for (const message of messages) {
      const existing = grouped.get(message.contentType) || [];
      grouped.set(message.contentType, [...existing, message]);
    }

    return grouped;
  }

  /**
   * Get conversation statistics from extracted data
   * @param data - Extracted conversation data
   * @returns Statistics object
   */
  getConversationStatistics(data: ExtractedConversationData): {
    totalMessages: number;
    messagesByType: Record<string, number>;
    messagesBySender: Record<string, number>;
    averageMessageLength: number;
    messagesRequiringResponse: number;
    unreadMessages: number;
  } {
    const messagesByType: Record<string, number> = {};
    const messagesBySender: Record<string, number> = {};
    let totalLength = 0;
    let requiresResponseCount = 0;
    let unreadCount = 0;

    for (const message of data.messages) {
      // Count by type
      messagesByType[message.contentType] =
        (messagesByType[message.contentType] || 0) + 1;

      // Count by sender
      const senderKey = `${message.senderType}-${message.senderId || 'system'}`;
      messagesBySender[senderKey] = (messagesBySender[senderKey] || 0) + 1;

      // Accumulate text length
      totalLength += message.textContent.length;

      // Count special cases
      if (message.requiresResponse && !message.isRead) {
        requiresResponseCount++;
      }
      if (!message.isRead) {
        unreadCount++;
      }
    }

    return {
      totalMessages: data.messageCount,
      messagesByType,
      messagesBySender,
      averageMessageLength:
        data.messageCount > 0 ? totalLength / data.messageCount : 0,
      messagesRequiringResponse: requiresResponseCount,
      unreadMessages: unreadCount,
    };
  }
}
