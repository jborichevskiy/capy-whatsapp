import { dbOps } from "./db";
import { ScheduledMessage, RecurringMessage } from "./types";

/**
 * Schedule a one-time message
 */
export function scheduleMessage(
  chatId: string, 
  text: string, 
  datetime: Date | string
): number {
  const dateStr = typeof datetime === 'string' ? datetime : datetime.toISOString();
  
  const id = dbOps.insertScheduledMessage({
    chatId,
    text,
    datetime: dateStr
  });
  
  console.log(`📅 Scheduled message (ID: ${id}) for ${dateStr}`);
  console.log(`   To: ${chatId}`);
  console.log(`   Text: "${text}"`);
  
  return id;
}

/**
 * Schedule a recurring message
 * @param weekday 0-6 (Sunday to Saturday)
 * @param hour 0-23
 * @param minute 0-59
 */
export function scheduleRecurringMessage(
  chatId: string,
  text: string,
  weekday: number,
  hour: number,
  minute: number
): number {
  const id = dbOps.insertRecurringMessage({
    chatId,
    text,
    weekday,
    hour,
    minute
  });
  
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  console.log(`🔄 Scheduled recurring message (ID: ${id})`);
  console.log(`   Every ${weekdays[weekday]} at ${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
  console.log(`   To: ${chatId}`);
  console.log(`   Text: "${text}"`);
  
  return id;
}

/**
 * Helper to schedule a message X minutes from now
 */
export function scheduleMessageInMinutes(
  chatId: string,
  text: string,
  minutes: number
): number {
  const futureDate = new Date(Date.now() + minutes * 60 * 1000);
  return scheduleMessage(chatId, text, futureDate);
}

/**
 * Helper to get all pending scheduled messages
 */
export function getPendingMessages(): ScheduledMessage[] {
  const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year from now
  return dbOps.getScheduledMessages(futureDate);
}

/**
 * Helper to get all recurring messages
 */
export function getAllRecurringMessages(): RecurringMessage[] {
  return dbOps.getAllRecurringMessages();
}

/**
 * Format a chat ID for display (truncate long group IDs)
 */
export function formatChatId(chatId: string): string {
  if (chatId.includes('@g.us')) {
    return `Group ${chatId.substring(0, 8)}...`;
  }
  return chatId.replace('@s.whatsapp.net', '');
}

/**
 * Validate chat ID format
 */
export function isValidChatId(chatId: string): boolean {
  return chatId.includes('@s.whatsapp.net') || chatId.includes('@g.us');
} 