import Database from "better-sqlite3";
import { ScheduledMessage, RecurringMessage, DatabaseOperations } from "./types";

import { existsSync, mkdirSync } from "fs";
import path from "path";

// Ensure data directory exists
const dataDir = process.env.DATA_DIR || "./data";
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, "bot.sqlite");
const db = new Database(dbPath);

// One-time init
db.exec(`
CREATE TABLE IF NOT EXISTS scheduled_messages (
  id INTEGER PRIMARY KEY,
  chatId TEXT NOT NULL,
  text TEXT NOT NULL,
  datetime TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recurring_messages (
  id INTEGER PRIMARY KEY,
  chatId TEXT NOT NULL,
  text TEXT NOT NULL,
  weekday INTEGER NOT NULL,
  hour INTEGER NOT NULL,
  minute INTEGER NOT NULL,
  lastSent TEXT
);
`);

// Prepared statements for better performance
const insertScheduledStmt = db.prepare(`
  INSERT INTO scheduled_messages (chatId, text, datetime) VALUES (?, ?, ?)
`);

const insertRecurringStmt = db.prepare(`
  INSERT INTO recurring_messages (chatId, text, weekday, hour, minute) VALUES (?, ?, ?, ?, ?)
`);

const getScheduledStmt = db.prepare(`
  SELECT * FROM scheduled_messages WHERE datetime <= ? ORDER BY datetime
`);

const getRecurringStmt = db.prepare(`
  SELECT * FROM recurring_messages 
  WHERE weekday = ? AND hour = ? AND minute = ? 
  AND (lastSent IS NULL OR date(lastSent) < date(?))
`);

const getAllRecurringStmt = db.prepare(`
  SELECT * FROM recurring_messages ORDER BY weekday, hour, minute
`);

const deleteScheduledStmt = db.prepare(`
  DELETE FROM scheduled_messages WHERE id = ?
`);

const deleteRecurringStmt = db.prepare(`
  DELETE FROM recurring_messages WHERE id = ?
`);

const updateRecurringStmt = db.prepare(`
  UPDATE recurring_messages SET lastSent = ? WHERE id = ?
`);

// Database operations
export const dbOps: DatabaseOperations = {
  insertScheduledMessage: (message: Omit<ScheduledMessage, 'id'>): number => {
    const result = insertScheduledStmt.run(message.chatId, message.text, message.datetime);
    return result.lastInsertRowid as number;
  },

  insertRecurringMessage: (message: Omit<RecurringMessage, 'id' | 'lastSent'>): number => {
    const result = insertRecurringStmt.run(
      message.chatId, 
      message.text, 
      message.weekday, 
      message.hour, 
      message.minute
    );
    return result.lastInsertRowid as number;
  },

  getScheduledMessages: (before: Date): ScheduledMessage[] => {
    return getScheduledStmt.all(before.toISOString()) as ScheduledMessage[];
  },

  getRecurringMessages: (weekday: number, hour: number, minute: number): RecurringMessage[] => {
    const today = new Date().toISOString().split('T')[0];
    return getRecurringStmt.all(weekday, hour, minute, today) as RecurringMessage[];
  },

  getAllRecurringMessages: (): RecurringMessage[] => {
    return getAllRecurringStmt.all() as RecurringMessage[];
  },

  deleteScheduledMessage: (id: number): { changes: number } => {
    const result = deleteScheduledStmt.run(id);
    return { changes: result.changes };
  },

  deleteRecurringMessage: (id: number): { changes: number } => {
    const result = deleteRecurringStmt.run(id);
    return { changes: result.changes };
  },

  updateRecurringMessageLastSent: (id: number, timestamp: string): void => {
    updateRecurringStmt.run(timestamp, id);
  }
};

export default db;