require('dotenv').config();
const { Client, GatewayIntentBits, PermissionFlagsBits, EmbedBuilder, Collection } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates // Required for voice chat mutations
    ]
});

// Runtime data caches for auditing logs (resets when the bot restarts)
const globalBotLogs = [];
const runningChatLogs = new Map(); // Maps userId -> array of recent messages
const cooldowns = new Collection();

client.once('ready', () => {
    console.log(`🚀 Success! Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    // --- CHAT LOGGING BACKGROUND LISTENER ---
    if (!runningChatLogs.has(message.author.id)) {
        runningChatLogs.set(message.author.id, []);
    }
    const userLog = runningChatLogs.get(message.author.id);
    userLog.push({
        content: message.content,
        channel: message.channel.name,
        timestamp: new Date().toLocaleTimeString()
    });
    // Cap at last 100 entries per user to conserve active server memory space
    if (userLog.length > 100) userLog.shift();


    const prefix = '!';
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    // Helper function for quick error cards
    const sendError = (msg, text) => {
        const errorEmbed = new EmbedBuilder()
            .setColor(0xFF3333)
            .setDescription(`❌ ${text}`);
        return msg.reply({ embeds: [errorEmbed] });
    };

    // --- ENFORCED GLOBAL COMMAND COOLDOWN (2 SECONDS) ---
    const now = Date.now();
    const cooldownAmount = 2 * 1000;

    if (!cooldowns.has(command)) {
        cooldowns.set(command, new Collection());
    }

    const timestamps = cooldowns.get(command);
    if (timestamps.has(message.author.id)) {
        const expirationTime = timestamps.get(message.author.id) + cooldownAmount;

        if (now < expirationTime) {
            const timeLeft = ((expirationTime - now) / 1000).toFixed(1);
            return message.reply(`⚠️ Please slow down! Wait **${timeLeft}s** before using the \`${command}\` command again.`)
                .then(msg => setTimeout(() => msg.delete().catch(() => {}), 3000));
        }
    }

    timestamps.set(message.author.id, now);
    setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);


    // --- BOT ACTIONS BACKGROUND LOGGER ---
    globalBotLogs.push({
        user: message.author.tag,
        userId: message.author.id,
        command: `!${command} ${args.join(" ")}`.trim(),
        timestamp: new Date().toLocaleTimeString()
    });
    if (globalBotLogs.length > 150) globalBotLogs.shift(); // Bound memory leakage limits


    // Utility Command: Ping
    if (command === 'ping') {
        const pingEmbed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('🏓 Pong!')
            .setDescription(`Latency is **${Date.now() - message.createdTimestamp}ms**.\nAPI Latency is **${Math.round(client.ws.ping)}ms**.`)
            .setTimestamp();
        return message.reply({ embeds: [pingEmbed] });
    }

    // Utility Command: Help menu
    if (command === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle('🛡️ Eazy Moderation | Commands Menu')
            .setDescription('Here is a complete list of administrative commands available for this bot. Ensure roles are properly configured.')
            .addFields(
                { name: '⚙️ Utilities', value: '`!ping` - Check bot status & latency.\n`!help` - Display this modern interface.\n`!check [executor]` - Check real-time exploit statuses.\n`!botlogs` - Display recent commands executed on this system.' },
                { name: '🔨 Punishments', value: '`!kick @user [reason]` - Kick a member.\n`!ban @user [reason]` - Permanently ban a member.\n`!unban [UserID]` - Revoke a ban.\n`!warn @user [reason]` - Record official warning logs.' },
                { name: '🤫 Restraints & Voice', value: '`!mute @user [reason]` - Timeout a user for 24 hours.\n`!unmute @user` - Lift structural limitations.\n`!mutevc @user` - Toggle audio server voice mute.\n`!deafen @user` - Toggle system voice deafen.' },
                { name: '🧹 Management', value: '`!clear [1-100]` - Wipe recent message flows.\n`!chatlogs @user` - Review targeted text streams.' }
            )
            .setFooter({ text: `${client.user.username} Modern System`, iconURL: client.user.displayAvatarURL() })
            .setTimestamp();
        return message.reply({ embeds: [helpEmbed] });
    }

    // --- MODERATION COMMANDS ---

    // 1. KICK
    if (command === 'kick') {
        if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {
            return sendError(message, "You don't have permission to kick members.");
        }
        const target = message.mentions.members.first();
        if (!target) return sendError(message, "Please mention a valid user to kick.");
        if (!target.kickable) return sendError(message, "I cannot kick this user. Check my role hierarchy position.");

        const reason = args.slice(1).join(" ") || "No reason specified";
        await target.kick(reason);

        const kickEmbed = new EmbedBuilder()
            .setColor(0xE74C3C)
            .setTitle('👢 Member Kicked')
            .addFields(
                { name: 'User', value: `${target.user.tag} (${target.id})`, inline: true },
                { name: 'Moderator', value: `${message.author.tag}`, inline: true },
                { name: 'Reason', value: `*${reason}*` }
            )
            .setTimestamp();
        return message.reply({ embeds: [kickEmbed] });
    }

    // 2. BAN
    if (command === 'ban') {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return sendError(message, "You don't have permission to ban members.");
        }
        const target = message.mentions.members.first();
        if (!target) return sendError(message, "Please mention a valid user to ban.");
        if (!target.bannable) return sendError(message, "I cannot ban this user. Check my role hierarchy position.");

        const reason = args.slice(1).join(" ") || "No reason specified";
        await target.ban({ reason: reason });

        const banEmbed = new EmbedBuilder()
            .setColor(0x992D22)
            .setTitle('⛔ Member Banned')
            .addFields(
                { name: 'User', value: `${target.user.tag} (${target.id})`, inline: true },
                { name: 'Moderator', value: `${message.author.tag}`, inline: true },
                { name: 'Reason', value: `*${reason}*` }
            )
            .setTimestamp();
        return message.reply({ embeds: [banEmbed] });
    }

    // 3. UNBAN
    if (command === 'unban') {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {
            return sendError(message, "You don't have permission to unban members.");
        }
        const targetId = args[0];
        if (!targetId) return sendError(message, "Please provide a valid User ID to unban.");

        try {
            await message.guild.members.unban(targetId);
            const unbanEmbed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle('🔓 Member Unbanned')
                .setDescription(`Successfully revoked ban for User ID: **${targetId}**`)
                .setTimestamp();
            return message.reply({ embeds: [unbanEmbed] });
        } catch (error) {
            return sendError(message, "Failed to unban. Make sure the ID is correct and they are actually banned.");
        }
    }

    // 4. MUTE (TIMEOUT)
    if (command === 'mute') {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return sendError(message, "You don't have permission to mute members.");
        }
        const target = message.mentions.members.first();
        if (!target) return sendError(message, "Please mention a user to mute.");

        const reason = args.slice(1).join(" ") || "No reason specified";
        try {
            await target.timeout(24 * 60 * 60 * 1000, reason);
            const muteEmbed = new EmbedBuilder()
                .setColor(0xE67E22)
                .setTitle('🔇 Member Muted')
                .addFields(
                    { name: 'User', value: `${target.user.tag}`, inline: true },
                    { name: 'Duration', value: `24 Hours`, inline: true },
                    { name: 'Reason', value: `*${reason}*` }
                )
                .setTimestamp();
            return message.reply({ embeds: [muteEmbed] });
        } catch (error) {
            return sendError(message, "I couldn't mute this user. Check my permissions hierarchy.");
        }
    }

    // 5. UNMUTE
    if (command === 'unmute') {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return sendError(message, "You don't have permission to unmute members.");
        }
        const target = message.mentions.members.first();
        if (!target) return sendError(message, "Please mention a user to unmute.");

        try {
            await target.timeout(null);
            const unmuteEmbed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle('🔊 Member Unmuted')
                .setDescription(`Timeout restriction lifted for **${target.user.tag}**.`)
                .setTimestamp();
            return message.reply({ embeds: [unmuteEmbed] });
        } catch (error) {
            return sendError(message, "Failed to remove timeout from this user.");
        }
    }

    // 6. CLEAR / PURGE
    if (command === 'clear' || command === 'purge') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return sendError(message, "You don't have permission to delete messages.");
        }
        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount < 1 || amount > 100) {
            return sendError(message, "Please enter a number between 1 and 100 indicating how many messages to clear.");
        }

        await message.channel.bulkDelete(amount + 1, true)
            .then(messages => {
                const clearEmbed = new EmbedBuilder()
                    .setColor(0xF1C40F)
                    .setDescription(`🧹 **Chat Cleaned!** Successfully deleted **${messages.size - 1}** messages.`);
                
                message.channel.send({ embeds: [clearEmbed] }).then(msg => {
                    setTimeout(() => msg.delete(), 4000); 
                });
            })
            .catch(() => sendError(message, "Messages older than 14 days cannot be bulk deleted by Discord API limitations."));
    }

    // 7. WARN
    if (command === 'warn') {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            return sendError(message, "You don't have permission to warn members.");
        }
        const target = message.mentions.users.first();
        if (!target) return sendError(message, "Please mention a valid member to warn.");
        
        const reason = args.slice(1).join(" ") || "No reason specified";
        const warnEmbed = new EmbedBuilder()
            .setColor(0xE67E22)
            .setTitle('⚠️ Official Warning Issued')
            .setDescription(`${target}, you have received an official structural warning. Please adjust your conduct accordingly.`)
            .addFields(
                { name: 'Warned User', value: `${target.tag}`, inline: true },
                { name: 'Issued By', value: `${message.author.tag}`, inline: true },
                { name: 'Infraction Reason', value: `*${reason}*` }
            )
            .setTimestamp();
        return message.channel.send({ content: `${target}`, embeds: [warnEmbed] });
    }

    // 8. CHECK EXECUTORS STATUS LINK
    if (command === 'check') {
        const query = args.join(" ");
        if (!query) return sendError(message, "Please specify an executor name to lookup. Example: `!check real`");

        const processingMessage = await message.reply("Checking..");

        try {
            const response = await fetch('https://weao.xyz/api/status/exploits');
            if (!response.ok) throw new Error("API status fault.");
            
            const executorsList = await response.json();
            const matchedExecutor = executorsList.find(e => e.title && e.title.toLowerCase() === query.toLowerCase());

            if (!matchedExecutor) {
                const notFoundEmbed = new EmbedBuilder()
                    .setColor(0xFF3333)
                    .setDescription(`❌ **Executor Not Found:** Could not locate database traces matching \`${query}\`.`);
                return processingMessage.edit({ content: null, embeds: [notFoundEmbed] });
            }

            const isWorking = matchedExecutor.updateStatus === true;
            const statusIndicator = isWorking ? "🟢 UP / Working" : "🔴 DOWN / Outdated";
            const embedColor = isWorking ? 0x2ECC71 : 0xE74C3C;

            const isDetected = matchedExecutor.detected === true ? "Yes (Detected in banwaves)" : "No";

            const infoEmbed = new EmbedBuilder()
                .setColor(embedColor)
                .setDescription(
                    `**Executor: ${matchedExecutor.title}**\n\n` +
                    `**Status**\n${statusIndicator}\n\n` +
                    `**Detected?**\n${isDetected}\n\n` +
                    `**Version**\n${matchedExecutor.version || "N/A"}\n\n` +
                    `**Platform**\n${matchedExecutor.free === true ? "Free" : "Paid"}\n\n` +
                    `**Last Update**\n${matchedExecutor.updatedDate || "Unknown"}\n\n` +
                    `**Supported Roblox Build**\n\`${matchedExecutor.rbxversion || "N/A"}\`\n\n` +
                    `**Website**\n${matchedExecutor.websitelink ? matchedExecutor.websitelink : "None Provided"}\n\n` +
                    `**Discord**\n${matchedExecutor.discordlink ? matchedExecutor.discordlink : "None Provided"}`
                );

            return processingMessage.edit({ content: null, embeds: [infoEmbed] });

        } catch (error) {
            console.error(error);
            const apiErrorEmbed = new EmbedBuilder()
                .setColor(0xFF3333)
                .setDescription("❌ **API Fault:** Failed to communicate or decode status details correctly right now.");
            return processingMessage.edit({ content: null, embeds: [apiErrorEmbed] });
        }
    }

    // =======================================================
    // 🛡️ NEWLY REQUESTED SYSTEM COMMAND SECTIONS
    // =======================================================

    // 1. !BOTLOGS
    if (command === 'botlogs') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return sendError(message, "You need `Manage Server` permissions to view bot operation metrics.");
        }

        if (globalBotLogs.length === 0) {
            return message.reply("📋 **System Log Profile:** No commands have been handled since the engine last started.");
        }

        // Gather latest 10 action records to display cleanly inside formatting parameters
        const formattedLogs = globalBotLogs.slice(-10).map(l => `\`[${l.timestamp}]\` **${l.user}**: \`${l.command}\``).join('\n');

        const logsEmbed = new EmbedBuilder()
            .setColor(0x34495E)
            .setTitle('📋 Eazy Moderation | Internal System Audit Logs')
            .setDescription(formattedLogs)
            .setTimestamp();

        return message.reply({ embeds: [logsEmbed] });
    }

    // 2. !CHATLOGS
    if (command === 'chatlogs') {
        if (!message.member.permissions.has(PermissionFlagsBits.MessageContent)) {
            return sendError(message, "You don't have the explicit permission flags required to generate transcripts.");
        }

        const targetUser = message.mentions.users.first();
        if (!targetUser) return sendError(message, "Please tag a user to view context cache history. Usage: `!chatlogs @user`");

        const history = runningChatLogs.get(targetUser.id) || [];
        if (history.length === 0) {
            return message.reply(`🔍 No tracked text streams indexed in memory for user **${targetUser.tag}** recently.`);
        }

        const transcript = history.slice(-15).map(m => `\`[${m.timestamp}] #${m.channel}\` ${m.content}`).join('\n');

        const chatlogsEmbed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle(`💬 Transcript Log: ${targetUser.username}`)
            .setDescription(transcript.length > 2000 ? transcript.slice(0, 1990) + "..." : transcript)
            .setFooter({ text: "Displaying up to 15 last logged messages" });

        return message.reply({ embeds: [chatlogsEmbed] });
    }

    // 3. !MUTVC
    if (command === 'mutevc') {
        if (!message.member.permissions.has(PermissionFlagsBits.MuteMembers)) {
            return sendError(message, "You don't have the permission flag `Mute Members` to perform voice operations.");
        }

        const target = message.mentions.members.first();
        if (!target) return sendError(message, "Please specify a target profile tag to adjust voice settings.");

        const voiceState = target.voice.channel;
        if (!voiceState) return sendError(message, "That user is not currently sitting in any active Voice Channels on this server.");

        try {
            const currentMuteStatus = target.voice.serverMute;
            await target.voice.setMute(!currentMuteStatus); // Dynamic toggle logic
            
            const vcMuteEmbed = new EmbedBuilder()
                .setColor(0x34495E)
                .setDescription(`🎤 **Voice State Modified:** Successfully set server voice mute state to **${!currentMuteStatus}** for **${target.user.tag}**.`);
            return message.reply({ embeds: [vcMuteEmbed] });
        } catch (e) {
            return sendError(message, "Could not manipulate connection layout flags on target user profiles.");
        }
    }

    // 4. !DEAFEN
    if (command === 'deafen') {
        if (!message.member.permissions.has(PermissionFlagsBits.DeafenMembers)) {
            return sendError(message, "You don't have the permission flag `Deafen Members` to perform voice operations.");
        }

        const target = message.mentions.members.first();
        if (!target) return sendError(message, "Please specify a target profile tag to adjust deafen settings.");

        const voiceState = target.voice.channel;
        if (!voiceState) return sendError(message, "That user is not currently sitting in any active Voice Channels on this server.");

        try {
            const currentDeafenStatus = target.voice.serverDeafen;
            await target.voice.setDeafen(!currentDeafenStatus); // Dynamic toggle logic

            const vcDeafenEmbed = new EmbedBuilder()
                .setColor(0x34495E)
                .setDescription(`🎧 **Voice State Modified:** Successfully set server voice deafen state to **${!currentDeafenStatus}** for **${target.user.tag}**.`);
            return message.reply({ embeds: [vcDeafenEmbed] });
        } catch (e) {
            return sendError(message, "Could not manipulate connection layout flags on target user profiles.");
        }
    }
});

// Dummy Web Server for Render Up-time
const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is awake!\n');
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Web monitor listening on port ${PORT}`);
});

client.login(process.env.DISCORD_TOKEN);