require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');

// 1. Initialize Bot Client with required intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

// 2. Ready Event Listener
client.once('ready', () => {
    console.log(`🚀 Success! Logged in as ${client.user.tag}`);
});

// 3. Command Listener 
client.on('messageCreate', (message) => {
    // Ignore messages from other bots or this bot itself
    if (message.author.bot) return;

    const msg = message.content.toLowerCase();

    // Command: !ping
    if (msg === '!ping') {
        message.reply('🏓 Pong!');
    }
    
    // Command: !help
    if (msg === '!help') {
        message.reply('🤖 **Custom Bot Commands:**\n`!ping` - Test latency\n`!help` - List commands');
    }
});

// 4. Dummy Web Server (Mandatory for keeping it alive on Render for free)
const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot is awake!\n');
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Web monitor listening on port ${PORT}`);
});

// 5. Connect to Discord Gateway using the token from your .env
client.login(process.env.DISCORD_TOKEN);