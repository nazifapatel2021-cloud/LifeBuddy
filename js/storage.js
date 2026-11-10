/* Storage Manager for LocalStorage */
const STORAGE_KEYS = {
  SETTINGS: 'zen_pomodoro_settings',
  TASKS: 'zen_pomodoro_tasks',
  STATS: 'zen_pomodoro_stats',
  ACTIVE_TASK: 'zen_pomodoro_active_task'
};

const DEFAULT_SETTINGS = {
  focusDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  longBreakInterval: 4,
  autoStartBreaks: false,
  autoStartPomodoros: false,
  theme: 'sage',
  soundVolume: 0.5
};

const DEFAULT_STATS = {
  totalMinutes: 0,
  completedPomodoros: 0,
  currentStreak: 0,
  lastCompletedDate: null,
  dailyHistory: {} // Format: { "YYYY-MM-DD": minutes }
};

export const Storage = {
  getSettings() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
    } catch (e) {
      return DEFAULT_SETTINGS;
    }
  },

  saveSettings(settings) {
    try {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    } catch (e) {
      console.error('Failed to save settings to localStorage:', e);
    }
  },

  getTasks() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.TASKS);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      return [];
    }
  },

  saveTasks(tasks) {
    try {
      localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(tasks));
    } catch (e) {
      console.error('Failed to save tasks to localStorage:', e);
    }
  },

  getActiveTaskId() {
    return localStorage.getItem(STORAGE_KEYS.ACTIVE_TASK) || null;
  },

  setActiveTaskId(id) {
    if (id) {
      localStorage.setItem(STORAGE_KEYS.ACTIVE_TASK, id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.ACTIVE_TASK);
    }
  },

  getStats() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.STATS);
      return data ? { ...DEFAULT_STATS, ...JSON.parse(data) } : DEFAULT_STATS;
    } catch (e) {
      return DEFAULT_STATS;
    }
  },

  saveStats(stats) {
    try {
      localStorage.setItem(STORAGE_KEYS.STATS, JSON.stringify(stats));
    } catch (e) {
      console.error('Failed to save stats to localStorage:', e);
    }
  },

  recordCompletedSession(durationMinutes) {
    const stats = this.getStats();
    const today = new Date().toISOString().split('T')[0];

    stats.totalMinutes += durationMinutes;
    stats.completedPomodoros += 1;

    // Daily History update
    stats.dailyHistory[today] = (stats.dailyHistory[today] || 0) + durationMinutes;

    // Streak Calculation
    if (stats.lastCompletedDate) {
      const lastDate = new Date(stats.lastCompletedDate);
      const currentDate = new Date(today);
      const diffTime = Math.abs(currentDate - lastDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        stats.currentStreak += 1;
      } else if (diffDays > 1) {
        stats.currentStreak = 1;
      }
    } else {
      stats.currentStreak = 1;
    }

    stats.lastCompletedDate = today;
    this.saveStats(stats);
    return stats;
  }
};
