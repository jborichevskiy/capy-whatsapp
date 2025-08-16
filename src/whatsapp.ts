import makeWASocket, { 
  useMultiFileAuthState, 
  DisconnectReason,
  WASocket
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import * as qrcode from "qrcode-terminal";
import { existsSync, rmSync, readdirSync } from "fs";
import * as https from "https";

// Message handlers
export async function handleMessage(msg: any): Promise<void> {
  const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
  const fromUser = msg.key.remoteJid;
  
  if (messageText && fromUser) {
    console.log(`📨 Message received`);
    
    // Simple ping/pong for testing
    if (messageText.toLowerCase() === 'ping') {
      // We'll handle responses in the main bot logic if needed
      console.log("🏓 Ping command detected");
    }
  }
}

export async function handleReaction(reaction: any): Promise<void> {
  console.log("👍 Reaction received");
  // Add reaction handling logic here
}

export async function handleChatUpdate(update: any): Promise<void> {
  console.log("💬 Chat update received");
  // Add chat update handling logic here
}

// Function to check if auth exists
export function hasExistingAuth(): boolean {
  return existsSync("auth/creds.json");
}

// Function to clean up auth files
export function cleanupAuth(): void {
  if (existsSync("auth")) {
    console.log("🗑️  Cleaning up authentication files in persistent volume...");
    try {
      let filesRemoved = 0;
      
      // Remove creds.json if it exists
      const credsPath = "auth/creds.json";
      if (existsSync(credsPath)) {
        rmSync(credsPath, { force: true });
        filesRemoved++;
        console.log("✅ Removed creds.json");
      }
      
      // Remove all auth-related files
      const files = readdirSync("auth");
      files.forEach((file: string) => {
        // Remove all WhatsApp auth files
        if (file.startsWith("app-state-sync-key-") || 
            file.startsWith("pre-key-") || 
            file.startsWith("sender-key-") || 
            file.startsWith("session-") ||
            file.startsWith("app-state-sync-version") ||
            file === "creds.json") {
          try {
            rmSync(`auth/${file}`, { force: true });
            filesRemoved++;
          } catch (e) {
            console.log(`⚠️  Could not remove ${file}: ${e}`);
          }
        }
      });
      
      if (filesRemoved > 0) {
        console.log(`✅ Cleaned up ${filesRemoved} authentication files`);
      } else {
        console.log("ℹ️  No authentication files found to clean");
      }
    } catch (error) {
      console.error("❌ Failed to clean auth files:", error);
      console.log("💡 You may need to manually clear the auth volume");
    }
  } else {
    console.log("ℹ️  No auth directory found");
  }
}

// Custom logger for better debugging
const customLogger = {
  level: 'info' as const,
  info: (...args: any[]) => console.log('📘 INFO:', ...args),
  error: (...args: any[]) => console.error('❌ ERROR:', ...args),
  warn: (...args: any[]) => console.warn('⚠️ WARN:', ...args),
  debug: (...args: any[]) => {
    if (process.env.DEBUG === 'true') {
      console.log('🐛 DEBUG:', ...args);
    }
  },
  trace: (...args: any[]) => {
    if (process.env.DEBUG === 'true') {
      console.log('🔍 TRACE:', ...args);
    }
  },
  child: () => customLogger,
};

export async function createBot(): Promise<WASocket> {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  
  const sock = makeWASocket({
    auth: state,
    // Enhanced timeout configuration
    connectTimeoutMs: 60000, // Increase to 60 seconds
    defaultQueryTimeoutMs: 120000, // Increase to 2 minutes
    keepAliveIntervalMs: 25000, // Slightly lower than default
    retryRequestDelayMs: 1000, // Increase delay between retries
    maxMsgRetryCount: 10, // Increase retry count
    fireInitQueries: true, // Keep this enabled for now
    logger: customLogger, // Use custom logger
    // Network agent configuration
    agent: new https.Agent({
      keepAlive: true,
      keepAliveMsecs: 10000,
      timeout: 120000, // 2 minute timeout for socket
    }),
    fetchAgent: new https.Agent({
      keepAlive: true,
      timeout: 120000,
    }),
  });

  // Save credentials when updated
  sock.ev.on("creds.update", saveCreds);

  // Handle connection updates
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    // Handle QR code display
    if (qr) {
      console.log("📱 QR Code received! Scan this with WhatsApp on your iPhone:");
      console.log("👆 Open WhatsApp on your iPhone → Settings → Linked Devices → Link a Device");
      console.log("📸 Scan the QR code below to link your iPhone to this bot");
      console.log("=".repeat(60));
      
      try {
        qrcode.generate(qr, { small: true });
      } catch (error) {
        console.log("Raw QR data (if visual QR fails):");
        console.log(qr);
      }
      
      console.log("=".repeat(60));
    }
    
    if (connection === "close") {
      const error = lastDisconnect?.error as Boom;
      const statusCode = error?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
      
      console.log("🔌 Connection closed due to:", lastDisconnect?.error);
      
      // Handle authentication expiry specifically
      if (statusCode === 401) {
        console.log("\n⚠️  Authentication expired or invalid!");
        console.log("🔐 Your WhatsApp session has expired. This typically happens when:");
        console.log("   • You haven't used the bot for several weeks");
        console.log("   • WhatsApp Web/Desktop sessions were cleared on your phone");
        console.log("   • Your WhatsApp account security settings changed\n");
        console.log("🔄 To fix this, you'll need to re-authenticate:");
        console.log("   1. Delete the 'auth' folder: rm -rf auth");
        console.log("   2. Restart the bot: pnpm dev");
        console.log("   3. Scan the new QR code with WhatsApp\n");
        console.log("❌ Bot will NOT auto-reconnect. Please follow the steps above.");
        return; // Don't attempt to reconnect on auth failure
      }
      
      if (shouldReconnect) {
        console.log("🔄 Reconnecting...");
        
        // Check for timeout errors specifically
        if (statusCode === DisconnectReason.timedOut || statusCode === 408) {
          console.log("⏱️  Connection timed out - forcing process restart for fresh connection");
          console.log("💡 Glif will automatically restart the container");
          process.exit(1);
        }
        
        // For other disconnection reasons, restart the process to ensure clean reconnection
        console.log("🔄 Forcing process restart for clean reconnection...");
        process.exit(1);
      } else {
        console.log("❌ Bot logged out. Restart the bot to reconnect.");
      }
    } else if (connection === "open") {
      console.log("✅ WhatsApp connection established!");
    }
  });

  // Handle incoming messages
  sock.ev.on("messages.upsert", async (m) => {
    for (const msg of m.messages) {
      if (!msg.key.fromMe && m.type === "notify") {
        try {
          await handleMessage(msg);
        } catch (error) {
          console.error("❌ Error handling message:", error);
        }
      }
    }
  });

  // Handle message reactions
  sock.ev.on("messages.reaction", async (reaction) => {
    try {
      await handleReaction(reaction);
    } catch (error) {
      console.error("❌ Error handling reaction:", error);
    }
  });

  // Handle chat updates (typing, online status, etc.)
  sock.ev.on("chats.update", async (chats) => {
    for (const chat of chats) {
      try {
        await handleChatUpdate(chat);
      } catch (error) {
        console.error("❌ Error handling chat update:", error);
      }
    }
  });

  return sock;
}