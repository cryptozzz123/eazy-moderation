require('dotenv').config();
const { Client, GatewayIntentBits, PermissionFlagsBits, EmbedBuilder, Collection, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences // CRITICAL: Required to read online/offline status fields
    ]
});

// =========================================================================
// 🖼️ CUSTOM EXECUTOR IMAGE CONFIGURATION
// All requested executors are fully loaded below!
// Simply paste your Discord image link inside the quotes for any executor.
// =========================================================================
const EXECUTOR_IMAGES = {
    "volt": "https://cdn.discordapp.com/attachments/1478359860570751159/1526169379459563601/sunc.png?ex=6a560b7e&is=6a54b9fe&hm=94313523b8e6e5d2d6bd9542845db7f4d1f4896d66163b554bc39f0dc53aff46&",
    "potassium": "https://cdn.discordapp.com/attachments/1478359860570751159/1526176916531318814/sunc.png?ex=6a561283&is=6a54c103&hm=c467bc57700a616c8d5cc6d546a9a3d987f7c073e6e77495d727f57bfa6ce014&",
    "xeno": "https://cdn.discordapp.com/attachments/1478359860570751159/1526176811711467590/sunc.png?ex=6a56126a&is=6a54c0ea&hm=782d4698fb80a3ecbb3e773287304785c48720265ffea0a473527fda63c3dcbd&",
    "solara": "https://cdn.discordapp.com/attachments/1478359860570751159/1526138851704307712/sunc.png?ex=6a55ef10&is=6a549d90&hm=9d7d739a883e6f27fe36b887b812a3997c7ef0f3ec21f1a4b9819008d732b5de&",
    "wave": "https://cdn.discordapp.com/attachments/1478359860570751159/1526186867026825366/sunc.png?ex=6a561bc8&is=6a54ca48&hm=6a2fad8ccc8fb443b78740d61b865810d0573c0f6ab179cd3b1530200dc1daf2&",
    "real": "https://cdn.discordapp.com/attachments/1478359860570751159/1526177102817398886/sunc.png?ex=6a5612b0&is=6a54c130&hm=d33560ab3dd06cc000e7b35160c6956ff807c091f638f2bf1c26603c71474d6f&",
    "velocity": "https://cdn.discordapp.com/attachments/1478359860570751159/1526181791759601765/sunc.png?ex=6a56170e&is=6a54c58e&hm=b29224df4cfeeb363d4bf7ee1527b33aae1c161e97904c0c13e6cf6fb3a4dddd&", 
    "madium": "https://cdn.discordapp.com/attachments/1478359860570751159/1526177030838812672/sunc.png?ex=6a56129f&is=6a54c11f&hm=242e9135e53753c646e2c6b29f961d85ac816a56d03cc6c6da6e3454c2575b57&",
    "synapse z": "https://cdn.discordapp.com/attachments/1478359860570751159/1526186942256123995/sunc.png?ex=6a561bda&is=6a54ca5a&hm=7440f9d83409a79c700f211b04b115d39f13a405ebbfe6f25cad513ee3c571b8&",
    "cosmic": "https://cdn.discordapp.com/attachments/1478359860570751159/1526187048392851609/sunc.png?ex=6a561bf3&is=6a54ca73&hm=4cb3b59db869fc938de94aa50dc71801daf397a0742fe010363ccc740dd6d4f6&",
    "macsploit": "https://cdn.discordapp.com/attachments/1478359860570751159/1526187094005911602/sunc.png?ex=6a561bfe&is=6a54ca7e&hm=d42db7cd6d9e70fd314b614c5a514c6a69afb984cd476665f6a353957d6eb465&",
    "opiumware": "https://cdn.discordapp.com/attachments/1478359860570751159/1526187176956661860/sunc.png?ex=6a561c12&is=6a54ca92&hm=eb4f2a07daa855119e61f3c17d8205d966c64236c21fa2e6749b791df248f302&",
    "delta": "https://cdn.discordapp.com/attachments/1478359860570751159/1526036362766057472/sunc.png?ex=6a558f9d&is=6a543e1d&hm=4e38ffbaedfe2b194d3f4ce4ca2da3210af1657c8005bbbf233c021e5862a05b&",
    "codex": "https://cdn.discordapp.com/attachments/1478359860570751159/1526187244988141618/sunc.png?ex=6a561c22&is=6a54caa2&hm=c7c0e84f4542e0e48e9d9f85a7a2e87a1a250c34506fc86b4ebf6fa5459157a4&",
    "vega x": "https://cdn.discordapp.com/attachments/1478359860570751159/1526187398478696519/sunc.png?ex=6a561c46&is=6a54cac6&hm=8244fc048a27283d497680ade5185b52fc49c9fca83b73d3397058df989ef001&"
};

// Global Bot Version Constant
const BOT_VERSION = '1.2.0';

// Runtime data caches for auditing logs (resets when the bot restarts)
const globalBotLogs = [];
const runningChatLogs = new Map(); // Maps userId -> array of recent messages
const cooldowns = new Collection();
const bootTime = Date.now(); // Track initial system initialization timestamp

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
    if (globalBotLogs.length > 150) globalBotLogs.shift();

    // Utility Command: Ping
    if (command === 'ping') {
        const pingEmbed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('🏓 Pong!')
            .setDescription(`Latency is **${Date.now() - message.createdTimestamp}ms**.\nAPI Latency is **${Math.round(client.ws.ping)}ms**.`)
            .setTimestamp();
        return message.reply({ embeds: [pingEmbed] });
    }

    // New Command: Version Check
    if (command === 'version') {
        const versionEmbed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle('ℹ️ Eazy Moderation | Version Profile')
            .setDescription(`Current operational software framework layer is on **v${BOT_VERSION}**`)
            .setTimestamp()
            .setFooter({ text: `${client.user.username} Engine` });
        return message.reply({ embeds: [versionEmbed] });
    }

    // Utility Command: Help menu
    if (command === 'help') {
        const helpEmbed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle('🛡️ Eazy Moderation | Commands Menu')
            .setDescription('Here is a complete list of administrative commands available for this bot. Ensure roles are properly configured.')
            .addFields(
                { name: '⚙️ Utilities', value: '`!ping` - Check bot status & latency.\n`!version` - Display active engine software release built.\n`!help` - Display this modern interface.\n`!check [executor]` - Check real-time exploit statuses.\n`!botlogs` - Display recent commands executed on this system.\n`!status` - View bot framework performance, hosting, and uptime.' },
                { name: '🔨 Punishments', value: '`!kick @user [reason]` - Kick a member.\n`!ban @user [reason]` - Permanently ban a member.\n`!unban [UserID]` - Revoke a ban.\n`!warn @user [reason]` - Record official warning logs.' },
                { name: '🤫 Restraints & Voice', value: '`!mute @user [reason]` - Timeout a user for 24 hours.\n`!unmute @user` - Lift structural limitations.\n`!mutevc @user` - Toggle audio server voice mute.\n`!deafen @user` - Toggle system voice deafen.' },
                { name: '🧹 Management & Lock', value: '`!clear [1-100]` - Wipe recent message flows.\n`!chatlogs @user` - Review targeted text streams.\n`!lock [#chan]` - Lock a text channel.\n`!unlock [#chan]` - Re-open text channel permission loops.\n`!lockdown` - Emergency lock ALL server text channels.\n`!unlockdown` - Restore text channel paths globally.' },
                { name: '🏷️ Role Controls', value: '`!role [@user] [Role]` - Assign a specific role to a server target member.\n`!unrole [@user] [Role]` - Remove a specific role value assignment.' }
            )
            .setFooter({ text: `${client.user.username} Modern System`, iconURL: client.user.displayAvatarURL() })
            .setTimestamp();
        return message.reply({ embeds: [helpEmbed] });
    }

    // --- MODERATION PUNISHMENTS ---

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

    // 8. REDESIGNED CHECK EXECUTORS COMMAND (With dynamic buttons and Top Images)
    if (command === 'check') {
        const query = args.join(" ");
        if (!query) return sendError(message, "Please specify an executor name to lookup. Example: `!check velocity`");

        const processingMessage = await message.reply("Checking..");

        try {
            const response = await fetch('https://weao.xyz/api/status/exploits');
            if (!response.ok) throw new Error("API status fault.");
            
            const executorsList = await response.json();
            const queryLower = query.toLowerCase();
            const matchedExecutor = executorsList.find(e => e.title && e.title.toLowerCase() === queryLower);

            if (!matchedExecutor) {
                const notFoundEmbed = new EmbedBuilder()
                    .setColor(0xFF3333)
                    .setDescription(`❌ **Executor Not Found:** Could not locate database traces matching \`${query}\`.`);
                return processingMessage.edit({ content: null, embeds: [notFoundEmbed] });
            }

            const isWorking = matchedExecutor.updateStatus === true;
            const statusEmoji = isWorking ? "✅" : "❌";
            const embedColor = isWorking ? 0x2ECC71 : 0xE74C3C;

            // Format Tier details (Free vs Paid)
            const isFree = matchedExecutor.free === true;
            const tierText = isFree ? "Free" : "Paid";

            // Format anti-cheat status / detection details cleanly below
            const warningText = matchedExecutor.detected === true 
                ? "⚠️ Detected in banwaves, proceed with extreme caution." 
                : "Bypasses client mod bans, may cause bans in banwaves.";

            // Core Layout Redesign matching User Image Specification Interface
            const infoEmbed = new EmbedBuilder()
                .setColor(embedColor)
                .setTitle(matchedExecutor.title)
                .setDescription(
                    `Updated ${statusEmoji} - \`${matchedExecutor.version || "N/A"}\` - **${tierText}** - Key System\n` +
                    `Last updated: ${matchedExecutor.updatedDate || "N/A"}\n\n` +
                    `> ${warningText}`
                )
                .setFooter({ text: 'Powered by weao.xyz' })
                .setTimestamp();

            // Handle custom top image injection if configured
            if (EXECUTOR_IMAGES[queryLower] && EXECUTOR_IMAGES[queryLower] !== "") {
                infoEmbed.setImage(EXECUTOR_IMAGES[queryLower]);
            }

            // --- Dynamic Buttons Component Setup ---
            const actionRow = new ActionRowBuilder();

            // 1. Website Button
            if (matchedExecutor.websitelink) {
                actionRow.addComponents(
                    new ButtonBuilder()
                        .setLabel('Website')
                        .setStyle(ButtonStyle.Link)
                        .setURL(matchedExecutor.websitelink)
                );
            }

            // 2. Discord Button
            if (matchedExecutor.discordlink) {
                actionRow.addComponents(
                    new ButtonBuilder()
                        .setLabel('Discord')
                        .setStyle(ButtonStyle.Link)
                        .setURL(matchedExecutor.discordlink)
                );
            }

            // 3. Purchase Button: Exclude for velocity, require for non-free executors
            if (queryLower !== 'velocity' && !isFree) {
                actionRow.addComponents(
                    new ButtonBuilder()
                        .setLabel('Purchase')
                        .setStyle(ButtonStyle.Link)
                        .setURL('https://rcheatz.com/')
                );
            }

            // Only attach action row components if links are provided
            const componentsArray = actionRow.components.length > 0 ? [actionRow] : [];

            return processingMessage.edit({ content: null, embeds: [infoEmbed], components: componentsArray });

        } catch (error) {
            console.error(error);
            const apiErrorEmbed = new EmbedBuilder()
                .setColor(0xFF3333)
                .setDescription("❌ **API Fault:** Failed to communicate or decode status details correctly right now.");
            return processingMessage.edit({ content: null, embeds: [apiErrorEmbed] });
        }
    }

    // --- AUDIT COMPONENT INTERFACES ---

    // 1. !BOTLOGS
    if (command === 'botlogs') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return sendError(message, "You need `Manage Server` permissions to view bot operation metrics.");
        }
        if (globalBotLogs.length === 0) {
            return message.reply("📋 **System Log Profile:** No commands have been handled since the engine last started.");
        }
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

    // 3. !MUTEVC
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
            await target.voice.setMute(!currentMuteStatus);
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
            await target.voice.setDeafen(!currentDeafenStatus);
            const vcDeafenEmbed = new EmbedBuilder()
                .setColor(0x34495E)
                .setDescription(`🎧 **Voice State Modified:** Successfully set server voice deafen state to **${!currentDeafenStatus}** for **${target.user.tag}**.`);
            return message.reply({ embeds: [vcDeafenEmbed] });
        } catch (e) {
            return sendError(message, "Could not manipulate connection layout flags on target user profiles.");
        }
    }

    // --- CHANNEL MODERATIONS ---

    // 1. !LOCK
    if (command === 'lock') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return sendError(message, "You need `Manage Channels` permission to execute this operation.");
        }
        const targetChannel = message.mentions.channels.first() || message.channel;
        try {
            await targetChannel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
            const lockEmbed = new EmbedBuilder()
                .setColor(0xE74C3C)
                .setDescription(`🔒 **Channel Locked:** Chat access has been suspended in ${targetChannel}.`);
            return message.reply({ embeds: [lockEmbed] });
        } catch (err) {
            return sendError(message, "Unable to restructure channel permission maps. Check bot hierarchy.");
        }
    }

    // 2. !UNLOCK
    if (command === 'unlock') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return sendError(message, "You need `Manage Channels` permission to execute this operation.");
        }
        const targetChannel = message.mentions.channels.first() || message.channel;
        try {
            await targetChannel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
            const unlockEmbed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setDescription(`🔓 **Channel Unlocked:** Chat access has been restored in ${targetChannel}.`);
            return message.reply({ embeds: [unlockEmbed] });
        } catch (err) {
            return sendError(message, "Unable to restructure channel permission maps. Check bot hierarchy.");
        }
    }

    // 3. !LOCKDOWN
    if (command === 'lockdown') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return sendError(message, "Emergency server actions require full `Administrator` security clearances.");
        }
        const standardMessage = await message.reply("🔄 Initializing server-wide lockdown protocols...");
        let lockedCount = 0;
        const textChannels = message.guild.channels.cache.filter(c => c.isTextBased());
        for (const [id, channel] of textChannels) {
            try {
                await channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
                lockedCount++;
            } catch (e) {}
        }
        const lockdownDone = new EmbedBuilder()
            .setColor(0x992D22)
            .setTitle('🚨 Server Lockdown Active')
            .setDescription(`Successfully locked **${lockedCount}** channels. Public communications are suspended.`);
        return standardMessage.edit({ content: null, embeds: [lockdownDone] });
    }

    // 4. !UNLOCKDOWN
    if (command === 'unlockdown') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return sendError(message, "Emergency server actions require full `Administrator` security clearances.");
        }
        const standardMessage = await message.reply("🔄 Revoking lockdown limits, restoring channel arrays......");
        let unlockedCount = 0;
        const textChannels = message.guild.channels.cache.filter(c => c.isTextBased());
        for (const [id, channel] of textChannels) {
            try {
                await channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
                unlockedCount++;
            } catch (e) {}
        }
        const unlockdownDone = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('🔓 Server Lockdown Lifted')
            .setDescription(`Successfully restored public traffic permissions inside **${unlockedCount}** channels.`);
        return standardMessage.edit({ content: null, embeds: [unlockdownDone] });
    }

    // --- ROLE MANAGEMENT MODES ---

    // 1. !ROLE
    if (command === 'role') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return sendError(message, "You don't have the `Manage Roles` permission.");
        }
        const targetMember = message.mentions.members.first();
        if (!targetMember) return sendError(message, "Please tag a target member profile. Usage: `!role @user [Role Name/ID]`");

        const roleQuery = args.slice(1).join(" ");
        if (!roleQuery) return sendError(message, "Specify a target structural role tag or ID.");

        const targetRole = message.guild.roles.cache.get(roleQuery) || 
                           message.guild.roles.cache.find(r => r.name.toLowerCase() === roleQuery.toLowerCase());

        if (!targetRole) return sendError(message, "Could not map that role indicator value inside server databases.");
        if (targetRole.position >= message.guild.members.me.roles.highest.position) {
            return sendError(message, "That role sits higher than my operational permission index structure.");
        }

        try {
            await targetMember.roles.add(targetRole);
            const roleEmbed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setDescription(`✅ Successfully assigned role **${targetRole.name}** to **${targetMember.user.tag}**.`);
            return message.reply({ embeds: [roleEmbed] });
        } catch (err) {
            return sendError(message, "Execution failure. Verify structural role balance setups.");
        }
    }

    // 2. !UNROLE
    if (command === 'unrole') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {
            return sendError(message, "You don't have the `Manage Roles` permission.");
        }
        const targetMember = message.mentions.members.first();
        if (!targetMember) return sendError(message, "Please tag a target member profile. Usage: `!unrole @user [Role Name/ID]`");

        const roleQuery = args.slice(1).join(" ");
        if (!roleQuery) return sendError(message, "Specify a target structural role tag or ID.");

        const targetRole = message.guild.roles.cache.get(roleQuery) || 
                           message.guild.roles.cache.find(r => r.name.toLowerCase() === roleQuery.toLowerCase());

        if (!targetRole) return sendError(message, "Could not map that role indicator value inside server databases.");
        if (targetRole.position >= message.guild.members.me.roles.highest.position) {
            return sendError(message, "That role sits higher than my operational permission index structure.");
        }

        try {
            await targetMember.roles.remove(targetRole);
            const unroleEmbed = new EmbedBuilder()
                .setColor(0xE67E22)
                .setDescription(`🗑️ Successfully removed role **${targetRole.name}** from **${targetMember.user.tag}**.`);
            return message.reply({ embeds: [unroleEmbed] });
        } catch (err) {
            return sendError(message, "Execution failure. Verify structural role balance setups.");
        }
    }

    // 3. !STATUS (Dynamic Live Verification Tracker)
    if (command === 'status') {
        const uptimeRaw = Date.now() - bootTime;
        const hours = Math.floor(uptimeRaw / (1000 * 60 * 60));
        const minutes = Math.floor((uptimeRaw % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((uptimeRaw % (1000 * 60)) / 1000);

        const currentPing = client.ws.ping;
        const isBotHealthy = (currentPing > 0 && currentPing < 1000) || (uptimeRaw < 60000 && currentPing >= -1);
        const botStatusEmoji = isBotHealthy ? '🟢' : '🔴';
        const botStatusText = isBotHealthy ? 'Working' : 'Lagging / Down';

        const isRenderHostingActive = process.env.PORT !== undefined || process.env.RENDER === 'true';
        const renderStatusEmoji = isRenderHostingActive ? '🟢' : '🔴';
        const renderStatusText = isRenderHostingActive ? 'Working' : 'Local Host/Down';

        let githubStatusEmoji = '🔴';
        let githubStatusText = 'Down';
        try {
            const ghCheck = await fetch('https://api.github.com', { method: 'HEAD', signal: AbortSignal.timeout(1500) });
            if (ghCheck.ok) {
                githubStatusEmoji = '🟢';
                githubStatusText = 'Working';
            }
        } catch (err) {
            githubStatusEmoji = '🔴';
            githubStatusText = 'Connection Error';
        }

        const CRASHY_BOT_ID = '1512062436411183114'; 
        let crashyMember = message.guild.members.cache.get(CRASHY_BOT_ID);
        if (!crashyMember) {
            try {
                crashyMember = await message.guild.members.fetch(CRASHY_BOT_ID);
            } catch (e) {}
        }
        
        const isCrashyOnline = crashyMember && crashyMember.presence && crashyMember.presence.status !== 'offline';
        const crashyStatusEmoji = isCrashyOnline ? '🟢' : '🔴';
        const crashyStatusText = isCrashyOnline ? 'Working' : 'Down';

        const isSystemStable = isBotHealthy && isRenderHostingActive && isCrashyOnline;
        const embedColor = isSystemStable ? 0x2ECC71 : 0xE74C3C;

        const statusEmbed = new EmbedBuilder()
            .setColor(embedColor)
            .setTitle('⚙️ Eazy Moderation | System Status')
            .setDescription(
                `${botStatusEmoji} **Bot status:** ${botStatusText}\n` +
                `${renderStatusEmoji} **Render:** ${renderStatusText}\n` +
                `${githubStatusEmoji} **GitHub:** ${githubStatusText}\n` +
                `${crashyStatusEmoji} **crashy:** ${crashyStatusText}\n\n` +
                `⏱️ **Uptime:** \`${hours}h ${minutes}m ${seconds}s\``
            )
            .setFooter({ text: 'Live system array validation checks active' })
            .setTimestamp();

        return message.reply({ embeds: [statusEmbed] });
    }
});

// Dummy Web Server for Render Up-time monitoring
const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is awake!\n');
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Web monitor listening on port ${PORT}`);
});

// =======================================================
// 🛡️ ANTI-CRASH PROTECTION ENGINE (Prevents Unhandled Drops)
// =======================================================
process.on('unhandledRejection', (reason, promise) => {
    console.error('⚠️ [CRITICAL ANTI-CRASH] Unhandled rejection intercepted:', promise, 'reason:', reason);
});
process.on('uncaughtException', (err, origin) => {
    console.error('⚠️ [CRITICAL ANTI-CRASH] Uncaught exception intercepted:', err, 'origin:', origin);
});

client.login(process.env.DISCORD_TOKEN);