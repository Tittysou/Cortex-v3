const { Client, GatewayIntentBits, Collection } = require('discord.js');
const { logTotalLines } = require('./utils/LineCount');
const { checkIntents } = require('./utils/IntentChecker');
const { info, success, warn, error, debug } = require('./utils/logs');
const checkConfig = require('./functions/loadConfig');
const connectToDatabase = require('./MDatabase');
const { interactionLogger } = require('./utils/UserLogs');
const { WebhookUtil } = require('./utils/WebhookUtil');
const { readJSON, writeJSON } = require('./utils/FileUtils');
const { simplecron } = require('./utils/Cron');
const { normalizePath } = require('./utils/PathNormalizer');
const { parseCSV, generateCSV } = require('./utils/CSVParser');
const { extractURLs } = require('./utils/Regex');
const { paginate } = require('./utils/Pagination');
const HotReload = require('./utils/hotReload');
const config = require('../config.json');
const { loadUtils } = require('./functions/loadUtils');
const { loadFiles } = require('./functions/loadFiles');
const inquirer = require('inquirer').default;
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const getIntents = () => [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildPresences,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMessageTyping,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildInvites,
    GatewayIntentBits.GuildEmojisAndStickers,
    GatewayIntentBits.GuildScheduledEvents,
    GatewayIntentBits.AutoModerationConfiguration,
    GatewayIntentBits.AutoModerationExecution,
    GatewayIntentBits.GuildModeration,
    GatewayIntentBits.MessageContent,
];

const setupInteractionHandlers = async (client) => {
    const ButtonHandler = require('./handlers/buttonHandler');
    const SelectMenuHandler = require('./handlers/menuHandler');
    const ModalHandler = require('./handlers/modalHandler');
    const ContextMenuHandler = require('./handlers/contextMenuHandler');

    const buttonHandler = new ButtonHandler(client);
    const selectMenuHandler = new SelectMenuHandler(client);
    const modalHandler = new ModalHandler(client);
    const contextMenuHandler = new ContextMenuHandler(client);

    await Promise.all([
        buttonHandler.loadButtons(),
        selectMenuHandler.loadSelectMenus(),
        modalHandler.loadModals(),
        contextMenuHandler.loadContextMenus()
    ]);

    client.on('interactionCreate', async (interaction) => {
        try {
            if (interaction.isButton()) await buttonHandler.handleButton(interaction);
            else if (interaction.isAnySelectMenu()) await selectMenuHandler.handleSelectMenu(interaction);
            else if (interaction.isModalSubmit()) await modalHandler.handleModal(interaction);
            else if (interaction.isContextMenuCommand()) await contextMenuHandler.handleContextMenu(interaction);
        } catch (error) {
            console.error('Error handling interaction:', error);
        }
    });
};

const getSelectedBotFromFile = () => {
    try {
        const tempFilePath = path.resolve('./temp-selected-bot.json');
        if (fs.existsSync(tempFilePath)) {
            const data = fs.readFileSync(tempFilePath, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        error(`Error reading selected bot data: ${err.message}`);
    }
    return null;
};

const selectToken = async () => {
    const selectedBotFromFile = getSelectedBotFromFile();
    if (selectedBotFromFile) {
        debug(`Using bot selection from file: ${selectedBotFromFile.name}`);
        return selectedBotFromFile;
    }
    
    if (process.env.USING_SHARDING === 'true' && process.env.SELECTED_BOT_INDEX) {
        const index = parseInt(process.env.SELECTED_BOT_INDEX);
        
        if (index === -1) {
            debug(`Using default token from config`);
            return { token: config.token, name: 'Bot 1' };
        }
        
        if (Array.isArray(config.tokens) && index >= 0 && index < config.tokens.length) {
            const name = process.env.SELECTED_BOT_NAME || 
                         (config.botNames && config.botNames[index] ? config.botNames[index] : `Bot ${index + 1}`);
            
            debug(`Using token for ${name} from environment variables`);
            return { token: config.tokens[index], name };
        }
        
        error(`Invalid bot index received from shard manager: ${index}`);
    }
    
    if (process.env.USING_SHARDING !== 'true') {
        if (Array.isArray(config.tokens) && config.tokens.length > 1) {
            const choices = config.tokens.map((token, index) => {
                const name = config.botNames && config.botNames[index] 
                    ? config.botNames[index] 
                    : `Bot ${index + 1}`;
                return { name, value: { token, name } };
            });
            
            const answer = await inquirer.prompt([{
                type: 'list',
                name: 'selectedBot',
                message: 'Select which bot to start:',
                choices
            }]);
            
            return answer.selectedBot;
        }
    }
    
    if (Array.isArray(config.tokens) && config.tokens.length > 0) {
        debug(`Using first bot in tokens array as fallback`);
        return { token: config.tokens[0], name: config.botNames?.[0] || 'Bot 1' };
    }
    
    debug(`Using token from config.token as last resort`);
    return { token: config.token, name: 'Bot 1' };
};

const initializeBot = async () => {
    const { token, name } = await selectToken();
    debug(`Selected bot: ${name}`);

    const client = new Client({ intents: getIntents() });
    
    require('./utils/packageChecker')(client);

    const hotReload = new HotReload(client);
    hotReload.initialize();
    loadUtils(client);
    loadFiles(client);
    
    interactionLogger(client);
    checkIntents(client);
    connectToDatabase(client);
    logTotalLines(client);
    WebhookUtil(client);
    
    await setupInteractionHandlers(client);
    
    try {
        await client.login(token);
        success(`Bot ${name} logged in successfully${process.env.SHARD_ID ? ` (Shard ${process.env.SHARD_ID})` : ''}`);
    } catch (loginError) {
        error(`Failed to login: ${loginError.message}`);
        process.exit(1);
    }
};

initializeBot().catch(err => {
    error(`Error during initialization: ${err}`);
    process.exit(1);
});

process.on('SIGINT', () => {
    debug("Shutting down..");
    process.exit(0);
});