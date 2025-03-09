const AdvancedShardManager = require('../src/utils/sharding');
const config = require('../config.json');
const { shard, error, debug } = require('../src/utils/logs');
const inquirer = require('inquirer').default;

const path = './src/index.js';
const selectToken = async () => {
    if (Array.isArray(config.tokens) && config.tokens.length > 1) {
        const choices = config.tokens.map((token, index) => {
            const name = config.botNames && config.botNames[index] 
                ? config.botNames[index] 
                : `Bot ${index + 1}`;
            return { name, value: { token, name, index } };
        });
        
        const answer = await inquirer.prompt([{
            type: 'list',
            name: 'selectedBot',
            message: 'Select which bot to shard:',
            choices
        }]);
        
        return answer.selectedBot;
    }
    
    if (Array.isArray(config.tokens) && config.tokens.length === 1) {
        return { token: config.tokens[0], name: config.botNames[0] || 'Bot 1', index: 0 };
    }
    
    return { token: config.token, name: 'Bot 1', index: -1 };
};

const initializeShardManager = async () => {
    try {
        const { token, name, index } = await selectToken();
        debug(`Selected bot for sharding: ${name}`);
        const fs = require('fs');
        const selectedBotInfo = JSON.stringify({ token, name, index });
        fs.writeFileSync('./temp-selected-bot.json', selectedBotInfo);

        const manager = new AdvancedShardManager(path, {
            token: token,
            totalShards: 'auto',
            shardsPerCluster: 2,
            maxMemoryPerShard: 1024,
            execArgv: [],
            env: {
                ...process.env,
                SELECTED_BOT_INDEX: index.toString(),
                SELECTED_BOT_NAME: name,
                USING_SHARDING: 'true'
            }
        });

        manager.spawn();

        manager.on('shardCreate', shard => {
            debug(`Launched shard ${shard.id} for ${name}`);
        });

        /*manager.on('shardStatsUpdate', (shardId, stats) => {
            shard(`Shard ${shardId} stats updated.`);
        });*/
        
        process.on('exit', () => {
            try {
                if (fs.existsSync('./temp-selected-bot.json')) {
                    fs.unlinkSync('./temp-selected-bot.json');
                }
            } catch (err) {
            }
        });
    } catch (err) {
        error(`Error during shard initialization: ${err}`);
        process.exit(1);
    }
};

initializeShardManager().catch(err => {
    error(`Fatal error in shard manager: ${err}`);
    process.exit(1);
});

process.on('SIGINT', () => {
    try {
        const fs = require('fs');
        if (fs.existsSync('./temp-selected-bot.json')) {
            fs.unlinkSync('./temp-selected-bot.json');
        }
    } catch (err) {
    }
    process.exit(0);
});