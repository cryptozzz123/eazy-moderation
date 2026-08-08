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
    statusVCs: { crashy: null, eazy: null, banwave: null },
    maintenanceMode: { eazy: false, crashy: false },
    banwaveOverride: null, // 'none' | 'checking' | 'ongoing' | null (null = fully automatic)
    banwaveOverrideExpiry: null, // ms timestamp, or null = no expiry until cleared
    lastVersions: {
        live: { windows: null, mac: null, android: null, ios: null },
        beta: { windows: null, mac: null },
        hidden: { windows: null, mac: null }
    },
    economy: {} // Persisted user economy data
};

// Default per-platform shape for each update type — used to migrate old flat configs
const LAST_VERSIONS_DEFAULTS = {
    live: { windows: null, mac: null, android: null, ios: null },
    beta: { windows: null, mac: null },
    hidden: { windows: null, mac: null }
};

const BOT_VERSION = '1.16.0'; 

function runConfigMigrations() {
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
        versionConfig.statusVCs = { crashy: null, eazy: null, banwave: null };
    } else if (!('banwave' in versionConfig.statusVCs)) {
        versionConfig.statusVCs.banwave = null;
    }
    if (versionConfig.banwaveOverride && !['none', 'checking', 'ongoing'].includes(versionConfig.banwaveOverride)) {
        versionConfig.banwaveOverride = null;
    }
    if (typeof versionConfig.banwaveOverrideExpiry !== 'number') {
        versionConfig.banwaveOverrideExpiry = null;
    }
    if (!versionConfig.economy || typeof versionConfig.economy !== 'object') {
        versionConfig.economy = {};
    }
}

// ---- GitHub-backed persistence -------------------------------------------------
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || null;
const GITHUB_REPO = process.env.GITHUB_REPO || null; 
const GITHUB_BRANCH = process.env.GITHUB_BRANCH || 'main';
const GITHUB_CONFIG_API = GITHUB_REPO ? `https://api.github.com/repos/${GITHUB_REPO}/contents/version_config.json` : null;
let githubConfigSha = null;

function githubPersistenceEnabled() {
    return !!(GITHUB_TOKEN && GITHUB_REPO);
}

function githubHeaders(extra = {}) {
    return {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'eazy-moderation-bot',
        ...extra
    };
}

async function loadConfigFromGitHub() {
    if (!githubPersistenceEnabled()) return false;
    try {
        const res = await fetch(`${GITHUB_CONFIG_API}?ref=${GITHUB_BRANCH}`, { headers: githubHeaders() });
        if (!res.ok) {
            if (res.status === 404) {
                console.log("ℹ️ No version_config.json found in the GitHub repo yet — it will be created on first save.");
            } else {
                console.error(`⚠️ GitHub config fetch failed (${res.status}), falling back to local cache.`);
            }
            return false;
        }
        const data = await res.json();
        githubConfigSha = data.sha;
        const decoded = Buffer.from(data.content, 'base64').toString('utf8');
        versionConfig = Object.assign(versionConfig, JSON.parse(decoded));
        console.log("✅ Loaded persisted configuration from the GitHub repo.");
        return true;
    } catch (e) {
        console.error("⚠️ Failed to load config from GitHub, falling back to local cache.", e.message);
        return false;
    }
}

async function pushConfigToGitHub(retrying = false) {
    if (!githubPersistenceEnabled()) return;
    try {
        const body = {
            message: 'chore: sync bot config [skip ci]',
            content: Buffer.from(JSON.stringify(versionConfig, null, 4), 'utf8').toString('base64'),
            branch: GITHUB_BRANCH
        };
        if (githubConfigSha) body.sha = githubConfigSha;

        const res = await fetch(GITHUB_CONFIG_API, {
            method: 'PUT',
            headers: githubHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify(body)
        });

        if ((res.status === 409 || res.status === 422) && !retrying) {
            const fresh = await fetch(`${GITHUB_CONFIG_API}?ref=${GITHUB_BRANCH}`, { headers: githubHeaders() });
            if (fresh.ok) {
                const freshData = await fresh.json();
                githubConfigSha = freshData.sha;
                return pushConfigToGitHub(true);
            }
            return;
        }

        if (!res.ok) {
            console.error(`⚠️ Failed to push config to GitHub (${res.status}).`);
            return;
        }

        const json = await res.json();
        githubConfigSha = json.content?.sha || githubConfigSha;
    } catch (e) {
        console.error("⚠️ GitHub config push error:", e.message);
    }
}

if (fs.existsSync(CONFIG_PATH)) {
    try {
        const fileData = fs.readFileSync(CONFIG_PATH, 'utf8');
        versionConfig = Object.assign(versionConfig, JSON.parse(fileData));
    } catch (e) {
        console.error("⚠️ Failed to parse version_config.json, starting fresh.", e);
    }
}
runConfigMigrations();

function saveConfig() {
    try {
        fs.writeFileSync(CONFIG_PATH, JSON.stringify(versionConfig, null, 4), 'utf8');
    } catch (e) {
        console.error("⚠️ Could not write configurations to storage file.", e);
    }
    pushConfigToGitHub(); 
}

// Economy Data Helper Functions
function getEcoUser(userId) {
    if (!versionConfig.economy[userId]) {
        versionConfig.economy[userId] = {
            coins: 0,
            lastDaily: 0,
            company: null, // { name: "", coinName: "", holdings: 0, tokenPrice: 100 }
            portfolio: {}  // { [companyName]: amountHeld }
        };
    }
    return versionConfig.economy[userId];
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

    const overrideActive = versionConfig.banwaveOverride &&
        (!versionConfig.banwaveOverrideExpiry || Date.now() < versionConfig.banwaveOverrideExpiry);

    let effectiveBanwaveStatus;
    if (overrideActive) {
        effectiveBanwaveStatus = versionConfig.banwaveOverride;
    } else {
        if (versionConfig.banwaveOverride && !overrideActive) {
            versionConfig.banwaveOverride = null;
            versionConfig.banwaveOverrideExpiry = null;
            saveConfig();
        }
        if (Date.now() - banwaveLastFetch > BANWAVE_FETCH_INTERVAL) {
            banwaveLastFetch = Date.now();
            await fetchBanwaveAutoStatus();
        }
        effectiveBanwaveStatus = banwaveAutoStatus;
    }

    let banwaveText = "Banwave : No 🔴";
    if (effectiveBanwaveStatus === 'checking') {
        banwaveText = "Banwave : Checking/Possible 🟠";
    } else if (effectiveBanwaveStatus === 'ongoing') {
        banwaveText = "Banwave : Ongoing 🟢";
    }

    if (versionConfig.statusVCs?.eazy) {
        const chan = await client.channels.fetch(versionConfig.statusVCs.eazy).catch(() => null);
        if (chan && chan.name !== eazyText) await chan.setName(eazyText).catch(() => {});
    }
    if (versionConfig.statusVCs?.crashy) {
        const chan = await client.channels.fetch(versionConfig.statusVCs.crashy).catch(() => null);
        if (chan && chan.name !== crashyText) await chan.setName(crashyText).catch(() => {});
    }
    if (versionConfig.statusVCs?.banwave) {
        const chan = await client.channels.fetch(versionConfig.statusVCs.banwave).catch(() => null);
        if (chan && chan.name !== banwaveText) await chan.setName(banwaveText).catch(() => {});
    }
}

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

const BANWAVE_RSS_URL = 'https://robloxbanwave.vercel.app/api/rss';
const BANWAVE_ALERT_KEYWORDS = ['banwave', 'ban wave', 'banned', 'wave', 'hyperion', 'byfron', 'flagged', 'detected'];
const BANWAVE_FETCH_INTERVAL = 4 * 60 * 1000; 
let banwaveAutoStatus = 'none'; 
let banwaveLastFetch = 0;

function parseRssItems(xml) {
    const items = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
        const block = match[1];
        const titleMatch = block.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
        const dateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
        items.push({
            title: titleMatch ? titleMatch[1].trim() : '',
            pubDate: dateMatch ? new Date(dateMatch[1].trim()) : null
        });
    }
    return items;
}

async function fetchBanwaveAutoStatus() {
    try {
        const res = await fetch(BANWAVE_RSS_URL, { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return banwaveAutoStatus;

        const items = parseRssItems(await res.text());
        const now = Date.now();
        let strongRecent = 0; 
        let anyRecent = 0;    

        for (const item of items) {
            if (!item.pubDate || isNaN(item.pubDate.getTime())) continue;
            const hoursAgo = (now - item.pubDate.getTime()) / 3600000;
            const isAlertLike = BANWAVE_ALERT_KEYWORDS.some(k => item.title.toLowerCase().includes(k));
            if (!isAlertLike) continue;
            if (hoursAgo <= 24) strongRecent++;
            if (hoursAgo <= 72) anyRecent++;
        }

        if (strongRecent >= 2) banwaveAutoStatus = 'ongoing';
        else if (strongRecent >= 1 || anyRecent >= 3) banwaveAutoStatus = 'checking';
        else banwaveAutoStatus = 'none';
    } catch (e) {
        console.error("⚠️ Failed to fetch banwave RSS feed:", e.message);
    }
    return banwaveAutoStatus;
}

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

    // ==========================================
    // 🪙 EAZYCOINS ECONOMY ENGINE & COMMANDS 🪙
    // ==========================================

    if (command === 'beg') {
        const user = getEcoUser(message.author.id);
        const gained = Math.floor(Math.random() * 250) + 50; 
        user.coins += gained;
        saveConfig();

        const begEmbed = new EmbedBuilder()
            .setColor(0xF1C40F)
            .setTitle('🥺 Spare Change!')
            .setDescription(`A generous stranger gave you **${gained.toLocaleString()} EazyCoins**!`)
            .setFooter({ text: `Wallet: ${user.coins.toLocaleString()} EazyCoins` });

        return message.reply({ embeds: [begEmbed] });
    }

    if (command === 'daily') {
        const user = getEcoUser(message.author.id);
        const cooldown = 24 * 60 * 60 * 1000;
        if (Date.now() - user.lastDaily < cooldown) {
            const remainingMs = cooldown - (Date.now() - user.lastDaily);
            const hours = Math.floor(remainingMs / (1000 * 60 * 60));
            const minutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
            return sendError(message, `You have already claimed your daily bonus! Come back in **${hours}h ${minutes}m**.`);
        }

        const reward = Math.floor(Math.random() * 5000) + 2500; 
        user.coins += reward;
        user.lastDaily = Date.now();
        saveConfig();

        const dailyEmbed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('🎁 Daily EazyCoins Claimed!')
            .setDescription(`You claimed your daily reward of **${reward.toLocaleString()} EazyCoins**!`)
            .setFooter({ text: `Total Balance: ${user.coins.toLocaleString()} EazyCoins` });

        return message.reply({ embeds: [dailyEmbed] });
    }

    if (command === 'balance' || command === 'bal') {
        const targetMember = message.mentions.members.first() || message.member;
        const user = getEcoUser(targetMember.id);

        const balEmbed = new EmbedBuilder()
            .setColor(0x3498DB)
            .setTitle(`💰 ${targetMember.displayName}'s Balance`)
            .addFields(
                { name: 'Wallet', value: `**${user.coins.toLocaleString()}** EazyCoins`, inline: true },
                { name: 'Crypto Company', value: user.company ? `**${user.company.name}** (\`${user.company.coinName}\`)` : '*None Linked*', inline: true }
            )
            .setFooter({ text: 'EazyCoins Economy Framework' });

        return message.reply({ embeds: [balEmbed] });
    }

    if (command === 'cryptolaunch') {
        const user = getEcoUser(message.author.id);

        if (user.company) {
            return sendError(message, `You already own a Crypto Company called **${user.company.name}**!`);
        }

        if (user.coins < 500000) {
            return sendError(message, `You need at least **500,000 EazyCoins** to launch a Crypto Company. Current Balance: ${user.coins.toLocaleString()} EazyCoins.`);
        }

        const input = args.join(" ").split("|").map(s => s.trim());
        if (input.length < 2 || !input[0] || !input[1]) {
            return sendError(message, "Usage: `!cryptolaunch <Company Name> | <Coin Ticker/Name>`\nExample: `!cryptolaunch Moon Corp | MOON`");
        }

        const companyName = input[0];
        const coinName = input[1].toUpperCase();

        user.coins -= 500000;
        user.company = {
            name: companyName,
            coinName: coinName,
            holdings: 10000,
            tokenPrice: Math.floor(Math.random() * 50) + 100
        };
        saveConfig();

        const launchEmbed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle('🚀 Crypto Company Launched!')
            .setDescription(`Successfully founded **${companyName}**! *(FAKE / SIMULATED)*\n\n` +
                `• **Coin Ticker:** \`${coinName}\`\n` +
                `• **Initial Market Price:** \`${user.company.tokenPrice} EazyCoins\`\n` +
                `• **Starting Reserve Holdings:** \`${user.company.holdings.toLocaleString()} ${coinName}\``)
            .setFooter({ text: `500,000 EazyCoins deducted. Remaining: ${user.coins.toLocaleString()} EazyCoins` });

        return message.reply({ embeds: [launchEmbed] });
    }

    if (command === 'cryptobuy') {
        const user = getEcoUser(message.author.id);

        if (!user.company) {
            return sendError(message, "You must have a Crypto Company linked to execute trade orders! Create one using `!cryptolaunch <Name> | <Ticker>`.");
        }

        if (user.coins < 1000000) {
            return sendError(message, `You must have at least **1,000,000 EazyCoins** to buy crypto! Current Balance: ${user.coins.toLocaleString()} EazyCoins.`);
        }

        const amountToBuy = parseInt(args[0]) || 100;
        const currentPrice = user.company.tokenPrice;
        const totalCost = amountToBuy * currentPrice;
        const tradingFee = Math.floor(totalCost * 0.05);
        const grandTotal = totalCost + tradingFee;

        if (user.coins < grandTotal) {
            return sendError(message, `Insufficient funds for this trade order. Total cost with 5% trading fee: **${grandTotal.toLocaleString()} EazyCoins**.`);
        }

        user.coins -= grandTotal;
        user.company.holdings += amountToBuy;
        if (!user.portfolio) user.portfolio = {};
        user.portfolio[user.company.coinName] = (user.portfolio[user.company.coinName] || 0) + amountToBuy;
        saveConfig();

        const buyEmbed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('📈 Crypto Purchased!')
            .setDescription(`Bought **${amountToBuy.toLocaleString()} ${user.company.coinName}** for **${totalCost.toLocaleString()} EazyCoins** *(FAKE / SIMULATED)*`)
            .addFields(
                { name: 'Price per Coin', value: `${currentPrice} EazyCoins`, inline: true },
                { name: 'Trading Fee (5%)', value: `${tradingFee.toLocaleString()} EazyCoins`, inline: true },
                { name: 'Total Holdings', value: `${user.company.holdings.toLocaleString()} ${user.company.coinName}`, inline: false }
            )
            .setFooter({ text: `${user.company.name} Crypto` });

        return message.reply({ embeds: [buyEmbed] });
    }

    if (command === 'cryptoportfolio' || command === 'cryptoportfoilo') {
        const user = getEcoUser(message.author.id);

        if (!user.company) {
            return sendError(message, "You do not own or link to any active Crypto Company profile. Use `!cryptolaunch` first.");
        }

        const holdings = user.company.holdings;
        const price = user.company.tokenPrice;
        const totalVal = holdings * price;

        const portEmbed = new EmbedBuilder()
            .setColor(0x34495E)
            .setTitle(`📊 ${message.author.username}'s Crypto Portfolio`)
            .setDescription(`*(Simulated Asset Management)*\n\n` +
                `**Company:** ${user.company.name}\n` +
                `**Asset Ticker:** \`${user.company.coinName}\`\n` +
                `**Token Holdings:** \`${holdings.toLocaleString()} ${user.company.coinName}\`\n` +
                `**Current Value:** \`${price} EazyCoins / token\`\n` +
                `**Estimated Portfolio Valuation:** \`${totalVal.toLocaleString()} EazyCoins\``)
            .setFooter({ text: 'EazyCoins Crypto Market' });

        return message.reply({ embeds: [portEmbed] });
    }

    if (command === 'gamble') {
        const user = getEcoUser(message.author.id);
        const bet = parseInt(args[0]);

        if (isNaN(bet) || bet <= 0) {
            return sendError(message, "Please state a valid amount of EazyCoins to gamble! Usage: `!gamble [amount]`");
        }

        if (user.coins < bet) {
            return sendError(message, `You do not have enough EazyCoins to place that bet! Current Balance: ${user.coins.toLocaleString()} EazyCoins.`);
        }

        const won = Math.random() >= 0.55; 
        if (won) {
            const earnings = bet * 2;
            user.coins += bet;
            saveConfig();
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x2ECC71)
                        .setTitle('🎰 GAMBLE WIN!')
                        .setDescription(`🎉 Double or Nothing! You won **${earnings.toLocaleString()} EazyCoins**!`)
                        .setFooter({ text: `New Balance: ${user.coins.toLocaleString()} EazyCoins` })
                ]
            });
        } else {
            user.coins -= bet;
            saveConfig();
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xE74C3C)
                        .setTitle('🎰 GAMBLE LOSS!')
                        .setDescription(`💸 You gambled away **${bet.toLocaleString()} EazyCoins** into thin air...`)
                        .setFooter({ text: `New Balance: ${user.coins.toLocaleString()} EazyCoins` })
                ]
            });
        }
    }

    if (command === 'blackjack') {
        const user = getEcoUser(message.author.id);
        const bet = parseInt(args[0]);

        if (isNaN(bet) || bet <= 0) {
            return sendError(message, "Please enter a valid amount to bet! Usage: `!blackjack [number]`");
        }

        if (user.coins < bet) {
            return sendError(message, `You do not have enough EazyCoins for this table. Wallet: ${user.coins.toLocaleString()} EazyCoins.`);
        }

        const playerHand = Math.floor(Math.random() * 10) + 12; 
        const dealerHand = Math.floor(Math.random() * 10) + 12; 

        let resultText = "";
        let win = false;

        if (playerHand > 21) {
            resultText = "💥 You Busted!";
        } else if (dealerHand > 21 || playerHand > dealerHand) {
            resultText = "🃏 You Beat the Dealer!";
            win = true;
        } else if (playerHand === dealerHand) {
            resultText = "🤝 Push! It's a Tie.";
        } else {
            resultText = "📉 Dealer Wins!";
        }

        if (win) {
            user.coins += bet;
            saveConfig();
        } else if (resultText !== "🤝 Push! It's a Tie.") {
            user.coins -= bet;
            saveConfig();
        }

        const bjEmbed = new EmbedBuilder()
            .setColor(win ? 0x2ECC71 : 0xE74C3C)
            .setTitle('🃏 Blackjack Table')
            .setDescription(`**${resultText}**\n\n` +
                `• **Your Score:** \`${playerHand}\`\n` +
                `• **Dealer Score:** \`${dealerHand}\``)
            .setFooter({ text: `Wallet: ${user.coins.toLocaleString()} EazyCoins` });

        return message.reply({ embeds: [bjEmbed] });
    }

    if (command === 'huntcoins') {
        const user = getEcoUser(message.author.id);
        const animals = [
            { name: 'Rabbit 🐇', payout: 150 },
            { name: 'Wild Boar 🐗', payout: 400 },
            { name: 'Deer 🦌', payout: 750 },
            { name: 'Bear 🐻', payout: 1500 },
            { name: 'Legendary Dragon 🐉', payout: 5000 }
        ];

        const caught = animals[Math.floor(Math.random() * animals.length)];
        user.coins += caught.payout;
        saveConfig();

        const huntEmbed = new EmbedBuilder()
            .setColor(0x2ECC71)
            .setTitle('🏹 Coin Hunt Successful!')
            .setDescription(`You went hunting and tracked down a **${caught.name}**!\nSold the trophy for **${caught.payout.toLocaleString()} EazyCoins**!`)
            .setFooter({ text: `Total Balance: ${user.coins.toLocaleString()} EazyCoins` });

        return message.reply({ embeds: [huntEmbed] });
    }

    if (command === 'rob') {
        const user = getEcoUser(message.author.id);
        const targetMember = message.mentions.members.first();

        if (!targetMember) {
            const randomStolen = Math.floor(Math.random() * 500) + 100;
            user.coins += randomStolen;
            saveConfig();
            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xE67E22)
                        .setTitle('🥷 Street Heist')
                        .setDescription(`You pickpocketed a passerby on the street and made off with **${randomStolen.toLocaleString()} EazyCoins**!`)
                        .setFooter({ text: `Wallet: ${user.coins.toLocaleString()} EazyCoins` })
                ]
            });
        }

        if (targetMember.id === message.author.id) {
            return sendError(message, "You can't rob yourself!");
        }

        const targetUser = getEcoUser(targetMember.id);
        if (targetUser.coins < 200) {
            return sendError(message, `**${targetMember.displayName}** is too poor to be robbed!`);
        }

        const success = Math.random() >= 0.5;
        if (success) {
            const stolen = Math.floor(targetUser.coins * (Math.random() * 0.3 + 0.1)); 
            targetUser.coins -= stolen;
            user.coins += stolen;
            saveConfig();

            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0x2ECC71)
                        .setTitle('🥷 Robbery Successful!')
                        .setDescription(`You mugged ${targetMember} and successfully stole **${stolen.toLocaleString()} EazyCoins**!`)
                        .setFooter({ text: `Your Balance: ${user.coins.toLocaleString()} EazyCoins` })
                ]
            });
        } else {
            const fine = Math.min(user.coins, 300);
            user.coins -= fine;
            saveConfig();

            return message.reply({
                embeds: [
                    new EmbedBuilder()
                        .setColor(0xFF3333)
                        .setTitle('🚨 Robbery Failed!')
                        .setDescription(`You got caught red-handed attempting to rob ${targetMember}! Paid a fine of **${fine.toLocaleString()} EazyCoins**.`)
                        .setFooter({ text: `Your Balance: ${user.coins.toLocaleString()} EazyCoins` })
                ]
            });
        }
    }

    if (command === 'breakinto') {
        const user = getEcoUser(message.author.id);
        const success = Math.random() >= 0.4; 

        if (success) {
            const loot = Math.floor(Math.random() * 2500) + 500;
            user.coins += loot;
            saveConfig();

            const breakEmbed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle('🏠 House Break-In Successful!')
                .setDescription(`*(SIMULATED / GAME)*\nYou lockpicked a house safe and stole **${loot.toLocaleString()} EazyCoins**!`)
                .setFooter({ text: `Wallet: ${user.coins.toLocaleString()} EazyCoins` });

            return message.reply({ embeds: [breakEmbed] });
        } else {
            const penalty = Math.min(user.coins, 1000);
            user.coins -= penalty;
            saveConfig();

            const failEmbed = new EmbedBuilder()
                .setColor(0xFF3333)
                .setTitle('🚨 Alarm Triggered!')
                .setDescription(`*(SIMULATED / GAME)*\nThe house alarm went off! You dropped **${penalty.toLocaleString()} EazyCoins** while escaping!`)
                .setFooter({ text: `Wallet: ${user.coins.toLocaleString()} EazyCoins` });

            return message.reply({ embeds: [failEmbed] });
        }
    }

    // !setannounce Command 
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

    // !statusvc Command
    if (command === 'statusvc') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageChannels)) {
            return sendError(message, "You need the `Manage Channels` permission to run this command.");
        }

        try {
            const guild = message.guild;

            if (versionConfig.statusVCs?.crashy) {
                const oldCrashy = await guild.channels.fetch(versionConfig.statusVCs.crashy).catch(() => null);
                if (oldCrashy) await oldCrashy.delete().catch(() => {});
            }
            if (versionConfig.statusVCs?.eazy) {
                const oldEazy = await guild.channels.fetch(versionConfig.statusVCs.eazy).catch(() => null);
                if (oldEazy) await oldEazy.delete().catch(() => {});
            }
            if (versionConfig.statusVCs?.banwave) {
                const oldBanwave = await guild.channels.fetch(versionConfig.statusVCs.banwave).catch(() => null);
                if (oldBanwave) await oldBanwave.delete().catch(() => {});
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

            const banwaveVC = await guild.channels.create({
                name: 'Banwave : No 🔴',
                type: ChannelType.GuildVoice,
                permissionOverwrites: channelPermissions
            });

            versionConfig.statusVCs = {
                crashy: crashyVC.id,
                eazy: eazyVC.id,
                banwave: banwaveVC.id
            };
            saveConfig();

            await updateStatusVoiceChannels();

            return sendSuccess(message, "Successfully created and linked locked status voice channels!");
        } catch (err) {
            console.error(err);
            return sendError(message, "Failed to create status channels. Check my server permissions hierarchy.");
        }
    }

    // !banwave Command
    if (command === 'banwave') {
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild)) {
            return sendError(message, "You need the `Manage Server` permission to run this command.");
        }

        const input = (args[0] || '').toLowerCase();

        if (input === 'auto' || input === 'clear' || input === 'reset') {
            versionConfig.banwaveOverride = null;
            versionConfig.banwaveOverrideExpiry = null;
            saveConfig();
            banwaveLastFetch = 0; 
            await updateStatusVoiceChannels();
            return sendSuccess(message, "Banwave status is back to fully automatic (source: robloxbanwave.vercel.app).");
        }

        const validStates = {
            'none': 'none', 'no': 'none', 'off': 'none',
            'checking': 'checking', 'possible': 'checking',
            'ongoing': 'ongoing', 'yes': 'ongoing', 'on': 'ongoing'
        };

        if (!validStates[input]) {
            return sendError(message, "Usage: `!banwave <none/checking/ongoing>` to override, or `!banwave auto` to go back to automatic detection.");
        }

        const minutesArg = parseInt(args[1], 10);
        const durationMinutes = !isNaN(minutesArg) && minutesArg > 0 ? minutesArg : null;

        versionConfig.banwaveOverride = validStates[input];
        versionConfig.banwaveOverrideExpiry = durationMinutes ? Date.now() + durationMinutes * 60000 : null;
        saveConfig();
        await updateStatusVoiceChannels();

        const labels = { none: '🔴 No Banwave', checking: '🟠 Checking / Possible', ongoing: '🟢 Ongoing Banwave' };
        const durationNote = durationMinutes ? ` for ${durationMinutes} minute(s), then back to auto` : ' until `!banwave auto` is run';
        return sendSuccess(message, `Banwave status manually overridden to **${labels[versionConfig.banwaveOverride]}**${durationNote}.`);
    }

    // !setrblxupd / !setbetarblx / !sethidrblx Commands
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

    // !setupdatechannel Command
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

    // !setstatusupd Command
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
                title: '🪙 EazyCoins Economy Framework',
                lines: [
                    '`beg` — Beg for a small random sum of EazyCoins.',
                    '`daily` — Claim your daily allocation of EazyCoins.',
                    '`balance / bal` — View your current EazyCoins and crypto company standing.',
                    '`gamble [amount]` — Gamble away EazyCoins in double-or-nothing.',
                    '`blackjack [amount]` — Play a hand of blackjack against the dealer.',
                    '`huntcoins` — Track down wild animals and sell them for EazyCoins.',
                    '`rob [@mention]` — Attempt to steal EazyCoins from another user or street passersby.',
                    '`breakinto` — Break into virtual houses to steal EazyCoins (fake/game).',
                    '`cryptolaunch <Name> | <Ticker>` — Launch your custom simulated Crypto Company (Costs 500,000 EazyCoins).',
                    '`cryptobuy [amount]` — Purchase company tokens (Requires 1,000,000 EazyCoins & linked company).',
                    '`cryptoportfolio` — Inspect current crypto holdings and simulated market evaluation.'
                ]
            },
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
                    '`scripts` — List Roblox script sites with live API status.',
                    '`statusvc` — Automatically setup channels layout to track bot status.',
                    '`banwave <none/checking/ongoing> [minutes]` — Manually override the (self-updating) banwave VC. `!banwave auto` to clear it.',
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

    if (command === 'scripts') {
        const processing = await message.reply("Pinging script site APIs...");

        const sites = [
            { name: 'ScriptBlox', url: 'https://scriptblox.com/', check: 'https://scriptblox.com/api/script/fetch?page=1', type: 'json' },
            { name: 'Rscripts', url: 'https://rscripts.net/', check: 'https://api.rscripts.net/health', type: 'health' },
            { name: 'RobloxScripts', url: 'https://robloxscripts.com/', check: 'https://robloxscripts.com/api/v1', type: 'apiroot' },
            { name: 'HaxHell', url: 'https://haxhell.com/', check: 'https://haxhell.com/', type: 'ping' }
        ];

        const results = await Promise.all(sites.map(async (site) => {
            try {
                const res = await fetch(site.check, {
                    method: site.type === 'ping' ? 'HEAD' : 'GET',
                    signal: AbortSignal.timeout(4000)
                });
                if (!res.ok) return { ...site, status: '🔴 Down' };

                if (site.type === 'health') {
                    const data = await res.json();
                    return { ...site, status: data?.status === 'ok' ? '🟢 Working' : '🟠 Degraded' };
                }
                if (site.type === 'apiroot') {
                    const data = await res.json();
                    return { ...site, status: data?.status === 'ok' ? '🟢 Working' : '🟠 Degraded' };
                }
                if (site.type === 'json') {
                    const data = await res.json();
                    return { ...site, status: data ? '🟢 Working' : '🟠 Degraded' };
                }
                return { ...site, status: '🟢 Working' };
            } catch {
                return { ...site, status: '🔴 Down' };
            }
        }));

        const description = results.map(r => `**${r.name}** — ${r.status}\n${r.url}`).join('\n\n');

        const scriptsEmbed = new EmbedBuilder()
            .setColor(0x9B59B6)
            .setTitle('📜 Roblox Script Websites')
            .setDescription(description)
            .setFooter({ text: "Status pulled live from each site's public API where available." })
            .setTimestamp();

        const linkButtons = results.map(r => new ButtonBuilder().setLabel(r.name).setStyle(ButtonStyle.Link).setURL(r.url));
        const buttonRow = new ActionRowBuilder().addComponents(linkButtons);

        return processing.edit({ content: null, embeds: [scriptsEmbed], components: [buttonRow] });
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
});

const http = require('http');
http.createServer((req, res) => { res.writeHead(200); res.end('System Alive'); }).listen(process.env.PORT || 3000);

process.on('unhandledRejection', (reason) => console.error('⚠️ Intercepted Unhandled Rejection:', reason));
process.on('uncaughtException', (err) => console.error('⚠️ Intercepted Uncaught Exception:', err));

(async () => {
    if (githubPersistenceEnabled()) {
        const loaded = await loadConfigFromGitHub();
        if (loaded) runConfigMigrations();
    } else {
        console.log("ℹ️ GITHUB_TOKEN / GITHUB_REPO env vars not set — config will NOT survive Render redeploys. See setup notes.");
    }
    client.login(process.env.DISCORD_TOKEN);
})();