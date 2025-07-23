# Capy 🦫

**A WhatsApp bot for Boulder's weekly food exchange, built almost entirely by Claude.** Every week, Capy asks one simple question: "Who's in this week?" That's it. No AI, no analytics, no fancy features – just a reliable capybara with a pink beret making sure the food swap happens. Built as part of exploring [Local Community Tech Stacks](https://jon.bo/posts/local-community-tech-stack-capy/): interoperable, vibe-coded, self-hostable apps for our communities.

---

<details>
<summary><strong>📚 Technical Architecture for LLMs</strong> (expand for implementation details)</summary>

## System Architecture

This WhatsApp bot was architected and implemented entirely through conversational programming with Claude. Built for simplicity and reliability over features.

### Core Components

#### 1. WhatsApp Client Layer (`src/whatsapp.ts`)
- Uses Baileys library for WhatsApp Web protocol implementation
- Handles connection management, QR code generation, and auth persistence
- Event-driven architecture for message handling
- Implements reconnection logic with exponential backoff
- Message queue system for reliable delivery

#### 2. Scheduling Engine (`src/scheduler.ts`)
- Cron-based scheduling using node-cron
- Supports one-time scheduled messages and weekly recurring messages
- Runs checks every minute for pending messages
- Handles timezone considerations (currently uses system time)
- Automatic cleanup of sent one-time messages

#### 3. Database Layer (`src/db.ts`)
- SQLite for local persistence (file: `bot.sqlite`)
- Tables:
  - `scheduled_messages`: One-time messages with timestamps
  - `recurring_messages`: Weekly recurring messages with day/time
  - `groups`: WhatsApp group information cache
- Prepared statements for performance and security
- Auto-initialization on first run

#### 4. Web Dashboard (`src/web.ts`)
- Bun-powered HTTP server on port 3000
- Real-time status updates via polling (5-second intervals)
- No authentication (designed for local/trusted network use)
- Responsive UI built with vanilla HTML/CSS/JS
- Endpoints:
  - `/`: Main dashboard
  - `/api/status`: JSON API for bot status

### Message Flow

1. **Incoming Messages**: WhatsApp → Baileys → Event Handler → Message Processor
2. **Scheduled Messages**: Cron Trigger → Database Query → Message Queue → WhatsApp
3. **Web Dashboard**: Browser → HTTP Server → Database/Bot State → JSON Response

### Key Design Decisions

- **TypeScript**: Full type safety across the codebase
- **SQLite**: Zero-config database for simplicity
- **Baileys**: Most mature Node.js WhatsApp library
- **Modular Structure**: Each file has a single responsibility
- **Event-Driven**: Loose coupling between components
- **Graceful Shutdown**: Proper cleanup on process termination

### Extension Points

- `handleMessage()`: Add custom command handlers
- `handleReaction()`: Process emoji reactions
- `handleChatUpdate()`: Track group changes
- Database schema is extensible for new features
- Web dashboard can be extended with new endpoints

### Security Considerations

- Auth credentials stored locally in `auth/` directory
- No external API dependencies (fully self-contained)
- Web dashboard has no authentication (use firewall/VPN)
- Database uses prepared statements
- No user input is executed as code

</details>

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- npm or bun

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/jonbo/capy-whatsapp
   cd capy-whatsapp
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

### Running Capy

```bash
npm start          # Start Capy (CLI mode)
npm run dev        # Start with file watching
npm run build      # Compile TypeScript
npm run bun:start  # Start with bun (CLI mode)
npm run bun:web    # Start with web dashboard
npm run test-util  # Run test utilities
```

### Customizing Capy

While Capy is intentionally simple, you can modify the weekly message or add new handlers in `src/whatsapp.ts`. The test utility in `src/test.ts` helps with scheduling and testing.

## 🔧 Configuration

- **Database**: SQLite file `bot.sqlite` (created automatically)
- **Auth**: Stored in `auth/` directory (created automatically)
- **Scheduling**: Runs every minute by default (configurable in `scheduler.ts`)

## 📝 Philosophy & Notes

- **Community First**: Built for a specific community need, not for scale
- **Simple by Design**: Does one thing well – asks who's cooking each week
- **Self-Hostable**: Runs on a donated PC in a Boulder coworking space
- **WhatsApp Constraints**: Uses unofficial API since WhatsApp doesn't support community bots
- **Operating Cost**: ~$8/month for the phone number (US Mobile eSIM)

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

## 🌱 Part of Local Community Tech Stacks

Capy is an experiment in community-owned technology. Built with AI but designed for humans. No venture funding, no growth metrics, no surveillance capitalism – just a bot that helps friends share food.

### Resources
- [Blog post: Building Capy](https://jon.bo/posts/local-community-tech-stack-capy/)
- [GitHub: This repo](https://github.com/jonbo/foodexchange-bot)
- [Home-Cooked Software](https://maggieappleton.com/home-cooked-software) by Maggie Appleton
- [Build for Here](https://unforced.substack.com/p/build-for-here) by Aaron Gabriel Neyer

### Built With
- 🤖 ~$30 of Claude API credits
- 🦫 One capybara with a pink beret
- ☕ Several debugging sessions
- 💚 Community vibes

---

*Capy asks "Who's in this week?" so you don't have to.* 