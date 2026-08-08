require('dotenv').config();
const {
    Client, GatewayIntentBits, PermissionFlagsBits, EmbedBuilder, Collection,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType,
    ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize, MessageFlags,
    MediaGalleryBuilder, MediaGalleryItemBuilder, AttachmentBuilder, SectionBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');

// Shared reference to the "crashy" bot's Discord user ID
const CRASHY_USER_ID = '1512062436411183114';

// Only this user may toggle !maintenance, !postupdate, !statusupd, and test commands
const MAINTENANCE_USER_ID = '1161980923168952410';

// Banner images for Roblox LIVE / Beta / Hidden alert cards
const RBLX_LIVE_BANNER_URL = 'https://cdn.discordapp.com/attachments/1499365932685070486/1529518568528674897/LIVE.png?ex=6a62e36b&is=6a6191eb&hm=6a89f509738444f7b5a66499dc9753c3b82106ffb16baff34fdae72014534dee&';
const RBLX_BETA_BANNER_URL = 'https://cdn.discordapp.com/attachments/1499365932685070486/1529257162436640778/BETA.png?ex=6a634177&is=6a61eff7&hm=3d590db7d58b0cdbd6340a8c5196a227e7de398bf3f02af330c25cad39688eaf&';
const RBLX_HIDDEN_BANNER_URL = 'https://cdn.discordapp.com/attachments/1499365932685070486/1529458299467202730/HIDDEN.png?ex=6a62ab4a&is=6a6159ca&hm=f08b95e7e1bbe2bfe1bfb66fb1aa1dc15b5b865d29d85d1f6005179d555b6e33&';

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
    robloxChannels: { live: null, beta: null, hidden: null },
    updateChannel: null,
    statusUpdateChannel: null,
    announceChannel: null,
    statusVCs: { crashy: null, eazy: null },
    maintenanceMode: { eazy: false, crashy: false },
    lastVersions: {
        live: { windows: null, mac: null, android: null, ios: null },
        beta: { windows: null, mac: null },
        hidden: { windows: null, mac: null }
    }
};

// Default per-platform shape for each update type — used to migrate old flat configs
const LAST_VERSIONS_DEFAULTS = {
    live: { windows: null, mac: null, android: null, ios: null },
    beta: { windows: null, mac: null },
    hidden: { windows: null, mac: null }
};

const BOT_VERSION = '1.12.0'; 

if (fs.existsSync(CONFIG_PATH)) {
    try {
        const fileData = fs.readFileSync(CONFIG_PATH, 'utf8');
        versionConfig = Object.assign(versionConfig, JSON.parse(fileData));
    } catch (e) {
        console.error("⚠️ Failed to parse version_config.json, starting fresh.", e);
    }
}

// Backwards-compatible migrations
if (typeof versionConfig.maintenanceMode === 'boolean') {
    versionConfig.maintenanceMode = { eazy: versionConfig.maintenanceMode, crashy: false };
} else if (!versionConfig.maintenanceMode || typeof versionConfig.maintenanceMode !== 'object') {
    versionConfig.maintenanceMode = { eazy: false, crashy: false };
}

if (!versionConfig.lastVersions || typeof versionConfig.lastVersions !== 'object') {
    versionConfig.lastVersions = JSON.parse(JSON.stringify(LAST_VERSIONS_DEFAULTS));
} else {
    for (const key of ['live', 'beta', 'hidden']) {
        const existing = versionConfig.lastVersions[key];
        if (!existing || typeof existing !== 'object') {
            // Old flat string/null value from a previous bot version — carry it over as the Windows entry
            versionConfig.lastVersions[key] = { ...LAST_VERSIONS_DEFAULTS[key], windows: (typeof existing === 'string' ? existing : null) };
        } else {
            versionConfig.lastVersions[key] = { ...LAST_VERSIONS_DEFAULTS[key], ...existing };
        }
    }
}
if (!versionConfig.robloxChannels || typeof versionConfig.robloxChannels !== 'object') {
    versionConfig.robloxChannels = { live: null, beta: null, hidden: null };
}
if (!versionConfig.statusVCs || typeof versionConfig.statusVCs !== 'object') {
    versionConfig.statusVCs = { crashy: null, eazy: null };
}

function saveConfig() {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(versionConfig, null, 4), 'utf8');
    } catch (e) {
        console.error("⚠️ Could not write configurations to storage file.", e);
    }
}

// ================= EazyCoins Economy System =================
const ECONOMY_PATH = path.join(__dirname, 'economy_config.json');
const DEFAULT_ECONOMY_COMPANIES = {
    doge: { name: 'DOGE', ownerId: null, price: 0.18 },
    pepe: { name: 'PEPE', ownerId: null, price: 0.006 },
    moon: { name: 'MOON', ownerId: null, price: 95 }
};

let economyData = {
    wallets: {},          // userId -> EazyCoins balance
    lastBeg: {},           // userId -> timestamp
    lastHunt: {},          // userId -> timestamp
    lastRob: {},            // userId -> timestamp
    lastBreakin: {},        // userId -> timestamp
    linkedCompany: {},      // userId -> true once they've used !cryptolaunch
    companies: JSON.parse(JSON.stringify(DEFAULT_ECONOMY_COMPANIES)), // key -> { name, ownerId, price }
    holdings: {}             // userId -> { companyKey: amount }
};

if (fs.existsSync(ECONOMY_PATH)) {
    try {
        const fileData = fs.readFileSync(ECONOMY_PATH, 'utf8');
        economyData = Object.assign(economyData, JSON.parse(fileData));
        // Make sure the built-in coins always exist, even against an older economy file
        economyData.companies = Object.assign(JSON.parse(JSON.stringify(DEFAULT_ECONOMY_COMPANIES)), economyData.companies);
        for (const key of ['wallets', 'lastBeg', 'lastHunt', 'lastRob', 'lastBreakin', 'linkedCompany', 'holdings']) {
            if (!economyData[key] || typeof economyData[key] !== 'object') economyData[key] = {};
        }
    } catch (e) {
        console.error("⚠️ Failed to parse economy_config.json, starting fresh.", e);
    }
}

function saveEconomy() {
    try {
        fs.writeFileSync(ECONOMY_PATH, JSON.stringify(economyData, null, 4), 'utf8');
    } catch (e) {
        console.error("⚠️ Could not write economy data to storage file.", e);
    }
}

function getWallet(userId) {
    return economyData.wallets[userId] || 0;
}

function addWallet(userId, amount) {
    economyData.wallets[userId] = Math.max(0, Math.round((economyData.wallets[userId] || 0) + amount));
}

// Accepts a plain number, comma-formatted number, or "all"/"max" shorthand for bet amounts
function parseBetAmount(raw, walletBalance) {
    if (!raw) return null;
    const normalized = raw.toString().toLowerCase();
    if (normalized === 'all' || normalized === 'max') return walletBalance;
    const num = parseInt(raw.toString().replace(/,/g, ''), 10);
    if (isNaN(num)) return null;
    return num;
}

function pickWeighted(list) {
    const total = list.reduce((s, i) => s + i.weight, 0);
    let roll = Math.random() * total;
    for (const item of list) {
        if (roll < item.weight) return item;
        roll -= item.weight;
    }
    return list[list.length - 1];
}

// Minimal blackjack deck helpers (infinite-deck / draw-with-replacement — no card counting needed)
const CARD_RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const CARD_SUITS = ['♠️', '♥️', '♦️', '♣️'];

function drawCard() {
    const rank = CARD_RANKS[Math.floor(Math.random() * CARD_RANKS.length)];
    const suit = CARD_SUITS[Math.floor(Math.random() * CARD_SUITS.length)];
    return { rank, suit };
}

function cardValue(rank) {
    if (rank === 'A') return 11;
    if (rank === 'K' || rank === 'Q' || rank === 'J') return 10;
    return parseInt(rank, 10);
}

function handValue(hand) {
    let total = hand.reduce((sum, c) => sum + cardValue(c.rank), 0);
    let aces = hand.filter(c => c.rank === 'A').length;
    while (total > 21 && aces > 0) {
        total -= 10;
        aces--;
    }
    return total;
}

function formatHand(hand) {
    return hand.map(c => `${c.rank}${c.suit}`).join(' ');
}
// ================= End EazyCoins Economy System Engine =================

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
const userWarnings = new Collection(); 
const bootTime = Date.now();

client.once('ready', () => {
    console.log(`🚀 Success! Eazy Moderation loaded as ${client.user.tag} [v${BOT_VERSION}]`);
    setInterval(() => {
        checkRobloxVersions();
        updateStatusVoiceChannels();
    }, 60000);
    checkRobloxVersions();
    updateStatusVoiceChannels();
});

// Auto-updates channel names dynamically based on live status
async function updateStatusVoiceChannels() {
    let eazyText = "Eazy Moderation : Working 🟢";
    if (versionConfig.maintenanceMode?.eazy) {
        eazyText = "Eazy Moderation : Maintenance 🟠";
    } else if (client.ws.ping <= 0 || client.ws.ping > 1200) {
        eazyText = "Eazy Moderation : Down 🔴";
    }

    let crashyText = "crashy : Down 🔴";
    if (versionConfig.maintenanceMode?.crashy) {
        crashyText = "crashy : Maintenance 🟠";
    } else {
        for (const guild of client.guilds.cache.values()) {
            try {
                const crashyMember = await guild.members.fetch(CRASHY_USER_ID).catch(() => null);
                if (crashyMember?.presence?.status && crashyMember.presence.status !== 'offline') {
                    crashyText = "crashy : Working 🟢";
                    break;
                }
            } catch {}
        }
    }

    if (versionConfig.statusVCs?.eazy) {
        const chan = await client.channels.fetch(versionConfig.statusVCs.eazy).catch(() => null);
        if (chan && chan.name !== eazyText) await chan.setName(eazyText).catch(() => {});
    }
    if (versionConfig.statusVCs?.crashy) {
        const chan = await client.channels.fetch(versionConfig.statusVCs.crashy).catch(() => null);
        if (chan && chan.name !== crashyText) await chan.setName(crashyText).catch(() => {});
    }
}

// Registers a freshly polled version string for a given (type, platform) pair and
// fires an alert only when it actually changed — and never on the very first observation,
// so newly-tracked platforms (e.g. Android/iOS) don't spam the channel on rollout/startup.
async function registerVersionAndAlert(type, platform, versionString, dateStr) {
    if (!versionString) return;
    const current = versionConfig.lastVersions[type][platform];
    if (current === versionString) return;

    const isFirstRun = !current;
    versionConfig.lastVersions[type][platform] = versionString;
    saveConfig();

    if (!isFirstRun) {
        await sendRobloxAlertToChannel(type, platform, versionString, dateStr || new Date().toLocaleString());
    }
}

// Same idea as registerVersionAndAlert, but for "hidden" entries where the unique signature
// is versionLabel+date combined (mirrors the original hidden-version change detection).
async function registerHiddenAndAlert(platform, versionLabel, dateStr) {
    if (!versionLabel) return;
    const signature = `${versionLabel}|${dateStr}`;
    const current = versionConfig.lastVersions.hidden[platform];
    if (current === signature) return;

    const isFirstRun = !current;
    versionConfig.lastVersions.hidden[platform] = signature;
    saveConfig();

    if (!isFirstRun) {
        await sendRobloxAlertToChannel('hidden', platform, versionLabel, dateStr);
    }
}

async function checkRobloxVersions() {
    // LIVE — Windows, macOS, Android, iOS (all from the same /versions/current payload)
    if (versionConfig.robloxChannels?.live) {
        try {
            const res = await fetch('https://weao.xyz/api/versions/current');
            if (res.ok) {
                const data = await res.json();
                await registerVersionAndAlert('live', 'windows', data.Windows, data.WindowsDate);
                await registerVersionAndAlert('live', 'mac', data.Mac, data.MacDate);
                await registerVersionAndAlert('live', 'android', data.Android, data.AndroidDate);
                await registerVersionAndAlert('live', 'ios', data.iOS, data.iOSDate);
            }
        } catch (err) { console.error("❌ Error polling live endpoint:", err.message); }
    }

    // BETA / FUTURE — Windows, macOS (WEAO's /versions/future only exposes these two)
    if (versionConfig.robloxChannels?.beta) {
        try {
            const res = await fetch('https://weao.xyz/api/versions/future');
            if (res.ok) {
                const data = await res.json();
                await registerVersionAndAlert('beta', 'windows', data.Windows, data.WindowsDate);
                await registerVersionAndAlert('beta', 'mac', data.Mac, data.MacDate);
            }
        } catch (err) { console.error("❌ Error polling future endpoint:", err.message); }
    }

    // HIDDEN — Windows, macOS (parsed straight from Roblox's own DeployHistory.txt files)
    if (versionConfig.robloxChannels?.hidden) {
        try {
            const winEntry = await getLatestHiddenEntry('windows');
            if (winEntry) await registerHiddenAndAlert('windows', winEntry.versionLabel, winEntry.dateStr);
        } catch (err) { console.error("❌ Error polling Windows DeployHistory.txt:", err.message); }

        try {
            const macEntry = await getLatestHiddenEntry('mac');
            if (macEntry) await registerHiddenAndAlert('mac', macEntry.versionLabel, macEntry.dateStr);
        } catch (err) { console.error("❌ Error polling macOS DeployHistory.txt:", err.message); }
    }
}

// Roblox's own deploy-history files (the same source Roblox's bootstrappers rely on) for
// resolving the current hidden ("version-hidden") build per platform.
const DEPLOY_HISTORY_URLS = {
    windows: 'https://setup.rbxcdn.com/DeployHistory.txt',
    mac: 'https://setup.rbxcdn.com/mac/DeployHistory.txt'
};
const DEPLOY_HISTORY_BINARY = {
    windows: 'WindowsPlayer',
    mac: 'MacPlayer'
};

async function getLatestHiddenEntry(platform) {
    const url = DEPLOY_HISTORY_URLS[platform];
    const binaryName = DEPLOY_HISTORY_BINARY[platform];
    if (!url || !binaryName) return null;

    const res = await fetch(url);
    if (!res.ok) return null;

    const lines = (await res.text()).split('\n');
    let latestLine = null;
    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].includes(binaryName) && lines[i].includes('version-hidden')) {
            latestLine = lines[i];
            break;
        }
    }
    if (!latestLine) return null;

    const dateMatch = latestLine.match(/version-hidden at ([^,]+),/);
    const fileVerMatch = latestLine.match(/file version:\s*([\d,\s]+),\s*git hash:/);
    const dateStr = dateMatch ? dateMatch[1].trim() : 'Unknown';

    let versionLabel = 'version-hidden';
    if (fileVerMatch) {
        const parts = fileVerMatch[1].split(',').map(p => p.trim()).filter(Boolean);
        if (parts.length > 0) versionLabel = parts.join('.');
    }

    return { versionLabel, dateStr };
}

const PLATFORM_LABELS = { windows: 'Windows', mac: 'macOS', android: 'Android', ios: 'iOS' };
const PLATFORM_BINARY_TYPES = { windows: 'WindowsPlayer', mac: 'MacPlayer' };

async function buildRobloxAlertPayload(type, platform, versionString, dateStr) {
    let title, desc, banner;
    const platformLabel = PLATFORM_LABELS[platform] || platform;
    if (type === 'live') {
        title = 'Live update detected!';
        desc = `A new ROBLOX LIVE version is out for ${platformLabel}.`;
        banner = RBLX_LIVE_BANNER_URL;
    } else if (type === 'beta') {
        title = 'Beta update detected!';
        desc = `A new ROBLOX beta build was detected before LIVE for ${platformLabel}.`;
        banner = RBLX_BETA_BANNER_URL;
    } else {
        title = 'Version-hidden detected!';
        desc = `A new ${PLATFORM_BINARY_TYPES[platform] || platformLabel} version-hidden appeared in DeployHistory.`;
        banner = RBLX_HIDDEN_BANNER_URL;
    }

    const fieldsText = `**Platform:** ${platformLabel}\n**Roblox Version:** \`${versionString}\`\n**Detected:** ${dateStr}`;

    let downloadRow = null;
    if (type !== 'hidden' && PLATFORM_BINARY_TYPES[platform]) {
        const downloadUrl = `https://rdd.weao.xyz/?channel=LIVE&binaryType=${PLATFORM_BINARY_TYPES[platform]}&version=${encodeURIComponent(versionString)}&includeLauncher=true&parallelDownloads=true`;
        downloadRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('Download').setStyle(ButtonStyle.Link).setURL(downloadUrl)
        );
    }

    if (ContainerBuilder && TextDisplayBuilder && SeparatorBuilder && MediaGalleryBuilder && MediaGalleryItemBuilder && MessageFlags) {
        try {
            const container = new ContainerBuilder();
            container.addMediaGalleryComponents(
                new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(banner))
            );
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**${title}**`));
            container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`${desc}\n\n${fieldsText}`));
            if (downloadRow) {
                container.addSeparatorComponents(new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small));
                container.addActionRowComponents(downloadRow);
            }
            return { components: [container], flags: MessageFlags.IsComponentsV2 };
        } catch (err) {
            console.error("⚠️ Components V2 container failed for Roblox alert, falling back to embed:", err.message);
        }
    }

    const embed = new EmbedBuilder().setTitle(title).setDescription(`${desc}\n\n${fieldsText}`).setImage(banner);
    return { embeds: [embed], components: downloadRow ? [downloadRow] : [] };
}

async function sendRobloxAlertToChannel(type, platform, versionString, dateStr) {
    const channelId = versionConfig.robloxChannels?.[type];
    if (!channelId) return;
    try {
        const channel = await client.channels.fetch(channelId).catch(() => null);
        if (channel?.isTextBased()) {
            const payload = await buildRobloxAlertPayload(type, platform, versionString, dateStr);
            await channel.send(payload);
        }
    } catch (e) {
        console.error(`⚠️ Failed to deliver Roblox ${type}/${platform} alert to channel ${channelId}:`, e.message);
    }
}

async function buildRobloxConfirmationPayload(type) {
    const labelMap = {
        live: 'LIVE Roblox Updates (Windows, macOS, Android & iOS)',
        beta: 'Beta Roblox Updates (Windows & macOS)',
        hidden: 'Hidden Roblox Versions (Windows & macOS)'
    };
    const text = `✅ **This channel is now linked for ${labelMap[type]}.**\nAlerts will be posted here automatically going forward.`;

    if (ContainerBuilder && TextDisplayBuilder && MessageFlags) {
        try {
            const container = new ContainerBuilder();
            container.addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
            return { components: [container], flags: MessageFlags.IsComponentsV2 };
        } catch (err) {
            console.error("⚠️ Components V2 confirmation failed, falling back to embed:", err.message);
        }
    }
    return { embeds: [new EmbedBuilder().setColor(0x2ECC71).setDescription(text)] };
}

client.on('messageCreate', async (message) => {
    if (message.author.bot || !message.guild) return;

    const prefix = '!';

    // UNAFK Handling
    if (afkUsers.has(message.author.id) && !message.content.startsWith(`${prefix}afk`)) {
        const afkData = afkUsers.get(message.author.id);
        afkUsers.delete(message.author.id);

        if (message.member && message.member.manageable) {
            try {
                await message.member.setNickname(afkData.oldDisplayName);
            } catch (err) {
                console.error("⚠️ Failed to revert nickname:", err.message);
            }
        }

        const welcomeBack = await message.channel.send({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x2ECC71)
                    .setDescription(`👋 Welcome back ${message.author}! I have removed your AFK status.`)
            ]
        });
        setTimeout(() => welcomeBack.delete().catch(() => {}), 5000);
    }

    // AFK Intercept
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

    // !setannounce Command (PERSISTED NOW)
    if (command === 'setannounce') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return sendError(message, "You need the `Manage Channels` permission to run this command.");
        }

        const targetChannel = message.mentions.channels.first();
        if (!targetChannel || !targetChannel.isTextBased()) {
            return sendError(message, "Please mention a valid text channel. Usage: `!setannounce #channel`");
        }

        versionConfig.announceChannel = targetChannel.id;
        saveConfig();

        try {
            const confirmText = `✅ **This channel is now set to receive Further Announcements.**`;
            if (ContainerBuilder && TextDisplayBuilder && MessageFlags) {
                const confirmContainer = new ContainerBuilder();
                confirmContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(confirmText));
                await targetChannel.send({ components: [confirmContainer], flags: MessageFlags.IsComponentsV2 });
            } else {
                await targetChannel.send({ embeds: [new EmbedBuilder().setColor(0x2ECC71).setDescription(confirmText)] });
            }
        } catch (e) {
            console.error(`⚠️ Failed to send confirmation to channel ${targetChannel.id}:`, e.message);
        }

        return sendSuccess(message, `Announcement channel set to ${targetChannel}.`);
    }

    // !announce Command
    if (command === 'announce') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
            return sendError(message, "You do not have permission to run this command.");
        }

        if (!versionConfig.announceChannel) {
            return sendError(message, "No announcement channel is set yet. Use `!setannounce #channel` first.");
        }

        const text = args.join(" ");
        if (!text) {
            return sendError(message, "Please provide the text you want to announce. Usage: `!announce [text]`");
        }

        const targetChannel = await client.channels.fetch(versionConfig.announceChannel).catch(() => null);
        if (!targetChannel?.isTextBased()) {
            return sendError(message, "Couldn't reach the configured announcement channel — it may have been deleted.");
        }

        const unixNow = Math.floor(Date.now() / 1000);
        const payload = {
            flags: 32768,
            components: [
                {
                    type: 17,
                    components: [
                        {
                            type: 10,
                            content: `# ANNOUNCEMENT\n${text}\n\nAnnounced On : <t:${unixNow}:f>`
                        }
                    ]
                }
            ]
        };

        try {
            await targetChannel.send(payload);
            return sendSuccess(message, `Announcement posted to ${targetChannel}.`);
        } catch (err) {
            console.error("⚠️ Failed to send announcement payload:", err.message);
            return sendError(message, "Something went wrong sending the announcement payload.");
        }
    }

    // !maintenance Command
    if (command === 'maintenance') {
        if (message.author.id !== MAINTENANCE_USER_ID) {
            return sendError(message, "You are not authorized to run this command.");
        }

        const botMention = message.mentions.users.first();
        if (!botMention || (botMention.id !== client.user.id && botMention.id !== CRASHY_USER_ID)) {
            return sendError(message, "You must ping a tracked bot (this bot or crashy). Usage: `!maintenance @bot [true/false]`");
        }

        const valueParam = args[1]?.toLowerCase();
        if (valueParam !== 'true' && valueParam !== 'false') {
            return sendError(message, "Invalid setting. Please use either `true` or `false`.");
        }

        const targetKey = botMention.id === CRASHY_USER_ID ? 'crashy' : 'eazy';
        const targetLabel = targetKey === 'crashy' ? 'crashy' : 'Eazy Moderation';
        const newState = valueParam === 'true';

        versionConfig.maintenanceMode[targetKey] = newState;
        saveConfig();
        await updateStatusVoiceChannels();

        return sendSuccess(
            message,
            newState
                ? `**${targetLabel}** status switched to **Maintenance 🟠**.`
                : `**${targetLabel}** status returned to **Working 🟢**.`
        );
    }

    // !statusvc Command (REVISED & FIXED RE-CREATION/PERSISTENCE)
    if (command === 'statusvc') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return sendError(message, "You need the `Manage Channels` permission to run this command.");
        }

        try {
            const guild = message.guild;

            // Delete old configured status VCs if they still exist to prevent duplicates
            if (versionConfig.statusVCs?.crashy) {
                const oldCrashy = await guild.channels.fetch(versionConfig.statusVCs.crashy).catch(() => null);
                if (oldCrashy) await oldCrashy.delete().catch(() => {});
            }
            if (versionConfig.statusVCs?.eazy) {
                const oldEazy = await guild.channels.fetch(versionConfig.statusVCs.eazy).catch(() => null);
                if (oldEazy) await oldEazy.delete().catch(() => {});
            }

            const channelPermissions = [
                {
                    id: guild.roles.everyone.id,
                    deny: [PermissionFlagsBits.Connect],
                    allow: [PermissionFlagsBits.ViewChannel]
                }
            ];

            const crashyVC = await guild.channels.create({
                name: 'crashy : Working 🟢',
                type: ChannelType.GuildVoice,
                permissionOverwrites: channelPermissions
            });

            const eazyVC = await guild.channels.create({
                name: 'Eazy Moderation : Working 🟢',
                type: ChannelType.GuildVoice,
                permissionOverwrites: channelPermissions
            });

            versionConfig.statusVCs = {
                crashy: crashyVC.id,
                eazy: eazyVC.id
            };
            saveConfig();

            await updateStatusVoiceChannels();

            return sendSuccess(message, "Successfully created and linked locked status voice channels!");
        } catch (err) {
            console.error(err);
            return sendError(message, "Failed to create status channels. Check my server permissions hierarchy.");
        }
    }

    // !setrblxupd / !setbetarblx / !sethidrblx Commands (PERSISTED NOW)
    if (command === 'setrblxupd' || command === 'setbetarblx' || command === 'sethidrblx') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return sendError(message, "You need the `Manage Channels` permission to run this command.");
        }

        const targetChannel = message.mentions.channels.first();
        if (!targetChannel || !targetChannel.isTextBased()) {
            return sendError(message, `Please mention a valid text channel. Usage: \`!${command} #channel\``);
        }

        const typeMap = { setrblxupd: 'live', setbetarblx: 'beta', sethidrblx: 'hidden' };
        const labelMap = { live: 'LIVE Roblox update', beta: 'Beta Roblox update', hidden: 'Hidden Roblox version' };
        const type = typeMap[command];

        versionConfig.robloxChannels[type] = targetChannel.id;
        saveConfig();

        try {
            const confirmPayload = await buildRobloxConfirmationPayload(type);
            await targetChannel.send(confirmPayload);
        } catch (e) {
            console.error(`⚠️ Failed to send confirmation to channel ${targetChannel.id}:`, e.message);
        }

        return sendSuccess(message, `${labelMap[type]} alerts will now be sent to ${targetChannel}.`);
    }

    // !sendlive / !sendbeta / !sendhid Commands
    if (command === 'sendlive' || command === 'sendbeta' || command === 'sendhid') {
        if (message.author.id !== MAINTENANCE_USER_ID) {
            return sendError(message, "You are not authorized to run this command.");
        }

        const typeMap = { sendlive: 'live', sendbeta: 'beta', sendhid: 'hidden' };
        const labelMap = { live: 'LIVE', beta: 'Beta', hidden: 'Hidden' };
        const type = typeMap[command];

        if (!versionConfig.robloxChannels?.[type]) {
            return sendError(message, `No ${labelMap[type]} channel is configured yet. Use \`!${type === 'live' ? 'setrblxupd' : type === 'beta' ? 'setbetarblx' : 'sethidrblx'} #channel\` first.`);
        }

        try {
            if (type === 'hidden') {
                const entry = await getLatestHiddenEntry('windows');
                if (!entry) return sendError(message, "Couldn't find a hidden WindowsPlayer entry in DeployHistory.txt right now.");
                await sendRobloxAlertToChannel('hidden', 'windows', entry.versionLabel, entry.dateStr);
            } else {
                const endpoint = type === 'live' ? 'https://weao.xyz/api/versions/current' : 'https://weao.xyz/api/versions/future';
                const res = await fetch(endpoint);
                if (!res.ok) return sendError(message, "WEAO API didn't respond. Try again in a moment.");
                const data = await res.json();
                if (!data.Windows) return sendError(message, "No Windows version data available from WEAO right now.");
                await sendRobloxAlertToChannel(type, 'windows', data.Windows, data.WindowsDate || new Date().toLocaleString());
            }
            return sendSuccess(message, `Test ${labelMap[type]} alert sent to the configured channel.`);
        } catch (err) {
            console.error(`⚠️ Manual ${type} test dispatch failed:`, err.message);
            return sendError(message, "Something went wrong sending the test alert.");
        }
    }

    // !setupdatechannel Command (PERSISTED NOW)
    if (command === 'setupdatechannel') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return sendError(message, "You need the `Manage Channels` permission to run this command.");
        }

        const targetChannel = message.mentions.channels.first();
        if (!targetChannel || !targetChannel.isTextBased()) {
            return sendError(message, "Please mention a valid text channel. Usage: `!setupdatechannel #channel`");
        }

        versionConfig.updateChannel = targetChannel.id;
        saveConfig();

        try {
            const confirmText = `✅ **This channel is now linked for Bot Update announcements.**\nRun \`!postupdate\` here going forward to post here automatically.`;
            if (ContainerBuilder && TextDisplayBuilder && MessageFlags) {
                const confirmContainer = new ContainerBuilder();
                confirmContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(confirmText));
                await targetChannel.send({ components: [confirmContainer], flags: MessageFlags.IsComponentsV2 });
            } else {
                await targetChannel.send({ embeds: [new EmbedBuilder().setColor(0x2ECC71).setDescription(confirmText)] });
            }
        } catch (e) {
            console.error(`⚠️ Failed to send confirmation to channel ${targetChannel.id}:`, e.message);
        }

        return sendSuccess(message, `Bot Update announcements will now be sent to ${targetChannel}.`);
    }

    // !postupdate Command
    if (command === 'postupdate') {
        if (message.author.id !== MAINTENANCE_USER_ID) {
            return sendError(message, "You are not authorized to run this command.");
        }

        if (!versionConfig.updateChannel) {
            return sendError(message, "No update channel is configured yet. Use `!setupdatechannel #channel` first.");
        }

        const changelogText = args.join(" ");
        if (!changelogText) {
            return sendError(message, "Please include changelog text. Usage: `!postupdate <changelog text>`");
        }

        const targetChannel = await client.channels.fetch(versionConfig.updateChannel).catch(() => null);
        if (!targetChannel?.isTextBased()) {
            return sendError(message, "Couldn't reach the configured update channel — it may have been deleted.");
        }

        const statusText = versionConfig.maintenanceMode?.eazy
            ? 'Maintenance 🟠'
            : (client.ws.ping > 0 && client.ws.ping < 1200 ? 'Working 🟢' : 'Down 🔴');
        const unixNow = Math.floor(Date.now() / 1000);
        const cardContent = `# - Bot Update\n- ${client.user.username}\n- Status/Compatibility : ${statusText}\n- Version : \`v${BOT_VERSION}\`\n- Update Date : <t:${unixNow}:F>\n# CHANGELOGS\n${changelogText}`;

        const updateBannerPath = path.join(__dirname, 'update_banner.png');
        const hasUpdateBanner = !!AttachmentBuilder && fs.existsSync(updateBannerPath);

        try {
            if (ContainerBuilder && SectionBuilder && TextDisplayBuilder && MediaGalleryBuilder && MediaGalleryItemBuilder && MessageFlags) {
                const container = new ContainerBuilder();
                const section = new SectionBuilder()
                    .addTextDisplayComponents(new TextDisplayBuilder().setContent(cardContent))
                    .setButtonAccessory(
                        new ButtonBuilder().setLabel('Get The Bot Now').setStyle(ButtonStyle.Link).setURL(
                            'https://discord.com/oauth2/authorize?client_id=1513386994510598144&scope=bot&permissions=8'
                        )
                    );
                container.addSectionComponents(section);

                const sendOptions = { components: [container], flags: MessageFlags.IsComponentsV2 };
                if (hasUpdateBanner) {
                    container.addMediaGalleryComponents(
                        new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL('attachment://update_banner.png'))
                    );
                    sendOptions.files = [new AttachmentBuilder(updateBannerPath, { name: 'update_banner.png' })];
                }

                await targetChannel.send(sendOptions);
            } else {
                const embed = new EmbedBuilder().setDescription(cardContent);
                const btnRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setLabel('Get The Bot Now').setStyle(ButtonStyle.Link).setURL(
                        'https://discord.com/oauth2/authorize?client_id=1513386994510598144&scope=bot&permissions=8'
                    )
                );
                const sendOptions = { embeds: [embed], components: [btnRow] };
                if (hasUpdateBanner) {
                    embed.setImage('attachment://update_banner.png');
                    sendOptions.files = [new AttachmentBuilder(updateBannerPath, { name: 'update_banner.png' })];
                }
                await targetChannel.send(sendOptions);
            }
            return sendSuccess(message, `Bot Update announcement posted to ${targetChannel}.`);
        } catch (err) {
            console.error("⚠️ Failed to post bot update announcement:", err.message);
            return sendError(message, "Something went wrong posting the update announcement.");
        }
    }

    // !setstatusupd Command (PERSISTED NOW)
    if (command === 'setstatusupd') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return sendError(message, "You need the `Manage Channels` permission to run this command.");
        }

        const targetChannel = message.mentions.channels.first();
        if (!targetChannel || !targetChannel.isTextBased()) {
            return sendError(message, "Please mention a valid text channel. Usage: `!setstatusupd #channel`");
        }

        versionConfig.statusUpdateChannel = targetChannel.id;
        saveConfig();

        try {
            const confirmText = `✅ **This channel is now linked for Status Update announcements.**\nRun \`!statusupd\` here going forward to post here automatically.`;
            if (ContainerBuilder && TextDisplayBuilder && MessageFlags) {
                const confirmContainer = new ContainerBuilder();
                confirmContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(confirmText));
                await targetChannel.send({ components: [confirmContainer], flags: MessageFlags.IsComponentsV2 });
            } else {
                await targetChannel.send({ embeds: [new EmbedBuilder().setColor(0x2ECC71).setDescription(confirmText)] });
            }
        } catch (e) {
            console.error(`⚠️ Failed to send confirmation to channel ${targetChannel.id}:`, e.message);
        }

        return sendSuccess(message, `Status Update announcements will now be sent to ${targetChannel}.`);
    }

    // !statusupd Command
    if (command === 'statusupd') {
        if (message.author.id !== MAINTENANCE_USER_ID) {
            return sendError(message, "You are not authorized to run this command.");
        }

        const botMention = message.mentions.users.first();
        if (!botMention || (botMention.id !== client.user.id && botMention.id !== CRASHY_USER_ID)) {
            return sendError(message, "You must ping a tracked bot (this bot or crashy). Usage: `!statusupd @bot <maintenance/working/offline> <Dev's Response>`");
        }

        const statusMap = {
            maintenance: { label: 'Maintenance', emoji: '🟠' },
            working: { label: 'Working', emoji: '🟢' },
            offline: { label: 'Down', emoji: '🔴' }
        };
        const statusArg = args[1]?.toLowerCase();
        if (!statusMap[statusArg]) {
            return sendError(message, "Invalid status. Use `maintenance`, `working`, or `offline`.");
        }

        const devResponse = args.slice(2).join(' ');
        if (!devResponse) {
            return sendError(message, "Please include a Dev's Response message. Usage: `!statusupd @bot <maintenance/working/offline> <Dev's Response>`");
        }

        if (!versionConfig.statusUpdateChannel) {
            return sendError(message, "No status update channel is configured yet. Use `!setstatusupd #channel` first.");
        }

        const targetChannel = await client.channels.fetch(versionConfig.statusUpdateChannel).catch(() => null);
        if (!targetChannel?.isTextBased()) {
            return sendError(message, "Couldn't reach the configured status update channel — it may have been deleted.");
        }

        const botLabel = botMention.id === CRASHY_USER_ID ? 'crashy' : client.user.username;
        const { label, emoji } = statusMap[statusArg];
        const cardContent = `# ${botLabel} is now ${label}!\n\n- ${botLabel}\n- Status : ${label} ${emoji}\n\n**Dev's Response**\n${devResponse}`;

        try {
            if (ContainerBuilder && TextDisplayBuilder && MessageFlags) {
                const container = new ContainerBuilder();
                container.addTextDisplayComponents(new TextDisplayBuilder().setContent(cardContent));
                await targetChannel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
            } else {
                await targetChannel.send({ embeds: [new EmbedBuilder().setDescription(cardContent)] });
            }
            return sendSuccess(message, `Status update posted to ${targetChannel}.`);
        } catch (err) {
            console.error("⚠️ Failed to post status update:", err.message);
            return sendError(message, "Something went wrong posting the status update.");
        }
    }

    // !afk Command
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

    // !nickname Command
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
                await target.setNickname(null);
                return sendSuccess(message, `Successfully reset the nickname for **${target.user.tag}**.`);
            } else {
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
        const helpSections = [
            {
                title: '🧰 Core Utilities',
                lines: [
                    '`ping` — Check real-time Discord API latency responses.',
                    '`version` — Return system architecture build strings.',
                    '`status` — Multi-endpoint framework health check values.',
                    '`help` — Display this clean master systems guide.',
                    '`botlogs` — View last 10 commands parsed through memory.',
                    '`afk [message]` — Mark yourself away from keyboard with custom status messages.',
                    "`userinfo [@user]` — View a member's detail card.",
                    '`serverinfo` — View complete structural details of the server.',
                    '`members` — View total current users present inside the community footprint.'
                ]
            },
            {
                title: '🎮 Roblox Version Engines',
                lines: [
                    '`currentver` — Returns current versions with auto-updating download buttons.',
                    '`downgrade` — Returns previous production rollback builds.',
                    '`futurever` — Query upcoming deployment configurations.',
                    '`setrblxupd #channel` — Route LIVE Roblox update alerts to a channel.',
                    '`setbetarblx #channel` — Route Beta Roblox update alerts to a channel.',
                    '`sethidrblx #channel` — Route Hidden Roblox version alerts to a channel.',
                    '`sendlive / sendbeta / sendhid` — Manually test-send an alert (owner-only).',
                    '`setupdatechannel #channel` — Route Bot Update announcements to a channel.',
                    '`postupdate <changelog>` — Post a Bot Update announcement (owner-only).',
                    '`setstatusupd #channel` — Route Status Update announcements to a channel.',
                    '`statusupd @bot <maintenance/working/offline> <response>` — Post a status update (owner-only).',
                    '`setannounce #channel` — Route Announcements to a channel.',
                    '`announce [text]` — Post an announcement using raw Components V2 payload.'
                ]
            },
            {
                title: '🛡️ Exploit Automation Tracking & VCs',
                lines: [
                    '`check [name]` — Query structural exploit bypass signatures.',
                    '`statusvc` — Automatically setup channels layout to track bot status.',
                    '`maintenance @bot [true/false]` — Toggle Maintenance mode for this bot **or crashy** (restricted).'
                ]
            },
            {
                title: '🔨 Punishments & Restraints',
                lines: [
                    '`kick / ban @user [reason]` — Core member removal actions.',
                    '`unban [id]` — Clear target restrictions.',
                    '`warn @user [reason]` — Log behavior warnings. (4 warns = 24h timeout, 5 = Ban).',
                    '`warns @user` — Check comprehensive history log sheets and historical warning notes.',
                    '`clearwarns @user` — Clear warning counts for a user profile.',
                    '`mute / unmute @user` — Restrict messaging metrics securely.',
                    '`nickname @user [name]` — Force change or reset profile nicknames.'
                ]
            },
            {
                title: '📁 Channel Management Operations',
                lines: [
                    '`clear [1-100]` — Clean clutter text blocks from channel flows.',
                    '`slowmode [seconds] [channel]` — Apply precise slowmode delays.',
                    '`lock / unlock` — Toggle message writing rights instantly.',
                    '`lockdown / unlockdown` — Global server channel freezing arrays.',
                    '`chatlogs @user` — Review last 15 elements cached by user footprint.'
                ]
            },
            {
                title: '🔊 Voice Channel Restraints & Roles',
                lines: [
                    '`mutevc @user` — Toggle targeted voice server mic muting.',
                    '`deafen @user` — Toggle targeted voice server auditory deafen status.',
                    '`role @user [Name/ID]` — Bind assigned role value patterns directly.',
                    '`unrole @user [Name/ID]` — Strip assigned role value patterns directly.'
                ]
            }
        ];

        const INVITE_URL = 'https://discord.com/oauth2/authorize?client_id=1513386994510598144&scope=bot&permissions=8';
        const currentPing = client.ws.ping;
        const statusDot = versionConfig.maintenanceMode?.eazy ? '🟠' : (currentPing > 0 && currentPing < 1200 ? '🟢' : '🔴');

        const getBotRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setLabel('Get Bot').setStyle(ButtonStyle.Link).setURL(INVITE_URL)
        );

        const helpBannerPath = path.join(__dirname, 'help_banner.png');
        const hasHelpBanner = !!AttachmentBuilder && fs.existsSync(helpBannerPath);
        const helpBannerAttachment = hasHelpBanner
            ? new AttachmentBuilder(helpBannerPath, { name: 'help_banner.png' })
            : null;

        const sendClassicEmbed = () => {
            const cmdsEmbed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setDescription(
                    (hasHelpBanner ? '' : `# H E L P\n\n`) +
                    `**Status:** ${statusDot}\n\n` +
                    `Use the prefix \`${prefix}\` before executing any commands listed below.\n\n` +
                    helpSections.map(s => `**${s.title}**\n${s.lines.map(l => `• ${l}`).join('\n')}`).join('\n\n')
                );
            if (hasHelpBanner) cmdsEmbed.setImage('attachment://help_banner.png');
            return message.reply({
                embeds: [cmdsEmbed],
                components: [getBotRow],
                files: hasHelpBanner ? [helpBannerAttachment] : []
            });
        };

        if (ContainerBuilder && TextDisplayBuilder && SeparatorBuilder && MessageFlags) {
            try {
                const container = new ContainerBuilder();

                if (hasHelpBanner && MediaGalleryBuilder && MediaGalleryItemBuilder) {
                    container.addMediaGalleryComponents(
                        new MediaGalleryBuilder().addItems(
                            new MediaGalleryItemBuilder().setURL('attachment://help_banner.png')
                        )
                    );
                } else {
                    container.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(`# H E L P`)
                    );
                }

                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(`**Status:** ${statusDot}`)
                );

                container.addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
                );

                container.addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `Use the prefix \`${prefix}\` before executing any commands listed below.`
                    )
                );

                for (const section of helpSections) {
                    container.addSeparatorComponents(
                        new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
                    );
                    container.addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `**${section.title}**\n${section.lines.map(l => `• ${l}`).join('\n')}`
                        )
                    );
                }

                container.addSeparatorComponents(
                    new SeparatorBuilder().setSpacing(SeparatorSpacingSize.Small)
                );
                container.addActionRowComponents(getBotRow);

                return await message.reply({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2,
                    files: hasHelpBanner ? [helpBannerAttachment] : []
                });
            } catch (err) {
                console.error("⚠️ Components V2 container failed, falling back to standard embed:", err.message);
                return sendClassicEmbed();
            }
        }

        return sendClassicEmbed();
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
        if (!message.member.permissions.has(PermissionFlagsBits.KickMembers)) return sendError(message, "Missing \`Kick Members\` permission.");
        const target = message.mentions.members.first();
        if (!target) return sendError(message, "Please target a member to kick.");
        if (!target.kickable) return sendError(message, "Cannot kick this profile target due to role hierarchies.");
        const reason = args.slice(1).join(" ") || "None specified";
        await target.kick(reason);
        return message.reply({ embeds: [new EmbedBuilder().setColor(0xE74C3C).setTitle('BOOTED Member Kicked').setDescription(`**User:** ${target.user.tag}\n**Reason:** *${reason}*`)] });
    }

    if (command === 'ban') {
        if (!message.member.permissions.has(PermissionFlagsBits.BanMembers)) return sendError(message, "Missing \`Ban Members\` permission.");
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
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return sendError(message, "Missing structural permissions.");
        
        const targetMember = message.mentions.members.first();
        if (!targetMember) return sendError(message, "Please tag a target profile. Usage: `!warn @user [reason]`");
        if (targetMember.user.bot) return sendError(message, "Automated bot infrastructure cannot be processed with behavioral warnings.");

        const reason = args.slice(1).join(" ") || "No reason specified";
        
        if (!userWarnings.has(targetMember.id)) userWarnings.set(targetMember.id, []);
        const logs = userWarnings.get(targetMember.id);
        
        logs.push({
            reason: reason,
            timestamp: new Date().toLocaleString(),
            moderator: message.author.tag
        });

        const currentWarns = logs.length;

        const warnEmbed = new EmbedBuilder()
            .setColor(0xE67E22)
            .setTitle('⚠️ Behavioral Warning Logged')
            .setDescription(`**User:** ${targetMember.user.tag}\n**Total Warnings:** \`${currentWarns}/5\`\n**Reason:** *${reason}*`)
            .setTimestamp();

        await message.channel.send({ content: `${targetMember}`, embeds: [warnEmbed] });

        if (currentWarns === 4) {
            if (!targetMember.moderatable) return sendError(message, `Warning tracked (${currentWarns}), but hierarchy configurations prevent me from enforcing a timeout loop.`);
            await targetMember.timeout(24 * 60 * 60 * 1000, `Automated Escalation: 4 active warnings parsed.`);
            return sendSuccess(message, `User **${targetMember.user.tag}** reached **4 warnings** and has been timed out for 24 hours.`);
        } else if (currentWarns >= 5) {
            if (!targetMember.bannable) return sendError(message, `Warning tracked (${currentWarns}), but hierarchy configurations prevent me from executing a ban.`);
            await targetMember.ban({ reason: `Automated Escalation: Warning threshold limit (5) breached.` });
            return sendSuccess(message, `User **${targetMember.user.tag}** reached **5 warnings** and has been permanently banned.`);
        }
        return;
    }

    if (command === 'warns') {
        const targetMember = message.mentions.members.first() || message.member;
        const logs = userWarnings.get(targetMember.id) || [];

        if (logs.length === 0) {
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x2ECC71)
                        .setDescription(`✅ **${targetMember.user.tag}** has a clean operational profile. No warnings found.`)
                ]
            });
        }

        const historyText = logs.map((w, idx) => `**${idx + 1}.** \`[${w.timestamp}]\` by *${w.moderator}*\n└ Reason: *${w.reason}*`).join('\n\n');

        const historyEmbed = new EmbedBuilder()
            .setColor(0xF39C12)
            .setTitle(`📋 Warnings Audit Profile: ${targetMember.user.tag}`)
            .setDescription(`Total Warnings: \`${logs.length}/5\`\n\n${historyText}`)
            .setTimestamp();

        return message.reply({ embeds: [historyEmbed] });
    }

    if (command === 'clearwarns') {
        if (!message.member.permissions.has(PermissionFlagsBits.ModerateMembers)) return sendError(message, "Missing structural permissions.");
        
        const targetMember = message.mentions.members.first();
        if (!targetMember) return sendError(message, "Please tag a user profile. Usage: `!clearwarns @user`");
        
        if (!userWarnings.has(targetMember.id)) {
            return sendError(message, `No behavioral records tracked for **${targetMember.user.tag}**.`);
        }

        userWarnings.delete(targetMember.id);
        return sendSuccess(message, `Successfully reset and cleared warnings for **${targetMember.user.tag}**.`);
    }

    if (command === 'slowmode') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) return sendError(message, "Missing \`Manage Channels\` permission flags.");
        
        const seconds = parseInt(args[0]);
        if (isNaN(seconds) || seconds < 0 || seconds > 21600) {
            return sendError(message, "Provide a valid slowmode integer constraint between 0 and 21600 seconds.");
        }

        const targetChannel = message.mentions.channels.first() || message.channel;
        
        if (!targetChannel.isTextBased()) {
            return sendError(message, "Slowmode parameters can only be altered inside valid text channel environments.");
        }

        try {
            await targetChannel.setRateLimitPerUser(seconds);
            if (seconds === 0) {
                return sendSuccess(message, `Disabled slowmode restrictions inside channel context ${targetChannel}.`);
            } else {
                return sendSuccess(message, `Successfully configured a **${seconds}s** slowmode loop inside channel ${targetChannel}.`);
            }
        } catch (err) {
            console.error(err);
            return sendError(message, "An error prevented adjusting the rate limits.");
        }
    }

    if (command === 'userinfo') {
        const targetMember = message.mentions.members.first() || message.member;
        const rolesList = targetMember.roles.cache
            .filter(r => r.id !== message.guild.id)
            .map(r => r.toString())
            .join(', ') || 'None';

        const infoEmbed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle(`👤 Profile Metrics: ${targetMember.user.tag}`)
            .setThumbnail(targetMember.user.displayAvatarURL({ dynamic: true }))
            .addFields(
                { name: 'ID Metric String', value: `\`${targetMember.id}\``, inline: true },
                { name: 'Server Display Profile', value: `${targetMember.displayName}`, inline: true },
                { name: 'Account Footprint Created', value: `<t:${Math.floor(targetMember.user.createdTimestamp / 1000)}:F>`, inline: false },
                { name: 'Server Deployment Joined', value: `<t:${Math.floor(targetMember.joinedTimestamp / 1000)}:F>`, inline: false },
                { name: `Assigned Role Assets (${targetMember.roles.cache.size - 1})`, value: rolesList, inline: false }
            )
            .setTimestamp();

        return message.reply({ embeds: [infoEmbed] });
    }

    if (command === 'serverinfo') {
        const guild = message.guild;
        const totalMembers = guild.memberCount;
        const textChannels = guild.channels.cache.filter(c => c.type === 0 || c.isTextBased()).size;
        const voiceChannels = guild.channels.cache.filter(c => c.type === 2).size;

        const serverEmbed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle(`🏰 Workspace Architecture: ${guild.name}`)
            .setThumbnail(guild.iconURL({ dynamic: true }))
            .addFields(
                { name: 'Server Identification String', value: `\`${guild.id}\``, inline: true },
                { name: 'Guild Authority Owner', value: `<@${guild.ownerId}>`, inline: true },
                { name: 'Total Tracked Footprint', value: `\`${totalMembers}\` users`, inline: true },
                { name: 'Text Channels Count', value: `\`${textChannels}\``, inline: true },
                { name: 'Voice Channels Count', value: `\`${voiceChannels}\``, inline: true },
                { name: 'Verification Layer Level', value: `\`${guild.verificationLevel}\``, inline: true },
                { name: 'Workspace Created On', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:F>`, inline: false }
            )
            .setTimestamp();

        return message.reply({ embeds: [serverEmbed] });
    }

    if (command === 'members') {
        return message.reply({
            embeds: [
                new EmbedBuilder()
                    .setColor(0x2ECC71)
                    .setTitle('👥 Active Population Matrix')
                    .setDescription(`There are currently **${message.guild.memberCount}** members interacting inside this server environment right now.`)
                    .setTimestamp()
            ]
        });
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
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) return sendError(message, "Missing rights.");
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
        } catch { return sendError(message, "Failed to modify voice state flags."); }
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
        } catch { return sendError(message, "Failed to modify voice state flags."); }
    }

    if (command === 'role') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) return sendError(message, "Missing \`Manage Roles\` rights.");
        const target = message.mentions.members.first();
        if (!target) return sendError(message, "Tag a user. Usage: \`!role @user [Role Name/ID]\`");
        
        const query = args.slice(1).join(" ");
        if (!query) return sendError(message, "Please provide a valid Role name or ID.");
        const role = message.guild.roles.cache.get(query) || message.guild.roles.cache.find(r => r.name.toLowerCase() === query.toLowerCase());
        
        if (!role) return sendError(message, "Role not found inside server databases.");
        if (role.position >= message.guild.members.me.roles.highest.position) return sendError(message, "Target role sits higher than my position.");
        
        await target.roles.add(role);
        return sendSuccess(message, `Assigned role **${role.name}** to **${target.user.tag}**.`);
    }

    if (command === 'unrole') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles)) return sendError(message, "Missing \`Manage Roles\` rights.");
        const target = message.mentions.members.first();
        if (!target) return sendError(message, "Tag a user. Usage: \`!unrole @user [Role Name/ID]\`");
        
        const query = args.slice(1).join(" ");
        if (!query) return sendError(message, "Please provide a valid Role name or ID.");
        const role = message.guild.roles.cache.get(query) || message.guild.roles.cache.find(r => r.name.toLowerCase() === query.toLowerCase());
        
        if (!role) return sendError(message, "Role not found inside server databases.");
        if (role.position >= message.guild.members.me.roles.highest.position) return sendError(message, "Target role sits higher than my position.");
        
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
        const botStatusText = versionConfig.maintenanceMode?.eazy ? '🟠 Maintenance' : (currentPing > 0 && currentPing < 1200 ? '🟢 Working' : '🔴 Lagging');

        let ghStatus = '🟢 Working';
        try { await fetch('https://api.github.com', { method: 'HEAD', signal: AbortSignal.timeout(1000) }); } catch { ghStatus = '🔴 Fault'; }

        let crashyStatus = '🔴 Down';
        if (versionConfig.maintenanceMode?.crashy) {
            crashyStatus = '🟠 Maintenance';
        } else {
            for (const guild of client.guilds.cache.values()) {
                try {
                    const crashy = await guild.members.fetch(CRASHY_USER_ID).catch(() => null);
                    if (crashy?.presence?.status && crashy.presence.status !== 'offline') {
                        crashyStatus = '🟢 Working';
                        break;
                    }
                } catch {}
            }
        }

        const statusEmbed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('⚙️ Eazy Moderation | System Status')
            .setDescription(`**Date:** ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}\n\n**Bot:** ${botStatusText}\n**GitHub API:** ${ghStatus}\n**crashy:** ${crashyStatus}\n\n⏱️ **Uptime:** \`${hours}h ${minutes}m\``)
            .setTimestamp();
        return message.reply({ embeds: [statusEmbed] });
    }

    // ================= EazyCoins Economy Commands =================

    // !beg
    if (command === 'beg') {
        const BEG_COOLDOWN = 15 * 1000;
        const last = economyData.lastBeg[message.author.id] || 0;
        const remaining = BEG_COOLDOWN - (Date.now() - last);
        if (remaining > 0) return sendError(message, `You're begging too much! Try again in **${Math.ceil(remaining / 1000)}s**.`);

        economyData.lastBeg[message.author.id] = Date.now();

        if (Math.random() < 0.10) {
            saveEconomy();
            return message.reply({ embeds: [new EmbedBuilder().setColor(0x95A5A6).setDescription("🪙 Nobody gave you anything this time. Try again later!").setFooter({ text: 'Eazy Economy • Begging' })] });
        }

        const BEG_LINES = [
            "A stranger tossed you some spare change.",
            "You found coins on the ground!",
            "Someone felt bad and gave you a handout.",
            "You did a little dance and earned some pity money."
        ];
        const reward = Math.floor(Math.random() * 46) + 5; // 5-50
        addWallet(message.author.id, reward);
        saveEconomy();

        const line = BEG_LINES[Math.floor(Math.random() * BEG_LINES.length)];
        const embed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setDescription(`🪙 ${line} You got **${reward.toLocaleString()} eazycoins**!`)
            .setFooter({ text: 'Eazy Economy • Begging' });

        return message.reply({ embeds: [embed] });
    }

    // !balance / !bal
    if (command === 'balance' || command === 'bal') {
        const target = message.mentions.users.first() || message.author;
        const wallet = getWallet(target.id);
        const embed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle(`💰 ${target.username}'s Balance`)
            .addFields({ name: 'Wallet', value: `${wallet.toLocaleString()} eazycoins` })
            .setThumbnail(target.displayAvatarURL())
            .setFooter({ text: 'Eazy Economy • Wallet' });
        return message.reply({ embeds: [embed] });
    }

    // !huntcoins / !hunt
    if (command === 'huntcoins' || command === 'hunt') {
        const HUNT_COOLDOWN = 20 * 1000;
        const last = economyData.lastHunt[message.author.id] || 0;
        const remaining = HUNT_COOLDOWN - (Date.now() - last);
        if (remaining > 0) return sendError(message, `You're still out hunting! Try again in **${Math.ceil(remaining / 1000)}s**.`);

        economyData.lastHunt[message.author.id] = Date.now();

        if (Math.random() < 0.15) {
            saveEconomy();
            return message.reply({ embeds: [new EmbedBuilder().setColor(0x95A5A6).setDescription("🌲 You searched the woods but found nothing this time.").setFooter({ text: 'Eazy Economy • Hunting' })] });
        }

        const HUNT_ANIMALS = [
            { name: 'Rabbit', emoji: '🐇', min: 10, max: 60, weight: 40 },
            { name: 'Deer', emoji: '🦌', min: 40, max: 120, weight: 25 },
            { name: 'Wolf', emoji: '🐺', min: 80, max: 220, weight: 15 },
            { name: 'Bear', emoji: '🐻', min: 150, max: 400, weight: 10 },
            { name: 'Golden Stag', emoji: '✨', min: 500, max: 1500, weight: 3 }
        ];
        const animal = pickWeighted(HUNT_ANIMALS);
        const reward = Math.floor(Math.random() * (animal.max - animal.min + 1)) + animal.min;
        addWallet(message.author.id, reward);
        saveEconomy();

        const embed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setDescription(`${animal.emoji} You hunted down a **${animal.name}** and earned **${reward.toLocaleString()} eazycoins**!`)
            .setFooter({ text: 'Eazy Economy • Hunting' });

        return message.reply({ embeds: [embed] });
    }

    // !rob / !rob @user
    if (command === 'rob') {
        const ROB_COOLDOWN = 5 * 60 * 1000;
        const ROB_MIN_VICTIM_BALANCE = 500;

        const last = economyData.lastRob[message.author.id] || 0;
        const remaining = ROB_COOLDOWN - (Date.now() - last);
        if (remaining > 0) return sendError(message, `You're laying low after your last job. Try again in **${Math.ceil(remaining / 60000)}m**.`);

        const robberWallet = getWallet(message.author.id);
        let targetUser = message.mentions.users.first();

        if (targetUser) {
            if (targetUser.id === message.author.id) return sendError(message, "You can't rob yourself.");
            if (targetUser.bot) return sendError(message, "You can't rob a bot.");
        } else {
            const candidates = Object.keys(economyData.wallets).filter(id => id !== message.author.id && economyData.wallets[id] >= ROB_MIN_VICTIM_BALANCE);
            if (candidates.length === 0) return sendError(message, "There's nobody worth robbing right now.");
            const randomId = candidates[Math.floor(Math.random() * candidates.length)];
            targetUser = await client.users.fetch(randomId).catch(() => null);
            if (!targetUser) return sendError(message, "Couldn't find a target to rob right now.");
        }

        const targetWallet = getWallet(targetUser.id);
        if (targetWallet < ROB_MIN_VICTIM_BALANCE) return sendError(message, `**${targetUser.username}** doesn't have enough EazyCoins to be worth robbing (needs at least ${ROB_MIN_VICTIM_BALANCE.toLocaleString()}).`);

        economyData.lastRob[message.author.id] = Date.now();

        let embed;
        if (Math.random() < 0.45) {
            const stealPercent = Math.random() * 0.15 + 0.10; // 10-25%
            const stolen = Math.min(Math.floor(targetWallet * stealPercent), 500000);
            addWallet(targetUser.id, -stolen);
            addWallet(message.author.id, stolen);
            embed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setDescription(`🕵️ You robbed **${targetUser.username}** and got away with **${stolen.toLocaleString()} eazycoins**!`)
                .setFooter({ text: 'Eazy Economy • Robbery' });
        } else {
            const finePercent = Math.random() * 0.10 + 0.05; // 5-15%
            const fine = Math.min(Math.floor(robberWallet * finePercent), 250000);
            if (fine > 0) addWallet(message.author.id, -fine);
            embed = new EmbedBuilder()
                .setColor(0xE74C3C)
                .setDescription(`🚨 You got caught trying to rob **${targetUser.username}** and paid a **${fine.toLocaleString()} eazycoins** fine!`)
                .setFooter({ text: 'Eazy Economy • Robbery' });
        }
        saveEconomy();
        return message.reply({ embeds: [embed] });
    }

    // !breakinto
    if (command === 'breakinto') {
        const BREAKIN_COOLDOWN = 3 * 60 * 1000;
        const last = economyData.lastBreakin[message.author.id] || 0;
        const remaining = BREAKIN_COOLDOWN - (Date.now() - last);
        if (remaining > 0) return sendError(message, `The neighborhood's still on alert. Try again in **${Math.ceil(remaining / 60000)}m**.`);

        economyData.lastBreakin[message.author.id] = Date.now();

        let embed;
        if (Math.random() < 0.40) {
            const wallet = getWallet(message.author.id);
            const fine = Math.min(Math.floor(wallet * (Math.random() * 0.08 + 0.02)), 100000);
            if (fine > 0) addWallet(message.author.id, -fine);
            embed = new EmbedBuilder()
                .setColor(0xE74C3C)
                .setDescription(fine > 0
                    ? `🚔 You got caught breaking in and paid a **${fine.toLocaleString()} eazycoins** fine!`
                    : `🚔 You got caught breaking in, but had nothing worth fining.`)
                .setFooter({ text: 'Eazy Economy • Break-In' });
        } else {
            const jackpot = Math.random() < 0.08;
            const reward = jackpot
                ? Math.floor(Math.random() * 15000) + 5000
                : Math.floor(Math.random() * 1800) + 200;
            addWallet(message.author.id, reward);
            embed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setDescription(`${jackpot ? '💎 **JACKPOT HOUSE!** You' : '🏚️ You broke into a house and'} found **${reward.toLocaleString()} eazycoins**!`)
                .setFooter({ text: 'Eazy Economy • Break-In' });
        }
        saveEconomy();
        return message.reply({ embeds: [embed] });
    }

    // !gamble <amount>
    if (command === 'gamble') {
        const wallet = getWallet(message.author.id);
        const bet = parseBetAmount(args[0], wallet);
        if (bet === null) return sendError(message, "Usage: `!gamble <amount>` (or `!gamble all`)");
        if (bet <= 0) return sendError(message, "Bet must be greater than 0.");
        if (bet > wallet) return sendError(message, "You don't have that many EazyCoins.");

        const won = Math.random() < 0.47; // slight house edge
        addWallet(message.author.id, won ? bet : -bet);
        const newBalance = getWallet(message.author.id);
        saveEconomy();

        const embed = new EmbedBuilder()
            .setColor(won ? 0x2ECC71 : 0xE74C3C)
            .setTitle(won ? '🎰 GAMBLE - YOU WON!' : '🎰 GAMBLE - YOU LOST!')
            .setDescription(`🎲 ${won ? '+' : '-'}${bet.toLocaleString()} eazycoins\n\n**New Balance:** ${newBalance.toLocaleString()} eazycoins`)
            .setFooter({ text: 'Eazy Economy • Gambling' });

        return message.reply({ embeds: [embed] });
    }

    // !blackjack <amount>
    if (command === 'blackjack') {
        const wallet = getWallet(message.author.id);
        let bet = parseBetAmount(args[0], wallet);
        if (bet === null) return sendError(message, "Usage: `!blackjack <amount>` (or `!blackjack all`)");
        if (bet <= 0) return sendError(message, "Bet must be greater than 0.");
        if (bet > wallet) return sendError(message, "You don't have that many EazyCoins.");

        addWallet(message.author.id, -bet);
        saveEconomy();

        let playerHand = [drawCard(), drawCard()];
        let dealerHand = [drawCard(), drawCard()];
        let finished = false;

        const buildEmbed = (state, resultText) => {
            const embed = new EmbedBuilder()
                .setColor(state === 'lost' ? 0xE74C3C : state === 'won' ? 0x2ECC71 : 0x3498DB)
                .setTitle('🃏 Blackjack')
                .setFooter({ text: 'Eazy Casino • Blackjack' });
            if (resultText) embed.setDescription(resultText);
            embed.addFields(
                { name: `🤵 Dealer (${state === 'playing' ? '?' : handValue(dealerHand)})`, value: state === 'playing' ? `${formatHand([dealerHand[0]])} 🂠` : formatHand(dealerHand) },
                { name: `🧍 You (${handValue(playerHand)})`, value: formatHand(playerHand) },
                { name: '💰 Bet', value: `${bet.toLocaleString()} eazycoins` }
            );
            return embed;
        };

        // Natural blackjack — instant 3:2 payout
        if (handValue(playerHand) === 21) {
            const winnings = Math.floor(bet * 2.5);
            addWallet(message.author.id, winnings);
            saveEconomy();
            return message.reply({ embeds: [buildEmbed('won', `🎉 **BLACKJACK!** Won ${winnings.toLocaleString()} eazycoins!`)] });
        }

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('bj_hit').setLabel('Hit').setStyle(ButtonStyle.Primary).setEmoji('🃏'),
            new ButtonBuilder().setCustomId('bj_stand').setLabel('Stand').setStyle(ButtonStyle.Secondary).setEmoji('✋'),
            new ButtonBuilder().setCustomId('bj_double').setLabel('Double Down').setStyle(ButtonStyle.Success).setEmoji('⬆️')
        );

        const gameMessage = await message.reply({ embeds: [buildEmbed('playing')], components: [row] });
        let doubled = false;

        const collector = gameMessage.createMessageComponentCollector({ time: 45000, filter: (i) => i.user.id === message.author.id });

        collector.on('collect', async (interaction) => {
            if (interaction.customId === 'bj_hit') {
                playerHand.push(drawCard());
                if (handValue(playerHand) > 21) {
                    finished = true;
                    collector.stop('bust');
                    return interaction.update({ embeds: [buildEmbed('lost', `💥 **BUST!** You lost ${bet.toLocaleString()} eazycoins.`)], components: [] });
                }
                return interaction.update({ embeds: [buildEmbed('playing')], components: [row] });
            }

            if (interaction.customId === 'bj_double') {
                if (doubled || playerHand.length > 2) return interaction.reply({ content: "You can only double down on your first move.", ephemeral: true });
                if (bet > getWallet(message.author.id)) return interaction.reply({ content: "You don't have enough EazyCoins to double down.", ephemeral: true });
                doubled = true;
                addWallet(message.author.id, -bet);
                bet *= 2;
                saveEconomy();
                playerHand.push(drawCard());
                if (handValue(playerHand) > 21) {
                    finished = true;
                    collector.stop('bust');
                    return interaction.update({ embeds: [buildEmbed('lost', `💥 **BUST!** You lost ${bet.toLocaleString()} eazycoins.`)], components: [] });
                }
                collector.stop('stand');
                return interaction.update({ embeds: [buildEmbed('playing')], components: [] });
            }

            if (interaction.customId === 'bj_stand') {
                collector.stop('stand');
                return interaction.update({ embeds: [buildEmbed('playing')], components: [] });
            }
        });

        collector.on('end', async (_collected, reason) => {
            if (finished) return; // bust already resolved and paid out in the collect handler

            while (handValue(dealerHand) < 17) {
                dealerHand.push(drawCard());
            }
            const playerTotal = handValue(playerHand);
            const dealerTotal = handValue(dealerHand);

            let resultText, state;
            if (dealerTotal > 21 || playerTotal > dealerTotal) {
                const winnings = bet * 2;
                addWallet(message.author.id, winnings);
                resultText = `🎉 **YOU WIN!** Won ${winnings.toLocaleString()} eazycoins!`;
                state = 'won';
            } else if (playerTotal === dealerTotal) {
                addWallet(message.author.id, bet);
                resultText = `🤝 **PUSH.** Your ${bet.toLocaleString()} eazycoins bet was returned.`;
                state = 'playing';
            } else {
                resultText = `❌ **YOU LOSE!** Lost ${bet.toLocaleString()} eazycoins.`;
                state = 'lost';
            }
            saveEconomy();
            await gameMessage.edit({ embeds: [buildEmbed(state, resultText)], components: [] }).catch(() => {});
        });
    }

    // !cryptolaunch <company name>
    if (command === 'cryptolaunch') {
        const companyName = args.join(' ').trim();
        if (!companyName) return sendError(message, "Usage: `!cryptolaunch <company name>`");
        if (companyName.length > 24) return sendError(message, "Company name must be 24 characters or fewer.");

        const key = companyName.toLowerCase().replace(/\s+/g, '');
        if (economyData.companies[key]) return sendError(message, `A company called **${economyData.companies[key].name}** already exists. Pick another name.`);

        const LAUNCH_COST = 500000;
        const wallet = getWallet(message.author.id);
        if (wallet < LAUNCH_COST) return sendError(message, `You need at least **${LAUNCH_COST.toLocaleString()} EazyCoins** to launch a crypto company. You have **${wallet.toLocaleString()}**.`);

        addWallet(message.author.id, -LAUNCH_COST);
        const startingPrice = parseFloat((Math.random() * 49 + 1).toFixed(2)); // 1.00 - 50.00

        economyData.companies[key] = { name: companyName, ownerId: message.author.id, price: startingPrice, createdAt: Date.now() };
        economyData.linkedCompany[message.author.id] = true;
        saveEconomy();

        const embed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle('🚀 Crypto Company Launched!')
            .setDescription(`**${companyName}** is now live and tradable with \`!cryptobuy ${key}\`!`)
            .addFields(
                { name: 'Founder', value: `${message.author}`, inline: true },
                { name: 'Starting Price', value: `${startingPrice.toLocaleString()} eazycoins each`, inline: true },
                { name: 'Cost To Launch', value: `${LAUNCH_COST.toLocaleString()} eazycoins`, inline: true }
            )
            .setFooter({ text: 'Eazy Crypto • Launch' });

        return message.reply({ embeds: [embed] });
    }

    // !cryptobuy <coin> <amount>
    if (command === 'cryptobuy') {
        const coinKey = args[0]?.toLowerCase();
        const amount = parseFloat(args[1]);
        if (!coinKey || !amount || amount <= 0) return sendError(message, "Usage: `!cryptobuy <coin> <amount>` — e.g. `!cryptobuy moon 100`");

        const company = economyData.companies[coinKey];
        if (!company) return sendError(message, `No crypto company found called \`${coinKey}\`. Check the name or launch your own with \`!cryptolaunch\`.`);

        const MIN_NET_WORTH = 1000000;
        const wallet = getWallet(message.author.id);
        if (wallet < MIN_NET_WORTH) return sendError(message, `You need at least **${MIN_NET_WORTH.toLocaleString()} EazyCoins** in your wallet to access crypto trading.`);
        if (!economyData.linkedCompany[message.author.id]) return sendError(message, "You need a Crypto Company linked to your account first. Use `!cryptolaunch <name>` to set one up.");

        const grossCost = amount * company.price;
        const fee = Math.ceil(grossCost * 0.05);
        const totalCost = Math.ceil(grossCost) + fee;

        if (totalCost > wallet) return sendError(message, `That purchase costs **${totalCost.toLocaleString()} EazyCoins** (incl. 5% fee) — you only have **${wallet.toLocaleString()}**.`);

        addWallet(message.author.id, -totalCost);
        if (!economyData.holdings[message.author.id]) economyData.holdings[message.author.id] = {};
        economyData.holdings[message.author.id][coinKey] = (economyData.holdings[message.author.id][coinKey] || 0) + amount;

        // Simulate a small price drift after each buy (fake market movement — not real trading)
        company.price = Math.max(0.001, parseFloat((company.price * (1 + (Math.random() * 0.04 - 0.01))).toFixed(4)));
        saveEconomy();

        const totalHoldings = economyData.holdings[message.author.id][coinKey];

        const embed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle('📈 Crypto Purchased!')
            .setDescription(`Bought **${amount.toLocaleString()} ${company.name}** for **${totalCost.toLocaleString()} eazycoins**`)
            .addFields(
                { name: 'Price', value: `${company.price.toLocaleString()} eazycoins each`, inline: true },
                { name: 'Trading Fee (5%)', value: `${fee.toLocaleString()} eazycoins`, inline: true },
                { name: 'Total Holdings', value: `${totalHoldings.toLocaleString()} ${company.name}`, inline: false }
            )
            .setFooter({ text: 'Eazy Crypto' });

        return message.reply({ embeds: [embed] });
    }

    // !cryptoportfolio (alias: !cryptoportfoilo, matching the requested spelling)
    if (command === 'cryptoportfolio' || command === 'cryptoportfoilo') {
        const holdings = economyData.holdings[message.author.id];
        if (!holdings || Object.keys(holdings).length === 0) return sendError(message, "You don't own any crypto yet. Use `!cryptobuy` to get started.");

        let totalValue = 0;
        const fields = [];
        for (const [key, amount] of Object.entries(holdings)) {
            if (amount <= 0) continue;
            const company = economyData.companies[key];
            if (!company) continue;
            const value = amount * company.price;
            totalValue += value;
            fields.push({ name: company.name, value: `${amount.toLocaleString()} coins\n${Math.round(value).toLocaleString()} eazycoins`, inline: true });
        }

        if (fields.length === 0) return sendError(message, "You don't own any crypto yet. Use `!cryptobuy` to get started.");

        const embed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle(`📊 ${message.author.username}'s Crypto Portfolio`)
            .addFields(...fields, { name: '💰 Total Portfolio Value', value: `${Math.round(totalValue).toLocaleString()} eazycoins`, inline: false })
            .setFooter({ text: 'Eazy Crypto • Portfolio' });

        return message.reply({ embeds: [embed] });
    }
});

const http = require('http');
http.createServer((req, res) => { res.writeHead(200); res.end('System Alive'); }).listen(process.env.PORT || 3000);

process.on('unhandledRejection', (reason) => console.error('⚠️ Intercepted Unhandled Rejection:', reason));
process.on('uncaughtException', (err) => console.error('⚠️ Intercepted Uncaught Exception:', err));

client.login(process.env.DISCORD_TOKEN);