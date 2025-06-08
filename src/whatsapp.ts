import makeWASocket, { 
  useMultiFileAuthState, 
  ConnectionState, 
  DisconnectReason,
  WASocket
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import * as qrcode from "qrcode-terminal";

// Message handlers
export async function handleMessage(msg: any): Promise<void> {
  const messageText = msg.message?.conversation || msg.message?.extendedTextMessage?.text;
  const fromUser = msg.key.remoteJid;
  
  if (messageText && fromUser) {
    console.log(`📨 Message from ${fromUser}: ${messageText}`);
    
    // Simple ping/pong for testing
    if (messageText.toLowerCase() === 'ping') {
      // We'll handle responses in the main bot logic if needed
      console.log("🏓 Ping received - could respond with pong");
    }
  }
}

export async function handleReaction(reaction: any): Promise<void> {
  console.log("👍 Reaction received:", reaction);
  // Add reaction handling logic here
}

export async function handleChatUpdate(update: any): Promise<void> {
  console.log("💬 Chat update:", update);
  // Add chat update handling logic here
}

export async function createBot(): Promise<WASocket> {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
  
  const sock = makeWASocket({
    auth: state,
    // Removed deprecated printQRInTerminal option
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
      const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log("🔌 Connection closed due to:", lastDisconnect?.error);
      
      if (shouldReconnect) {
        console.log("🔄 Reconnecting...");
        createBot();
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