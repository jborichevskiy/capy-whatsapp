import cron from "node-cron";
import { dbOps } from "./db";
import { getCurrentSocket } from "./socket-manager";

let schedulerStartTime: Date | null = null;

export function setupScheduler(): void {
  console.log("🕐 Setting up message scheduler (runs every minute)");
  
  // Record when scheduler starts to avoid sending messages from startup minute
  schedulerStartTime = new Date();
  
  // Every minute
  cron.schedule("* * * * *", async () => {
    const sock = getCurrentSocket();
    
    // Check if socket is ready
    if (!sock || !sock.user) {
      console.log("⏳ Socket not ready yet, skipping scheduler run");
      return;
    }
    
    // Skip the first minute after startup to avoid duplicate sends
    if (schedulerStartTime && new Date().getTime() - schedulerStartTime.getTime() < 60000) {
      console.log("⏳ Skipping scheduler run in first minute after startup");
      return;
    }
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
        } catch (error: any) {
          console.error(`❌ Failed to send scheduled message (ID: ${msg.id}):`, error);
          // If connection is closed, log more details
          if (error?.message?.includes('Connection Closed')) {
            console.log('🔌 Socket state:', { 
              hasSocket: !!sock, 
              hasUser: !!sock?.user,
              userId: sock?.user?.id 
            });
          }
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
          console.log(`🔄 Sending recurring message`);
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