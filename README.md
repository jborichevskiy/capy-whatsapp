# WhatsApp Bot MVP

A self-hosted WhatsApp bot built with TypeScript, Baileys, and SQLite that can schedule and send messages automatically.

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or bun

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone <your-repo>
   cd whatsapp-bot-mvp
   npm install
   ```

2. **Start the bot:**
   ```bash
   # Command line version
   npm start
   # or with bun
   npm run bun:start
   
   # Web UI version (includes dashboard at http://localhost:3000)
   npm run bun:web
   ```

3. **Scan the QR code** with WhatsApp to connect the bot

4. **Test the connection** by sending "ping" to the bot number

## 📋 Features

- ✅ **Scheduled Messages**: Send one-time messages at specific times
- ✅ **Recurring Messages**: Weekly recurring messages (e.g., Monday 9 AM reminders)
- ✅ **Message Handlers**: React to incoming messages, reactions, and chat updates
- ✅ **SQLite Storage**: Local database for persistence
- ✅ **TypeScript**: Full type safety and development experience
- ✅ **Graceful Shutdown**: Clean exit handling
- ✅ **Web Dashboard**: Real-time monitoring with Bun-powered UI

## 🛠️ Usage

### Scheduling Messages

Use the test utility to schedule messages:

```bash
# Schedule a message 5 minutes from now
npx ts-node src/test.ts schedule "1234567890@s.whatsapp.net" "Hello!" 5

# Schedule recurring message every Monday at 9:00 AM
npx ts-node src/test.ts recurring "1234567890@s.whatsapp.net" "Weekly reminder!" 1 9 0

# Quick test message (1 minute from now)
npx ts-node src/test.ts test-schedule "1234567890@s.whatsapp.net"

# List all pending/recurring messages
npx ts-node src/test.ts list-pending
npx ts-node src/test.ts list-recurring
```

### Getting Chat IDs

1. Start the bot
2. Send a message to the bot from WhatsApp
3. Check the console logs - the chat ID will be displayed
4. Copy the chat ID for use in scheduling

### Web Dashboard

If you start the bot with `npm run bun:web`, you'll get a beautiful web dashboard at http://localhost:3000 that shows:

- 📱 **Connection Status**: Real-time WhatsApp connection indicator
- 🔢 **Phone Number**: Your bot's phone number once connected
- 📅 **Scheduled Messages**: All upcoming one-time messages
- 🔄 **Recurring Messages**: All weekly recurring messages
- 👥 **Groups**: All groups your bot has joined
- 🕐 **Last Connected**: When the bot last connected to WhatsApp

The dashboard auto-refreshes every 5 seconds and requires no authentication.

### Direct Database Access

```bash
# Open SQLite CLI
sqlite3 bot.sqlite

# View tables
.tables

# Check scheduled messages
SELECT * FROM scheduled_messages;

# Check recurring messages  
SELECT * FROM recurring_messages;
```

## 📁 Project Structure

```
src/
├── index.ts          # Main entry point
├── whatsapp.ts       # WhatsApp client & message handlers
├── scheduler.ts      # Cron-based message scheduler
├── db.ts            # SQLite database operations
├── types.ts         # TypeScript type definitions
├── utils.ts         # Helper functions
├── test.ts          # Testing utilities
└── web.ts           # Web dashboard server

data/
├── bot.sqlite       # SQLite database (auto-created)
└── auth/            # WhatsApp auth files (auto-created)
```

## 🧪 Development

### Available Scripts

```bash
npm start          # Start the bot (CLI mode)
npm run dev        # Start with file watching
npm run build      # Compile TypeScript
npm run bun:start  # Start with bun (CLI mode)
npm run bun:web    # Start with web dashboard
npm run test-util  # Run test utilities
```

### Adding Message Handlers

Edit `src/whatsapp.ts` to customize message handling:

```typescript
export async function handleMessage(msg: any): Promise<void> {
  const messageText = msg.message?.conversation;
  const fromUser = msg.key.remoteJid;
  
  // Add your custom logic here
  if (messageText === 'hello') {
    // Respond to the message
    // sock.sendMessage(fromUser, { text: 'Hi there!' });
  }
}
```

### Adding Custom Commands

The test utility can be extended in `src/test.ts` for additional functionality.

## 🔧 Configuration

- **Database**: SQLite file `bot.sqlite` (created automatically)
- **Auth**: Stored in `auth/` directory (created automatically)
- **Scheduling**: Runs every minute by default (configurable in `scheduler.ts`)

### Environment Variables

Create a `.env` file in the client directory with the following variables:

```
# Client Configuration
VITE_HOSTNAME=your-hostname # Used for HMR configuration
```

This will replace hardcoded values in the config files.

## 📝 Notes

- **WhatsApp ToS**: This bot connects as a regular WhatsApp user. Follow WhatsApp's Terms of Service.
- **Rate Limits**: Be mindful of message frequency to avoid temporary restrictions.
- **Persistence**: Auth state and messages persist across restarts.
- **Security**: Keep your `auth/` directory private and secure.

## 🐛 Troubleshooting

### QR Code Issues
- Delete `auth/` folder and restart to generate a new QR code
- Make sure WhatsApp Web isn't already active on another device

### Message Not Sending
- Check that the chat ID format is correct (`@s.whatsapp.net` for individuals, `@g.us` for groups)
- Verify the bot is connected (check console logs)
- Ensure the chat exists and you have permission to send messages

### Database Issues
- Delete `bot.sqlite` to reset the database (you'll lose scheduled messages)
- Check file permissions in the project directory

## 🔮 Future Enhancements

- Web dashboard for message management
- Support for media messages (images, documents)
- Message templates and variables
- Integration with external APIs
- Group management features
- Analytics and reporting 

# running on mac

pm2 start npm --name whatsapp-bot-server -- run dev:server
pm2 start npm --name whatsapp-bot-client -- run dev:client
