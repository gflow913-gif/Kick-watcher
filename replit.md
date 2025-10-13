# Overview

This is a comprehensive Discord moderation monitoring bot that tracks all moderation actions including kicks, bans, unbans, timeouts/mutes, and unmutes. The bot uses real-time event listeners and audit log analysis to detect moderation actions, identify executors (human or bot), and send detailed DM notifications to a configured user. Built with Discord.js v14, it provides complete moderation oversight with best-effort detection of human moderators behind bot actions.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Application Type
Single-file Node.js application using Discord.js v14 as the primary framework for Discord bot functionality.

## Core Components

### Discord Client Configuration
- **Gateway Intents**: Uses required intents for comprehensive moderation monitoring:
  - Guilds - Access to guild information
  - GuildMembers - Required to detect member removals and updates
  - GuildModeration - Required for ban events (guildBanAdd, guildBanRemove)
  - GuildMessages - For bot message parsing
  - MessageContent - For best-effort human moderator detection from bot messages
- **Event-Driven Architecture**: Implements Discord.js event listeners for bot lifecycle and all moderation events
- **Rationale**: Event-driven approach aligns with Discord's WebSocket-based real-time communication model and ensures instant notification delivery

### Event Handling System
- **Multi-Event Architecture**: Monitors 4 Discord events for comprehensive moderation tracking:
  - `guildMemberRemove` - Detects kicks and member departures
  - `guildBanAdd` - Real-time ban detection with reason tracking
  - `guildBanRemove` - Unban monitoring
  - `guildMemberUpdate` - Timeout/mute and unmute detection via communication_disabled_until changes
- **Audit Log Analysis**: Fetches multiple audit log types (MemberKick, MemberBanAdd, MemberBanRemove, MemberUpdate) using Promise.all for performance
- **Delay Handling**: Implements 500ms-1000ms delays before audit log fetch to account for Discord API propagation delays
- **Timeout Detection**: Monitors communicationDisabledUntil field changes in guildMemberUpdate events to detect mutes/unmutes with duration tracking
- **Rationale**: Real-time event listeners provide immediate detection while audit logs supply executor information; multiple event types ensure comprehensive coverage of all moderation actions

### Bot vs Human Detection
- **Known Bot Database**: Maintains hardcoded array of common moderation bots (Arcane, MEE6, Dyno, Carl-bot, ProBot, Wick, Maki, YAGPDB)
- **Audit Log Parsing**: Analyzes executor information from Discord audit logs to identify who performed the action
- **Best-Effort Human Detection**: Searches recent bot messages for mentions/patterns to identify the human moderator behind bot actions
- **Rationale**: While not perfect, this approach provides best-effort attribution for moderation actions, especially useful in servers with bot-assisted moderation

### Permission Handling
- **Required Permission**: VIEW_AUDIT_LOG permission checked before attempting audit log access
- **Graceful Degradation**: Logs errors but continues operation if permissions are missing in specific servers
- **Rationale**: Prevents bot crashes in servers where it lacks proper permissions while maintaining functionality elsewhere

## Configuration Management
- **Environment Variables**: Uses dotenv for configuration (BOT_TOKEN, YOUR_USER_ID)
- **Fallback Values**: Provides placeholder defaults for development/testing
- **Rationale**: Separates secrets from code and allows easy deployment across different environments

## Error Handling Strategy
- **Try-Catch Blocks**: Wraps audit log operations to prevent bot crashes
- **Console Logging**: Provides operational visibility for debugging and monitoring
- **Graceful Failures**: Bot continues running even if individual operations fail
- **Rationale**: Ensures high availability - one server's permission issues don't affect monitoring in other servers

## Notification System
- **Direct Messages**: Sends detailed notifications via DM to configured user ID for all moderation actions
- **Action-Specific Formatting**: Different emojis and formatting for each action type:
  - 🚨 Kicks
  - 🔨 Bans
  - ✅ Unbans
  - 🔇 Timeouts/Mutes
  - 🔊 Unmutes
- **Comprehensive Details**: Each notification includes:
  - Target member username & ID
  - Executor username & ID (human or bot)
  - Action timestamp (formatted and Unix)
  - Ban reasons (when available)
  - Timeout duration and expiration (for mutes)
  - Best-effort human moderator detection for bot actions
- **Helper Functions**: Centralized sendDM() function for DRY code and consistent error handling
- **Rationale**: Action-specific formatting improves readability; DMs ensure reliable delivery regardless of server notification settings

# External Dependencies

## Discord.js (v14.23.2)
- **Purpose**: Official Discord API wrapper providing WebSocket gateway, REST API interactions, and type definitions
- **Key Features Used**: 
  - Client with Gateway Intents
  - Audit Log fetching (AuditLogEvent.MemberKick, AuditLogEvent.MemberBanAdd)
  - Permission checking (PermissionFlagsBits.ViewAuditLog)
  - Guild and member management
- **Why Chosen**: Industry-standard library with comprehensive Discord API coverage and active maintenance

## Dotenv (v17.2.3)
- **Purpose**: Loads environment variables from .env file into process.env
- **Configuration Variables**:
  - BOT_TOKEN: Discord bot authentication token
  - YOUR_USER_ID: Discord user ID for receiving notifications
- **Why Chosen**: Simple, widely-adopted solution for environment variable management

## Discord Developer Portal
- **Purpose**: Bot creation, token generation, and OAuth2 configuration
- **Required Setup**:
  - Bot application with token
  - Privileged Gateway Intents: SERVER MEMBERS INTENT (required), optional PRESENCE and MESSAGE CONTENT
  - OAuth2 bot invite URL with ViewAuditLog permission
- **Integration**: Bot token stored in environment variables for authentication

## Discord Gateway API
- **Purpose**: Real-time WebSocket connection for receiving events
- **Events Consumed**:
  - ready: Bot initialization confirmation
  - guildMemberRemove: Member departure/removal detection
- **Integration**: Accessed through discord.js client abstraction

## Discord REST API
- **Purpose**: Audit log retrieval and guild information fetching
- **Endpoints Used** (via discord.js):
  - GET /guilds/{guild.id}/audit-logs (for kick and ban events)
  - Guild member fetching
- **Rate Limiting**: Handled automatically by discord.js library