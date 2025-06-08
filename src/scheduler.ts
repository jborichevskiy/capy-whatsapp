import cron from "node-cron";
import { dbOps } from "./db";
import { WASocket } from "@whiskeysockets/baileys";

export function setupScheduler(sock: WASocket): void {
  console.log("🕐 Setting up message scheduler (runs every minute)");
  
  // Every minute
  cron.schedule("* * * * *", async () => {
    const now = new Date();
    
    try {
      // Handle scheduled messages
      const scheduledMessages = dbOps.getScheduledMessages(now);
      
      for (const msg of scheduledMessages) {
        try {
          console.log(`📤 Sending scheduled message to ${msg.chatId}: "${msg.text}"`);
          await sock.sendMessage(msg.chatId, { text: msg.text });
          dbOps.deleteScheduledMessage(msg.id!);
          console.log(`✅ Scheduled message sent and removed (ID: ${msg.id})`);
        } catch (error) {
          console.error(`❌ Failed to send scheduled message (ID: ${msg.id}):`, error);
        }
      }

      // Handle recurring messages
      const recurringMessages = dbOps.getRecurringMessages(
        now.getDay(), 
        now.getHours(), 
        now.getMinutes()
      );

      for (const msg of recurringMessages) {
        try {
          console.log(`🔄 Sending recurring message to ${msg.chatId}: "${msg.text}"`);
          await sock.sendMessage(msg.chatId, { text: msg.text });
          dbOps.updateRecurringMessageLastSent(msg.id!, now.toISOString());
          console.log(`✅ Recurring message sent (ID: ${msg.id})`);
        } catch (error) {
          console.error(`❌ Failed to send recurring message (ID: ${msg.id}):`, error);
        }
      }
      
    } catch (error) {
      console.error("❌ Error in scheduler:", error);
    }
  });
}