# Discord Kick & Ban Monitor Bot

A Discord bot that monitors member kicks and bans, sending detailed DM notifications with executor information, timestamps, and bot detection.

## Features

- ✅ Detects when members are kicked or banned from Discord servers
- ✅ Identifies whether kicks/bans were performed by humans or bots
- ✅ Sends detailed DM notifications with:
  - Kicked/banned member's username & ID
  - Executor (human or bot) username & ID
  - Timestamp of the action (formatted and Unix)
  - Action type (kick vs ban)
- ✅ Special handling for moderation bots (Arcane, MEE6, Dyno, etc.)
- ✅ Best-effort detection of humans behind bot kicks/bans
- ✅ Comprehensive error handling for permissions and audit log delays
- ✅ Distinguishes between kicks, bans, and voluntary leaves

## Requirements

- Node.js v16.9.0 or higher
- Discord bot with proper permissions and intents

## Setup Instructions

### 1. Create a Discord Bot

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application" and give it a name
3. Go to the "Bot" section and click "Add Bot"
4. **Important**: Enable these Privileged Gateway Intents:
   - ✅ PRESENCE INTENT (optional)
   - ✅ SERVER MEMBERS INTENT (required)
   - ✅ MESSAGE CONTENT INTENT (optional, for bot message parsing)
5. Copy your bot token (click "Reset Token" if needed)

### 2. Invite Bot to Your Server

1. Go to "OAuth2" > "URL Generator"
2. Select scopes:
   - ✅ `bot`
3. Select bot permissions:
   - ✅ `View Audit Log` (required)
   - ✅ `Read Messages/View Channels` (optional, for bot message parsing)
4. Copy the generated URL and open it in your browser
5. Select your server and authorize the bot

### 3. Get Your User ID

1. Enable Developer Mode in Discord:
   - Settings > Advanced > Developer Mode (toggle on)
2. Right-click on your username and click "Copy User ID"

### 4. Configure the Bot

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and add your values:
   ```env
   BOT_TOKEN=your_actual_bot_token_here
   YOUR_USER_ID=your_actual_user_id_here
   ```

### 5. Install Dependencies

```bash
npm install
```

### 6. Run the Bot

```bash
node index.js
```

## Deploying to Pella (24/7 Hosting)

To run this bot 24/7 on Pella or any other hosting service:

1. Upload all files to your hosting platform
2. Make sure `.env` file is configured with your bot token and user ID
3. Set the start command to: `node index.js`
4. Ensure Node.js v16+ is available on the hosting platform

## How It Works

1. **Event Listener**: Bot listens for `guildMemberRemove` events
2. **Audit Log Check**: Fetches recent audit logs to find kick and ban entries
3. **Action Detection**: Determines if member was kicked, banned, or left voluntarily
4. **Executor Detection**: Determines if action was by human or bot
5. **DM Notification**: Sends formatted message to your Discord DMs
6. **Error Handling**: Gracefully handles permission errors and API delays

## Troubleshooting

### Bot doesn't detect kicks or bans
- Ensure "SERVER MEMBERS INTENT" is enabled in Discord Developer Portal
- Verify bot has "View Audit Log" permission in your server
- Check that bot role is high enough in the role hierarchy

### Not receiving DMs
- Make sure `YOUR_USER_ID` is correct in `.env`
- Ensure you share at least one server with the bot
- Check that your DMs are not disabled for server members

### Permission errors
- Bot needs "View Audit Log" permission
- Bot role must be positioned properly in server settings
- Check console logs for specific error codes

## Error Codes

- `50007`: Cannot send DM to user (DMs disabled or no shared server)
- `50013`: Missing permissions (needs View Audit Log)
- `50001`: Missing access (check role permissions)
- `TokenInvalid`: Invalid bot token in `.env`

## Known Moderation Bots

The bot recognizes these moderation bots by default:
- Arcane
- MEE6
- Dyno
- Carl-bot
- ProBot
- Wick

Add more in `index.js` by editing the `KNOWN_MOD_BOTS` array.

## License

Free to use and modify for your needs.
