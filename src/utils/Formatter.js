class Formatter {
    static timestamp(date = new Date(), format = 'R') {
        return `<t:${Math.floor(date.getTime() / 1000)}:${format}>`;
    }

    static numberWithCommas(x) {
        return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }

    static truncate(str, length = 100) {
        return str.length > length ? str.substring(0, length - 3) + '...' : str;
    }

    static capitalize(str) {
        return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
    }

    static formatBytes(bytes, decimals = 2) {
        if (bytes === 0) return '0 Bytes';
        
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
        const factor = 1024;
        const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(factor));
        const unit = i >= 0 && i < sizes.length ? sizes[i] : 'Bytes';
        return parseFloat((bytes / Math.pow(factor, i)).toFixed(decimals)) + ' ' + unit;
      }

    static formatDuration(ms) {
        const times = {
            d: Math.floor(ms / 86400000),
            h: Math.floor(ms / 3600000) % 24,
            m: Math.floor(ms / 60000) % 60,
            s: Math.floor(ms / 1000) % 60
        };
        return Object.entries(times)
            .filter(([_, v]) => v > 0)
            .map(([k, v]) => `${v}${k}`)
            .join(' ');
    }

    static progressBar(value, maxValue, size = 10) {
        const percentage = value / maxValue;
        const progress = Math.round(size * percentage);
        const emptyProgress = size - progress;
        const progressText = '▰'.repeat(progress);
        const emptyProgressText = '▱'.repeat(emptyProgress);
        return `${progressText}${emptyProgressText}`;
    }

    static cleanCode(text) {
        return text
            .replace(/`/g, '`' + String.fromCharCode(8203))
            .replace(/@/g, '@' + String.fromCharCode(8203));
    }
}

module.exports = Formatter;
