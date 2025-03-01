const { readdirSync } = require('fs');
const { join } = require('path');
const { utils } = require('../utils/logs');

async function loadUtils(client) {
    const utilsPath = join(__dirname, '../utils');
    const utilFiles = readdirSync(utilsPath).filter(file => file.endsWith('.js'));

    utils(`Loaded ${utilFiles.length} utility function(s).`);
}

module.exports = { loadUtils };