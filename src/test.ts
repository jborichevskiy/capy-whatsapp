#!/usr/bin/env ts-node
import { 
  scheduleMessage, 
  scheduleRecurringMessage, 
  scheduleMessageInMinutes,
  getPendingMessages,
  getAllRecurringMessages,
  formatChatId
} from "./utils";

/**
 * Test script for the WhatsApp bot
 * Run with: npx ts-node src/test.ts
 */

function showUsage() {
  console.log("📋 WhatsApp Bot Test Utilities");
  console.log("Usage: npx ts-node src/test.ts [command] [args...]");
  console.log("");
  console.log("Commands:");
  console.log("  schedule <chatId> <text> <minutes>  - Schedule message X minutes from now");
  console.log("  recurring <chatId> <text> <day> <hour> <minute> - Schedule recurring message");
  console.log("  list-pending                        - Show all pending scheduled messages");
  console.log("  list-recurring                      - Show all recurring messages");
  console.log("  test-schedule <chatId>              - Add a test message 1 minute from now");
  console.log("");
  console.log("Examples:");
  console.log("  npx ts-node src/test.ts schedule 1234567890@s.whatsapp.net \"Hello!\" 5");
  console.log("  npx ts-node src/test.ts recurring 1234567890@s.whatsapp.net \"Good morning!\" 1 9 0");
  console.log("  npx ts-node src/test.ts test-schedule 1234567890@s.whatsapp.net");
  console.log("");
  console.log("Note: Get chat IDs by sending messages to the bot and checking logs");
}

function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    showUsage();
    return;
  }
  
  const command = args[0];
  
  switch (command) {
    case "schedule":
      if (args.length !== 4) {
        console.error("❌ Usage: schedule <chatId> <text> <minutes>");
        return;
      }
      const [, chatId1, text1, minutesStr] = args;
      const minutes = parseInt(minutesStr);
      if (isNaN(minutes)) {
        console.error("❌ Minutes must be a number");
        return;
      }
      scheduleMessageInMinutes(chatId1, text1, minutes);
      break;
      
    case "recurring":
      if (args.length !== 6) {
        console.error("❌ Usage: recurring <chatId> <text> <weekday> <hour> <minute>");
        console.error("   weekday: 0=Sunday, 1=Monday, ..., 6=Saturday");
        return;
      }
      const [, chatId2, text2, dayStr, hourStr, minuteStr] = args;
      const weekday = parseInt(dayStr);
      const hour = parseInt(hourStr);
      const minute = parseInt(minuteStr);
      
      if (isNaN(weekday) || weekday < 0 || weekday > 6) {
        console.error("❌ Weekday must be 0-6 (Sunday=0, Saturday=6)");
        return;
      }
      if (isNaN(hour) || hour < 0 || hour > 23) {
        console.error("❌ Hour must be 0-23");
        return;
      }
      if (isNaN(minute) || minute < 0 || minute > 59) {
        console.error("❌ Minute must be 0-59");
        return;
      }
      
      scheduleRecurringMessage(chatId2, text2, weekday, hour, minute);
      break;
      
    case "list-pending":
      console.log("📅 Pending Scheduled Messages:");
      const pending = getPendingMessages();
      if (pending.length === 0) {
        console.log("   (none)");
      } else {
        pending.forEach(msg => {
          console.log(`   [${msg.id}] ${formatChatId(msg.chatId)} - "${msg.text}" at ${new Date(msg.datetime).toLocaleString()}`);
        });
      }
      break;
      
    case "list-recurring":
      console.log("🔄 Recurring Messages:");
      const recurring = getAllRecurringMessages();
      if (recurring.length === 0) {
        console.log("   (none)");
      } else {
        const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        recurring.forEach(msg => {
          console.log(`   [${msg.id}] ${formatChatId(msg.chatId)} - "${msg.text}" every ${weekdays[msg.weekday]} at ${msg.hour.toString().padStart(2, '0')}:${msg.minute.toString().padStart(2, '0')}`);
        });
      }
      break;
      
    case "test-schedule":
      if (args.length !== 2) {
        console.error("❌ Usage: test-schedule <chatId>");
        return;
      }
      const testChatId = args[1];
      scheduleMessageInMinutes(testChatId, "🤖 Test message from WhatsApp bot!", 1);
      console.log("✅ Test message scheduled for 1 minute from now");
      break;
      
    default:
      console.error(`❌ Unknown command: ${command}`);
      showUsage();
  }
}

main(); 