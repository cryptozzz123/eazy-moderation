require('dotenv').config();
const { Client, GatewayIntentBits, PermissionFlagsBits, EmbedBuilder } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

client.once('ready', () => {
    console.log(`🚀 Success! Logged in as ${client.user.tag}`);
});

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

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
                { name: '⚙️ Utilities', value: '`!ping` - Check bot status & latency.\n`!help` - Display this modern interface.' },
                { name: '🔨 Punishments', value: '`!kick @user [reason]` - Kick a user from the server.\n`!ban @user [reason]` - Permanently ban a member.\n`!unban [UserID]` - Revoke a ban using a unique ID.' },
                { name: '🤫 Chat Restraints', value: '`!mute @user [reason]` - Timeout a user for 24 hours.\n`!unmute @user` - Instantly remove a user\'s timeout.' },
                { name: '🧹 Clean & Warn', value: '`!clear [1-100]` - Wipe a specific number of recent messages.\n`!warn @user [reason]` - Fire an official warning embed to chat.' }
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