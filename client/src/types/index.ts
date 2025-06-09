export interface Group {
  id: string;
  name: string;
  participantCount: number;
  description?: string;
  owner?: string;
  creation?: number;
}

export interface ScheduledMessage {
  id: number;
  chatId: string;
  text: string;
  datetime: string;
}

export interface RecurringMessage {
  id: number;
  chatId: string;
  text: string;
  weekday: number;
  hour: number;
  minute: number;
}

export interface BotState {
  connected: boolean;
  phoneNumber: string | null;
  lastConnectionTime: Date | null;
  groups: Group[];
  sentMessagesCount: number;
}

export interface DashboardData {
  connected: boolean;
  phoneNumber: string | null;
  lastConnectionTime: Date | null;
  groups: Group[];
  scheduledMessages: ScheduledMessage[];
  recurringMessages: RecurringMessage[];
}

export interface WebSocketMessage {
  type: 'STATUS_UPDATE' | 'GROUPS_UPDATE' | 'MESSAGES_UPDATE' | 'CONNECTION_UPDATE';
  data: any;
}

export interface MessageFormData {
  chatId: string;
  text: string;
  isRecurring: boolean;
  // For scheduled messages
  scheduleDate?: string;
  scheduleTime?: string;
  // For recurring messages
  weekdays?: number[];
  hour?: number;
  minute?: number;
  ampm?: 'AM' | 'PM';
} 