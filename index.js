require('dotenv').config();
const { Client, GatewayIntentBits, PermissionFlagsBits, EmbedBuilder, Collection, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildPresences // CRITICAL: Required to read online/offline status fields[cite: 1]
    ]
});

// Paths for saving configured announcement channels and latest versions persistently
const CONFIG_PATH = path.join(__dirname, 'version_config.json');

// Memory structures for background loops
let versionConfig = {
    liveChannels: [], // Array of channel IDs
    betaChannels: [], // Array of channel IDs
    lastLiveVersions: {}, // Map of platform -> version string
    lastBetaVersions: {}  // Map of platform -> version string
};

// Load saved tracking states safely on bootup
if (fs.existsSync(CONFIG_PATH)) {
    try {
        const fileData = fs.readFileSync(CONFIG_PATH, 'utf8');
        versionConfig = Object.assign(versionConfig, JSON.parse(fileData));
    } catch (e) {
        console.error("⚠️ Failed to parse version_config.json, starting fresh.", e);
    }
}

function saveConfig() {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(versionConfig, null, 4), 'utf8');
    } catch (e) {
        console.error("⚠️ Could not write configurations to storage file.", e);
    }
}

// =========================================================================
// 🖼️ CUSTOM EXECUTOR IMAGE CONFIGURATION[cite: 1]
// All requested executors are fully loaded below![cite: 1]
// =========================================================================
const EXECUTOR_IMAGES = {
    "volt": "https://cdn.discordapp.com/attachments/1478359860570751159/1526169379459563601/sunc.png?ex=6a560b7e&is=6a54b9fe&hm=94313523b8e6e5d2d6bd9542845db7f4d1f4896d66163b554bc39f0dc53aff46&",[cite: 1]
    "potassium": "https://cdn.discordapp.com/attachments/1478359860570751159/1526176916531318814/sunc.png?ex=6a561283&is=6a54c103&hm=c467bc57700a616c8d5cc6d546a9a3d987f7c073e6e77495d727f57bfa6ce014&",[cite: 1]
    "xeno": "https://cdn.discordapp.com/attachments/1478359860570751159/1526176811711467590/sunc.png?ex=6a56126a&is=6a54c0ea&hm=782d4698fb80a3ecbb3e773287304785c48720265ffea0a473527fda63c3dcbd&",[cite: 1]
    "solara": "https://cdn.discordapp.com/attachments/1478359860570751159/1526138851704307712/sunc.png?ex=6a55ef10&is=6a549d90&hm=9d7d739a883e6f27fe36b887b812a3997c7ef0f3ec21f1a4b9819008d732b5de&",[cite: 1]
    "wave": "https://cdn.discordapp.com/attachments/1478359860570751159/1526186867026825366/sunc.png?ex=6a561bc8&is=6a54ca48&hm=6a2fad8ccc8fb443b78740d61b865810d0573c0f6ab179cd3b1530200dc1daf2&",[cite: 1]
    "real": "https://cdn.discordapp.com/attachments/1478359860570751159/1526177102817398886/sunc.png?ex=6a5612b0&is=6a54c130&hm=d33560ab3dd06cc000e7b35160c6956ff807c091f638f2bf1c26603c71474d6f&",[cite: 1]
    "velocity": "https://cdn.discordapp.com/attachments/1478359860570751159/1526181791759601765/sunc.png?ex=6a56170e&is=6a54c58e&hm=b29224df4cfeeb363d4bf7ee1527b33aae1c161e97904c0c13e6cf6fb3a4dddd&", [cite: 1]
    "madium": "https://cdn.discordapp.com/attachments/1478359860570751159/1526177030838812672/sunc.png?ex=6a56129f&is=6a54c11f&hm=242e9135e53753c646e2c6b29f961d85ac816a56d03cc6c6da6e3454c2575b57&",[cite: 1]
    "synapse z": "https://cdn.discordapp.com/attachments/1478359860570751159/1526186942256123995/sunc.png?ex=6a561bda&is=6a54ca5a&hm=7440f9d83409a79c700f211b04b115d39f13a405ebbfe6f25cad513ee3c571b8&",[cite: 1]
    "cosmic": "https://cdn.discordapp.com/attachments/1478359860570751159/1526187048392851609/sunc.png?ex=6a561bf3&is=6a54ca73&hm=4cb3b59db869fc938de94aa50dc71801daf397a0742fe010363ccc740dd6d4f6&",[cite: 1]
    "macsploit": "https://cdn.discordapp.com/attachments/1478359860570751159/1526187094005911602/sunc.png?ex=6a561bfe&is=6a54ca7e&hm=d42db7cd6d9e70fd314b614c5a514c6a69afb984cd476665f6a353957d6eb465&",[cite: 1]
    "opiumware": "https://cdn.discordapp.com/attachments/1478359860570751159/1526187176956661860/sunc.png?ex=6a561c12&is=6a54ca92&hm=eb4f2a07daa855119e61f3c17d8205d966c64236c21fa2e6749b791df248f302&",[cite: 1]
    "delta": "https://cdn.discordapp.com/attachments/1478359860570751159/1526036362766057472/sunc.png?ex=6a558f9d&is=6a543e1d&hm=4e38ffbaedfe2b194d3f4ce4ca2da3210af1657c8005bbbf233c021e5862a05b&",[cite: 1]
    "codex": "https://cdn.discordapp.com/attachments/1478359860570751159/1526187244988141618/sunc.png?ex=6a561c22&is=6a54caa2&hm=c7c0e84f4542e0e48e9d9f85a7a2e87a1a250c34506fc86b4ebf6fa5459157a4&",[cite: 1]
    "vega x": "https://cdn.discordapp.com/attachments/1478359860570751159/1526187398478696519/sunc.png?ex=6a561c46&is=6a54cac6&hm=8244fc048a27283d497680ade5185b52fc49c9fca83b73d3397058df989ef001&"[cite: 1]
};

// Global Bot Version Constant
const BOT_VERSION = '1.3.0';

// Runtime data caches for auditing logs (resets when the bot restarts)[cite: 1]
const globalBotLogs = [];[cite: 1]
const runningChatLogs = new Map(); // Maps userId -> array of recent messages[cite: 1]
const cooldowns = new Collection();[cite: 1]
const bootTime = Date.now(); // Track initial system initialization timestamp[cite: 1]

client.once('ready', () => {
    console.log(`🚀 Success! Logged in as ${client.user.tag}`);[cite: 1]
    // Initialize background automatic updater every 60 seconds
    setInterval(checkRobloxVersions, 60000);
    checkRobloxVersions();
});

// =========================================================================
// 🔄 AUTOMATED BACKGROUND ROBLOX VERSION COMPARISON TRACKER
// =========================================================================
async function checkRobloxVersions() {
    if (versionConfig.liveChannels.length === 0 && versionConfig.betaChannels.length === 0) return;

    // 1. Live Update Tracker Pipeline
    if (versionConfig.liveChannels.length > 0) {
        try {
            const res = await fetch('https://weao.xyz/api/versions/current');
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    for (const item of data) {
                        const platform = item.platform || 'Unknown';
                        const currentVer = item.version || '';
                        if (!currentVer) continue;

                        const savedVer = versionConfig.lastLiveVersions[platform];
                        if (savedVer && savedVer !== currentVer) {
                            broadcastVersionUpdate('live', platform, currentVer);
                        }
                        versionConfig.lastLiveVersions[platform] = currentVer;
                    }
                    saveConfig();
                }
            }
        } catch (err) {
            console.error("❌ Live API background polling intercept error:", err.message);
        }
    }

    // 2. Beta Update Tracker Pipeline
    if (versionConfig.betaChannels.length > 0) {
        try {
            const res = await fetch('https://weao.xyz/api/versions/future');
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) {
                    for (const item of data) {
                        const platform = item.platform || 'Unknown';
                        const currentVer = item.version || '';
                        if (!currentVer) continue;

                        const savedVer = versionConfig.lastBetaVersions[platform];
                        if (savedVer && savedVer !== currentVer) {
                            broadcastVersionUpdate('beta', platform, currentVer);
                        }
                        versionConfig.lastBetaVersions[platform] = currentVer;
                    }
                    saveConfig();
                }
            }
        } catch (err) {
            console.error("❌ Beta API background polling intercept error:", err.message);
        }
    }
}

// Global Message Embed Broadcaster Engine
async function broadcastVersionUpdate(type, platform, version) {
    const channelsList = type === 'live' ? versionConfig.liveChannels : versionConfig.betaChannels;
    const embed = new EmbedBuilder().setTimestamp();

    if (type === 'live') {
        embed.setColor(0xE74C3C) // Red layout color flag
             .setTitle('Live update detected!')
             .setDescription('This is a live ROBLOX update.')
             .addFields(
                 { name: 'Platform', value: platform, inline: true },
                 { name: 'Roblox Version', value: `\`${version}\``, inline: true }
             );
    } else {
        embed.setColor(0x2ECC71) // Green layout color flag
             .setTitle('Beta update detected!')
             .setDescription('A new ROBLOX beta build was detected before LIVE.')
             .addFields(
                 { name: 'Platform', value: platform, inline: true },
                 { name: 'Roblox Version', value: `\`${version}\``, inline: true }
             );
    }

    const downloadRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setLabel('Download')
            .setStyle(ButtonStyle.Link)
            .setURL('https://rdd.weao.xyz/')
    );

    for (const channelId of channelsList) {
        try {
            const channel = await client.channels.fetch(channelId).catch(() => null);
            if (channel && channel.isTextBased()) {
                await channel.send({ embeds: [embed], components: [downloadRow] });
            }
        } catch (e) {
            console.error(`⚠️ Delivery failure to target channel metric endpoint [${channelId}]:`, e.message);
        }
    }
}

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;[cite: 1]

    // --- CHAT LOGGING BACKGROUND LISTENER ---[cite: 1]
    if (!runningChatLogs.has(message.author.id)) {[cite: 1]
        runningChatLogs.set(message.author.id, []);[cite: 1]
    }
    const userLog = runningChatLogs.get(message.author.id);[cite: 1]
    userLog.push({[cite: 1]
        content: message.content,[cite: 1]
        channel: message.channel.name,[cite: 1]
        timestamp: new Date().toLocaleTimeString()[cite: 1]
    });[cite: 1]
    if (userLog.length > 100) userLog.shift();[cite: 1]

    const prefix = '!';[cite: 1]
    if (!message.content.startsWith(prefix)) return;[cite: 1]

    const args = message.content.slice(prefix.length).trim().split(/ +/);[cite: 1]
    const command = args.shift().toLowerCase();[cite: 1]

    const sendError = (msg, text) => {[cite: 1]
        const errorEmbed = new EmbedBuilder().setColor(0xFF3333).setDescription(`❌ ${text}`);[cite: 1]
        return msg.reply({ embeds: [errorEmbed] });[cite: 1]
    };[cite: 1]

    const sendSuccess = (msg, text) => {
        const successEmbed = new EmbedBuilder().setColor(0x2ECC71).setDescription(`✅ ${text}`);
        return msg.reply({ embeds: [successEmbed] });
    };

    // --- ENFORCED GLOBAL COMMAND COOLDOWN (2 SECONDS) ---[cite: 1]
    const now = Date.now();[cite: 1]
    const cooldownAmount = 2 * 1000;[cite: 1]

    if (!cooldowns.has(command)) {[cite: 1]
        cooldowns.set(command, new Collection());[cite: 1]
    }

    const timestamps = cooldowns.get(command);[cite: 1]
    if (timestamps.has(message.author.id)) {[cite: 1]
        const expirationTime = timestamps.get(message.author.id) + cooldownAmount;[cite: 1]

        if (now < expirationTime) {[cite: 1]
            const timeLeft = ((expirationTime - now) / 1000).toFixed(1);[cite: 1]
            return message.reply(`⚠️ Please slow down! Wait **${timeLeft}s** before using the \`${command}\` command again.`)[cite: 1]
                .then(msg => setTimeout(() => msg.delete().catch(() => {}), 3000));[cite: 1]
        }
    }

    timestamps.set(message.author.id, now);[cite: 1]
    setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);[cite: 1]

    // --- BOT ACTIONS BACKGROUND LOGGER ---[cite: 1]
    globalBotLogs.push({[cite: 1]
        user: message.author.tag,[cite: 1]
        userId: message.author.id,[cite: 1]
        command: `!${command} ${args.join(" ")}`.trim(),[cite: 1]
        timestamp: new Date().toLocaleTimeString()[cite: 1]
    });[cite: 1]
    if (globalBotLogs.length > 150) globalBotLogs.shift();[cite: 1]

    // =========================================================================
    // ⚙️ SUBSCRIPTION MANAGEMENT COMMAND LAYER (BETA & LIVE)
    // =========================================================================

    if (command === 'beta-ver') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return sendError(message, "You require `Manage Channels` permission flags to alter build distribution paths.");
        }
        const targetChannel = message.mentions.channels.first();
        if (!targetChannel || !targetChannel.isTextBased()) {
            return sendError(message, "Please properly mention a text channel. Example: `!beta-ver #updates`");
        }

        if (!versionConfig.betaChannels.includes(targetChannel.id)) {
            versionConfig.betaChannels.push(targetChannel.id);
            saveConfig();
        }
        return sendSuccess(message, `Successfully locked in ${targetChannel} to receive real-time **Roblox BETA Build Change Updates**.`);
    }

    if (command === 'live-ver') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return sendError(message, "You require `Manage Channels` permission flags to alter build distribution paths.");
        }
        const targetChannel = message.mentions.channels.first();
        if (!targetChannel || !targetChannel.isTextBased()) {
            return sendError(message, "Please properly mention a text channel. Example: `!live-ver #updates`");
        }

        if (!versionConfig.liveChannels.includes(targetChannel.id)) {
            versionConfig.liveChannels.push(targetChannel.id);
            saveConfig();
        }
        return sendSuccess(message, `Successfully locked in ${targetChannel} to receive real-time **Roblox LIVE Mainline Version Updates**.`);
    }

    if (command === 'unlive-ver') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return sendError(message, "You require `Manage Channels` permission flags to alter build distribution paths.");
        }
        const targetChannel = message.mentions.channels.first();
        if (!targetChannel) return sendError(message, "Please mention the channel to unregister. Example: `!unlive-ver #updates`");

        const index = versionConfig.liveChannels.indexOf(targetChannel.id);
        if (index === -1) {
            return sendError(message, "That channel is not registered to receive Live deployment updates.");
        }

        versionConfig.liveChannels.splice(index, 1);
        saveConfig();
        return sendSuccess(message, `Successfully removed ${targetChannel} from the Live updates tracking index.`);
    }

    if (command === 'unbeta-ver') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return sendError(message, "You require `Manage Channels` permission flags to alter build distribution paths.");
        }
        const targetChannel = message.mentions.channels.first();
        if (!targetChannel) return sendError(message, "Please mention the channel to unregister. Example: `!unbeta-ver #updates`");

        const index = versionConfig.betaChannels.indexOf(targetChannel.id);
        if (index === -1) {
            return sendError(message, "That channel is not registered to receive Beta tracking updates.");
        }

        versionConfig.betaChannels.splice(index, 1);
        saveConfig();
        return sendSuccess(message, `Successfully removed ${targetChannel} from the Beta tracking updates feed.`);
    }

    // --- MANUAL FORCE DISPATCH CHANNELS ---
    if (command === 'sendlive-ver') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return sendError(message, "You require `Manage Channels` permissions to run this command.");
        }
        if (versionConfig.liveChannels.length === 0) {
            return sendError(message, "No active channels have been setup yet via `!live-ver #channel`.");
        }

        const processingMessage = await message.reply("🔄 Fetching current Live version data...");
        try {
            const res = await fetch('https://weao.xyz/api/versions/current');
            if (!res.ok) throw new Error("API responded with an error status.");
            const data = await res.json();
            
            if (Array.isArray(data) && data.length > 0) {
                for (const item of data) {
                    await broadcastVersionUpdate('live', item.platform || 'Unknown', item.version || 'N/A');
                }
                return sendSuccess(processingMessage, "Live version tracking cards dispatched manually to all configured channels.");
            } else {
                return sendError(processingMessage, "Live update version endpoints returned an empty data structure.");
            }
        } catch (err) {
            console.error(err);
            return sendError(processingMessage, `Failed manually dispatching current live version logs: \`${err.message}\``);
        }
    }

    if (command === 'sendbeta-ver') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return sendError(message, "You require `Manage Channels` permissions to run this command.");
        }
        if (versionConfig.betaChannels.length === 0) {
            return sendError(message, "No active channels have been setup yet via `!beta-ver #channel`.");
        }

        const processingMessage = await message.reply("🔄 Fetching current Beta version data...");
        try {
            const res = await fetch('https://weao.xyz/api/versions/future');
            if (!res.ok) throw new Error("API responded with an error status.");
            const data = await res.json();
            
            if (Array.isArray(data) && data.length > 0) {
                for (const item of data) {
                    await broadcastVersionUpdate('beta', item.platform || 'Unknown', item.version || 'N/A');
                }
                return sendSuccess(processingMessage, "Beta version tracking cards dispatched manually to all configured channels.");
            } else {
                return sendError(processingMessage, "Beta update version endpoints returned an empty data structure.");
            }
        } catch (err) {
            console.error(err);
            return sendError(processingMessage, `Failed manually dispatching current beta version logs: \`${err.message}\``);
        }
    }

    // =========================================================================
    // REST OF CORE ADMINISTRATIVE COMMAND UTILS
    // =========================================================================

    if (command === 'ping') {[cite: 1]
        const pingEmbed = new EmbedBuilder()[cite: 1]
            .setColor(0x2ECC71)[cite: 1]
            .setTitle('🏓 Pong!')[cite: 1]
            .setDescription(`Latency is **${Date.now() - message.createdTimestamp}ms**.\nAPI Latency is **${Math.round(client.ws.ping)}ms**.`)[cite: 1]
            .setTimestamp();[cite: 1]
        return message.reply({ embeds: [pingEmbed] });[cite: 1]
    }[cite: 1]

    if (command === 'version') {[cite: 1]
        const versionEmbed = new EmbedBuilder()[cite: 1]
            .setColor(0x3498DB)[cite: 1]
            .setTitle('ℹ️ Eazy Moderation | Version Profile')[cite: 1]
            .setDescription(`Current operational software framework layer is on **v${BOT_VERSION}**`)[cite: 1]
            .setTimestamp()[cite: 1]
            .setFooter({ text: `${client.user.username} Engine` });[cite: 1]
        return message.reply({ embeds: [versionEmbed] });[cite: 1]
    }[cite: 1]

    if (command === 'help') {[cite: 1]
        const helpEmbed = new EmbedBuilder()[cite: 1]
            .setColor(0x3498DB)[cite: 1]
            .setTitle('🛡️ Eazy Moderation | Commands Menu')[cite: 1]
            .setDescription('Here is a complete list of administrative commands available for this bot. Ensure roles are properly configured.')[cite: 1]
            .addFields([cite: 1]
                { name: '⚙️ Utilities', value: '`!ping` - Check bot status & latency.\n`!version` - Display active engine software release built.\n`!help` - Display this modern interface.\n`!check [executor]` - Check real-time exploit statuses.\n`!botlogs` - Display recent commands executed on this system.\n`!status` - View bot framework performance, hosting, and uptime.' },[cite: 1]
                { name: '📦 Roblox Tracker Subscriptions', value: '`!beta-ver #chan` - Bind Beta notifications.\n`!live-ver #chan` - Bind Live update streams.\n`!unbeta-ver #chan` - Lift Beta notification pipeline.\n`!unlive-ver #chan` - Lift Live notification pipeline.\n`!sendlive-ver` - Force execute Live alerts.\n`!sendbeta-ver` - Force execute Beta alerts.' },
                { name: '🔨 Punishments', value: '`!kick @user [reason]` - Kick a member.\n`!ban @user [reason]` - Permanently ban a member.\n`!unban [UserID]` - Revoke a ban.\n`!warn @user [reason]` - Record official warning logs.' },[cite: 1]
                { name: '🤫 Restraints & Voice', value: '`!mute @user [reason]` - Timeout a user for 24 hours.\n`!unmute @user` - Lift structural limitations.\n`!mutevc @user` - Toggle audio server voice mute.\n`!deafen @user` - Toggle system voice deafen.' },[cite: 1]
                { name: '🧹 Management & Lock', value: '`!clear [1-100]` - Wipe recent message flows.\n`!chatlogs @user` - Review targeted text streams.\n`!lock [#chan]` - Lock a text channel.\n`!unlock [#chan]` - Re-open text channel permission loops.\n`!lockdown` - Emergency lock ALL server text channels.\n`!unlockdown` - Restore text channel paths globally.' },[cite: 1]
                { name: '🏷️ Role Controls', value: '`!role [@user] [Role]` - Assign a specific role to a server target member.\n`!unrole [@user] [Role]` - Remove a specific role value assignment.' }[cite: 1]
            )[cite: 1]
            .setFooter({ text: `${client.user.username} Modern System`, iconURL: client.user.displayAvatarURL() })[cite: 1]
            .setTimestamp();[cite: 1]
        return message.reply({ embeds: [helpEmbed] });[cite: 1]
    }[cite: 1]

    if (command === 'kick') {[cite: 1]
        if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) {[cite: 1]
            return sendError(message, "You don't have permission to kick members.");[cite: 1]
        }[cite: 1]
        const target = message.mentions.members.first();[cite: 1]
        if (!target) return sendError(message, "Please mention a valid user to kick.");[cite: 1]
        if (!target.kickable) return sendError(message, "I cannot kick this user. Check my role hierarchy position.");[cite: 1]

        const reason = args.slice(1).join(" ") || "No reason specified";[cite: 1]
        await target.kick(reason);[cite: 1]

        const kickEmbed = new EmbedBuilder()[cite: 1]
            .setColor(0xE74C3C)[cite: 1]
            .setTitle('👢 Member Kicked')[cite: 1]
            .addFields([cite: 1]
                { name: 'User', value: `${target.user.tag} (${target.id})`, inline: true },[cite: 1]
                { name: 'Moderator', value: `${message.author.tag}`, inline: true },[cite: 1]
                { name: 'Reason', value: `*${reason}*` }[cite: 1]
            )[cite: 1]
            .setTimestamp();[cite: 1]
        return message.reply({ embeds: [kickEmbed] });[cite: 1]
    }[cite: 1]

    if (command === 'ban') {[cite: 1]
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {[cite: 1]
            return sendError(message, "You don't have permission to ban members.");[cite: 1]
        }[cite: 1]
        const target = message.mentions.members.first();[cite: 1]
        if (!target) return sendError(message, "Please mention a valid user to ban.");[cite: 1]
        if (!target.bannable) return sendError(message, "I cannot ban this user. Check my role hierarchy position.");[cite: 1]

        const reason = args.slice(1).join(" ") || "No reason specified";[cite: 1]
        await target.ban({ reason: reason });[cite: 1]

        const banEmbed = new EmbedBuilder()[cite: 1]
            .setColor(0x992D22)[cite: 1]
            .setTitle('⛔ Member Banned')[cite: 1]
            .addFields([cite: 1]
                { name: 'User', value: `${target.user.tag} (${target.id})`, inline: true },[cite: 1]
                { name: 'Moderator', value: `${message.author.tag}`, inline: true },[cite: 1]
                { name: 'Reason', value: `*${reason}*` }[cite: 1]
            )[cite: 1]
            .setTimestamp();[cite: 1]
        return message.reply({ embeds: [banEmbed] });[cite: 1]
    }[cite: 1]

    if (command === 'unban') {[cite: 1]
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) {[cite: 1]
            return sendError(message, "You don't have permission to unban members.");[cite: 1]
        }[cite: 1]
        const targetId = args[0];[cite: 1]
        if (!targetId) return sendError(message, "Please provide a valid User ID to unban.");[cite: 1]

        try {[cite: 1]
            await message.guild.members.unban(targetId);[cite: 1]
            const unbanEmbed = new EmbedBuilder()[cite: 1]
                .setColor(0x2ECC71)[cite: 1]
                .setTitle('🔓 Member Unbanned')[cite: 1]
                .setDescription(`Successfully revoked ban for User ID: **${targetId}**`)[cite: 1]
                .setTimestamp();[cite: 1]
            return message.reply({ embeds: [unbanEmbed] });[cite: 1]
        } catch (error) {[cite: 1]
            return sendError(message, "Failed to unban. Make sure the ID is correct and they are actually banned.");[cite: 1]
        }[cite: 1]
    }[cite: 1]

    if (command === 'mute') {[cite: 1]
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {[cite: 1]
            return sendError(message, "You don't have permission to mute members.");[cite: 1]
        }[cite: 1]
        const target = message.mentions.members.first();[cite: 1]
        if (!target) return sendError(message, "Please mention a user to mute.");[cite: 1]

        const reason = args.slice(1).join(" ") || "No reason specified";[cite: 1]
        try {[cite: 1]
            await target.timeout(24 * 60 * 60 * 1000, reason);[cite: 1]
            const muteEmbed = new EmbedBuilder()[cite: 1]
                .setColor(0xE67E22)[cite: 1]
                .setTitle('🔇 Member Muted')[cite: 1]
                .addFields([cite: 1]
                    { name: 'User', value: `${target.user.tag}`, inline: true },[cite: 1]
                    { name: 'Duration', value: `24 Hours`, inline: true },[cite: 1]
                    { name: 'Reason', value: `*${reason}*` }[cite: 1]
                )[cite: 1]
                .setTimestamp();[cite: 1]
            return message.reply({ embeds: [muteEmbed] });[cite: 1]
        } catch (error) {[cite: 1]
            return sendError(message, "I couldn't mute this user. Check my permissions hierarchy.");[cite: 1]
        }[cite: 1]
    }[cite: 1]

    if (command === 'unmute') {[cite: 1]
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {[cite: 1]
            return sendError(message, "You don't have permission to unmute members.");[cite: 1]
        }[cite: 1]
        const target = message.mentions.members.first();[cite: 1]
        if (!target) return sendError(message, "Please mention a user to unmute.");[cite: 1]

        try {[cite: 1]
            await target.timeout(null);[cite: 1]
            const unmuteEmbed = new EmbedBuilder()[cite: 1]
                .setColor(0x2ECC71)[cite: 1]
                .setTitle('🔊 Member Unmuted')[cite: 1]
                .setDescription(`Timeout restriction lifted for **${target.user.tag}**.`)[cite: 1]
                .setTimestamp();[cite: 1]
            return message.reply({ embeds: [unmuteEmbed] });[cite: 1]
        } catch (error) {[cite: 1]
            return sendError(message, "Failed to remove timeout from this user.");[cite: 1]
        }[cite: 1]
    }[cite: 1]

    if (command === 'clear' || command === 'purge') {[cite: 1]
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {[cite: 1]
            return sendError(message, "You don't have permission to delete messages.");[cite: 1]
        }[cite: 1]
        const amount = parseInt(args[0]);[cite: 1]
        if (isNaN(amount) || amount < 1 || amount > 100) {[cite: 1]
            return sendError(message, "Please enter a number between 1 and 100 indicating how many messages to clear.");[cite: 1]
        }[cite: 1]

        await message.channel.bulkDelete(amount + 1, true)[cite: 1]
            .then(messages => {[cite: 1]
                const clearEmbed = new EmbedBuilder()[cite: 1]
                    .setColor(0xF1C40F)[cite: 1]
                    .setDescription(`🧹 **Chat Cleaned!** Successfully deleted **${messages.size - 1}** messages.`);[cite: 1]
                
                message.channel.send({ embeds: [clearEmbed] }).then(msg => {[cite: 1]
                    setTimeout(() => msg.delete().catch(() => {}), 4000);  [cite: 1]
                });[cite: 1]
            })[cite: 1]
            .catch(() => sendError(message, "Messages older than 14 days cannot be bulk deleted by Discord API limitations."));[cite: 1]
    }[cite: 1]

    if (command === 'warn') {[cite: 1]
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) {[cite: 1]
            return sendError(message, "You don't have permission to warn members.");[cite: 1]
        }[cite: 1]
        const target = message.mentions.users.first();[cite: 1]
        if (!target) return sendError(message, "Please mention a valid member to warn.");[cite: 1]
        
        const reason = args.slice(1).join(" ") || "No reason specified";[cite: 1]
        const warnEmbed = new EmbedBuilder()[cite: 1]
            .setColor(0xE67E22)[cite: 1]
            .setTitle('⚠️ Official Warning Issued')[cite: 1]
            .setDescription(`${target}, you have received an official structural warning. Please adjust your conduct accordingly.`)[cite: 1]
            .addFields([cite: 1]
                { name: 'Warned User', value: `${target.tag}`, inline: true },[cite: 1]
                { name: 'Issued By', value: `${message.author.tag}`, inline: true },[cite: 1]
                { name: 'Infraction Reason', value: `*${reason}*` }[cite: 1]
            )[cite: 1]
            .setTimestamp();[cite: 1]
        return message.channel.send({ content: `${target}`, embeds: [warnEmbed] });[cite: 1]
    }[cite: 1]

    if (command === 'check') {[cite: 1]
        const query = args.join(" ");[cite: 1]
        if (!query) return sendError(message, "Please specify an executor name to lookup. Example: `!check velocity`");[cite: 1]

        const processingMessage = await message.reply("Checking..");[cite: 1]

        try {[cite: 1]
            const response = await fetch('https://weao.xyz/api/status/exploits');[cite: 1]
            if (!response.ok) throw new Error("API status fault.");[cite: 1]
            
            const executorsList = await response.json();[cite: 1]
            const queryLower = query.toLowerCase();[cite: 1]
            const matchedExecutor = executorsList.find(e => e.title && e.title.toLowerCase() === queryLower);[cite: 1]

            if (!matchedExecutor) {[cite: 1]
                const notFoundEmbed = new EmbedBuilder()[cite: 1]
                    .setColor(0xFF3333)[cite: 1]
                    .setDescription(`❌ **Executor Not Found:** Could not locate database traces matching \`${query}\`.`);[cite: 1]
                return processingMessage.edit({ content: null, embeds: [notFoundEmbed] });[cite: 1]
            }[cite: 1]

            const isWorking = matchedExecutor.updateStatus === true;[cite: 1]
            const statusEmoji = isWorking ? "✅" : "❌";[cite: 1]
            const embedColor = isWorking ? 0x2ECC71 : 0xE74C3C;[cite: 1]

            const isFree = matchedExecutor.free === true;[cite: 1]
            const tierText = isFree ? "Free" : "Paid";[cite: 1]

            const warningText = matchedExecutor.detected === true[cite: 1]
                ? "⚠️ Detected in banwaves, proceed with extreme caution."[cite: 1]
                : "Bypasses client mod bans, may cause bans in banwaves.";[cite: 1]

            const infoEmbed = new EmbedBuilder()[cite: 1]
                .setColor(embedColor)[cite: 1]
                .setTitle(matchedExecutor.title)[cite: 1]
                .setDescription([cite: 1]
                    `Updated ${statusEmoji} - \`${matchedExecutor.version || "N/A"}\` - **${tierText}** - Key System\n` +[cite: 1]
                    `Last updated: ${matchedExecutor.updatedDate || "N/A"}\n\n` +[cite: 1]
                    `> ${warningText}`[cite: 1]
                )[cite: 1]
                .setFooter({ text: 'Powered by weao.xyz' })[cite: 1]
                .setTimestamp();[cite: 1]

            if (EXECUTOR_IMAGES[queryLower] && EXECUTOR_IMAGES[queryLower] !== "") {[cite: 1]
                infoEmbed.setImage(EXECUTOR_IMAGES[queryLower]);[cite: 1]
            }[cite: 1]

            const actionRow = new ActionRowBuilder();[cite: 1]

            if (matchedExecutor.websitelink) {[cite: 1]
                actionRow.addComponents([cite: 1]
                    new ButtonBuilder()[cite: 1]
                        .setLabel('Website')[cite: 1]
                        .setStyle(ButtonStyle.Link)[cite: 1]
                        .setURL(matchedExecutor.websitelink)[cite: 1]
                );[cite: 1]
            }[cite: 1]

            if (matchedExecutor.discordlink) {[cite: 1]
                actionRow.addComponents([cite: 1]
                    new ButtonBuilder()[cite: 1]
                        .setLabel('Discord')[cite: 1]
                        .setStyle(ButtonStyle.Link)[cite: 1]
                        .setURL(matchedExecutor.discordlink)[cite: 1]
                );[cite: 1]
            }[cite: 1]

            if (queryLower !== 'velocity' && !isFree) {[cite: 1]
                actionRow.addComponents([cite: 1]
                    new ButtonBuilder()[cite: 1]
                        .setLabel('Purchase')[cite: 1]
                        .setStyle(ButtonStyle.Link)[cite: 1]
                        .setURL('https://rcheatz.com/')[cite: 1]
                );[cite: 1]
            }[cite: 1]

            const componentsArray = actionRow.components.length > 0 ? [actionRow] : [];[cite: 1]
            return processingMessage.edit({ content: null, embeds: [infoEmbed], components: componentsArray });[cite: 1]

        } catch (error) {[cite: 1]
            console.error(error);[cite: 1]
            const apiErrorEmbed = new EmbedBuilder()[cite: 1]
                .setColor(0xFF3333)[cite: 1]
                .setDescription("❌ **API Fault:** Failed to communicate or decode status details correctly right now.");[cite: 1]
            return processingMessage.edit({ content: null, embeds: [apiErrorEmbed] });[cite: 1]
        }[cite: 1]
    }[cite: 1]

    if (command === 'botlogs') {[cite: 1]
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {[cite: 1]
            return sendError(message, "You need `Manage Server` permissions to view bot operation metrics.");[cite: 1]
        }[cite: 1]
        if (globalBotLogs.length === 0) {[cite: 1]
            return message.reply("📋 **System Log Profile:** No commands have been handled since the engine last started.");[cite: 1]
        }[cite: 1]
        const formattedLogs = globalBotLogs.slice(-10).map(l => `\`[${l.timestamp}]\` **${l.user}**: \`${l.command}\``).join('\n');[cite: 1]
        const logsEmbed = new EmbedBuilder()[cite: 1]
            .setColor(0x34495E)[cite: 1]
            .setTitle('📋 Eazy Moderation | Internal System Audit Logs')[cite: 1]
            .setDescription(formattedLogs)[cite: 1]
            .setTimestamp();[cite: 1]
        return message.reply({ embeds: [logsEmbed] });[cite: 1]
    }[cite: 1]

    if (command === 'chatlogs') {[cite: 1]
        if (!message.member.permissions.has(PermissionFlagsBits.MessageContent)) {[cite: 1]
            return sendError(message, "You don't have the explicit permission flags required to generate transcripts.");[cite: 1]
        }[cite: 1]
        const targetUser = message.mentions.users.first();[cite: 1]
        if (!targetUser) return sendError(message, "Please tag a user to view context cache history. Usage: `!chatlogs @user`");[cite: 1]

        const history = runningChatLogs.get(targetUser.id) || [];[cite: 1]
        if (history.length === 0) {[cite: 1]
            return message.reply(`🔍 No tracked text streams indexed in memory for user **${targetUser.tag}** recently.`);[cite: 1]
        }[cite: 1]
        const transcript = history.slice(-15).map(m => `\`[${m.timestamp}] #${m.channel}\` ${m.content}`).join('\n');[cite: 1]
        const chatlogsEmbed = new EmbedBuilder()[cite: 1]
            .setColor(0x9B59B6)[cite: 1]
            .setTitle(`💬 Transcript Log: ${targetUser.username}`)[cite: 1]
            .setDescription(transcript.length > 2000 ? transcript.slice(0, 1990) + "..." : transcript)[cite: 1]
            .setFooter({ text: "Displaying up to 15 last logged messages" });[cite: 1]
        return message.reply({ embeds: [chatlogsEmbed] });[cite: 1]
    }[cite: 1]

    if (command === 'mutevc') {[cite: 1]
        if (!message.member.permissions.has(PermissionFlagsBits.MuteMembers)) {[cite: 1]
            return sendError(message, "You don't have the permission flag `Mute Members` to perform voice operations.");[cite: 1]
        }[cite: 1]
        const target = message.mentions.members.first();[cite: 1]
        if (!target) return sendError(message, "Please specify a target profile tag to adjust voice settings.");[cite: 1]

        const voiceState = target.voice.channel;[cite: 1]
        if (!voiceState) return sendError(message, "That user is not currently sitting in any active Voice Channels on this server.");[cite: 1]

        try {[cite: 1]
            const currentMuteStatus = target.voice.serverMute;[cite: 1]
            await target.voice.setMute(!currentMuteStatus);[cite: 1]
            const vcMuteEmbed = new EmbedBuilder()[cite: 1]
                .setColor(0x34495E)[cite: 1]
                .setDescription(`🎤 **Voice State Modified:** Successfully set server voice mute state to **${!currentMuteStatus}** for **${target.user.tag}**.`);[cite: 1]
            return message.reply({ embeds: [vcMuteEmbed] });[cite: 1]
        } catch (e) {[cite: 1]
            return sendError(message, "Could not manipulate connection layout flags on target user profiles.");[cite: 1]
        }[cite: 1]
    }[cite: 1]

    if (command === 'deafen') {[cite: 1]
        if (!message.member.permissions.has(PermissionFlagsBits.DeafenMembers)) {[cite: 1]
            return sendError(message, "You don't have the permission flag `Deafen Members` to perform voice operations.");[cite: 1]
        }[cite: 1]
        const target = message.mentions.members.first();[cite: 1]
        if (!target) return sendError(message, "Please specify a target profile tag to adjust deafen settings.");[cite: 1]

        const voiceState = target.voice.channel;[cite: 1]
        if (!voiceState) return sendError(message, "That user is not currently sitting in any active Voice Channels on this server.");[cite: 1]

        try {[cite: 1]
            const currentDeafenStatus = target.voice.serverDeafen;[cite: 1]
            await target.voice.setDeafen(!currentDeafenStatus);[cite: 1]
            const vcDeafenEmbed = new EmbedBuilder()[cite: 1]
                .setColor(0x34495E)[cite: 1]
                .setDescription(`🎧 **Voice State Modified:** Successfully set server voice deafen state to **${!currentDeafenStatus}** for **${target.user.tag}**.`);[cite: 1]
            return message.reply({ embeds: [vcDeafenEmbed] });[cite: 1]
        } catch (e) {[cite: 1]
            return sendError(message, "Could not manipulate connection layout flags on target user profiles.");[cite: 1]
        }[cite: 1]
    }[cite: 1]

    if (command === 'lock') {[cite: 1]
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {[cite: 1]
            return sendError(message, "You need `Manage Channels` permission to execute this operation.");[cite: 1]
        }[cite: 1]
        const targetChannel = message.mentions.channels.first() || message.channel;[cite: 1]
        try {[cite: 1]
            await targetChannel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });[cite: 1]
            const lockEmbed = new EmbedBuilder()[cite: 1]
                .setColor(0xE74C3C)[cite: 1]
                .setDescription(`🔒 **Channel Locked:** Chat access has been suspended in ${targetChannel}.`);[cite: 1]
            return message.reply({ embeds: [lockEmbed] });[cite: 1]
        } catch (err) {[cite: 1]
            return sendError(message, "Unable to restructure channel permission maps. Check bot hierarchy.");[cite: 1]
        }[cite: 1]
    }[cite: 1]

    if (command === 'unlock') {[cite: 1]
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {[cite: 1]
            return sendError(message, "You need `Manage Channels` permission to execute this operation.");[cite: 1]
        }[cite: 1]
        const targetChannel = message.mentions.channels.first() || message.channel;[cite: 1]
        try {[cite: 1]
            await targetChannel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });[cite: 1]
            const unlockEmbed = new EmbedBuilder()[cite: 1]
                .setColor(0x2ECC71)[cite: 1]
                .setDescription(`🔓 **Channel Unlocked:** Chat access has been restored in ${targetChannel}.`);[cite: 1]
            return message.reply({ embeds: [unlockEmbed] });[cite: 1]
        } catch (err) {[cite: 1]
            return sendError(message, "Unable to restructure channel permission maps. Check bot hierarchy.");[cite: 1]
        }[cite: 1]
    }[cite: 1]

    if (command === 'lockdown') {[cite: 1]
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {[cite: 1]
            return sendError(message, "Emergency server actions require full `Administrator` security clearances.");[cite: 1]
        }[cite: 1]
        const standardMessage = await message.reply("🔄 Initializing server-wide lockdown protocols...");[cite: 1]
        let lockedCount = 0;[cite: 1]
        const textChannels = message.guild.channels.cache.filter(c => c.isTextBased());[cite: 1]
        for (const [id, channel] of textChannels) {[cite: 1]
            try {[cite: 1]
                await channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });[cite: 1]
                lockedCount++;[cite: 1]
            } catch (e) {}[cite: 1]
        }[cite: 1]
        const lockdownDone = new EmbedBuilder()[cite: 1]
            .setColor(0x992D22)[cite: 1]
            .setTitle('🚨 Server Lockdown Active')[cite: 1]
            .setDescription(`Successfully locked **${lockedCount}** channels. Public communications are suspended.`);[cite: 1]
        return standardMessage.edit({ content: null, embeds: [lockdownDone] });[cite: 1]
    }[cite: 1]

    if (command === 'unlockdown') {[cite: 1]
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {[cite: 1]
            return sendError(message, "Emergency server actions require full `Administrator` security clearances.");[cite: 1]
        }[cite: 1]
        const standardMessage = await message.reply("🔄 Revoking lockdown limits, restoring channel arrays......");[cite: 1]
        let unlockedCount = 0;[cite: 1]
        const textChannels = message.guild.channels.cache.filter(c => c.isTextBased());[cite: 1]
        for (const [id, channel] of textChannels) {[cite: 1]
            try {[cite: 1]
                await channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });[cite: 1]
                unlockedCount++;[cite: 1]
            } catch (e) {}[cite: 1]
        }[cite: 1]
        const unlockdownDone = new EmbedBuilder()[cite: 1]
            .setColor(0x2ECC71)[cite: 1]
            .setTitle('🔓 Server Lockdown Lifted')[cite: 1]
            .setDescription(`Successfully restored public traffic permissions inside **${unlockedCount}** channels.`);[cite: 1]
        return standardMessage.edit({ content: null, embeds: [unlockdownDone] });[cite: 1]
    }[cite: 1]

    if (command === 'role') {[cite: 1]
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {[cite: 1]
            return sendError(message, "You don't have the `Manage Roles` permission.");[cite: 1]
        }[cite: 1]
        const targetMember = message.mentions.members.first();[cite: 1]
        if (!targetMember) return sendError(message, "Please tag a target member profile. Usage: `!role @user [Role Name/ID]`");[cite: 1]

        const roleQuery = args.slice(1).join(" ");[cite: 1]
        if (!roleQuery) return sendError(message, "Specify a target structural role tag or ID.");[cite: 1]

        const targetRole = message.guild.roles.cache.get(roleQuery) || [cite: 1]
                           message.guild.roles.cache.find(r => r.name.toLowerCase() === roleQuery.toLowerCase());[cite: 1]

        if (!targetRole) return sendError(message, "Could not map that role indicator value inside server databases.");[cite: 1]
        if (targetRole.position >= message.guild.members.me.roles.highest.position) {[cite: 1]
            return sendError(message, "That role sits higher than my operational permission index structure.");[cite: 1]
        }[cite: 1]

        try {[cite: 1]
            await targetMember.roles.add(targetRole);[cite: 1]
            const roleEmbed = new EmbedBuilder()[cite: 1]
                .setColor(0x3498DB)[cite: 1]
                .setDescription(`✅ Successfully assigned role **${targetRole.name}** to **${targetMember.user.tag}**.`);[cite: 1]
            return message.reply({ embeds: [roleEmbed] });[cite: 1]
        } catch (err) {[cite: 1]
            return sendError(message, "Execution failure. Verify structural role balance setups.");[cite: 1]
        }[cite: 1]
    }[cite: 1]

    if (command === 'unrole') {[cite: 1]
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) {[cite: 1]
            return sendError(message, "You don't have the `Manage Roles` permission.");[cite: 1]
        }[cite: 1]
        const targetMember = message.mentions.members.first();[cite: 1]
        if (!targetMember) return sendError(message, "Please tag a target member profile. Usage: `!unrole @user [Role Name/ID]`");[cite: 1]

        const roleQuery = args.slice(1).join(" ");[cite: 1]
        if (!roleQuery) return sendError(message, "Specify a target structural role tag or ID.");[cite: 1]

        const targetRole = message.guild.roles.cache.get(roleQuery) || [cite: 1]
                           message.guild.roles.cache.find(r => r.name.toLowerCase() === roleQuery.toLowerCase());[cite: 1]

        if (!targetRole) return sendError(message, "Could not map that role indicator value inside server databases.");[cite: 1]
        if (targetRole.position >= message.guild.members.me.roles.highest.position) {[cite: 1]
            return sendError(message, "That role sits higher than my operational permission index structure.");[cite: 1]
        }[cite: 1]

        try {[cite: 1]
            await targetMember.roles.remove(targetRole);[cite: 1]
            const unroleEmbed = new EmbedBuilder()[cite: 1]
                .setColor(0xE67E22)[cite: 1]
                .setDescription(`🗑️ Successfully removed role **${targetRole.name}** from **${targetMember.user.tag}**.`);[cite: 1]
            return message.reply({ embeds: [unroleEmbed] });[cite: 1]
        } catch (err) {[cite: 1]
            return sendError(message, "Execution failure. Verify structural role balance setups.");[cite: 1]
        }[cite: 1]
    }[cite: 1]

    if (command === 'status') {[cite: 1]
        const uptimeRaw = Date.now() - bootTime;[cite: 1]
        const hours = Math.floor(uptimeRaw / (1000 * 60 * 60));[cite: 1]
        const minutes = Math.floor((uptimeRaw % (1000 * 60 * 60)) / (1000 * 60));[cite: 1]
        const seconds = Math.floor((uptimeRaw % (1000 * 60)) / 1000);[cite: 1]

        const currentPing = client.ws.ping;[cite: 1]
        const isBotHealthy = (currentPing > 0 && currentPing < 1000) || (uptimeRaw < 60000 && currentPing >= -1);[cite: 1]
        const botStatusEmoji = isBotHealthy ? '🟢' : '🔴';[cite: 1]
        const botStatusText = isBotHealthy ? 'Working' : 'Lagging / Down';[cite: 1]

        const isRenderHostingActive = process.env.PORT !== undefined || process.env.RENDER === 'true';[cite: 1]
        const renderStatusEmoji = isRenderHostingActive ? '🟢' : '🔴';[cite: 1]
        const renderStatusText = isRenderHostingActive ? 'Working' : 'Local Host/Down';[cite: 1]

        let githubStatusEmoji = '🔴';[cite: 1]
        let githubStatusText = 'Down';[cite: 1]
        try {[cite: 1]
            const ghCheck = await fetch('https://api.github.com', { method: 'HEAD', signal: AbortSignal.timeout(1500) });[cite: 1]
            if (ghCheck.ok) {[cite: 1]
                githubStatusEmoji = '🟢';[cite: 1]
                githubStatusText = 'Working';[cite: 1]
            }[cite: 1]
        } catch (err) {[cite: 1]
            githubStatusEmoji = '🔴';[cite: 1]
            githubStatusText = 'Connection Error';[cite: 1]
        }[cite: 1]

        const CRASHY_BOT_ID = '1512062436411183114'; [cite: 1]
        let crashyMember = message.guild.members.cache.get(CRASHY_BOT_ID);[cite: 1]
        if (!crashyMember) {[cite: 1]
            try {[cite: 1]
                crashyMember = await message.guild.members.fetch(CRASHY_BOT_ID);[cite: 1]
            } catch (e) {}[cite: 1]
        }[cite: 1]
        
        const isCrashyOnline = crashyMember && crashyMember.presence && crashyMember.presence.status !== 'offline';[cite: 1]
        const crashyStatusEmoji = isCrashyOnline ? '🟢' : '🔴';[cite: 1]
        const crashyStatusText = isCrashyOnline ? 'Working' : 'Down';[cite: 1]

        const isSystemStable = isBotHealthy && isRenderHostingActive && isCrashyOnline;[cite: 1]
        const embedColor = isSystemStable ? 0x2ECC71 : 0xE74C3C;[cite: 1]

        const statusEmbed = new EmbedBuilder()[cite: 1]
            .setColor(embedColor)[cite: 1]
            .setTitle('⚙️ Eazy Moderation | System Status')[cite: 1]
            .setDescription([cite: 1]
                `${botStatusEmoji} **Bot status:** ${botStatusText}\n` +[cite: 1]
                `${renderStatusEmoji} **Render:** ${renderStatusText}\n` +[cite: 1]
                `${githubStatusEmoji} **GitHub:** ${githubStatusText}\n` +[cite: 1]
                `${crashyStatusEmoji} **crashy:** ${crashyStatusText}\n\n` +[cite: 1]
                `⏱️ **Uptime:** \`${hours}h ${minutes}m ${seconds}s\``[cite: 1]
            )[cite: 1]
            .setFooter({ text: 'Live system array validation checks active' })[cite: 1]
            .setTimestamp();[cite: 1]

        return message.reply({ embeds: [statusEmbed] });[cite: 1]
    }
});

// Dummy Web Server for Render Up-time monitoring[cite: 1]
const http = require('http');[cite: 1]
const server = http.createServer((req, res) => {[cite: 1]
    res.writeHead(200, { 'Content-Type': 'text/plain' });[cite: 1]
    res.end('Bot is awake!\n');[cite: 1]
});[cite: 1]
const PORT = process.env.PORT || 3000;[cite: 1]
server.listen(PORT, '0.0.0.0', () => {[cite: 1]
    console.log(`Web monitor listening on port ${PORT}`);[cite: 1]
});[cite: 1]

// =======================================================
// 🛡️ ANTI-CRASH PROTECTION ENGINE (Prevents Unhandled Drops)[cite: 1]
// =======================================================
process.on('unhandledRejection', (reason, promise) => {[cite: 1]
    console.error('⚠️ [CRITICAL ANTI-CRASH] Unhandled rejection intercepted:', promise, 'reason:', reason);[cite: 1]
});[cite: 1]
process.on('uncaughtException', (err, origin) => {[cite: 1]
    console.error('⚠️ [CRITICAL ANTI-CRASH] Uncaught exception intercepted:', err, 'origin:', origin);[cite: 1]
});[cite: 1]

client.login(process.env.DISCORD_TOKEN);[cite: 1]