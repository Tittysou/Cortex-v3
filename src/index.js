const { Client, GatewayIntentBits } = require('discord.js');
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
const { paginate } = require('./utils/Pagination')
const HotReload = require('./utils/hotReload');
const config = require('../config.json');

const client = new Client({
    intents: [
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
    ],
});

const initializeBot = async () => {
    await checkConfig();
    require('./utils/packageChecker')(client);

    const hotReload = new HotReload(client);
    hotReload.initialize();
    
    interactionLogger(client);
    checkIntents(client);
    connectToDatabase(client);
    logTotalLines(client);
    WebhookUtil(client);
        
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

    client.login(config.token);
};

initializeBot();

process.on('SIGINT', () => {
    debug("Shutting down..")
    process.exit(0)
});