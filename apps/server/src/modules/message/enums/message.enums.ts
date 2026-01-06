export enum MessageType {
  TASK_ASSIGNMENT = 'task_assignment',
  TASK_UPDATE = 'task_update',
  TASK_COMPLETION = 'task_completion',
  QUESTION = 'question',
  RESPONSE = 'response',
  DELEGATION_REQUEST = 'delegation_request',
  DELEGATION_APPROVAL = 'delegation_approval',
  COLLABORATION_REQUEST = 'collaboration_request',
  REVIEW_REQUEST = 'review_request',
  CONFLICT_NOTIFICATION = 'conflict_notification',
  GENERAL = 'general',
}

export enum ParticipantType {
  HOLLON = 'hollon',
  HUMAN = 'human',
  SYSTEM = 'system',
}

export enum MessagePriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

export enum ConversationContext {
  TASK = 'task',
  COLLABORATION = 'collaboration',
  ESCALATION = 'escalation',
  REVIEW = 'review',
  GENERAL = 'general',
}
