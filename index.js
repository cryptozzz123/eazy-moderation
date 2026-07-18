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
        GatewayIntentBits.GuildPresences
    ]
});

const CONFIG_PATH = path.join(__dirname, 'version_config.json');

let versionConfig = {
    channels: [], 
    lastVersions: {
        live: {},
        beta: {},
        hidden: {}
    }
};

const BOT_VERSION = '1.5.3'; 

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

const globalBotLogs = [];
const runningChatLogs = new Map();
const cooldowns = new Collection();
const bootTime = Date.now();

client.once('ready', () => {
    console.log(`🚀 Success! Eazy Moderation loaded as ${client.user.tag}`);
    setInterval(checkRobloxVersions, 60000);
    checkRobloxVersions();
});

async function checkRobloxVersions() {
    if (!versionConfig.channels || versionConfig.channels.length === 0) return;

    try {
        const currentRes = await fetch('https://weao.xyz/api/versions/current');
        if (currentRes.ok) {
            const data = await currentRes.json();
            const list = Array.isArray(data) ? data : [data];
            const winObj = list.find(e => e.client?.toLowerCase() === 'windows' || e.platform?.toLowerCase() === 'windows');
            const liveVer = winObj?.version || '';

            if (liveVer && versionConfig.lastVersions.live !== liveVer) {
                await dispatch1to1Embed('live', liveVer);
                versionConfig.lastVersions.live = liveVer;
                saveConfig();
            }
        }
    } catch (err) {
        console.error("❌ Error polling live endpoint:", err.message);
    }

    try {
        const futureRes = await fetch('https://weao.xyz/api/versions/future');
        if (futureRes.ok) {
            const data = await futureRes.json();
            const list = Array.isArray(data) ? data : [data];
            const winObj = list.find(e => e.client?.toLowerCase() === 'windows' || e.platform?.toLowerCase() === 'windows');
            
            const betaVer = winObj?.version || '';
            const hiddenVer = winObj?.hiddenVersion || '';

            if (betaVer && versionConfig.lastVersions.beta !== betaVer) {
                await dispatch1to1Embed('beta', betaVer);
                versionConfig.lastVersions.beta = betaVer;
                saveConfig();
            }
            if (hiddenVer && versionConfig.lastVersions.hidden !== hiddenVer) {
                await dispatch1to1Embed('hidden', hiddenVer);
                versionConfig.lastVersions.hidden = hiddenVer;
                saveConfig();
            }
        }
    } catch (err) {
        console.error("❌ Error polling future endpoint:", err.message);
    }
}

async function dispatch1to1Embed(type, versionString) {
    if (versionString === 'N/A' || !versionString) return;
    const timestampUnix = Math.floor(Date.now() / 1000);
    const embed = new EmbedBuilder();
    let componentsArray = [];

    if (type === 'live') {
        embed.setColor(0xFF0000)
             .setTitle('Live update detected!')
             .setDescription(`This is a live ROBLOX update, Real is patched.\n\n**Platform:** Windows\n**Roblox Version:** \`${versionString}\`\n**Detected:** <t:${timestampUnix}:F>`)
             .setImage("https://cdn.discordapp.com/attachments/1499365932685070486/1524082621951377630/LIVE.png");

        const downloadLink = `https://rdd.weao.xyz/?channel=LIVE&binaryType=WindowsPlayer&version=${encodeURIComponent(versionString)}&includeLauncher=true&parallelDownloads=true`;

        const downloadRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Download Windows')
                .setStyle(ButtonStyle.Link)
                .setURL(downloadLink)
        );
        componentsArray.push(downloadRow);

    } else if (type === 'beta') {
        embed.setColor(0x00B500)
             .setTitle('Beta update detected!')
             .setDescription(`A new ROBLOX beta build was detected before LIVE.\n\n**Platform:** Windows\n**Roblox Version:** \`${versionString}\`\n**Detected:** <t:${timestampUnix}:F>`)
             .setImage("https://cdn.discordapp.com/attachments/1499365932685070486/1524487983984672988/BETA.png");

    } else if (type === 'hidden') {
        embed.setColor(0x1E7BFF)
             .setTitle('Version-hidden detected!')
             .setDescription(`A new WindowsPlayer version-hidden appeared in DeployHistory.\n\n**Platform:** Windows\n**Roblox Version:** \`${versionString}\`\n**Detected:** <t:${timestampUnix}:F>`)
             .setImage("https://cdn.discordapp.com/attachments/1499365932685070486/1523828898872426617/HIDDEN.png");
    }

    for (const channelId of versionConfig.channels) {
        try {
            const channel = await client.channels.fetch(channelId).catch(() => null);
            if (channel?.isTextBased()) {
                await channel.send({ content: "<@&1497655173047386282>", embeds: [embed], components: componentsArray });
            }
        } catch (e) {
            console.error(`⚠️ Delivery failure to channel context: ${channelId}`);
        }
    }
}

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    if (!runningChatLogs.has(message.author.id)) runningChatLogs.set(message.author.id, []);
    const userLog = runningChatLogs.get(message.author.id);
    userLog.push({ content: message.content, channel: message.channel.name, timestamp: new Date().toLocaleTimeString() });
    if (userLog.length > 100) userLog.shift();

    const prefix = '!';
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    const sendError = (msg, text) => msg.reply({ embeds: [new EmbedBuilder().setColor(0xFF3333).setDescription(`❌ ${text}`)] });
    const sendSuccess = (msg, text) => msg.reply({ embeds: [new EmbedBuilder().setColor(0x2ECC71).setDescription(`✅ ${text}`)] });

    const now = Date.now();
    const cooldownAmount = 2 * 1000;
    if (!cooldowns.has(command)) cooldowns.set(command, new Collection());
    const timestamps = cooldowns.get(command);
    if (timestamps.has(message.author.id)) {
        const expirationTime = timestamps.get(message.author.id) + cooldownAmount;
        if (now < expirationTime) return;
    }
    timestamps.set(message.author.id, now);

    globalBotLogs.push({ user: message.author.tag, command: `!${command} ${args.join(" ")}`.trim(), timestamp: new Date().toLocaleTimeString() });
    if (globalBotLogs.length > 150) globalBotLogs.shift();

    if (command === 'help') {
        const cmdsEmbed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle('📖 Eazy Moderation | Complete Commands Registry')
            .setDescription(
                `Use the prefix \`${prefix}\` before executing any commands listed below.\n\n` +
                `**Core Utilities**\n` +
                `• \`ping\` — Check real-time Discord API latency responses.\n` +
                `• \`version\` — Return system architecture build strings.\n` +
                `• \`status\` — Multi-endpoint framework health check values.\n` +
                `• \`help\` — Display this clean master systems guide.\n` +
                `• \`botlogs\` — View last 10 commands parsed through memory.\n\n` +
                `**Roblox Version Engines**\n` +
                `• \`currentver\` — Returns current versions for PC, Mac, Android & iOS with auto-updating download buttons.\n` +
                `• \`downgrade\` — Returns previous production rollback builds for PC and Mac with tracking buttons.\n\n` +
                `**Exploit Automation Tracking**\n` +
                `• \`check [name]\` — Query structural exploit bypass signatures and capabilities.\n\n` +
                `**Punishments & Restraints**\n` +
                `• \`kick / ban @user [reason]\` — Core member removal actions.\n` +
                `• \`unban [id]\` — Clear target restrictions by identifier index.\n` +
                `• \`warn @user [reason]\` — Log structural behavioral adjustments.\n` +
                `• \`mute / unmute @user\` — Restrict messaging metrics securely.\n\n` +
                `**Channel Management Operations**\n` +
                `• \`clear [1-100]\` — Clean clutter text blocks from channel flows.\n` +
                `• \`lock / unlock\` — Toggle message writing rights instantly.\n` +
                `• \`lockdown / unlockdown\` — Global server channel freezing arrays.\n` +
                `• \`chatlogs @user\` — Review last 15 elements cached by user footprint.\n\n` +
                `**Voice Channel Restraints & Roles**\n` +
                `• \`mutevc @user\` — Toggle targeted voice server mic muting.\n` +
                `• \`deafen @user\` — Toggle targeted voice server auditory deafen status.\n` +
                `• \`role @user [Name/ID]\` — Bind assigned role value patterns directly.\n` +
                `• \`unrole @user [Name/ID]\` — Strip assigned role value patterns directly.`
            )
            .setFooter({ text: `System Version v${BOT_VERSION} • Operations Profile` })
            .setTimestamp();
        return message.reply({ embeds: [cmdsEmbed] });
    }

    if (command === 'currentver') {
        const processing = await message.reply("Fetching current engine specifications...");
        try {
            const res = await fetch('https://weao.xyz/api/versions/current');
            if (!res.ok) throw new Error("API response error");
            const data = await res.json();
            
            const list = Array.isArray(data) ? data : [data];
            
            const winObj = list.find(e => e.client?.toLowerCase() === 'windows' || e.platform?.toLowerCase() === 'windows');
            const macObj = list.find(e => e.client?.toLowerCase() === 'mac' || e.client?.toLowerCase() === 'macos' || e.platform?.toLowerCase() === 'mac');
            const androidObj = list.find(e => e.client?.toLowerCase() === 'android' || e.platform?.toLowerCase() === 'android');
            const iosObj = list.find(e => e.client?.toLowerCase() === 'ios' || e.platform?.toLowerCase() === 'ios');

            const winVer = winObj?.version || 'N/A';
            const macVer = macObj?.version || 'N/A';
            const androidVer = androidObj?.version || 'N/A';
            const iosVer = iosObj?.version || 'N/A';

            const versionEmbed = new EmbedBuilder()
                .setColor(0x00FF87)
                .setTitle('🎮 Current Roblox Production Build Metrics')
                .setDescription('Displaying production layer version deployments verified across modern architectures.')
                .addFields(
                    { name: '🖥️ Windows Player', value: `\`${winVer}\``, inline: false },
                    { name: '🍎 macOS Client', value: `\`${macVer}\``, inline: false },
                    { name: '🤖 Android App', value: `\`${androidVer}\``, inline: true },
                    { name: '📱 iOS App', value: `\`${iosVer}\``, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'WEAO Live Client Engine Sync' });

            const winLink = `https://rdd.weao.xyz/?channel=LIVE&binaryType=WindowsPlayer&version=${encodeURIComponent(winVer)}&includeLauncher=true&parallelDownloads=true`;
            const macLink = `https://rdd.weao.xyz/?channel=LIVE&binaryType=MacPlayer&version=${encodeURIComponent(macVer)}&includeLauncher=true&parallelDownloads=true`;
            const androidLink = "https://play.google.com/store/apps/details?id=com.roblox.client";
            const iosLink = "https://apps.apple.com/us/app/roblox/id431946152";

            const btnRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setLabel('Download Win').setStyle(ButtonStyle.Link).setURL(winVer !== 'N/A' ? winLink : 'https://rdd.weao.xyz'),
                new ButtonBuilder().setLabel('Download Mac').setStyle(ButtonStyle.Link).setURL(macVer !== 'N/A' ? macLink : 'https://rdd.weao.xyz'),
                new ButtonBuilder().setLabel('Play Store').setStyle(ButtonStyle.Link).setURL(androidLink),
                new ButtonBuilder().setLabel('App Store').setStyle(ButtonStyle.Link).setURL(iosLink)
            );

            return processing.edit({ content: null, embeds: [versionEmbed], components: [btnRow] });
        } catch (err) {
            console.error(err);
            return processing.edit("❌ Failed to contact standard live tracker network components.");
        }
    }

    if (command === 'downgrade') {
        const processing = await message.reply("Analyzing history arrays for rollback logs...");
        try {
            const res = await fetch('https://weao.xyz/api/versions/past');
            if (!res.ok) throw new Error("API structural error");
            const data = await res.json();
            
            const list = Array.isArray(data) ? data : [data];

            const winPast = list.filter(e => e.client?.toLowerCase() === 'windows' || e.platform?.toLowerCase() === 'windows');
            const macPast = list.filter(e => e.client?.toLowerCase() === 'mac' || e.client?.toLowerCase() === 'macos' || e.platform?.toLowerCase() === 'mac');

            const pastWin = winPast[0]?.version || 'N/A';
            const pastMac = macPast[0]?.version || 'N/A';

            const downgradeEmbed = new EmbedBuilder()
                .setColor(0xFFAA00)
                .setTitle('⏳ Roblox Historical Rollback Version Engine')
                .setDescription('Displays deployment records tracking the prior functional client versions before the active production block.')
                .addFields(
                    { name: '🖥️ Previous Windows Player Build', value: `\`${pastWin}\``, inline: false },
                    { name: '🍎 Previous macOS Client Build', value: `\`${pastMac}\``, inline: false }
                )
                .setTimestamp()
                .setFooter({ text: 'WEAO Legacy Deployment Mapping' });

            const winLink = `https://rdd.weao.xyz/?channel=LIVE&binaryType=WindowsPlayer&version=${encodeURIComponent(pastWin)}&includeLauncher=true&parallelDownloads=true`;
            const macLink = `https://rdd.weao.xyz/?channel=LIVE&binaryType=MacPlayer&version=${encodeURIComponent(pastMac)}&includeLauncher=true&parallelDownloads=true`;

            const btnRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setLabel('Download Old Win').setStyle(ButtonStyle.Link).setURL(pastWin !== 'N/A' ? winLink : 'https://rdd.weao.xyz'),
                new ButtonBuilder().setLabel('Download Old Mac').setStyle(ButtonStyle.Link).setURL(pastMac !== 'N/A' ? macLink : 'https://rdd.weao.xyz')
            );

            return processing.edit({ content: null, embeds: [downgradeEmbed], components: [btnRow] });
        } catch (err) {
            console.error(err);
            return processing.edit("❌ Failed to parse historic databases.");
        }
    }

    if (command === 'ping') {
        return message.reply({ embeds: [new EmbedBuilder().setColor(0x2ECC71).setTitle('🏓 Pong!').setDescription(`Latency: **${Date.now() - message.createdTimestamp}ms**\nAPI: **${Math.round(client.ws.ping)}ms**`)] });
    }

    if (command === 'version') {
        return message.reply({ embeds: [new EmbedBuilder().setColor(0x3498DB).setTitle('ℹ️ Engine Version Profile').setDescription(`Active framework build layer: **v${BOT_VERSION}**`)] });
    }

    if (command === 'kick') {
        if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) return sendError(message, "Missing `Kick Members` permission.");
        const target = message.mentions.members.first();
        if (!target?.kickable) return sendError(message, "Cannot kick this profile target.");
        const reason = args.slice(1).join(" ") || "None specified";
        await target.kick(reason);
        return message.reply({ embeds: [new EmbedBuilder().setColor(0xE74C3C).setTitle('👢 Member Kicked').setDescription(`**User:** ${target.user.tag}\n**Reason:** *${reason}*`)] });
    }

    if (command === 'ban') {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) return sendError(message, "Missing `Ban Members` permission.");
        const target = message.mentions.members.first();
        if (!target?.bannable) return sendError(message, "Cannot ban this profile target.");
        const reason = args.slice(1).join(" ") || "None specified";
        await target.ban({ reason });
        return message.reply({ embeds: [new EmbedBuilder().setColor(0x992D22).setTitle('⛔ Member Banned').setDescription(`**User:** ${target.user.tag}\n**Reason:** *${reason}*`)] });
    }

    if (command === 'unban') {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) return sendError(message, "Missing permission.");
        const targetId = args[0];
        if (!targetId) return sendError(message, "Provide a valid User ID string.");
        try {
            await message.guild.members.unban(targetId);
            return sendSuccess(message, `Ban configuration index revoked for **${targetId}**.`);
        } catch { return sendError(message, "Failed to resolve unban lookup target."); }
    }

    if (command === 'mute') {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return sendError(message, "Missing rights.");
        const target = message.mentions.members.first();
        if (!target) return sendError(message, "Tag a user profile.");
        await target.timeout(24 * 60 * 60 * 1000, args.slice(1).join(" ") || "No details provided");
        return sendSuccess(message, `Timed out user **${target.user.tag}**.`);
    }

    if (command === 'unmute') {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return sendError(message, "Missing rights.");
        const target = message.mentions.members.first();
        if (!target) return sendError(message, "Tag a user profile.");
        await target.timeout(null);
        return sendSuccess(message, `Restored messaging footprint for **${target.user.tag}**.`);
    }

    if (command === 'clear' || command === 'purge') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) return sendError(message, "Missing rights.");
        const amount = parseInt(args[0]);
        if (isNaN(amount) || amount < 1 || amount > 100) return sendError(message, "Provide clear value between 1 and 100.");
        await message.channel.bulkDelete(amount + 1, true);
        return message.channel.send("🧹 **Chat Cleaned!**").then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
    }

    if (command === 'warn') {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return sendError(message, "Missing rights.");
        const target = message.mentions.users.first();
        if (!target) return sendError(message, "Tag a user profile.");
        return message.channel.send({ content: `${target}`, embeds: [new EmbedBuilder().setColor(0xE67E22).setTitle('⚠️ Structural Warning').setDescription(`**User:** ${target.tag}\n**Reason:** *${args.slice(1).join(" ") || "None"}*`)] });
    }

    if (command === 'check') {
        const query = args.join(" ");
        if (!query) return sendError(message, "Provide an executor string.");
        const processing = await message.reply("Checking..");
        try {
            const response = await fetch('https://weao.xyz/api/status/exploits');
            const list = await response.json();
            const matched = list.find(e => e.title?.toLowerCase() === query.toLowerCase());
            if (!matched) return processing.edit({ content: `Executor profile matching \`${query}\` not located.` });
            
            const isWorking = matched.updateStatus === true;
            
            const lastUpdatedRaw = matched.lastUpdated || new Date().toISOString();
            const dateObj = new Date(lastUpdatedRaw);
            const pad = (n) => String(n).padStart(2, '0');
            const formattedDate = `${pad(dateObj.getUTCDate())}/${pad(dateObj.getUTCMonth() + 1)}/${dateObj.getUTCFullYear()} at ${pad(dateObj.getUTCHours())}:${pad(dateObj.getUTCMinutes())} ${dateObj.getUTCHours() >= 12 ? 'PM' : 'AM'} UTC`;

            const statusEmbed = new EmbedBuilder()
                .setColor(isWorking ? 0x2ECC71 : 0xE74C3C)
                .setTitle(matched.title)
                .setDescription(
                    `Updated ${isWorking ? "✅" : "❌"} - \`${matched.version || "1.0.0"}\` - **${matched.type || "Free"}** - ${matched.keySystem ? "Key System" : "Keyless"}\n` +
                    `Last updated: ${formattedDate}\n\n` +
                    `| ⚠️ ${matched.detected ? "Detected in banwaves, proceed with extreme caution." : "Footprint completely secure within default metrics."}`
                )
                .setFooter({ text: `Powered by weao.xyz • ${new Date().toLocaleDateString('en-US')} ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` });
            
            if (EXECUTOR_IMAGES[query.toLowerCase()]) statusEmbed.setImage(EXECUTOR_IMAGES[query.toLowerCase()]);

            const targetWebsite = matched.websitelink || "https://weao.xyz";
            const targetDiscord = matched.discordlink || "https://discord.gg";

            const buttons = [
                new ButtonBuilder().setLabel('Website').setStyle(ButtonStyle.Link).setURL(targetWebsite),
                new ButtonBuilder().setLabel('Discord').setStyle(ButtonStyle.Link).setURL(targetDiscord)
            ];

            if (matched.type?.toLowerCase() === 'paid') {
                buttons.push(new ButtonBuilder().setLabel('Get Key').setStyle(ButtonStyle.Link).setURL('https://rcheatz.com/'));
            }

            const linkRow = new ActionRowBuilder().addComponents(buttons);

            return processing.edit({ content: null, embeds: [statusEmbed], components: [linkRow] });
        } catch (err) { 
            console.error(err);
            return processing.edit("API communication breakdown mapping executor values."); 
        }
    }

    if (command === 'botlogs') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) return sendError(message, "Missing rights.");
        const text = globalBotLogs.map(l => `\`[${l.timestamp}]\` **${l.user}**: \`${l.command}\``).join('\n') || "Empty logs cache.";
        return message.reply({ embeds: [new EmbedBuilder().setColor(0x34495E).setTitle('📋 Internal Audit Log Tracks').setDescription(text)] });
    }

    if (command === 'chatlogs') {
        if (!message.member.permissions.has(PermissionFlagsBits.MessageContent)) return sendError(message, "Missing rights.");
        const target = message.mentions.users.first();
        if (!target) return sendError(message, "Tag a target profile.");
        const records = runningChatLogs.get(target.id) || [];
        const text = records.map(m => `\`[${m.timestamp}] #${m.channel}\` ${m.content}`).join('\n') || "No lines tracked.";
        return message.reply({ embeds: [new EmbedBuilder().setColor(0x9B59B6).setTitle(`Transcript: ${target.username}`).setDescription(text)] });
    }

    if (command === 'mutevc') {
        if (!message.member.permissions.has(PermissionFlagsBits.MuteMembers)) return sendError(message, "Missing `Mute Members` flag.");
        const target = message.mentions.members.first();
        if (!target) return sendError(message, "Tag a target member profile.");
        if (!target.voice.channel) return sendError(message, "User is not active in a Voice Channel.");

        try {
            const state = target.voice.serverMute;
            await target.voice.setMute(!state);
            return message.reply(`🎤 **Voice State:** Set server voice mute to **${!state}** for **${target.user.tag}**.`);
        } catch { return sendError(message, "Failed to modify voice state layout flags."); }
    }

    if (command === 'deafen') {
        if (!message.member.permissions.has(PermissionFlagsBits.DeafenMembers)) return sendError(message, "Missing `Deafen Members` flag.");
        const target = message.mentions.members.first();
        if (!target) return sendError(message, "Tag a target member profile.");
        if (!target.voice.channel) return sendError(message, "User is not active in a Voice Channel.");

        try {
            const state = target.voice.serverDeafen;
            await target.voice.setDeafen(!state);
            return message.reply(`🎧 **Voice State:** Set server voice deafen to **${!state}** for **${target.user.tag}**.`);
        } catch { return sendError(message, "Failed to modify voice state layout flags."); }
    }

    if (command === 'role') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) return sendError(message, "Missing `Manage Roles` rights.");
        const target = message.mentions.members.first();
        if (!target) return sendError(message, "Tag a user. Usage: `!role @user [Role Name/ID]`");
        
        const query = args.slice(1).join(" ");
        const role = message.guild.roles.cache.get(query) || message.guild.roles.cache.find(r => r.name.toLowerCase() === query.toLowerCase());
        
        if (!role) return sendError(message, "Role not found inside server databases.");
        if (role.position >= message.guild.members.me.roles.highest.position) return sendError(message, "Target role sits higher than my position index.");
        
        await target.roles.add(role);
        return sendSuccess(message, `Assigned role **${role.name}** to **${target.user.tag}**.`);
    }

    if (command === 'unrole') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) return sendError(message, "Missing `Manage Roles` rights.");
        const target = message.mentions.members.first();
        if (!target) return sendError(message, "Tag a user. Usage: `!unrole @user [Role Name/ID]`");
        
        const query = args.slice(1).join(" ");
        const role = message.guild.roles.cache.get(query) || message.guild.roles.cache.find(r => r.name.toLowerCase() === query.toLowerCase());
        
        if (!role) return sendError(message, "Role not found inside server databases.");
        if (role.position >= message.guild.members.me.roles.highest.position) return sendError(message, "Target role sits higher than my position index.");
        
        await target.roles.remove(role);
        return sendSuccess(message, `Stripped role **${role.name}** from **${target.user.tag}**.`);
    }

    if (command === 'lock') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return sendError(message, "Missing permissions.");
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
        return message.reply("🔒 **Channel Locked.**");
    }

    if (command === 'unlock') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return sendError(message, "Missing permissions.");
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
        return message.reply("🔓 **Channel Unlocked.**");
    }

    if (command === 'lockdown') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return sendError(message, "Requires full Admin status.");
        const textChannels = message.guild.channels.cache.filter(c => c.isTextBased());
        for (const [id, c] of textChannels) {
            try { await c.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false }); } catch {}
        }
        return message.reply("🚨 **Emergency Global Lockdown Complete.** All communication flows suspended.");
    }

    if (command === 'unlockdown') {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return sendError(message, "Requires full Admin status.");
        const textChannels = message.guild.channels.cache.filter(c => c.isTextBased());
        for (const [id, c] of textChannels) {
            try { await c.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null }); } catch {}
        }
        return message.reply("🔓 **Global Lockdown Lifted.** Access routes active.");
    }

    if (command === 'status') {
        const uptimeRaw = Date.now() - bootTime;
        const hours = Math.floor(uptimeRaw / 3600000);
        const minutes = Math.floor((uptimeRaw % 3600000) / 60000);
        
        const currentPing = client.ws.ping;
        const botStatusText = currentPing > 0 && currentPing < 1000 ? '🟢 Working' : '🔴 Lagging';

        let ghStatus = '🟢 Working';
        try { await fetch('https://api.github.com', { method: 'HEAD', signal: AbortSignal.timeout(1000) }); } catch { ghStatus = '🔴 Fault'; }

        let crashyStatus = '🔴 Down';
        try {
            const crashy = await message.guild.members.fetch('1512062436411183114');
            if (crashy?.presence?.status && crashy.presence.status !== 'offline') crashyStatus = '🟢 Working';
        } catch {}

        const statusEmbed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('⚙️ Eazy Moderation | System Status')
            .setDescription(`**Date:** ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}\n\n**Bot:** ${botStatusText}\n**GitHub API:** ${ghStatus}\n**crashy:** ${crashyStatus}\n\n⏱️ **Uptime:** \`${hours}h ${minutes}m\``)
            .setTimestamp();
        return message.reply({ embeds: [statusEmbed] });
    }
});

const http = require('http');
http.createServer((req, res) => { res.writeHead(200); res.end('System Alive'); }).listen(process.env.PORT || 3000);

process.on('unhandledRejection', (reason) => console.error('⚠️ Intercepted Unhandled Rejection:', reason));
process.on('uncaughtException', (err) => console.error('⚠️ Intercepted Uncaught Exception:', err));

client.login(process.env.DISCORD_TOKEN);