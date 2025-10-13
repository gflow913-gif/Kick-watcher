# Overview

This is a Discord bot application that monitors and reports member removals (kicks and bans) from Discord servers. The bot detects when members are removed, determines whether the action was performed by a human or bot moderator, and sends detailed DM notifications to a configured user. It uses the Discord.js v14 library and implements audit log analysis to distinguish between kicks, bans, and voluntary departures.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Application Type
Single-file Node.js application using Discord.js v14 as the primary framework for Discord bot functionality.

## Core Components

### Discord Client Configuration
- **Gateway Intents**: Uses minimal required intents (Guilds, GuildMembers, GuildMessages, MessageContent) to reduce overhead and comply with Discord's privileged intent requirements
- **Event-Driven Architecture**: Implements Discord.js event listeners for bot lifecycle and member removal detection
- **Rationale**: Event-driven approach aligns with Discord's WebSocket-based real-time communication model

### Event Handling System
- **Primary Event**: `guildMemberRemove` - Triggered when any member leaves, is kicked, or is banned
- **Audit Log Analysis**: Fetches both kick and ban audit logs simultaneously using Promise.all for performance
- **Delay Handling**: Implements 1-second delay before audit log fetch to account for Discord API propagation delays
- **Rationale**: Discord's audit logs aren't immediately available after actions occur; the delay ensures accurate detection

### Bot vs Human Detection
- **Known Bot Database**: Maintains hardcoded array of common moderation bots (Arcane, MEE6, Dyno, Carl-bot, ProBot, Wick)
- **Audit Log Parsing**: Analyzes executor information from Discord audit logs to identify who performed the action
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
- **Direct Messages**: Sends detailed notifications via DM to configured user ID
- **Timestamp Formatting**: Provides both human-readable and Unix timestamp formats
- **Action Differentiation**: Clearly distinguishes between kicks, bans, and voluntary leaves
- **Rationale**: DMs ensure reliable delivery to the monitoring user regardless of server notification settings

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