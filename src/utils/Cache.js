class Cache {
    constructor(ttl = 300000) { // default 5 minutes
        this.cache = new Map();
        this.ttl = ttl;
    }

    set(key, value, customTTL = this.ttl) {
        const expiry = Date.now() + customTTL;
        this.cache.set(key, { value, expiry });
        return this;
    }

    get(key) {
        const data = this.cache.get(key);
        if (!data) return null;
        
        if (Date.now() > data.expiry) {
            this.cache.delete(key);
            return null;
        }

        return data.value;
    }

    has(key) {
        return this.get(key) !== null;
    }

    delete(key) {
        return this.cache.delete(key);
    }

    clear() {
        this.cache.clear();
    }

    cleanup() {
        for (const [key, data] of this.cache.entries()) {
            if (Date.now() > data.expiry) {
                this.cache.delete(key);
            }
        }
    }

    size() {
        this.cleanup();
        return this.cache.size;
    }

    keys() {
        this.cleanup();
        return [...this.cache.keys()];
    }
}

module.exports = Cache;
