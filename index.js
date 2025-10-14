require('dotenv').config();
const { Client, GatewayIntentBits, AuditLogEvent, PermissionFlagsBits } = require('discord.js');

// Create Discord client with required intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, // Required to detect member removals and updates
        GatewayIntentBits.GuildModeration, // Required for ban events
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent // For optional bot message parsing
    ]
});

// Configuration - Replace these with your actual values
const YOUR_USER_ID = process.env.YOUR_USER_ID || 'YOUR_USER_ID_HERE';
const BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';

// Known moderation bots (add more as needed)
const KNOWN_MOD_BOTS = ['Arcane', 'MEE6', 'Dyno', 'Carl-bot', 'ProBot', 'Wick', 'Maki', 'YAGPDB'];

// Bot ready event
client.once('ready', () => {
    console.log(`✅ Bot is online as ${client.user.tag}`);
    console.log(`📋 Monitoring moderation actions in ${client.guilds.cache.size} server(s)`);
    console.log(`📬 DMs will be sent to user ID: ${YOUR_USER_ID}`);
    console.log(`🔍 Tracking: Kicks, Bans, Unbans, Timeouts/Mutes, Unmutes`);
});

// Listen for messages to check role permissions
client.on('messageCreate', async (message) => {
    // Ignore bot messages
    if (message.author.bot) return;
    
    // Only respond to the configured user
    if (message.author.id !== YOUR_USER_ID) return;
    
    // Check for permission check command
    if (message.content.toLowerCase() === '!checkperms' || message.content.toLowerCase() === '!roleperms') {
        try {
            const guild = message.guild;
            if (!guild) {
                await message.reply('❌ This command must be used in a server!');
                return;
            }

            // Fetch all roles
            const roles = guild.roles.cache.sort((a, b) => b.position - a.position);
            
            let reportMessage = `🔐 **Moderation Permission Report for ${guild.name}**\n\n`;
            
            // Check each role for moderation permissions
            const moderationPerms = [
                { name: 'KICK_MEMBERS', label: 'Kick Members', emoji: '👢' },
                { name: 'BAN_MEMBERS', label: 'Ban Members', emoji: '🔨' },
                { name: 'MODERATE_MEMBERS', label: 'Timeout Members', emoji: '🔇' },
                { name: 'MANAGE_MESSAGES', label: 'Manage Messages', emoji: '🗑️' },
                { name: 'MANAGE_ROLES', label: 'Manage Roles', emoji: '🎭' },
                { name: 'ADMINISTRATOR', label: 'Administrator', emoji: '👑' }
            ];

            for (const perm of moderationPerms) {
                const rolesWithPerm = roles.filter(role => 
                    role.permissions.has(PermissionFlagsBits[perm.name]) && 
                    role.id !== guild.id // Exclude @everyone
                );

                if (rolesWithPerm.size > 0) {
                    reportMessage += `${perm.emoji} **${perm.label}:**\n`;
                    rolesWithPerm.forEach(role => {
                        const memberCount = role.members.size;
                        reportMessage += `• ${role.name} (${memberCount} member${memberCount !== 1 ? 's' : ''})\n`;
                    });
                    reportMessage += '\n';
                }
            }

            // Check @everyone permissions
            const everyoneRole = guild.roles.everyone;
            const everyonePerms = moderationPerms.filter(perm => 
                everyoneRole.permissions.has(PermissionFlagsBits[perm.name])
            );
            
            if (everyonePerms.length > 0) {
                reportMessage += `⚠️ **@everyone has these permissions:**\n`;
                everyonePerms.forEach(perm => {
                    reportMessage += `• ${perm.emoji} ${perm.label}\n`;
                });
                reportMessage += '\n';
            }

            // Check bot's permissions
            const botMember = await guild.members.fetchMe();
            reportMessage += `🤖 **Bot's Permissions:**\n`;
            reportMessage += `• View Audit Log: ${botMember.permissions.has(PermissionFlagsBits.ViewAuditLog) ? '✅' : '❌'}\n`;
            reportMessage += `• Read Messages: ${botMember.permissions.has(PermissionFlagsBits.ReadMessageHistory) ? '✅' : '❌'}\n`;
            reportMessage += `• Send Messages: ${botMember.permissions.has(PermissionFlagsBits.SendMessages) ? '✅' : '❌'}\n`;

            // Split message if too long (Discord 2000 char limit)
            if (reportMessage.length > 1900) {
                const chunks = [];
                let currentChunk = `🔐 **Moderation Permission Report for ${guild.name}**\n\n`;
                
                const lines = reportMessage.split('\n');
                for (const line of lines) {
                    if (currentChunk.length + line.length > 1900) {
                        chunks.push(currentChunk);
                        currentChunk = line + '\n';
                    } else {
                        currentChunk += line + '\n';
                    }
                }
                chunks.push(currentChunk);
                
                for (const chunk of chunks) {
                    await message.reply(chunk);
                }
            } else {
                await message.reply(reportMessage);
            }

        } catch (error) {
            console.error('❌ Error checking permissions:', error);
            await message.reply('❌ Failed to check permissions. Make sure the bot has proper access to server roles.');
        }
    }
});

// Listen for member removals (kicks, leaves, bans)
client.on('guildMemberRemove', async (member) => {
    try {
        const guild = member.guild;
        const inviteLink = 'https://discord.gg/9ZbA7H5sfQ';
        
        // Check if bot has VIEW_AUDIT_LOG permission
        const botMember = await guild.members.fetchMe();
        if (!botMember.permissions.has(PermissionFlagsBits.ViewAuditLog)) {
            console.error(`❌ Missing VIEW_AUDIT_LOG permission in ${guild.name}`);
            return;
        }

        // Wait a moment for audit log to update (Discord has a slight delay)
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Fetch recent audit logs for kicks only (bans are handled by guildBanAdd)
        const kickLogs = await guild.fetchAuditLogs({
            type: AuditLogEvent.MemberKick,
            limit: 5
        });

        // Find the kick entry that matches this member
        const kickEntry = kickLogs.entries.find(entry => 
            entry.target.id === member.id &&
            Date.now() - entry.createdTimestamp < 5000 // Within last 5 seconds
        );

        // Check for kick entry (we ignore bans here since guildBanAdd handles them)
        if (!kickEntry) {
            // No kick found - either a ban (handled by guildBanAdd) or voluntary leave
            console.log(`👋 ${member.user.tag} left ${guild.name} (ban or voluntary leave - not a kick)`);
            
            // Send a welcome-back message to the user who left
            try {
                const comeBackMessage = `👋 Hey ${member.user.tag}!\n\n` +
                    `We noticed you left **${guild.name}**. We'd love to have you back!\n\n` +
                    `Here's the invite link if you'd like to rejoin:\n${inviteLink}\n\n` +
                    `Hope to see you soon! 💙`;
                
                await member.user.send(comeBackMessage);
                console.log(`✅ Sent come-back message to ${member.user.tag} (ID: ${member.user.id})`);
            } catch (dmError) {
                console.error(`❌ Failed to send come-back DM to ${member.user.tag}: ${dmError.message}`);
            }
            
            return;
        }

        // This is a kick
        const auditEntry = kickEntry;
        const actionType = 'kicked';

        // Extract executor information
        const executor = auditEntry.executor;
        const removedUser = member.user;
        const timestamp = new Date(auditEntry.createdTimestamp);
        
        // Determine if executor is a bot
        const isBot = executor.bot;
        const isModerationBot = isBot && KNOWN_MOD_BOTS.some(botName => 
            executor.username.toLowerCase().includes(botName.toLowerCase())
        );

        // Build DM message for kick
        let dmMessage = `🚨 **Member Kicked from ${guild.name}**\n\n`;
        dmMessage += `**Kicked Member:**\n`;
        dmMessage += `• Username: ${removedUser.tag}\n`;
        dmMessage += `• User ID: ${removedUser.id}\n\n`;
        
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

        // Optional: Attempt to find human behind bot kick/ban by checking recent messages
        if (isModerationBot) {
            try {
                const humanBehindBot = await findHumanBehindBotAction(guild, executor, removedUser, timestamp, actionType);
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
        await sendDM(dmMessage, `Kick notification sent for ${removedUser.tag}`);

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

// Listen for bans (real-time detection)
client.on('guildBanAdd', async (ban) => {
    try {
        const guild = ban.guild;
        const bannedUser = ban.user;
        
        // Check if bot has VIEW_AUDIT_LOG permission
        const botMember = await guild.members.fetchMe();
        if (!botMember.permissions.has(PermissionFlagsBits.ViewAuditLog)) {
            console.error(`❌ Missing VIEW_AUDIT_LOG permission in ${guild.name}`);
            return;
        }

        // Wait for audit log to update
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Fetch ban audit logs
        const banLogs = await guild.fetchAuditLogs({
            type: AuditLogEvent.MemberBanAdd,
            limit: 5
        });

        // Find the ban entry for this user
        const banEntry = banLogs.entries.find(entry => 
            entry.target.id === bannedUser.id &&
            Date.now() - entry.createdTimestamp < 5000
        );

        if (!banEntry) {
            console.log(`⚠️ Ban detected for ${bannedUser.tag} but no audit log entry found`);
            return;
        }

        // Extract executor and details
        const executor = banEntry.executor;
        const timestamp = new Date(banEntry.createdTimestamp);
        const reason = ban.reason || banEntry.reason || 'No reason provided';
        
        const isBot = executor.bot;
        const isModerationBot = isBot && KNOWN_MOD_BOTS.some(botName => 
            executor.username.toLowerCase().includes(botName.toLowerCase())
        );

        // Build DM message
        let dmMessage = `🔨 **Member BANNED from ${guild.name}**\n\n`;
        dmMessage += `**Banned Member:**\n`;
        dmMessage += `• Username: ${bannedUser.tag}\n`;
        dmMessage += `• User ID: ${bannedUser.id}\n\n`;
        
        if (isBot) {
            dmMessage += `**Executor (Bot):**\n`;
            dmMessage += `• Bot Name: ${executor.tag}\n`;
            dmMessage += `• Bot ID: ${executor.id}\n`;
            
            if (isModerationBot) {
                dmMessage += `• Type: Moderation Bot\n`;
                dmMessage += `\n⚠️ *This ban was executed by a moderation bot. The actual moderator who triggered this action may not be logged in audit logs.*\n`;
            }
        } else {
            dmMessage += `**Executor (Human):**\n`;
            dmMessage += `• Username: ${executor.tag}\n`;
            dmMessage += `• User ID: ${executor.id}\n`;
        }
        
        dmMessage += `\n**Reason:**\n`;
        dmMessage += `• ${reason}\n`;
        
        dmMessage += `\n**Timestamp:**\n`;
        dmMessage += `• ${timestamp.toLocaleString('en-US', { 
            dateStyle: 'full', 
            timeStyle: 'long' 
        })}\n`;
        dmMessage += `• Unix: ${Math.floor(timestamp.getTime() / 1000)}\n`;

        // Optional: Find human behind bot
        if (isModerationBot) {
            try {
                const humanBehindBot = await findHumanBehindBotAction(guild, executor, bannedUser, timestamp, 'ban');
                if (humanBehindBot) {
                    dmMessage += `\n**Possible Human Moderator:**\n`;
                    dmMessage += `• ${humanBehindBot.tag} (${humanBehindBot.id})\n`;
                    dmMessage += `• *Best-effort detection from recent bot messages*\n`;
                }
            } catch (error) {
                console.log(`⚠️ Could not detect human behind bot: ${error.message}`);
            }
        }

        // Send DM
        await sendDM(dmMessage, `Ban notification sent for ${bannedUser.tag}`);

    } catch (error) {
        console.error(`❌ Error processing ban:`, error);
    }
});

// Listen for unbans
client.on('guildBanRemove', async (ban) => {
    try {
        const guild = ban.guild;
        const unbannedUser = ban.user;
        
        // Check permissions
        const botMember = await guild.members.fetchMe();
        if (!botMember.permissions.has(PermissionFlagsBits.ViewAuditLog)) {
            console.error(`❌ Missing VIEW_AUDIT_LOG permission in ${guild.name}`);
            return;
        }

        // Wait for audit log
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Fetch unban audit logs
        const unbanLogs = await guild.fetchAuditLogs({
            type: AuditLogEvent.MemberBanRemove,
            limit: 5
        });

        const unbanEntry = unbanLogs.entries.find(entry => 
            entry.target.id === unbannedUser.id &&
            Date.now() - entry.createdTimestamp < 5000
        );

        if (!unbanEntry) {
            console.log(`⚠️ Unban detected for ${unbannedUser.tag} but no audit log entry found`);
            return;
        }

        const executor = unbanEntry.executor;
        const timestamp = new Date(unbanEntry.createdTimestamp);
        
        const isBot = executor.bot;

        // Build DM message
        let dmMessage = `✅ **Member UNBANNED from ${guild.name}**\n\n`;
        dmMessage += `**Unbanned Member:**\n`;
        dmMessage += `• Username: ${unbannedUser.tag}\n`;
        dmMessage += `• User ID: ${unbannedUser.id}\n\n`;
        
        if (isBot) {
            dmMessage += `**Executor (Bot):**\n`;
            dmMessage += `• Bot Name: ${executor.tag}\n`;
            dmMessage += `• Bot ID: ${executor.id}\n`;
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

        // Send DM
        await sendDM(dmMessage, `Unban notification sent for ${unbannedUser.tag}`);

    } catch (error) {
        console.error(`❌ Error processing unban:`, error);
    }
});

// Listen for member updates (timeouts/mutes)
client.on('guildMemberUpdate', async (oldMember, newMember) => {
    try {
        const guild = newMember.guild;
        
        // Check if timeout status changed
        const oldTimeout = oldMember.communicationDisabledUntil;
        const newTimeout = newMember.communicationDisabledUntil;
        
        // Ignore if no timeout change
        if (oldTimeout?.getTime() === newTimeout?.getTime()) {
            return;
        }

        // Check permissions
        const botMember = await guild.members.fetchMe();
        if (!botMember.permissions.has(PermissionFlagsBits.ViewAuditLog)) {
            console.error(`❌ Missing VIEW_AUDIT_LOG permission in ${guild.name}`);
            return;
        }

        // Wait for audit log
        await new Promise(resolve => setTimeout(resolve, 500));

        // Fetch member update audit logs
        const updateLogs = await guild.fetchAuditLogs({
            type: AuditLogEvent.MemberUpdate,
            limit: 10
        });

        // Find the timeout entry for this member
        const timeoutEntry = updateLogs.entries.find(entry => 
            entry.target.id === newMember.id &&
            Date.now() - entry.createdTimestamp < 5000 &&
            entry.changes.some(change => change.key === 'communication_disabled_until')
        );

        if (!timeoutEntry) {
            console.log(`⚠️ Timeout change detected for ${newMember.user.tag} but no audit log entry found`);
            return;
        }

        const executor = timeoutEntry.executor;
        const timestamp = new Date(timeoutEntry.createdTimestamp);
        
        const isBot = executor.bot;
        const isModerationBot = isBot && KNOWN_MOD_BOTS.some(botName => 
            executor.username.toLowerCase().includes(botName.toLowerCase())
        );

        // Determine if this is a mute or unmute
        const isMute = newTimeout && newTimeout > new Date();
        const actionEmoji = isMute ? '🔇' : '🔊';
        const actionText = isMute ? 'MUTED/TIMED OUT' : 'UNMUTED';

        // Build DM message
        let dmMessage = `${actionEmoji} **Member ${actionText} in ${guild.name}**\n\n`;
        dmMessage += `**${isMute ? 'Muted' : 'Unmuted'} Member:**\n`;
        dmMessage += `• Username: ${newMember.user.tag}\n`;
        dmMessage += `• User ID: ${newMember.user.id}\n\n`;
        
        if (isBot) {
            dmMessage += `**Executor (Bot):**\n`;
            dmMessage += `• Bot Name: ${executor.tag}\n`;
            dmMessage += `• Bot ID: ${executor.id}\n`;
            
            if (isModerationBot) {
                dmMessage += `• Type: Moderation Bot\n`;
                const actionNoun = isMute ? 'timeout' : 'timeout removal';
                dmMessage += `\n⚠️ *This ${actionNoun} was executed by a moderation bot. The actual moderator who triggered this action may not be logged in audit logs.*\n`;
            }
        } else {
            dmMessage += `**Executor (Human):**\n`;
            dmMessage += `• Username: ${executor.tag}\n`;
            dmMessage += `• User ID: ${executor.id}\n`;
        }
        
        if (isMute && newTimeout) {
            dmMessage += `\n**Timeout Duration:**\n`;
            const duration = Math.floor((newTimeout.getTime() - Date.now()) / 1000);
            const hours = Math.floor(duration / 3600);
            const minutes = Math.floor((duration % 3600) / 60);
            dmMessage += `• ${hours}h ${minutes}m remaining\n`;
            dmMessage += `• Expires: ${newTimeout.toLocaleString('en-US', { 
                dateStyle: 'full', 
                timeStyle: 'long' 
            })}\n`;
        }
        
        dmMessage += `\n**Timestamp:**\n`;
        dmMessage += `• ${timestamp.toLocaleString('en-US', { 
            dateStyle: 'full', 
            timeStyle: 'long' 
        })}\n`;
        dmMessage += `• Unix: ${Math.floor(timestamp.getTime() / 1000)}\n`;

        // Optional: Find human behind bot
        if (isModerationBot) {
            try {
                const humanBehindBot = await findHumanBehindBotAction(guild, executor, newMember.user, timestamp, isMute ? 'timeout' : 'unmute');
                if (humanBehindBot) {
                    dmMessage += `\n**Possible Human Moderator:**\n`;
                    dmMessage += `• ${humanBehindBot.tag} (${humanBehindBot.id})\n`;
                    dmMessage += `• *Best-effort detection from recent bot messages*\n`;
                }
            } catch (error) {
                console.log(`⚠️ Could not detect human behind bot: ${error.message}`);
            }
        }

        // Send DM
        await sendDM(dmMessage, `${isMute ? 'Mute' : 'Unmute'} notification sent for ${newMember.user.tag}`);

    } catch (error) {
        console.error(`❌ Error processing member update:`, error);
    }
});

/**
 * Helper function to send DMs
 * @param {string} message - The message to send
 * @param {string} logMessage - Success log message
 */
async function sendDM(message, logMessage) {
    try {
        const targetUser = await client.users.fetch(YOUR_USER_ID);
        await targetUser.send(message);
        console.log(`✅ ${logMessage}`);
    } catch (dmError) {
        console.error(`❌ Failed to send DM: ${dmError.message}`);
        if (dmError.code === 50007) {
            console.error(`   → User ${YOUR_USER_ID} has DMs disabled or doesn't share a server with the bot`);
        }
    }
}

/**
 * Best-effort attempt to find the human moderator behind a bot action
 * This searches recent messages from the moderation bot for moderator mentions
 * @param {Guild} guild - The guild where action occurred
 * @param {User} botExecutor - The bot that executed the action
 * @param {User} targetUser - The user who was targeted
 * @param {Date} actionTimestamp - When the action occurred
 * @param {string} actionType - Type of action (kick, ban, timeout, etc.)
 * @returns {Promise<User|null>} - The suspected human moderator or null
 */
async function findHumanBehindBotAction(guild, botExecutor, targetUser, actionTimestamp, actionType) {
    try {
        // Get all text channels
        const channels = guild.channels.cache.filter(c => c.isTextBased());
        
        // Search for recent bot messages (within 10 seconds of action)
        for (const [, channel] of channels) {
            try {
                const messages = await channel.messages.fetch({ limit: 10 });
                
                const relevantMessage = messages.find(msg => 
                    msg.author.id === botExecutor.id &&
                    Math.abs(msg.createdTimestamp - actionTimestamp.getTime()) < 10000 &&
                    (msg.content.includes(targetUser.tag) || 
                     msg.content.includes(targetUser.id) ||
                     msg.content.toLowerCase().includes(actionType))
                );
                
                if (relevantMessage) {
                    // Try to find mentioned users (excluding the target user)
                    const mentions = relevantMessage.mentions.users.filter(u => 
                        u.id !== targetUser.id && u.id !== botExecutor.id
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
