require('dotenv').config();
const { Client, GatewayIntentBits, AuditLogEvent, PermissionFlagsBits } = require('discord.js');
const fs = require('fs');
const path = require('path');

// Create Discord client with required intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers, // Required to detect member removals and updates
        GatewayIntentBits.GuildModeration, // Required for ban events
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent, // For optional bot message parsing
        GatewayIntentBits.GuildPresences // Required for status monitoring
    ]
});

// Configuration file path
const CONFIG_FILE = path.join(__dirname, 'config.json');
const PING_TRACKING_FILE = path.join(__dirname, 'ping_tracking.json');

// Load configuration
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            const data = fs.readFileSync(CONFIG_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading config:', error);
    }
    return {};
}

// Load ping tracking data
function loadPingTracking() {
    try {
        if (fs.existsSync(PING_TRACKING_FILE)) {
            const data = fs.readFileSync(PING_TRACKING_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading ping tracking:', error);
    }
    return {};
}

// Save ping tracking data
function savePingTracking(data) {
    try {
        fs.writeFileSync(PING_TRACKING_FILE, JSON.stringify(data, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving ping tracking:', error);
        return false;
    }
}

// Get today's date string
function getTodayDateString() {
    const today = new Date();
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

// Check and increment ping count for a guild
function checkPingLimit(guildId) {
    const tracking = loadPingTracking();
    const today = getTodayDateString();
    
    if (!tracking[guildId]) {
        tracking[guildId] = {};
    }
    
    if (!tracking[guildId][today]) {
        tracking[guildId][today] = 0;
    }
    
    const currentCount = tracking[guildId][today];
    
    if (currentCount >= 5) {
        return { allowed: false, count: currentCount };
    }
    
    tracking[guildId][today] = currentCount + 1;
    savePingTracking(tracking);
    
    return { allowed: true, count: currentCount + 1 };
}

// Manually approve ping for a guild
function approvePing(guildId, messageId) {
    const tracking = loadPingTracking();
    
    if (!tracking.pendingApprovals) {
        tracking.pendingApprovals = {};
    }
    
    tracking.pendingApprovals[messageId] = {
        guildId: guildId,
        approved: true,
        timestamp: Date.now()
    };
    
    savePingTracking(tracking);
}

// Save configuration
function saveConfig(config) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving config:', error);
        return false;
    }
}

// Get DM recipient for a guild
function getDMRecipient(guildId) {
    const config = loadConfig();
    return config[guildId]?.dmRecipient || null;
}

// Set DM recipient for a guild
function setDMRecipient(guildId, userId) {
    const config = loadConfig();
    if (!config[guildId]) {
        config[guildId] = {};
    }
    config[guildId].dmRecipient = userId;
    return saveConfig(config);
}

// Get custom invite message for a guild
function getInviteMessage(guildId) {
    const config = loadConfig();
    return config[guildId]?.inviteMessage || null;
}

// Set custom invite message for a guild
function setInviteMessage(guildId, message) {
    const config = loadConfig();
    if (!config[guildId]) {
        config[guildId] = {};
    }
    config[guildId].inviteMessage = message;
    return saveConfig(config);
}

// Get custom leave message for a guild
function getLeaveMessage(guildId) {
    const config = loadConfig();
    return config[guildId]?.leaveMessage || null;
}

// Set custom leave message for a guild
function setLeaveMessage(guildId, message) {
    const config = loadConfig();
    if (!config[guildId]) {
        config[guildId] = {};
    }
    config[guildId].leaveMessage = message;
    return saveConfig(config);
}

// Configuration - Replace these with your actual values
const YOUR_USER_ID = process.env.YOUR_USER_ID || 'YOUR_USER_ID_HERE';
const BOT_TOKEN = process.env.BOT_TOKEN || 'YOUR_BOT_TOKEN_HERE';

// DM Configuration
const DM_CONFIG = {
    MODERATION_ALERTS: process.env.MODERATION_ALERTS_USER_ID || YOUR_USER_ID, // Default to YOUR_USER_ID if not set
    WELCOME_INVITE: process.env.WELCOME_INVITE_MESSAGE || `🎉 Welcome to **{guild.name}**, {member.user.tag}!\n\nWe're so glad to have you here! 💝\n\n💎 **Join our main server and earn Robux rewards!**\n{YOUR_SERVER_INVITE}\n\n🎁 **Rewards Program:**\n• Earn 5 Robux for each person you invite!\n• Get 2 Robux just for joining!\n\nDon't miss out on this amazing opportunity! See you there! 🚀`
};


// Your server invite link - all new members will receive this
const YOUR_SERVER_INVITE = 'https://discord.gg/Wkwf9x3dA';

// Known moderation bots (add more as needed)
const KNOWN_MOD_BOTS = ['Arcane', 'MEE6', 'Dyno', 'Carl-bot', 'ProBot', 'Wick', 'Maki', 'YAGPDB'];

// Bot ready event
client.once('ready', () => {
    console.log(`✅ Bot is online as ${client.user.tag}`);


// Listen for new members joining ANY server the bot is in
client.on('guildMemberAdd', async (member) => {
    try {
        const guild = member.guild;

        // Send welcome message with server invitation to ALL servers
        try {
            // Check if this server has a custom invite message configured
            const customMessage = getInviteMessage(guild.id);
            
            let welcomeMessage;
            if (customMessage) {
                // Use custom message with placeholders
                welcomeMessage = customMessage
                    .replace(/{user}/g, member.user.tag)
                    .replace(/{server}/g, guild.name)
                    .replace(/{invite}/g, YOUR_SERVER_INVITE);
            } else {
                // Use default message
                welcomeMessage = DM_CONFIG.WELCOME_INVITE
                    .replace('{guild.name}', guild.name)
                    .replace('{member.user.tag}', member.user.tag)
                    .replace('{YOUR_SERVER_INVITE}', YOUR_SERVER_INVITE);
            }

            await member.user.send(welcomeMessage);
            console.log(`✅ Sent welcome + server invite to ${member.user.tag} in ${guild.name} (Guild ID: ${guild.id})`);
        } catch (dmError) {
            console.error(`❌ Failed to send welcome DM to ${member.user.tag} in ${guild.name}: ${dmError.message}`);
        }

    } catch (error) {
        console.error(`❌ Error processing member join:`, error);
    }
});

    console.log(`📋 Monitoring moderation actions in ${client.guilds.cache.size} server(s)`);
    console.log(`📬 DMs will be sent to user ID: ${DM_CONFIG.MODERATION_ALERTS}`);
    console.log(`🔍 Tracking: Kicks, Bans, Unbans, Timeouts/Mutes, Unmutes`);
});

// Listen for messages to check role permissions
client.on('messageCreate', async (message) => {
    // Ignore bot messages
    if (message.author.bot) return;

    // Check for @everyone or @here pings
    if (message.mentions.everyone && message.guild) {
        const guild = message.guild;
        const pingCheck = checkPingLimit(guild.id);
        
        if (!pingCheck.allowed) {
            // Limit exceeded - delete message and notify admin
            try {
                await message.delete();
                
                // DM the user who tried to ping
                try {
                    await message.author.send(`⚠️ Your @everyone/@here ping in **${guild.name}** was blocked. The server has reached its daily limit of 5 @everyone pings. An admin has been notified for approval.`);
                } catch (dmError) {
                    console.log(`Could not DM ${message.author.tag} about ping limit`);
                }
                
                // Get DM recipient for this guild or fallback to YOUR_USER_ID
                const recipientId = getDMRecipient(guild.id) || YOUR_USER_ID;
                const adminUser = await client.users.fetch(recipientId);
                
                // Send approval request to admin
                const approvalMessage = await adminUser.send(
                    `🚨 **@everyone Ping Limit Exceeded**\n\n` +
                    `**Server:** ${guild.name}\n` +
                    `**User:** ${message.author.tag} (${message.author.id})\n` +
                    `**Daily Limit:** 5 pings (already used)\n` +
                    `**Message Content:** ${message.content.substring(0, 200)}${message.content.length > 200 ? '...' : ''}\n\n` +
                    `**Actions:**\n` +
                    `• React with ✅ to allow this ping and send it\n` +
                    `• React with ❌ to deny (no action needed)\n` +
                    `• Ignore this message to deny`
                );
                
                // Add reactions for approval
                await approvalMessage.react('✅');
                await approvalMessage.react('❌');
                
                // Store pending approval data
                const tracking = loadPingTracking();
                if (!tracking.pendingApprovals) {
                    tracking.pendingApprovals = {};
                }
                tracking.pendingApprovals[approvalMessage.id] = {
                    guildId: guild.id,
                    userId: message.author.id,
                    channelId: message.channel.id,
                    content: message.content,
                    timestamp: Date.now()
                };
                savePingTracking(tracking);
                
                console.log(`⚠️ Blocked @everyone ping in ${guild.name} by ${message.author.tag} - limit exceeded`);
                
            } catch (error) {
                console.error('Error handling ping limit:', error);
            }
            return;
        } else {
            console.log(`✅ @everyone ping allowed in ${guild.name} (${pingCheck.count}/5 today)`);
        }
    }

    // Check for !help command (available to everyone)
    if (message.content.toLowerCase() === '!help' || message.content.toLowerCase() === '!commands') {
        const guild = message.guild;
        if (!guild) {
            await message.reply('❌ This command must be used in a server!');
            return;
        }

        const member = await guild.members.fetch(message.author.id);
        const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator) || guild.ownerId === message.author.id;

        let helpMessage = `🤖 **Bot Commands**\n\n`;
        
        if (isAdmin) {
            helpMessage += `**Admin Commands** (Requires Administrator or Server Owner):\n\n`;
            helpMessage += `• \`!setdm <user_id>\` - Set who receives moderation alerts for this server\n`;
            helpMessage += `• \`!setmessage <message>\` - Set custom welcome message for new members\n`;
            helpMessage += `• \`!setleavemessage <message>\` - Set custom message for members who leave\n\n`;
            helpMessage += `**Placeholders for messages:**\n`;
            helpMessage += `• \`{user}\` - Member's username\n`;
            helpMessage += `• \`{server}\` - Server name\n`;
            helpMessage += `• \`{invite}\` - Main server invite link\n\n`;
            helpMessage += `**Examples:**\n`;
            helpMessage += `\`!setmessage Welcome {user} to {server}! Join our main: {invite}\`\n`;
            helpMessage += `\`!setleavemessage Hey {user}! We miss you from {server}! Rejoin: {invite}\`\n`;
        } else {
            helpMessage += `Contact a server administrator to configure bot settings.\n\n`;
            helpMessage += `**What this bot does:**\n`;
            helpMessage += `• Sends welcome messages to new members\n`;
            helpMessage += `• Sends invite messages when members leave\n`;
            helpMessage += `• Monitors moderation actions (kicks, bans, timeouts)\n`;
        }

        await message.reply(helpMessage);
        return;
    }

    // Check for !setdm command (available to server admins)
    if (message.content.toLowerCase().startsWith('!setdm')) {
        try {
            const guild = message.guild;
            if (!guild) {
                await message.reply('❌ This command must be used in a server!');
                return;
            }

            // Check if user has administrator permission or is server owner
            const member = await guild.members.fetch(message.author.id);
            if (!member.permissions.has(PermissionFlagsBits.Administrator) && guild.ownerId !== message.author.id) {
                await message.reply('❌ You need Administrator permission or be the server owner to use this command!');
                return;
            }

            const args = message.content.split(' ');
            if (args.length < 2) {
                await message.reply('❌ Usage: `!setdm <user_id>`\nExample: `!setdm 123456789012345678`');
                return;
            }

            const userId = args[1].trim();
            
            // Validate user ID
            try {
                const user = await client.users.fetch(userId);
                
                // Save configuration
                if (setDMRecipient(guild.id, userId)) {
                    await message.reply(`✅ DM notifications for **${guild.name}** will now be sent to **${user.tag}** (ID: ${userId})`);
                    console.log(`✅ ${message.author.tag} configured DM recipient for ${guild.name}: ${user.tag}`);
                } else {
                    await message.reply('❌ Failed to save configuration. Please try again.');
                }
            } catch (error) {
                await message.reply('❌ Invalid user ID. Make sure the user exists and the bot can see them.');
            }
        } catch (error) {
            console.error('Error in !setdm command:', error);
            await message.reply('❌ An error occurred while processing the command.');
        }
        return;
    }

    // Check for !setmessage command (available to server admins/owner)
    if (message.content.toLowerCase().startsWith('!setmessage')) {
        try {
            const guild = message.guild;
            if (!guild) {
                await message.reply('❌ This command must be used in a server!');
                return;
            }

            // Check if user has administrator permission or is server owner
            const member = await guild.members.fetch(message.author.id);
            if (!member.permissions.has(PermissionFlagsBits.Administrator) && guild.ownerId !== message.author.id) {
                await message.reply('❌ You need Administrator permission or be the server owner to use this command!');
                return;
            }

            // Extract message after command
            const messageContent = message.content.substring('!setmessage'.length).trim();
            
            if (!messageContent) {
                await message.reply('❌ Usage: `!setmessage <your custom message>`\n\n' +
                    'Example: `!setmessage Hey {user}! We miss you in {server}! Come back: {invite}`\n\n' +
                    'Available placeholders:\n' +
                    '• `{user}` - Member\'s username\n' +
                    '• `{server}` - Server name\n' +
                    '• `{invite}` - Server invite link');
                return;
            }

            // Save configuration
            if (setInviteMessage(guild.id, messageContent)) {
                await message.reply(`✅ Custom invite message for **${guild.name}** has been set!\n\n**Preview:**\n${messageContent.replace('{user}', 'ExampleUser').replace('{server}', guild.name).replace('{invite}', 'https://discord.gg/example')}`);
                console.log(`✅ ${message.author.tag} configured invite message for ${guild.name}`);
            } else {
                await message.reply('❌ Failed to save configuration. Please try again.');
            }
        } catch (error) {
            console.error('Error in !setmessage command:', error);
            await message.reply('❌ An error occurred while processing the command.');
        }
        return;
    }

    // Check for !setleavemessage command (available to server admins/owner)
    if (message.content.toLowerCase().startsWith('!setleavemessage')) {
        try {
            const guild = message.guild;
            if (!guild) {
                await message.reply('❌ This command must be used in a server!');
                return;
            }

            // Check if user has administrator permission or is server owner
            const member = await guild.members.fetch(message.author.id);
            if (!member.permissions.has(PermissionFlagsBits.Administrator) && guild.ownerId !== message.author.id) {
                await message.reply('❌ You need Administrator permission or be the server owner to use this command!');
                return;
            }

            // Extract message after command
            const messageContent = message.content.substring('!setleavemessage'.length).trim();
            
            if (!messageContent) {
                await message.reply('❌ Usage: `!setleavemessage <your custom message>`\n\n' +
                    'Example: `!setleavemessage Hey {user}! We miss you in {server}! Come back: {invite}`\n\n' +
                    'Available placeholders:\n' +
                    '• `{user}` - Member\'s username\n' +
                    '• `{server}` - Server name\n' +
                    '• `{invite}` - Your main server invite link');
                return;
            }

            // Save configuration
            if (setLeaveMessage(guild.id, messageContent)) {
                await message.reply(`✅ Custom leave message for **${guild.name}** has been set!\n\n**Preview:**\n${messageContent.replace(/{user}/g, 'ExampleUser').replace(/{server}/g, guild.name).replace(/{invite}/g, YOUR_SERVER_INVITE)}`);
                console.log(`✅ ${message.author.tag} configured leave message for ${guild.name}`);
            } else {
                await message.reply('❌ Failed to save configuration. Please try again.');
            }
        } catch (error) {
            console.error('Error in !setleavemessage command:', error);
            await message.reply('❌ An error occurred while processing the command.');
        }
        return;
    }

    // Only respond to the configured user for other commands
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
                let comeBackMessage;
                
                // Check if custom leave message is configured for this guild
                const customLeaveMessage = getLeaveMessage(guild.id);
                
                if (customLeaveMessage) {
                    // Use custom leave message with placeholders
                    comeBackMessage = customLeaveMessage
                        .replace(/{user}/g, member.user.tag)
                        .replace(/{server}/g, guild.name)
                        .replace(/{invite}/g, YOUR_SERVER_INVITE);
                } else {
                    // Use default leave message
                    comeBackMessage = `👋 Hey ${member.user.tag}!\n\n` +
                        `We noticed you left **${guild.name}**. We'd love to have you back! 💝\n\n` +
                        `💎 **Join our main server:**\n${YOUR_SERVER_INVITE}\n\n` +
                        `We miss you already! Hope to see you soon! 💙`;
                }

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
        await sendDM(dmMessage, `Kick notification sent for ${removedUser.tag}`, guild.id);

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
        await sendDM(dmMessage, `Ban notification sent for ${bannedUser.tag}`, guild.id);

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
        await sendDM(dmMessage, `Unban notification sent for ${unbannedUser.tag}`, guild.id);

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

        if (isMute) {
            dmMessage += `\n**Timeout Duration:**\n`;
            dmMessage += `• Until: ${newTimeout.toLocaleString('en-US', { 
                dateStyle: 'full', 
                timeStyle: 'long' 
            })}\n`;
            dmMessage += `• Unix: ${Math.floor(newTimeout.getTime() / 1000)}\n`;
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
        await sendDM(dmMessage, `${isMute ? 'Mute' : 'Unmute'} notification sent for ${newMember.user.tag}`, guild.id);

    } catch (error) {
        console.error(`❌ Error processing member update:`, error);
    }
});

// Helper function to send moderation alert DMs
async function sendDM(message, logText, guildId) {
    try {
        // Get configured DM recipient for this guild
        const recipientId = getDMRecipient(guildId);
        
        if (!recipientId) {
            console.log(`⚠️ No DM recipient configured for guild ${guildId}. Use !setdm <user_id> to configure.`);
            return;
        }
        
        const user = await client.users.fetch(recipientId);
        await user.send(message);
        console.log(`✅ ${logText}`);
    } catch (error) {
        console.error(`❌ Failed to send DM: ${error.message}`);
    }
}

// Helper function to find human behind bot action (best-effort)
async function findHumanBehindBotAction(guild, botExecutor, targetUser, actionTimestamp, actionType) {
    try {
        // Get all text channels where bot has permission to read
        const channels = guild.channels.cache.filter(channel => 
            channel.isTextBased() && 
            channel.permissionsFor(guild.members.me).has(PermissionFlagsBits.ReadMessageHistory)
        );

        // Search for bot messages around the time of action (±10 seconds)
        const timeWindow = 10000;
        const startTime = actionTimestamp.getTime() - timeWindow;
        const endTime = actionTimestamp.getTime() + timeWindow;

        for (const [, channel] of channels) {
            try {
                const messages = await channel.messages.fetch({ limit: 20 });

                for (const [, msg] of messages) {
                    // Check if message is from the bot and within time window
                    if (msg.author.id === botExecutor.id && 
                        msg.createdTimestamp >= startTime && 
                        msg.createdTimestamp <= endTime) {

                        // Look for mentions or references to the action
                        const content = msg.content.toLowerCase();
                        const targetUsername = targetUser.username.toLowerCase();

                        if (content.includes(targetUsername) || 
                            content.includes(targetUser.id) ||
                            content.includes(actionType)) {

                            // Try to extract moderator mention from message
                            if (msg.mentions.users.size > 0) {
                                const possibleMod = msg.mentions.users.first();
                                if (possibleMod.id !== targetUser.id) {
                                    return possibleMod;
                                }
                            }
                        }
                    }
                }
            } catch (err) {
                // Skip channels we can't read
                continue;
            }
        }

        return null;
    } catch (error) {
        console.error(`Error finding human behind bot:`, error);
        return null;
    }
}

// Listen for reactions on approval messages
client.on('messageReactionAdd', async (reaction, user) => {
    // Ignore bot reactions
    if (user.bot) return;
    
    try {
        // Fetch the message if it's partial
        if (reaction.partial) {
            await reaction.fetch();
        }
        if (reaction.message.partial) {
            await reaction.message.fetch();
        }
        
        const tracking = loadPingTracking();
        if (!tracking.pendingApprovals || !tracking.pendingApprovals[reaction.message.id]) {
            return;
        }
        
        const approval = tracking.pendingApprovals[reaction.message.id];
        
        // Check if reactor is authorized (DM recipient for guild or YOUR_USER_ID)
        const authorizedId = getDMRecipient(approval.guildId) || YOUR_USER_ID;
        if (user.id !== authorizedId) {
            return;
        }
        
        if (reaction.emoji.name === '✅') {
            // Approved - send the message
            try {
                const guild = await client.guilds.fetch(approval.guildId);
                const channel = await guild.channels.fetch(approval.channelId);
                const pingUser = await client.users.fetch(approval.userId);
                
                await channel.send(`${approval.content}\n\n*— Approved @everyone ping from ${pingUser.tag}*`);
                
                await reaction.message.edit(reaction.message.content + '\n\n✅ **APPROVED** - Message sent!');
                
                // Notify the user
                try {
                    await pingUser.send(`✅ Your @everyone ping in **${guild.name}** has been approved and sent!`);
                } catch (e) {}
                
                console.log(`✅ Approved @everyone ping for ${pingUser.tag} in ${guild.name}`);
                
            } catch (error) {
                await reaction.message.edit(reaction.message.content + '\n\n❌ **ERROR** - Could not send message: ' + error.message);
            }
            
            // Clean up approval
            delete tracking.pendingApprovals[reaction.message.id];
            savePingTracking(tracking);
            
        } else if (reaction.emoji.name === '❌') {
            // Denied
            const guild = await client.guilds.fetch(approval.guildId);
            const pingUser = await client.users.fetch(approval.userId);
            
            await reaction.message.edit(reaction.message.content + '\n\n❌ **DENIED**');
            
            // Notify the user
            try {
                await pingUser.send(`❌ Your @everyone ping in **${guild.name}** was denied by an admin.`);
            } catch (e) {}
            
            console.log(`❌ Denied @everyone ping for ${pingUser.tag} in ${guild.name}`);
            
            // Clean up approval
            delete tracking.pendingApprovals[reaction.message.id];
            savePingTracking(tracking);
        }
        
    } catch (error) {
        console.error('Error handling reaction:', error);
    }
});

// Wake-up monitoring configuration
// ⚠️ This system DMs ONLY ONE USER (the targetUserId below) - NOT everyone!
const WAKE_UP_CONFIG = {
    targetUserId: 'REPLACE_WITH_USER_ID', // ⚠️ REPLACE THIS with the actual Discord user ID of ONE person to wake up
    targetChannelId: '1426252744586690792', // Channel where user should type "waked up"
    messageInterval: 3000, // 3 seconds between messages to respect rate limits
    pingInterval: 5, // Ping every 5th message
    isActive: false,
    messageCount: 0,
    lastStatus: null,
    statusCheckInterval: null
};

// Load wake-up state
const WAKEUP_STATE_FILE = path.join(__dirname, 'wakeup_state.json');

function loadWakeUpState() {
    try {
        if (fs.existsSync(WAKEUP_STATE_FILE)) {
            const data = fs.readFileSync(WAKEUP_STATE_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error loading wake-up state:', error);
    }
    return { isActive: false, messageCount: 0 };
}

function saveWakeUpState(state) {
    try {
        fs.writeFileSync(WAKEUP_STATE_FILE, JSON.stringify(state, null, 2));
    } catch (error) {
        console.error('Error saving wake-up state:', error);
    }
}

// Start wake-up monitoring
async function startWakeUpMonitoring() {
    const state = loadWakeUpState();
    
    // Validate user exists
    try {
        await client.users.fetch(WAKE_UP_CONFIG.targetUserId);
    } catch (error) {
        console.error(`❌ Cannot find user with ID ${WAKE_UP_CONFIG.targetUserId}`);
        return false;
    }
    
    // Validate channel exists
    try {
        await client.channels.fetch(WAKE_UP_CONFIG.targetChannelId);
    } catch (error) {
        console.error(`❌ Cannot find channel with ID ${WAKE_UP_CONFIG.targetChannelId}`);
        return false;
    }
    
    WAKE_UP_CONFIG.isActive = true;
    WAKE_UP_CONFIG.messageCount = state.messageCount || 0;
    
    console.log(`🔔 Wake-up monitoring started for user ${WAKE_UP_CONFIG.targetUserId}`);
    
    const sendWakeUpDM = async () => {
        if (!WAKE_UP_CONFIG.isActive) {
            return;
        }
        
        try {
            const user = await client.users.fetch(WAKE_UP_CONFIG.targetUserId);
            
            // Get user's presence status across all guilds
            let userStatus = null;
            for (const [guildId, guild] of client.guilds.cache) {
                try {
                    const member = await guild.members.fetch(WAKE_UP_CONFIG.targetUserId);
                    if (member && member.presence) {
                        userStatus = member.presence.status;
                        break;
                    }
                } catch (err) {
                    // User not in this guild, continue
                }
            }
            
            // If status is invisible/offline, skip sending DM
            if (userStatus === 'offline' || userStatus === 'invisible') {
                console.log(`⏸️ User ${user.tag} is ${userStatus || 'offline'}, skipping DM (will ping when online)`);
                // Schedule next check with rate limit delay
                setTimeout(sendWakeUpDM, WAKE_UP_CONFIG.messageInterval);
                return;
            }
            
            WAKE_UP_CONFIG.messageCount++;
            
            let message = `⏰ **WAKE UP TIME!** ⏰\n\n`;
            message += `🌅 Good morning! It's time to wake up and check the server!\n\n`;
            message += `📨 **Wake-up Message #${WAKE_UP_CONFIG.messageCount}**\n`;
            
            // Add ping every 5th message OR if user just came online
            const justCameOnline = WAKE_UP_CONFIG.lastStatus === 'offline' && (userStatus === 'online' || userStatus === 'dnd' || userStatus === 'idle');
            
            if (WAKE_UP_CONFIG.messageCount % WAKE_UP_CONFIG.pingInterval === 0 || justCameOnline) {
                message += `\n🔔 **PING! ${justCameOnline ? '🟢 You just came online!' : `This is ping #${Math.floor(WAKE_UP_CONFIG.messageCount / WAKE_UP_CONFIG.pingInterval)}!`}** 🔔\n`;
            }
            
            message += `\n✅ **To stop these messages:**\nType \`waked up\` in <#${WAKE_UP_CONFIG.targetChannelId}>\n\n`;
            message += `💤 Still sleeping? These messages will keep coming until you wake up!`;
            
            await user.send(message);
            console.log(`✅ Sent wake-up DM #${WAKE_UP_CONFIG.messageCount} to ${user.tag} (status: ${userStatus})${WAKE_UP_CONFIG.messageCount % WAKE_UP_CONFIG.pingInterval === 0 || justCameOnline ? ' (WITH PING)' : ''}`);
            
            // Update last status
            WAKE_UP_CONFIG.lastStatus = userStatus;
            
            // Save state
            saveWakeUpState({
                isActive: WAKE_UP_CONFIG.isActive,
                messageCount: WAKE_UP_CONFIG.messageCount
            });
            
            // Schedule next message with rate limit delay
            setTimeout(sendWakeUpDM, WAKE_UP_CONFIG.messageInterval);
            
        } catch (error) {
            console.error(`❌ Failed to send wake-up DM:`, error);
            // Retry after a longer delay if there's an error
            setTimeout(sendWakeUpDM, WAKE_UP_CONFIG.messageInterval * 2);
        }
    };
    
    // Start sending messages
    sendWakeUpDM();
}

// Stop wake-up monitoring
function stopWakeUpMonitoring() {
    WAKE_UP_CONFIG.isActive = false;
    const totalMessages = WAKE_UP_CONFIG.messageCount;
    WAKE_UP_CONFIG.messageCount = 0;
    WAKE_UP_CONFIG.lastStatus = null;
    
    saveWakeUpState({
        isActive: false,
        messageCount: 0
    });
    
    console.log(`🛑 Wake-up monitoring stopped. Sent ${totalMessages} total messages.`);
    return totalMessages;
}

// Monitor for "waked up" message
client.on('messageCreate', async (message) => {
    // Check if it's the target user in the target channel saying "waked up"
    if (message.author.id === WAKE_UP_CONFIG.targetUserId && 
        message.channel.id === WAKE_UP_CONFIG.targetChannelId &&
        message.content.toLowerCase().includes('waked up')) {
        
        if (WAKE_UP_CONFIG.isActive) {
            const totalMessages = stopWakeUpMonitoring();
            
            try {
                await message.reply(`✅ Good morning! You're finally awake! I sent you ${totalMessages} messages to wake you up. 😊`);
                
                const user = await client.users.fetch(WAKE_UP_CONFIG.targetUserId);
                await user.send(`✅ Wake-up monitoring stopped! You responded after ${totalMessages} messages. Have a great day! 🌟`);
            } catch (error) {
                console.error('Error sending confirmation:', error);
            }
        }
    }
    
    // Original message handling code continues here...
    if (message.author.bot) return;

    // Check for @everyone or @here pings
    if (message.mentions.everyone && message.guild) {
        const guild = message.guild;
        const pingCheck = checkPingLimit(guild.id);
        
        if (!pingCheck.allowed) {
            // Limit exceeded - delete message and notify admin
            try {
                await message.delete();
                
                // DM the user who tried to ping
                try {
                    await message.author.send(`⚠️ Your @everyone/@here ping in **${guild.name}** was blocked. The server has reached its daily limit of 5 @everyone pings. An admin has been notified for approval.`);
                } catch (dmError) {
                    console.log(`Could not DM ${message.author.tag} about ping limit`);
                }
                
                // Get DM recipient for this guild or fallback to YOUR_USER_ID
                const recipientId = getDMRecipient(guild.id) || YOUR_USER_ID;
                const adminUser = await client.users.fetch(recipientId);
                
                // Send approval request to admin
                const approvalMessage = await adminUser.send(
                    `🚨 **@everyone Ping Limit Exceeded**\n\n` +
                    `**Server:** ${guild.name}\n` +
                    `**User:** ${message.author.tag} (${message.author.id})\n` +
                    `**Daily Limit:** 5 pings (already used)\n` +
                    `**Message Content:** ${message.content.substring(0, 200)}${message.content.length > 200 ? '...' : ''}\n\n` +
                    `**Actions:**\n` +
                    `• React with ✅ to allow this ping and send it\n` +
                    `• React with ❌ to deny (no action needed)\n` +
                    `• Ignore this message to deny`
                );
                
                // Add reactions for approval
                await approvalMessage.react('✅');
                await approvalMessage.react('❌');
                
                // Store pending approval data
                const tracking = loadPingTracking();
                if (!tracking.pendingApprovals) {
                    tracking.pendingApprovals = {};
                }
                tracking.pendingApprovals[approvalMessage.id] = {
                    guildId: guild.id,
                    userId: message.author.id,
                    channelId: message.channel.id,
                    content: message.content,
                    timestamp: Date.now()
                };
                savePingTracking(tracking);
                
                console.log(`⚠️ Blocked @everyone ping in ${guild.name} by ${message.author.tag} - limit exceeded`);
                
            } catch (error) {
                console.error('Error handling ping limit:', error);
            }
            return;
        } else {
            console.log(`✅ @everyone ping allowed in ${guild.name} (${pingCheck.count}/5 today)`);
        }
    }

    // Check for !help command (available to everyone)
    if (message.content.toLowerCase() === '!help' || message.content.toLowerCase() === '!commands') {
        const guild = message.guild;
        if (!guild) {
            await message.reply('❌ This command must be used in a server!');
            return;
        }

        const member = await guild.members.fetch(message.author.id);
        const isAdmin = member.permissions.has(PermissionFlagsBits.Administrator) || guild.ownerId === message.author.id;

        let helpMessage = `🤖 **Bot Commands**\n\n`;
        
        if (isAdmin) {
            helpMessage += `**Admin Commands** (Requires Administrator or Server Owner):\n\n`;
            helpMessage += `• \`!setdm <user_id>\` - Set who receives moderation alerts for this server\n`;
            helpMessage += `• \`!setmessage <message>\` - Set custom welcome message for new members\n`;
            helpMessage += `• \`!setleavemessage <message>\` - Set custom message for members who leave\n`;
            helpMessage += `• \`!startwakeup\` - Start wake-up monitoring for configured user\n`;
            helpMessage += `• \`!stopwakeup\` - Stop wake-up monitoring\n`;
            helpMessage += `• \`!dmallusers <message>\` - Send DM to ALL users in this server\n\n`;
            helpMessage += `**Placeholders for messages:**\n`;
            helpMessage += `• \`{user}\` - Member's username\n`;
            helpMessage += `• \`{server}\` - Server name\n`;
            helpMessage += `• \`{invite}\` - Main server invite link\n\n`;
            helpMessage += `**Examples:**\n`;
            helpMessage += `\`!setmessage Welcome {user} to {server}! Join our main: {invite}\`\n`;
            helpMessage += `\`!setleavemessage Hey {user}! We miss you from {server}! Rejoin: {invite}\`\n`;
            helpMessage += `\`!dmallusers Wake up everyone! Important server announcement!\`\n`;
        } else {
            helpMessage += `Contact a server administrator to configure bot settings.\n\n`;
            helpMessage += `**What this bot does:**\n`;
            helpMessage += `• Sends welcome messages to new members\n`;
            helpMessage += `• Sends invite messages when members leave\n`;
            helpMessage += `• Monitors moderation actions (kicks, bans, timeouts)\n`;
        }

        await message.reply(helpMessage);
        return;
    }

    // Check for !startwakeup command (admin only)
    if (message.content.toLowerCase() === '!startwakeup') {
        const guild = message.guild;
        if (!guild) {
            await message.reply('❌ This command must be used in a server!');
            return;
        }

        const member = await guild.members.fetch(message.author.id);
        if (!member.permissions.has(PermissionFlagsBits.Administrator) && guild.ownerId !== message.author.id) {
            await message.reply('❌ You need Administrator permission or be the server owner to use this command!');
            return;
        }

        if (WAKE_UP_CONFIG.isActive) {
            await message.reply('⚠️ Wake-up monitoring is already active!');
            return;
        }

        const started = await startWakeUpMonitoring();
        if (started === false) {
            await message.reply('❌ Failed to start wake-up monitoring. Check that the user ID and channel ID in the config are valid.');
            return;
        }
        
        await message.reply(`✅ Wake-up monitoring started! User <@${WAKE_UP_CONFIG.targetUserId}> will receive DMs every 3 seconds (with a ping every 5th message) until they type "waked up" in <#${WAKE_UP_CONFIG.targetChannelId}>.`);
        return;
    }

    // Check for !stopwakeup command (admin only)
    if (message.content.toLowerCase() === '!stopwakeup') {
        const guild = message.guild;
        if (!guild) {
            await message.reply('❌ This command must be used in a server!');
            return;
        }

        const member = await guild.members.fetch(message.author.id);
        if (!member.permissions.has(PermissionFlagsBits.Administrator) && guild.ownerId !== message.author.id) {
            await message.reply('❌ You need Administrator permission or be the server owner to use this command!');
            return;
        }

        if (!WAKE_UP_CONFIG.isActive) {
            await message.reply('⚠️ Wake-up monitoring is not currently active!');
            return;
        }

        const totalMessages = stopWakeUpMonitoring();
        await message.reply(`✅ Wake-up monitoring stopped! Sent ${totalMessages} total messages.`);
        return;
    }

    // Check for !dmallusers command (admin only) - sends DM to ALL users in the server
    if (message.content.toLowerCase().startsWith('!dmallusers')) {
        const guild = message.guild;
        if (!guild) {
            await message.reply('❌ This command must be used in a server!');
            return;
        }

        const member = await guild.members.fetch(message.author.id);
        if (!member.permissions.has(PermissionFlagsBits.Administrator) && guild.ownerId !== message.author.id) {
            await message.reply('❌ You need Administrator permission or be the server owner to use this command!');
            return;
        }

        // Extract custom message
        const customDM = message.content.substring('!dmallusers'.length).trim();
        
        if (!customDM) {
            await message.reply('❌ Usage: `!dmallusers <your message>`\n\nExample: `!dmallusers Wake up! Important announcement!`');
            return;
        }

        await message.reply('🔄 Starting to DM all users... This may take a while.');

        // Fetch all members
        await guild.members.fetch();
        const allMembers = guild.members.cache.filter(m => !m.user.bot); // Exclude bots
        
        let successCount = 0;
        let failCount = 0;

        for (const [userId, guildMember] of allMembers) {
            try {
                await guildMember.user.send(`📢 **Message from ${guild.name}:**\n\n${customDM}`);
                successCount++;
                console.log(`✅ Sent DM to ${guildMember.user.tag}`);
                
                // Rate limit: wait 1 second between DMs to avoid being flagged
                await new Promise(resolve => setTimeout(resolve, 1000));
            } catch (error) {
                failCount++;
                console.log(`❌ Failed to DM ${guildMember.user.tag}: ${error.message}`);
            }
        }

        await message.reply(`✅ DM campaign complete!\n\n📊 **Results:**\n• ✅ Successful: ${successCount}\n• ❌ Failed: ${failCount}\n• 👥 Total users: ${allMembers.size}`);
        return;
    }

    // Check for !setdm command (available to server admins)
    if (message.content.toLowerCase().startsWith('!setdm')) {
        try {
            const guild = message.guild;
            if (!guild) {
                await message.reply('❌ This command must be used in a server!');
                return;
            }

            // Check if user has administrator permission or is server owner
            const member = await guild.members.fetch(message.author.id);
            if (!member.permissions.has(PermissionFlagsBits.Administrator) && guild.ownerId !== message.author.id) {
                await message.reply('❌ You need Administrator permission or be the server owner to use this command!');
                return;
            }

            const args = message.content.split(' ');
            if (args.length < 2) {
                await message.reply('❌ Usage: `!setdm <user_id>`\nExample: `!setdm 123456789012345678`');
                return;
            }

            const userId = args[1].trim();
            
            // Validate user ID
            try {
                const user = await client.users.fetch(userId);
                
                // Save configuration
                if (setDMRecipient(guild.id, userId)) {
                    await message.reply(`✅ DM notifications for **${guild.name}** will now be sent to **${user.tag}** (ID: ${userId})`);
                    console.log(`✅ ${message.author.tag} configured DM recipient for ${guild.name}: ${user.tag}`);
                } else {
                    await message.reply('❌ Failed to save configuration. Please try again.');
                }
            } catch (error) {
                await message.reply('❌ Invalid user ID. Make sure the user exists and the bot can see them.');
            }
        } catch (error) {
            console.error('Error in !setdm command:', error);
            await message.reply('❌ An error occurred while processing the command.');
        }
        return;
    }

    // Check for !setmessage command (available to server admins/owner)
    if (message.content.toLowerCase().startsWith('!setmessage')) {
        try {
            const guild = message.guild;
            if (!guild) {
                await message.reply('❌ This command must be used in a server!');
                return;
            }

            // Check if user has administrator permission or is server owner
            const member = await guild.members.fetch(message.author.id);
            if (!member.permissions.has(PermissionFlagsBits.Administrator) && guild.ownerId !== message.author.id) {
                await message.reply('❌ You need Administrator permission or be the server owner to use this command!');
                return;
            }

            // Extract message after command
            const messageContent = message.content.substring('!setmessage'.length).trim();
            
            if (!messageContent) {
                await message.reply('❌ Usage: `!setmessage <your custom message>`\n\n' +
                    'Example: `!setmessage Hey {user}! We miss you in {server}! Come back: {invite}`\n\n' +
                    'Available placeholders:\n' +
                    '• `{user}` - Member\'s username\n' +
                    '• `{server}` - Server name\n' +
                    '• `{invite}` - Server invite link');
                return;
            }

            // Save configuration
            if (setInviteMessage(guild.id, messageContent)) {
                await message.reply(`✅ Custom invite message for **${guild.name}** has been set!\n\n**Preview:**\n${messageContent.replace('{user}', 'ExampleUser').replace('{server}', guild.name).replace('{invite}', 'https://discord.gg/example')}`);
                console.log(`✅ ${message.author.tag} configured invite message for ${guild.name}`);
            } else {
                await message.reply('❌ Failed to save configuration. Please try again.');
            }
        } catch (error) {
            console.error('Error in !setmessage command:', error);
            await message.reply('❌ An error occurred while processing the command.');
        }
        return;
    }

    // Check for !setleavemessage command (available to server admins/owner)
    if (message.content.toLowerCase().startsWith('!setleavemessage')) {
        try {
            const guild = message.guild;
            if (!guild) {
                await message.reply('❌ This command must be used in a server!');
                return;
            }

            // Check if user has administrator permission or is server owner
            const member = await guild.members.fetch(message.author.id);
            if (!member.permissions.has(PermissionFlagsBits.Administrator) && guild.ownerId !== message.author.id) {
                await message.reply('❌ You need Administrator permission or be the server owner to use this command!');
                return;
            }

            // Extract message after command
            const messageContent = message.content.substring('!setleavemessage'.length).trim();
            
            if (!messageContent) {
                await message.reply('❌ Usage: `!setleavemessage <your custom message>`\n\n' +
                    'Example: `!setleavemessage Hey {user}! We miss you in {server}! Come back: {invite}`\n\n' +
                    'Available placeholders:\n' +
                    '• `{user}` - Member\'s username\n' +
                    '• `{server}` - Server name\n' +
                    '• `{invite}` - Your main server invite link');
                return;
            }

            // Save configuration
            if (setLeaveMessage(guild.id, messageContent)) {
                await message.reply(`✅ Custom leave message for **${guild.name}** has been set!\n\n**Preview:**\n${messageContent.replace(/{user}/g, 'ExampleUser').replace(/{server}/g, guild.name).replace(/{invite}/g, YOUR_SERVER_INVITE)}`);
                console.log(`✅ ${message.author.tag} configured leave message for ${guild.name}`);
            } else {
                await message.reply('❌ Failed to save configuration. Please try again.');
            }
        } catch (error) {
            console.error('Error in !setleavemessage command:', error);
            await message.reply('❌ An error occurred while processing the command.');
        }
        return;
    }

    // Only respond to the configured user for other commands
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

// Don't auto-start wake-up monitoring - must be manually triggered with !startwakeup command

// Login
client.login(BOT_TOKEN);