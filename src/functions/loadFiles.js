const { readdirSync, statSync } = require('fs');
const { join } = require('path');
const { debug } = require('../utils/logs');

function countFilesAndFolders(dir) {
    let counts = { files: 0, folders: 0 };
    
    const items = readdirSync(dir);
    
    for (const item of items) {
        const fullPath = join(dir, item);
        const stat = statSync(fullPath);
        
        if (stat.isDirectory()) {
            counts.folders++;
            const subCounts = countFilesAndFolders(fullPath);
            counts.files += subCounts.files;
            counts.folders += subCounts.folders;
        } else {
            counts.files++;
        }
    }
    
    return counts;
}

async function loadFiles(client) {
    const rootDir = join(__dirname, '../');
    const { files, folders } = countFilesAndFolders(rootDir);
    debug(`Loaded ${files} files and ${folders} folders.`);
}

module.exports = { loadFiles };
