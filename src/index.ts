import { createBot } from "./whatsapp";
import { setupScheduler } from "./scheduler";
import { dbOps } from "./db";
import { setCurrentSocket } from "./socket-manager";

async function startBot(): Promise<void> {
  console.log("🚀 Starting WhatsApp Bot MVP...");
  
  try {
    // Test database connection
    console.log("📀 Testing database connection...");
    
    // Initialize WhatsApp bot
    console.log("📱 Initializing WhatsApp connection...");
    const sock = await createBot();
    setCurrentSocket(sock);
    
    // Wait for connection to be fully established before setting up scheduler
    sock.ev.on("connection.update", (update) => {
      if (update.connection === "open") {
        // Setup message scheduler only after connection is open
        setupScheduler();
        // Remove the listener after first successful connection
        sock.ev.removeAllListeners("connection.update");
      }
    });
    
    console.log("✅ Bot started successfully!");
    console.log("📋 Next steps:");
    console.log("   1. Scan the QR code with WhatsApp");
    console.log("   2. Add scheduled/recurring messages to test");
    console.log("   3. Send 'ping' to test message handling");
    
  } catch (error) {
    console.error("❌ Failed to start bot:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Received SIGINT, shutting down gracefully...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("\n🛑 Received SIGTERM, shutting down gracefully...");
  process.exit(0);
});

process.on("uncaughtException", (error) => {
  console.error("❌ Uncaught Exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("❌ Unhandled Rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Start the bot
startBot();