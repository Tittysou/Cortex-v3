const fs = require('fs');
const path = require('path');
const { REST } = require('discord.js');
const { Routes } = require('discord-api-types/v9');
const config = require('../../config.json');
const { info, warn, error, success, event, component, command, prefix } = require('./logs');

class HotReload {
    constructor(client) {
        this.client = client;
        this.debounceMap = new Map();
        this.paths = {
            events: path.join(__dirname, '../events'),
            commands: path.join(__dirname, '../commands'),
            prefix: path.join(__dirname, '../prefix'),
            components: [
                path.join(__dirname, '../components/modals'),
                path.join(__dirname, '../components/menus'),
                path.join(__dirname, '../components/buttons')
            ]
        };
        
        this.client.components = new Map();
        this.client.commands = new Map();
        this.client.prefixCommands = new Map();
        this.updateQueue = new Set();
        this.isUpdating = false;
    }

    debounce(key, callback, delay = 100) {
        const now = Date.now();
        if (this.debounceMap.has(key) && now - this.debounceMap.get(key) < delay) return;
        this.debounceMap.set(key, now);
        callback();
    }

    getAllFiles(dirPath, arrayOfFiles) {
        const files = fs.readdirSync(dirPath);
        arrayOfFiles = arrayOfFiles || [];

        files.forEach(file => {
            const filePath = path.join(dirPath, file);
            if (fs.statSync(filePath).isDirectory()) {
                arrayOfFiles = this.getAllFiles(filePath, arrayOfFiles);
            } else if (file.endsWith('.js')) {
                arrayOfFiles.push(filePath);
            }
        });

        return arrayOfFiles;
    }

    loadEvent(filename) {
        try {
            delete require.cache[require.resolve(path.join(this.paths.events, filename))];
            const event = require(path.join(this.paths.events, filename));

            if (event && event.name && typeof event.execute === 'function') {
                if (event.once) {
                    this.client.once(event.name, (...args) => event.execute(...args, this.client));
                } else {
                    this.client.on(event.name, (...args) => event.execute(...args, this.client));
                }
                return event.name;
            }
            warn(`Skipped invalid event: ${filename}`);
            return null;
        } catch (err) {
            error(`Failed to load event ${filename}: ${err}`);
            return null;
        }
    }

    async updateSlashCommands() {
        const rest = new REST({ version: '10' }).setToken(config.token);
        try {
            await rest.put(
                Routes.applicationCommands(config.id),
                { body: Array.from(this.client.commands.values()).map(cmd => cmd.data.toJSON()) }
            );
        } catch (err) {
            error(`Failed to update slash commands: ${err}`);
        }
    }

    async batchUpdateCommands() {
        if (this.isUpdating || this.updateQueue.size === 0) return;
        
        this.isUpdating = true;
        try {
            await this.updateSlashCommands();
            this.updateQueue.clear();
        } catch (err) {
            error(`Failed to batch update commands: ${err}`);
        } finally {
            this.isUpdating = false;
            if (this.updateQueue.size > 0) {
                setTimeout(() => this.batchUpdateCommands(), 100);
            }
        }
    }

    async loadCommand(filename, silent = false) {
        try {
            delete require.cache[require.resolve(path.join(this.paths.commands, filename))];
            const command = require(path.join(this.paths.commands, filename));

            if (command && command.data && command.data.name) {
                this.client.commands.set(command.data.name, command);
                this.updateQueue.add(command.data.name);
                if (!silent) success(`Command loaded: ${command.data.name}`);
                return command.data.toJSON();
            }
            warn(`Skipped invalid command: ${filename}`);
            return null;
        } catch (err) {
            error(`Failed to load command ${filename}: ${err}`);
            return null;
        }
    }

    loadComponent(directory, filename) {
        try {
            delete require.cache[require.resolve(path.join(directory, filename))];
            const component = require(path.join(directory, filename));

            if (component && component.customId) {
                this.client.components.set(component.customId, component);
                return true;
            }
            warn(`Skipped invalid component: ${filename}`);
            return false;
        } catch (err) {
            error(`Failed to load component ${filename}: ${err}`);
            return false;
        }
    }

    loadPrefixCommand(filename) {
        try {
            delete require.cache[require.resolve(path.join(this.paths.prefix, filename))];
            const command = require(path.join(this.paths.prefix, filename));

            if (command && command.name && typeof command.execute === 'function') {
                command.filename = filename;
                this.client.prefixCommands.set(command.name, command);
                return command;
            }
            warn(`Skipped invalid prefix command: ${filename}`);
            return null;
        } catch (err) {
            error(`Failed to load prefix command ${filename}: ${err}`);
            return null;
        }
    }

    initializeWatchers() {
        fs.watch(this.paths.events, (eventType, filename) => {
            if (!filename.endsWith('.js')) return;
            this.debounce(`event-${filename}`, () => {
                const eventName = this.loadEvent(filename);
                if (eventName) success(`Event updated: ${eventName}`);
            });
        });

        fs.watch(this.paths.commands, (eventType, filename) => {
            if (!filename.endsWith('.js')) return;
            this.debounce(`command-${filename}`, () => {
                this.loadCommand(filename);
            });
        });

        this.paths.components.forEach(directory => {
            if (!fs.existsSync(directory)) {
                fs.mkdirSync(directory, { recursive: true });
            }
            fs.watch(directory, (eventType, filename) => {
                if (!filename.endsWith('.js')) return;
                this.debounce(`component-${filename}`, () => {
                    if (this.loadComponent(directory, filename)) {
                        success(`Component updated: ${filename}`);
                    }
                });
            });
        });

        if (!fs.existsSync(this.paths.prefix)) {
            fs.mkdirSync(this.paths.prefix, { recursive: true });
        }
        fs.watch(this.paths.prefix, (eventType, filename) => {
            if (!filename.endsWith('.js')) return;
            this.debounce(`prefix-${filename}`, () => {
                const command = this.loadPrefixCommand(filename);
                if (command) success(`Prefix command updated: ${command.name}`);
            });
        });
    }

    initialize() {
        fs.readdirSync(this.paths.events).filter(f => f.endsWith('.js')).forEach(f => this.loadEvent(f));
        fs.readdirSync(this.paths.commands).filter(f => f.endsWith('.js')).forEach(f => this.loadCommand(f, true));
        this.paths.components.forEach(dir => {
            if (fs.existsSync(dir)) {
                fs.readdirSync(dir).filter(f => f.endsWith('.js')).forEach(f => this.loadComponent(dir, f));
            }
        });
        if (fs.existsSync(this.paths.prefix)) {
            fs.readdirSync(this.paths.prefix).filter(f => f.endsWith('.js')).forEach(f => this.loadPrefixCommand(f));
        }

        this.initializeWatchers();

        event(`Loaded ${this.client.eventNames().length} event(s)`);
        command(`Loaded ${this.client.commands.size} command(s)`);
        component(`Loaded ${this.client.components.size} component(s)`);
        prefix(`Loaded ${this.client.prefixCommands.size} prefix command(s)`);

        this.updateSlashCommands();
        this.setupPrefixCommandHandler();
    }

    setupPrefixCommandHandler() {
        this.client.on('messageCreate', async (message) => {
            if (message.author.bot) return;
            
            const { prefix: commandPrefix } = config;
            if (!commandPrefix || !message.content.startsWith(commandPrefix)) return;

            const args = message.content.slice(commandPrefix.length).trim().split(/ +/);
            const commandName = args.shift()?.toLowerCase();
            if (!commandName) return;

            const command = this.client.prefixCommands.get(commandName);
            if (!command) return;

            try {
                if (command.permissions) {
                    const missingPerms = command.permissions.filter(perm => !message.member.permissions.has(perm));
                    if (missingPerms.length) {
                        return message.reply({
                            content: `You need the following permissions: ${missingPerms.join(', ')}`,
                            allowedMentions: { repliedUser: true }
                        });
                    }
                }
                await command.execute(message, args, this.client);
            } catch (err) {
                error(`Error executing prefix command ${commandName}: ${err}`);
                message.reply({ content: 'There was an error executing that command.' })
                    .catch(err => error('Failed to send error message:', err));
            }
        });
    }
}

module.exports = HotReload;
