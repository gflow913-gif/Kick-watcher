require('dotenv').config();
const { Client, GatewayIntentBits, AuditLogEvent, PermissionFlagsBits } = require('discord.js');

// Create Discord client with required intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, // Required to detect member removals
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent // For optional bot message parsing
    ]
});

// Configuration - Replace these with your actual values
const YOUR_USER_ID = process.env.YOUR_USER_ID || 'YOUR_USER_ID_HERE';
const BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';

// Known moderation bots (add more as needed)
const KNOWN_MOD_BOTS = ['Arcane', 'MEE6', 'Dyno', 'Carl-bot', 'ProBot', 'Wick'];

// Bot ready event
client.once('ready', () => {
    console.log(`✅ Bot is online as ${client.user.tag}`);
    console.log(`📋 Monitoring kicks in ${client.guilds.cache.size} server(s)`);
    console.log(`📬 DMs will be sent to user ID: ${YOUR_USER_ID}`);
});

// Listen for member removals (kicks, leaves, bans)
client.on('guildMemberRemove', async (member) => {
    try {
        const guild = member.guild;
        
        // Check if bot has VIEW_AUDIT_LOG permission
        const botMember = await guild.members.fetchMe();
        if (!botMember.permissions.has(PermissionFlagsBits.ViewAuditLog)) {
            console.error(`❌ Missing VIEW_AUDIT_LOG permission in ${guild.name}`);
            return;
        }

        // Wait a moment for audit log to update (Discord has a slight delay)
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Fetch recent audit logs for kicks
        const auditLogs = await guild.fetchAuditLogs({
            type: AuditLogEvent.MemberKick,
            limit: 5
        });

        // Find the kick entry that matches this member
        const kickEntry = auditLogs.entries.find(entry => 
            entry.target.id === member.id &&
            Date.now() - entry.createdTimestamp < 5000 // Within last 5 seconds
        );

        // If no kick entry found, member likely left voluntarily
        if (!kickEntry) {
            console.log(`👋 ${member.user.tag} left ${guild.name} (not kicked)`);
            return;
        }

        // Extract executor information
        const executor = kickEntry.executor;
        const kickedUser = member.user;
        const timestamp = new Date(kickEntry.createdTimestamp);
        
        // Determine if executor is a bot
        const isBot = executor.bot;
        const isModerationBot = isBot && KNOWN_MOD_BOTS.some(botName => 
            executor.username.toLowerCase().includes(botName.toLowerCase())
        );

        // Build DM message
        let dmMessage = `🚨 **Member Kicked from ${guild.name}**\n\n`;
        dmMessage += `**Kicked Member:**\n`;
        dmMessage += `• Username: ${kickedUser.tag}\n`;
        dmMessage += `• User ID: ${kickedUser.id}\n\n`;
        
        if (isBot) {
            dmMessage += `**Executor (Bot):**\n`;
            dmMessage += `• Bot Name: ${executor.tag}\n`;
            dmMessage += `• Bot ID: ${executor.id}\n`;
            
            if (isModerationBot) {
                dmMessage += `• Type: Moderation Bot\n`;
                dmMessage += `\n⚠️ *This kick was executed by a moderation bot. The actual moderator who triggered this action may not be logged in audit logs.*\n`;
            }
        } else {
            dmMessage += `**Executor (Human):**\n`;
            dmMessage += `• Username: ${executor.tag}\n`;
            dmMessage += `• User ID: ${executor.id}\n`;
        }
        
        dmMessage += `\n**Timestamp:**\n`;
        dmMessage += `• ${timestamp.toLocaleString('en-US', { 
            dateStyle: 'full', 
            timeStyle: 'long' 
        })}\n`;
        dmMessage += `• Unix: ${Math.floor(timestamp.getTime() / 1000)}\n`;

        // Optional: Attempt to find human behind bot kick by checking recent messages
        if (isModerationBot) {
            try {
                const humanBehindBot = await findHumanBehindBotKick(guild, executor, kickedUser, timestamp);
                if (humanBehindBot) {
                    dmMessage += `\n**Possible Human Moderator:**\n`;
                    dmMessage += `• ${humanBehindBot.tag} (${humanBehindBot.id})\n`;
                    dmMessage += `• *Best-effort detection from recent bot messages*\n`;
                }
            } catch (error) {
                console.log(`⚠️ Could not detect human behind bot: ${error.message}`);
            }
        }

        // Send DM to specified user
        try {
            const targetUser = await client.users.fetch(YOUR_USER_ID);
            await targetUser.send(dmMessage);
            console.log(`✅ Kick notification sent for ${kickedUser.tag}`);
        } catch (dmError) {
            console.error(`❌ Failed to send DM: ${dmError.message}`);
            if (dmError.code === 50007) {
                console.error(`   → User ${YOUR_USER_ID} has DMs disabled or doesn't share a server with the bot`);
            }
        }

    } catch (error) {
        console.error(`❌ Error processing member removal:`, error);
        
        // Specific error handling
        if (error.code === 50013) {
            console.error(`   → Missing permissions. Ensure bot has VIEW_AUDIT_LOG permission`);
        } else if (error.code === 50001) {
            console.error(`   → Missing access. Ensure bot has proper role permissions`);
        }
    }
});

/**
 * Best-effort attempt to find the human moderator behind a bot kick
 * This searches recent messages from the moderation bot for moderator mentions
 * @param {Guild} guild - The guild where kick occurred
 * @param {User} botExecutor - The bot that executed the kick
 * @param {User} kickedUser - The user who was kicked
 * @param {Date} kickTimestamp - When the kick occurred
 * @returns {Promise<User|null>} - The suspected human moderator or null
 */
async function findHumanBehindBotKick(guild, botExecutor, kickedUser, kickTimestamp) {
    try {
        // Get all text channels
        const channels = guild.channels.cache.filter(c => c.isTextBased());
        
        // Search for recent bot messages (within 10 seconds of kick)
        for (const [, channel] of channels) {
            try {
                const messages = await channel.messages.fetch({ limit: 10 });
                
                const relevantMessage = messages.find(msg => 
                    msg.author.id === botExecutor.id &&
                    Math.abs(msg.createdTimestamp - kickTimestamp.getTime()) < 10000 &&
                    (msg.content.includes(kickedUser.tag) || 
                     msg.content.includes(kickedUser.id) ||
                     msg.content.toLowerCase().includes('kicked'))
                );
                
                if (relevantMessage) {
                    // Try to find mentioned users (excluding the kicked user)
                    const mentions = relevantMessage.mentions.users.filter(u => 
                        u.id !== kickedUser.id && u.id !== botExecutor.id
                    );
                    
                    if (mentions.size > 0) {
                        return mentions.first();
                    }
                    
                    // Try to parse moderator from message content patterns
                    const modMatch = relevantMessage.content.match(/(?:by|from)\s+<?@?!?(\d{17,19})>?/i);
                    if (modMatch) {
                        return await guild.members.fetch(modMatch[1]).then(m => m.user);
                    }
                }
            } catch (channelError) {
                // Skip channels we can't access
                continue;
            }
        }
    } catch (error) {
        console.log(`Could not search for human moderator: ${error.message}`);
    }
    
    return null;
}

// Error handling for the bot
client.on('error', (error) => {
    console.error('❌ Discord client error:', error);
});

process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled promise rejection:', error);
});

// Login to Discord
client.login(BOT_TOKEN).catch(error => {
    console.error('❌ Failed to login to Discord:', error);
    if (error.code === 'TokenInvalid') {
        console.error('   → Invalid bot token. Please check your BOT_TOKEN in .env file');
    }
    process.exit(1);
});
