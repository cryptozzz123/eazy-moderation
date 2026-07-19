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

const BOT_VERSION = '1.7.0'; 

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
    "volt": "https://cdn.discordapp.com/attachments/1478359860570751159/1526169379459563601/sunc.png",
    "potassium": "https://cdn.discordapp.com/attachments/1478359860570751159/1526176916531318814/sunc.png",
    "xeno": "https://cdn.discordapp.com/attachments/1478359860570751159/1526176811711467590/sunc.png",
    "solara": "https://cdn.discordapp.com/attachments/1478359860570751159/1526138851704307712/sunc.png",
    "wave": "https://cdn.discordapp.com/attachments/1478359860570751159/1526186867026825366/sunc.png",
    "real": "https://cdn.discordapp.com/attachments/1478359860570751159/1526177102817398886/sunc.png",
    "velocity": "https://cdn.discordapp.com/attachments/1478359860570751159/1526181791759601765/sunc.png",
    "madium": "https://cdn.discordapp.com/attachments/1478359860570751159/1526177030838812672/sunc.png",
    "synapse z": "https://cdn.discordapp.com/attachments/1478359860570751159/1526186942256123995/sunc.png",
    "cosmic": "https://cdn.discordapp.com/attachments/1478359860570751159/1526187048392851609/sunc.png",
    "macsploit": "https://cdn.discordapp.com/attachments/1478359860570751159/1526187094005911602/sunc.png",
    "opiumware": "https://cdn.discordapp.com/attachments/1478359860570751159/1526187176956661860/sunc.png",
    "delta": "https://cdn.discordapp.com/attachments/1478359860570751159/1526036362766057472/sunc.png",
    "codex": "https://cdn.discordapp.com/attachments/1478359860570751159/1526187244988141618/sunc.png",
    "vega x": "https://cdn.discordapp.com/attachments/1478359860570751159/1526187398478696519/sunc.png"
};

const globalBotLogs = [];
const runningChatLogs = new Map();
const cooldowns = new Collection();
const afkUsers = new Map(); 
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
            const liveVer = data.Windows || '';

            if (liveVer && versionConfig.lastVersions.live !== liveVer) {
                await dispatch1to1Embed('live', liveVer);
                versionConfig.lastVersions.live = liveVer;
                saveConfig();
            }
        }
    } catch (err) {
        console.error("❌ Error polling live endpoint:", err.message);
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

    const prefix = '!';

    // --- Automatic UNAFK Handling Logic ---
    if (afkUsers.has(message.author.id) && !message.content.startsWith(`${prefix}afk`)) {
        const afkData = afkUsers.get(message.author.id);
        afkUsers.delete(message.author.id);

        if (message.member && message.member.manageable) {
            try {
                await message.member.setNickname(afkData.oldDisplayName);
            } catch (err) {
                console.error("⚠️ Failed to revert nickname config:", err.message);
            }
        }

        const welcomeBack = await message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x2ECC71)
                    .setDescription(`👋 Welcome back ${message.author}! I have removed your AFK status configuration layer.`)
            ]
        });
        setTimeout(() => welcomeBack.delete().catch(() => {}), 5000);
    }

    // --- Dynamic Multi-User AFK Intercept Monitor ---
    if (message.mentions.users.size > 0) {
        message.mentions.users.forEach((user) => {
            if (afkUsers.has(user.id)) {
                const data = afkUsers.get(user.id);
                message.reply({
                    embeds: [
                        new EmbedBuilder()
                            .setColor(0xFFAA00)
                            .setDescription(`💤 ${user} is currently AFK: **${data.reason}**`)
                    ]
                }).catch(() => {});
            }
        });
    }

    if (!runningChatLogs.has(message.author.id)) runningChatLogs.set(message.author.id, []);
    const userLog = runningChatLogs.get(message.author.id);
    userLog.push({ content: message.content, channel: message.channel.name, timestamp: new Date().toLocaleTimeString() });
    if (userLog.length > 100) userLog.shift();

    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const command = args.shift().toLowerCase();

    const sendError = (msg, text) => msg.reply({ embeds: [new EmbedBuilder().setColor(0xFF3333).setDescription(`❌ ${text}`)] }).catch(() => {});
    const sendSuccess = (msg, text) => msg.reply({ embeds: [new EmbedBuilder().setColor(0x2ECC71).setDescription(`✅ ${text}`)] }).catch(() => {});

    const now = Date.now();
    const cooldownAmount = 2 * 1000;
    if (!cooldowns.has(command)) cooldowns.set(command, new Collection());
    const timestamps = cooldowns.get(command);
    if (timestamps.has(message.author.id)) {
        const expirationTime = timestamps.get(message.author.id) + cooldownAmount;
        if (now < expirationTime) return;
    }
    timestamps.set(message.author.id, now);

    globalBotLogs.push({ user: message.author.tag, command: `${prefix}${command} ${args.join(" ")}`.trim(), timestamp: new Date().toLocaleTimeString() });
    if (globalBotLogs.length > 150) globalBotLogs.shift();

    // --- !afk Command Framework (Fixed Stacking Bug) ---
    if (command === 'afk') {
        const afkReason = args.join(" ") || "Away from keyboard";
        
        const oldNickname = afkUsers.has(message.author.id) 
            ? afkUsers.get(message.author.id).oldDisplayName 
            : (message.member ? message.member.nickname : null);

        afkUsers.set(message.author.id, {
            reason: afkReason,
            oldDisplayName: oldNickname,
            timestamp: Date.now()
        });

        let baseName = message.member ? message.member.displayName : message.author.username;
        if (baseName.startsWith('[ AFK ] ')) {
            baseName = baseName.replace('[ AFK ] ', '');
        }

        let changeStatusText = "";

        if (message.member && message.member.manageable) {
            try {
                const truncatedNick = `[ AFK ] ${baseName}`.slice(0, 32);
                await message.member.setNickname(truncatedNick);
            } catch (err) {
                changeStatusText = "\n*(Note: Could not alter server profile display structure due to hierarchy limits)*";
            }
        } else {
            changeStatusText = "\n*(Note: Missing permissions context to modify this specific profile name)*";
        }

        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x3498DB)
                    .setTitle('💤 AFK Status Enabled')
                    .setDescription(`I have set your status to AFK.\n\n**Reason:** *${afkReason}*${changeStatusText}`)
                    .setTimestamp()
            ]
        });
    }

    // --- !nickname Command Framework ---
    if (command === 'nickname' || command === 'nick') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageNicknames)) {
            return sendError(message, "You require the `Manage Nicknames` permission to execute this command.");
        }

        const target = message.mentions.members.first();
        if (!target) {
            return sendError(message, "Please target a member. Usage: `!nickname @user [New Nickname]`");
        }

        if (!target.manageable) {
            return sendError(message, "I do not have high enough hierarchy permissions to manage this user's nickname.");
        }

        const targetNick = args.slice(1).join(" ");
        
        try {
            if (!targetNick) {
                // If no name specified, reset the user's nickname back to default
                await target.setNickname(null);
                return sendSuccess(message, `Successfully reset the nickname for **${target.user.tag}**.`);
            } else {
                // Change nickname to the provided string argument
                const truncatedNick = targetNick.slice(0, 32);
                await target.setNickname(truncatedNick);
                return sendSuccess(message, `Successfully updated **${target.user.tag}**'s nickname to \`${truncatedNick}\`.`);
            }
        } catch (err) {
            console.error(err);
            return sendError(message, "An internal error occurred while adjusting the user's nickname.");
        }
    }

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
                `• \`botlogs\` — View last 10 commands parsed through memory.\n` +
                `• \`afk [message]\` — Mark yourself away from keyboard with custom status messages.\n\n` +
                `**Roblox Version Engines**\n` +
                `• \`currentver\` — Returns current versions for PC, Mac, Android & iOS with auto-updating download buttons.\n` +
                `• \`downgrade\` — Returns previous production rollback builds for PC and Mac.\n` +
                `• \`futurever\` — Query upcoming deployment configurations tracked inside staging history.\n\n` +
                `**Exploit Automation Tracking**\n` +
                `• \`check [name]\` — Query structural exploit bypass signatures and capabilities.\n\n` +
                `**Punishments & Restraints**\n` +
                `• \`kick / ban @user [reason]\` — Core member removal actions.\n` +
                `• \`unban [id]\` — Clear target restrictions by identifier index.\n` +
                `• \`warn @user [reason]\` — Log structural behavioral adjustments.\n` +
                `• \`mute / unmute @user\` — Restrict messaging metrics securely.\n` +
                `• \`nickname @user [name]\` — Force change or reset a server member's nickname display profile.\n\n` +
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
            
            const winVer = data.Windows || 'N/A';
            const macVer = data.Mac || 'N/A';
            const androidVer = data.Android || 'N/A';
            const iosVer = data.iOS || 'N/A';

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
                new ButtonBuilder().setLabel('Download Win').setStyle(ButtonStyle.Link).setURL(winVer !== 'N/A' ? winLink : 'https://rdd.weao.xyz/'),
                new ButtonBuilder().setLabel('Download Mac').setStyle(ButtonStyle.Link).setURL(macVer !== 'N/A' ? macLink : 'https://rdd.weao.xyz/'),
                new ButtonBuilder().setLabel('Android').setStyle(ButtonStyle.Link).setURL(androidLink),
                new ButtonBuilder().setLabel('IOS').setStyle(ButtonStyle.Link).setURL(iosLink)
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
            
            const pastWin = data.Windows || 'N/A';
            const pastMac = data.Mac || 'N/A';

            const downgradeEmbed = new EmbedBuilder()
                .setColor(0xFFAA00)
                .setTitle('⏳ Roblox Historical Rollback Version Engine')
                .setDescription('Displays deployment records tracking the prior functional client versions before the active production block.\n\nVisit their Docs for More Information.')
                .addFields(
                    { name: '🖥️ Previous Windows Player Build', value: `\`${pastWin}\``, inline: false },
                    { name: '🍎 Previous macOS Client Build', value: `\`${pastMac}\``, inline: false }
                )
                .setTimestamp()
                .setFooter({ text: 'WEAO Legacy Deployment Mapping' });

            const winLink = `https://rdd.weao.xyz/?channel=LIVE&binaryType=WindowsPlayer&version=${encodeURIComponent(pastWin)}&includeLauncher=true&parallelDownloads=true`;
            const macLink = `https://rdd.weao.xyz/?channel=LIVE&binaryType=MacPlayer&version=${encodeURIComponent(pastMac)}&includeLauncher=true&parallelDownloads=true`;

            const btnRow = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setLabel('Download Old Win').setStyle(ButtonStyle.Link).setURL(pastWin !== 'N/A' ? winLink : 'https://rdd.weao.xyz/'),
                new ButtonBuilder().setLabel('Download Old Mac').setStyle(ButtonStyle.Link).setURL(pastMac !== 'N/A' ? macLink : 'https://rdd.weao.xyz/')
            );

            return processing.edit({ content: null, embeds: [downgradeEmbed], components: [btnRow] });
        } catch (err) {
            console.error(err);
            return processing.edit("❌ Failed to parse historic databases.");
        }
    }

    if (command === 'futurever') {
        const processing = await message.reply("Querying future staging metrics...");
        try {
            const res = await fetch('https://weao.xyz/api/versions/future');
            if (!res.ok) throw new Error("API structural error");
            const data = await res.json();

            const futureWin = data.Windows || 'N/A';
            const futureMac = data.Mac || 'N/A';

            const futureEmbed = new EmbedBuilder()
                .setColor(0x00B500)
                .setTitle('🔮 Future Roblox Staging Deployments')
                .setDescription('Displays forthcoming version builds parsed from next-in-line deployment configurations.')
                .addFields(
                    { name: '🖥️ Staging Windows Player Build', value: `\`${futureWin}\``, inline: false },
                    { name: '🍎 Staging macOS Client Build', value: `\`${futureMac}\``, inline: false }
                )
                .setTimestamp()
                .setFooter({ text: 'WEAO Next-Gen Build Sync' });

            return processing.edit({ content: null, embeds: [futureEmbed], components: [] });
        } catch (err) {
            console.error(err);
            return processing.edit("❌ Failed to communicate with next-gen deployment maps.");
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
        if (!target) return sendError(message, "Please target a member to kick.");
        if (!target.kickable) return sendError(message, "Cannot kick this profile target due to role hierarchies.");
        const reason = args.slice(1).join(" ") || "None specified";
        await target.kick(reason);
        return message.reply({ embeds: [new EmbedBuilder().setColor(0xE74C3C).setTitle('👢 Member Kicked').setDescription(`**User:** ${target.user.tag}\n**Reason:** *${reason}*`)] });
    }

    if (command === 'ban') {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) return sendError(message, "Missing `Ban Members` permission.");
        const target = message.mentions.members.first();
        if (!target) return sendError(message, "Please target a member to ban.");
        if (!target.bannable) return sendError(message, "Cannot ban this profile target due to role hierarchies.");
        const reason = args.slice(1).join(" ") || "None specified";
        await target.ban({ reason });
        return message.reply({ embeds: [new EmbedBuilder().setColor(0x992D22).setTitle('⛔ Member Banned').setDescription(`**User:** ${target.user.tag}\n**Reason:** *${reason}*`)] });
    }

    if (command === 'unban') {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) return sendError(message, "Missing permissions.");
        const targetId = args[0];
        if (!targetId) return sendError(message, "Provide a valid User ID string.");
        try {
            await message.guild.members.unban(targetId);
            return sendSuccess(message, `Ban configuration index revoked for ID: **${targetId}**.`);
        } catch { return sendError(message, "Failed to find or resolve unban lookup target."); }
    }

    if (command === 'mute') {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return sendError(message, "Missing permissions.");
        const target = message.mentions.members.first();
        if (!target) return sendError(message, "Tag a user profile.");
        await target.timeout(24 * 60 * 60 * 1000, args.slice(1).join(" ") || "No details provided");
        return sendSuccess(message, `Timed out user **${target.user.tag}** for 24 hours.`);
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
        
        try {
            await message.channel.bulkDelete(amount + 1, true);
            return message.channel.send("🧹 **Chat Cleaned!**").then(m => setTimeout(() => m.delete().catch(() => {}), 3000));
        } catch (err) {
            return sendError(message, "Cannot delete messages older than 14 days due to Discord platform limits.");
        }
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
        const processing = await message.reply("Checking API registry entries...");
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
        if (!message.member.permissions.has(PermissionFlagsBits.MuteMembers)) return sendError(message, "Missing \`Mute Members\` flag.");
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
        if (!message.member.permissions.has(PermissionFlagsBits.DeafenMembers)) return sendError(message, "Missing \`Deafen Members\` flag.");
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
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) return sendError(message, "Missing \`Manage Roles\` rights.");
        const target = message.mentions.members.first();
        if (!target) return sendError(message, "Tag a user. Usage: \`!role @user [Role Name/ID]\`");
        
        const query = args.slice(1).join(" ");
        if (!query) return sendError(message, "Please provide a valid Role name or explicit ID string.");
        const role = message.guild.roles.cache.get(query) || message.guild.roles.cache.find(r => r.name.toLowerCase() === query.toLowerCase());
        
        if (!role) return sendError(message, "Role not found inside server databases.");
        if (role.position >= message.guild.members.me.roles.highest.position) return sendError(message, "Target role sits higher than my position index.");
        
        await target.roles.add(role);
        return sendSuccess(message, `Assigned role **${role.name}** to **${target.user.tag}**.`);
    }

    if (command === 'unrole') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) return sendError(message, "Missing \`Manage Roles\` rights.");
        const target = message.mentions.members.first();
        if (!target) return sendError(message, "Tag a user. Usage: \`!unrole @user [Role Name/ID]\`");
        
        const query = args.slice(1).join(" ");
        if (!query) return sendError(message, "Please provide a valid Role name or explicit ID string.");
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