class Validator {
    static isValidUrl(string) {
        try {
            new URL(string);
            return true;
        } catch (_) {
            return false;
        }
    }

    static isValidHex(hex) {
        return /^#[0-9A-F]{6}$/i.test(hex);
    }

    static isValidEmail(email) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    static isValidDiscordId(id) {
        return /^\d{17,19}$/.test(id);
    }

    static isValidImageUrl(url) {
        return /\.(jpg|jpeg|png|webp|avif|gif|svg)$/.test(url);
    }

    static isValidInviteCode(code) {
        return /^[a-zA-Z0-9-]{2,32}$/.test(code);
    }

    static isNullOrEmpty(value) {
        return value === null || value === undefined || value.toString().trim() === '';
    }

    static containsMarkdown(text) {
        return /[*_~`|]/.test(text);
    }
}

module.exports = Validator;
