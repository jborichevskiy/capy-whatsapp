export interface ScheduledMessage {
  id?: number;
  chatId: string;
  text: string;
  datetime: string;
}

export interface RecurringMessage {
  id?: number;
  chatId: string;
  text: string;
  weekday: number; // 0-6 (Sunday to Saturday)
  hour: number;    // 0-23
  minute: number;  // 0-59
  lastSent?: string;
}

export interface BotConfig {
  authDir: string;
  dbPath: string;
  scheduleInterval: string; // cron pattern
}

export interface MessageHandler {
  handleMessage: (msg: any) => Promise<void>;
  handleReaction: (reaction: any) => Promise<void>;
  handleChatUpdate: (update: any) => Promise<void>;
}

export interface DatabaseOperations {
  insertScheduledMessage: (message: Omit<ScheduledMessage, 'id'>) => number;
  insertRecurringMessage: (message: Omit<RecurringMessage, 'id' | 'lastSent'>) => number;
  getScheduledMessages: (before: Date) => ScheduledMessage[];
  getRecurringMessages: (weekday: number, hour: number, minute: number) => RecurringMessage[];
  deleteScheduledMessage: (id: number) => void;
  updateRecurringMessageLastSent: (id: number, timestamp: string) => void;
} 