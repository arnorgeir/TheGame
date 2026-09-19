/**
 * ============================================================================
 * THE GAME - ENHANCED EDITION
 * Local Storage Manager & Persistence System
 * ============================================================================
 * Handles High Scores, Level Completion, Speedrun Best Times, Audio & Display Settings.
 * Automatically falls back to an in-memory store if localStorage is blocked or restricted.
 */

const STORAGE_PREFIX = 'thegame_enhanced_';

const DEFAULT_AUDIO_SETTINGS = {
    masterVolume: 0.8,
    sfxVolume: 0.85,
    musicVolume: 0.75,
    muted: false
};

const DEFAULT_DISPLAY_SETTINGS = {
    crtFilter: false,
    screenShake: true,
    showFps: false,
    virtualControls: 'auto' // 'auto' | 'always' | 'never'
};

export class StorageManager {
    constructor() {
        this.isLocalStorageAvailable = this._checkLocalStorage();
        this.memoryStore = new Map();
    }

    /**
     * Test whether localStorage is accessible in the current browser context.
     * @private
     * @returns {boolean}
     */
    _checkLocalStorage() {
        try {
            if (typeof window === 'undefined' || !window.localStorage) {
                return false;
            }
            const testKey = '__storage_test__';
            window.localStorage.setItem(testKey, testKey);
            window.localStorage.removeItem(testKey);
            return true;
        } catch (e) {
            console.warn('[Storage] LocalStorage is unavailable (Private mode or blocked). Using in-memory fallback.');
            return false;
        }
    }

    /**
     * Get item from storage.
     * @param {string} key
     * @param {*} [defaultValue=null]
     * @returns {*}
     */
    get(key, defaultValue = null) {
        const fullKey = STORAGE_PREFIX + key;
        try {
            if (this.isLocalStorageAvailable) {
                const item = window.localStorage.getItem(fullKey);
                if (item === null) return defaultValue;
                return JSON.parse(item);
            } else {
                if (!this.memoryStore.has(fullKey)) return defaultValue;
                return this.memoryStore.get(fullKey);
            }
        } catch (e) {
            console.error(`[Storage] Failed to read key '${key}':`, e);
            return defaultValue;
        }
    }

    /**
     * Save item to storage.
     * @param {string} key
     * @param {*} value
     * @returns {boolean} Success status
     */
    set(key, value) {
        const fullKey = STORAGE_PREFIX + key;
        try {
            if (this.isLocalStorageAvailable) {
                window.localStorage.setItem(fullKey, JSON.stringify(value));
            } else {
                this.memoryStore.set(fullKey, value);
            }
            return true;
        } catch (e) {
            console.error(`[Storage] Failed to save key '${key}':`, e);
            // Fallback to memory
            this.memoryStore.set(fullKey, value);
            return false;
        }
    }

    /**
     * Remove item from storage.
     * @param {string} key
     */
    remove(key) {
        const fullKey = STORAGE_PREFIX + key;
        try {
            if (this.isLocalStorageAvailable) {
                window.localStorage.removeItem(fullKey);
            }
            this.memoryStore.delete(fullKey);
        } catch (e) {
            console.error(`[Storage] Failed to remove key '${key}':`, e);
        }
    }

    // =========================================================================
    // HIGH SCORES & LEADERBOARDS
    // =========================================================================

    /**
     * Retrieve high score for a specific level or overall.
     * @param {string|number} [levelId='overall']
     * @returns {number}
     */
    getHighScore(levelId = 'overall') {
        const scores = this.get('high_scores', {});
        return scores[levelId] || 0;
    }

    /**
     * Save high score if it surpasses existing record.
     * @param {number} score
     * @param {string|number} [levelId='overall']
     * @returns {boolean} True if new high score was set
     */
    saveHighScore(score, levelId = 'overall') {
        const scores = this.get('high_scores', {});
        const currentHigh = scores[levelId] || 0;

        if (score > currentHigh) {
            scores[levelId] = score;
            this.set('high_scores', scores);
            this._appendLeaderboardEntry(levelId, score);
            return true;
        }
        return false;
    }

    /**
     * Get top leaderboard scores for a level.
     * @param {string|number} [levelId='overall']
     * @returns {Array<{score: number, date: string, name: string}>}
     */
    getLeaderboard(levelId = 'overall') {
        const boards = this.get('leaderboards', {});
        return boards[levelId] || [];
    }

    /**
     * Internal helper to record top 10 leaderboard entries.
     */
    _appendLeaderboardEntry(levelId, score, name = 'HERO') {
        const boards = this.get('leaderboards', {});
        const list = boards[levelId] || [];

        list.push({
            score,
            name,
            date: new Date().toLocaleDateString()
        });

        // Sort descending and keep top 10
        list.sort((a, b) => b.score - a.score);
        boards[levelId] = list.slice(0, 10);

        this.set('leaderboards', boards);
    }

    // =========================================================================
    // BEST TIME / SPEEDRUN RECORDS
    // =========================================================================

    /**
     * Get best speedrun completion time in milliseconds.
     * @param {string|number} levelId
     * @returns {number|null} Time in ms, or null if uncompleted
     */
    getBestTime(levelId) {
        const times = this.get('best_times', {});
        return times[levelId] ?? null;
    }

    /**
     * Save best time if it beats the current record.
     * @param {string|number} levelId
     * @param {number} timeMs
     * @returns {boolean} True if new record set
     */
    saveBestTime(levelId, timeMs) {
        if (typeof timeMs !== 'number' || timeMs <= 0) return false;

        const times = this.get('best_times', {});
        const currentBest = times[levelId];

        if (currentBest === undefined || currentBest === null || timeMs < currentBest) {
            times[levelId] = timeMs;
            this.set('best_times', times);
            return true;
        }
        return false;
    }

    // =========================================================================
    // LEVEL PROGRESSION & UNLOCKS
    // =========================================================================

    /**
     * Check if a level has been completed.
     * @param {string|number} levelId
     * @returns {boolean}
     */
    hasCompletedLevel(levelId) {
        const completed = this.get('completed_levels', []);
        return completed.includes(levelId);
    }

    /**
     * Mark a level as completed and unlock next level.
     * @param {string|number} levelId
     */
    setCompletedLevel(levelId) {
        const completed = this.get('completed_levels', []);
        if (!completed.includes(levelId)) {
            completed.push(levelId);
            this.set('completed_levels', completed);
        }
    }

    // =========================================================================
    // AUDIO SETTINGS
    // =========================================================================

    /**
     * Get audio configuration.
     * @returns {{masterVolume: number, sfxVolume: number, musicVolume: number, muted: boolean}}
     */
    getAudioSettings() {
        return {
            ...DEFAULT_AUDIO_SETTINGS,
            ...(this.get('audio_settings', {}) || {})
        };
    }

    /**
     * Save audio configuration.
     * @param {Object} settings
     */
    saveAudioSettings(settings) {
        const current = this.getAudioSettings();
        const updated = { ...current, ...settings };
        this.set('audio_settings', updated);
        return updated;
    }

    // =========================================================================
    // DISPLAY & ACCESSIBILITY SETTINGS
    // =========================================================================

    /**
     * Get display & rendering settings.
     * @returns {Object}
     */
    getDisplaySettings() {
        return {
            ...DEFAULT_DISPLAY_SETTINGS,
            ...(this.get('display_settings', {}) || {})
        };
    }

    /**
     * Save display & rendering settings.
     * @param {Object} settings
     */
    saveDisplaySettings(settings) {
        const current = this.getDisplaySettings();
        const updated = { ...current, ...settings };
        this.set('display_settings', updated);
        return updated;
    }

    // =========================================================================
    // GENERAL SETTINGS & RESET
    // =========================================================================

    getSetting(key, defaultValue = null) {
        return this.get(`setting_${key}`, defaultValue);
    }

    saveSetting(key, value) {
        return this.set(`setting_${key}`, value);
    }

    /**
     * Clear all saved data for The Game.
     */
    clearAll() {
        if (this.isLocalStorageAvailable) {
            try {
                const keysToRemove = [];
                for (let i = 0; i < window.localStorage.length; i++) {
                    const key = window.localStorage.key(i);
                    if (key && key.startsWith(STORAGE_PREFIX)) {
                        keysToRemove.push(key);
                    }
                }
                keysToRemove.forEach(k => window.localStorage.removeItem(k));
            } catch (e) {
                console.error('[Storage] Error clearing localStorage:', e);
            }
        }
        this.memoryStore.clear();
    }
}

// Export singleton instance
export const storage = new StorageManager();
