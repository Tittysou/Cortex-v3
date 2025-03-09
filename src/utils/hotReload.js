const fs = require('fs');
const path = require('path');
const { REST } = require('discord.js');
const { Routes } = require('discord-api-types/v9');
const config = require('../../config.json');
const { warn, error, success, event, component, command, prefix } = require('./logs');

class HotReload {
    constructor(client) {
        this.client = client;
        this.debounce = {};
        this.client.components = new Map();
        this.client.commands = new Map();
        this.client.prefixCommands = new Map();
        this.root = path.join(__dirname, '..');
    }

    load(file, type) {
        try {
            delete require.cache[require.resolve(file)];
            const mod = require(file);
            const name = path.basename(file);
            
            if (!mod) return null;
            
            if (type === 'event' && mod.name && typeof mod.execute === 'function') {
                mod.once ? this.client.once(mod.name, (...args) => mod.execute(...args, this.client)) 
                         : this.client.on(mod.name, (...args) => mod.execute(...args, this.client));
                return mod.name;
            } else if (type === 'command' && mod.data && mod.data.name) {
                this.client.commands.set(mod.data.name, mod);
                return mod.data.name;
            } else if (type === 'prefix' && mod.name && typeof mod.execute === 'function') {
                mod.filename = name;
                this.client.prefixCommands.set(mod.name, mod);
                return mod.name;
            } else if (type === 'component' && mod.customId) {
                this.client.components.set(mod.customId, mod);
                return mod.customId;
            }
            
            warn(`Skipped invalid ${type}: ${name}`);
            return null;
        } catch (err) {
            error(`Failed to load ${type} ${path.basename(file)}: ${err}`);
            return null;
        }
    }

    watch(dir, type) {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        
        fs.readdirSync(dir).forEach(f => {
            const p = path.join(dir, f);
            if (fs.statSync(p).isDirectory()) return this.watch(p, type);
            if (f.endsWith('.js')) this.load(p, type);
        });
        
        fs.watch(dir, (_, f) => {
            if (!f || !f.endsWith('.js')) return;
            const p = path.join(dir, f);
            if (!fs.existsSync(p)) return;
            
            const now = Date.now();
            const key = `${p}`;
            if (this.debounce[key] && now - this.debounce[key] < 100) return;
            this.debounce[key] = now;
            
            const result = this.load(p, type);
            if (result) success(`${type.charAt(0).toUpperCase() + type.slice(1)} updated: ${result}`);
            
            if (type === 'command') this.updateCommands();
        });
    }

    updateCommands() {
        const selectedBotInfo = JSON.parse(fs.readFileSync('./temp-selected-bot.json', 'utf8'));
        const token = selectedBotInfo.token;
        if (!token) {
            console.error(`Token is not set for bot index ${selectedBotInfo.index}`);
            return;
        }
        new REST({ version: '10' }).setToken(token)
            .put(Routes.applicationCommands(config.botIds[selectedBotInfo.index]), { 
                body: Array.from(this.client.commands.values()).map(c => c.data.toJSON()) 
            })
            .catch(err => error(`Failed to update slash commands: ${err}`));
    }
    initialize() {
        this.watch(path.join(this.root, 'events'), 'event');
        this.watch(path.join(this.root, 'commands'), 'command');
        this.watch(path.join(this.root, 'prefix'), 'prefix');
        ['modals', 'menus', 'buttons'].forEach(dir => 
            this.watch(path.join(this.root, 'components', dir), 'component'));

        event(`Loaded ${this.client.eventNames().length} event(s)`);
        command(`Loaded ${this.client.commands.size} command(s)`);
        component(`Loaded ${this.client.components.size} component(s)`);
        prefix(`Loaded ${this.client.prefixCommands.size} prefix command(s)`);

        this.updateCommands();
        
        this.client.on('messageCreate', msg => {
            if (msg.author.bot || !config.prefix || !msg.content.startsWith(config.prefix)) return;
            
            const args = msg.content.slice(config.prefix.length).trim().split(/ +/);
            const cmdName = args.shift()?.toLowerCase();
            if (!cmdName) return;
            
            const cmd = this.client.prefixCommands.get(cmdName);
            if (!cmd) return;
            
            try {
                if (cmd.permissions) {
                    const missing = cmd.permissions.filter(p => !msg.member.permissions.has(p));
                    if (missing.length) return msg.reply({
                        content: `You need the following permissions: ${missing.join(', ')}`,
                        allowedMentions: { repliedUser: true }
                    });
                }
                cmd.execute(msg, args, this.client);
            } catch (err) {
                error(`Error executing prefix command ${cmdName}: ${err}`);
                msg.reply({ content: 'There was an error executing that command.' })
                    .catch(e => error('Failed to send error message:', e));
            }
        });
    }
}

module.exports = HotReload;