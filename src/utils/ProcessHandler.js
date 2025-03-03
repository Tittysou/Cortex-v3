const process = require('process');
const log = require('./logs');

const AntiCrash = () => {
    process.on('uncaughtException', (error) => {
        log('error', 'Uncaught Exception:', error);
    });

    process.on('unhandledRejection', (error) => {
        log('error', 'Unhandled Rejection:', error);
    });

    process.on('TypeError', (error) => {
        log('error', 'Type Error:', error);
    });

    process.on('SyntaxError', (error) => {
        log('error', 'Syntax Error:', error);
    });

    process.on('ReferenceError', (error) => {
        log('error', 'Reference Error:', error);
    });

    process.on('RangeError', (error) => {
        log('error', 'Range Error:', error);
    });

    process.on('Error', (error) => {
        log('error', 'Error:', error);
    });

    process.on('Warning', (error) => {
        log('warn', 'Warning:', error);
    });
};

module.exports = AntiCrash;