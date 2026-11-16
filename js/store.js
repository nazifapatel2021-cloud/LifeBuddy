/* LifeBuddy Unified Reactive State Store & Persistence Engine
   - Single source of truth for: User, Budget, Tasks, Habits, Expenses, Focus Sessions, Daily Logs, Settings
   - Consistent local persistence with schema versioning & migration
   - Event subscription system so Today, Finances, Insights, Review Day, and Preferences stay 100% in sync
*/
import { formatCurrency } from './currency.js';
import { API } from './api.js';

const STORE_STORAGE_KEY = 'lifebuddy_store_v2';
const SCHEMA_VERSION = 2;

const DEFAULT_SETTINGS = {
  monthly_budget: 25000.0,
  currency_symbol: '₹',
  focus_duration: 25,
  short_break: 5,
  long_break: 15,
  long_break_interval: 4,
  daily_focus_goal: 100, // minutes
  theme: 'nordic',
  sound_volume: 0.5,
  sound_enabled: true,
  auto_start_breaks: false,
  auto_start_pomodoros: false
};

class Store {
  constructor() {
    this.subscribers = new Map();
    this.state = {
      version: SCHEMA_VERSION,
      user: null,
      settings: { ...DEFAULT_SETTINGS },
      tasks: [],
      habits: [],
      expenses: [],
      sessions: [],
      dailyLogs: [],
      activeTaskId: null,
      initialized: false
    };

    this.loadFromStorage();
  }

  // -------------------------------------------------------------
  // Event Subscription
  // -------------------------------------------------------------
  subscribe(eventOrCallback, maybeCallback) {
    let event = '*';
    let callback = eventOrCallback;
    if (typeof maybeCallback === 'function') {
      event = eventOrCallback;
      callback = maybeCallback;
    }
    if (typeof callback !== 'function') return () => {};

    if (!this.subscribers.has(event)) {
      this.subscribers.set(event, new Set());
    }
    this.subscribers.get(event).add(callback);
    return () => {
      const set = this.subscribers.get(event);
      if (set) set.delete(callback);
    };
  }

  notify(event, payload) {
    // Notify specific subscribers
    if (this.subscribers.has(event)) {
      this.subscribers.get(event).forEach(cb => {
        try { cb(payload, this.state, event); } catch (e) { console.warn('Store subscriber error', e); }
      });
    }
    // Notify wildcard subscribers for all state mutations
    if (this.subscribers.has('*')) {
      this.subscribers.get('*').forEach(cb => {
        try { cb(payload, this.state, event); } catch (e) { console.warn('Wildcard store subscriber error', e); }
      });
    }
  }

  // -------------------------------------------------------------
  // Storage & Migration
  // -------------------------------------------------------------
  loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          this.state = {
            ...this.state,
            ...parsed,
            settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) }
          };
          return;
        }
      }
    } catch (e) {
      console.warn('Could not read existing store from localStorage', e);
    }

    // Run Migration from Legacy Storage Keys
    this.migrateLegacyStorage();
    this.saveToStorage();
  }

  migrateLegacyStorage() {
    try {
      // 1. Settings
      const legacySettings = localStorage.getItem('zen_pomodoro_settings') || localStorage.getItem('lifebuddy_offline_settings');
      if (legacySettings) {
        try {
          const s = JSON.parse(legacySettings);
          this.state.settings = {
            ...this.state.settings,
            focus_duration: s.focusDuration || s.focus_duration || 25,
            short_break: s.shortBreakDuration || s.short_break || 5,
            long_break: s.longBreakDuration || s.long_break || 15,
            monthly_budget: parseFloat(s.monthly_budget || s.monthlyBudget || 25000),
            theme: s.theme || 'nordic',
            sound_volume: s.soundVolume !== undefined ? s.soundVolume : 0.5,
            sound_enabled: s.soundEnabled !== undefined ? s.soundEnabled : true
          };
        } catch {}
      }

      // 2. Tasks
      const legacyTasks = localStorage.getItem('lifebuddy_offline_tasks') || localStorage.getItem('zen_pomodoro_tasks');
      if (legacyTasks) {
        try {
          const t = JSON.parse(legacyTasks);
          if (Array.isArray(t) && t.length > 0) this.state.tasks = t;
        } catch {}
      }

      // 3. Habits
      const legacyHabits = localStorage.getItem('lifebuddy_offline_habits');
      if (legacyHabits) {
        try {
          const h = JSON.parse(legacyHabits);
          if (Array.isArray(h) && h.length > 0) this.state.habits = h;
        } catch {}
      }

      // 4. Expenses
      const legacyExpenses = localStorage.getItem('lifebuddy_offline_expenses');
      if (legacyExpenses) {
        try {
          const exp = JSON.parse(legacyExpenses);
          if (Array.isArray(exp) && exp.length > 0) this.state.expenses = exp;
        } catch {}
      }

      // 5. Focus Sessions
      const legacySessions = localStorage.getItem('lifebuddy_offline_sessions');
      if (legacySessions) {
        try {
          const s = JSON.parse(legacySessions);
          if (Array.isArray(s) && s.length > 0) this.state.sessions = s;
        } catch {}
      }

      // 6. Daily Logs
      const legacyLogs = localStorage.getItem('lifebuddy_offline_daily_logs');
      if (legacyLogs) {
        try {
          const l = JSON.parse(legacyLogs);
          if (Array.isArray(l) && l.length > 0) this.state.dailyLogs = l;
        } catch {}
      }

      // 7. Active Task
      this.state.activeTaskId = localStorage.getItem('lifebuddy_active_task_id') || localStorage.getItem('zen_pomodoro_active_task') || null;
    } catch (e) {
      console.warn('Legacy migration notice:', e);
    }
  }

  saveToStorage() {
    try {
      localStorage.setItem(STORE_STORAGE_KEY, JSON.stringify({
        version: SCHEMA_VERSION,
        user: this.state.user,
        settings: this.state.settings,
        tasks: this.state.tasks,
        habits: this.state.habits,
        expenses: this.state.expenses,
        sessions: this.state.sessions,
        dailyLogs: this.state.dailyLogs,
        activeTaskId: this.state.activeTaskId
      }));
    } catch (e) {
      console.error('Failed to persist store state to localStorage:', e);
    }
  }

  // -------------------------------------------------------------
  // Data Selectors (Guaranteed Single Source of Truth)
  // -------------------------------------------------------------
  getUser() {
    return this.state.user || API.getUser();
  }

  getDisplayName() {
    const user = this.getUser();
    if (!user) return 'Friend';
    if (user.full_name && user.full_name.trim()) {
      return user.full_name.trim().split(/\s+/)[0];
    }
    if (user.username) {
      // If username looks like email (contains @), derive human name from first part
      const base = user.username.includes('@') ? user.username.split('@')[0] : user.username;
      const clean = base.replace(/[._0-9]/g, ' ').trim();
      return clean.length > 0 ? (clean.split(/\s+/)[0].charAt(0).toUpperCase() + clean.split(/\s+/)[0].slice(1)) : 'Friend';
    }
    return 'Friend';
  }

  getSettings() {
    return this.state.settings;
  }

  getBudget() {
    const b = Number(this.state.settings.monthly_budget);
    return isNaN(b) || b <= 0 ? 25000.0 : b;
  }

  getDailyFocusGoal() {
    const g = Number(this.state.settings.daily_focus_goal);
    return isNaN(g) || g <= 0 ? 100 : g;
  }

  getTodayDateString() {
    return new Date().toISOString().split('T')[0];
  }

  getCurrentMonthPrefix() {
    return new Date().toISOString().slice(0, 7);
  }

  // Financial Selectors
  getExpenses(monthFilter = null) {
    if (!monthFilter) return this.state.expenses;
    return this.state.expenses.filter(e => (e.date || '').startsWith(monthFilter));
  }

  getTodayExpense() {
    const today = this.getTodayDateString();
    return this.state.expenses
      .filter(e => e.type !== 'income' && (e.date || '').startsWith(today))
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }

  getMonthExpense(monthPrefix = null) {
    const prefix = monthPrefix || this.getCurrentMonthPrefix();
    return this.state.expenses
      .filter(e => e.type !== 'income' && (e.date || '').startsWith(prefix))
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }

  getMonthIncome(monthPrefix = null) {
    const prefix = monthPrefix || this.getCurrentMonthPrefix();
    return this.state.expenses
      .filter(e => e.type === 'income' && (e.date || '').startsWith(prefix))
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }

  getRemainingBudget(monthPrefix = null) {
    return Math.max(0, this.getBudget() - this.getMonthExpense(monthPrefix));
  }

  getDailyBudgetAllowance() {
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    return this.getBudget() / daysInMonth;
  }

  // Task Selectors
  getTasks() {
    return this.state.tasks;
  }

  getPendingTasks() {
    return this.state.tasks.filter(t => !t.completed);
  }

  getCompletedTasks() {
    return this.state.tasks.filter(t => Boolean(t.completed));
  }

  getActiveTask() {
    if (!this.state.activeTaskId) return null;
    return this.state.tasks.find(t => t.id === this.state.activeTaskId) || null;
  }

  // Habit Selectors
  getHabits() {
    return this.state.habits;
  }

  getHabitsDoneToday() {
    const today = this.getTodayDateString();
    return this.state.habits.filter(h => {
      let hist = h.history || [];
      if (typeof hist === 'string') {
        try { hist = JSON.parse(hist); } catch { hist = []; }
      }
      return Array.isArray(hist) && hist.includes(today);
    }).length;
  }

  // Focus Session Selectors
  getSessions() {
    return this.state.sessions;
  }

  getTodayFocusMinutes() {
    const today = this.getTodayDateString();
    return this.state.sessions
      .filter(s => s.mode === 'focus' && (s.completed_at || '').startsWith(today))
      .reduce((sum, s) => sum + (Number(s.duration_minutes) || 25), 0);
  }

  getTodayFocusSessionsCount() {
    const today = this.getTodayDateString();
    return this.state.sessions
      .filter(s => s.mode === 'focus' && (s.completed_at || '').startsWith(today))
      .length;
  }

  // Daily Log Selectors
  getDailyLogs() {
    return this.state.dailyLogs;
  }

  getTodayLog() {
    const today = this.getTodayDateString();
    return this.state.dailyLogs.find(l => l.date === today) || null;
  }

  // Streak & Milestone Summary
  getStreakDays() {
    const habits = this.state.habits;
    if (habits.length === 0) return 0;
    return Math.max(0, ...habits.map(h => Number(h.streak) || 0));
  }

  // -------------------------------------------------------------
  // Mutations & Actions (Reactive & Persistent)
  // -------------------------------------------------------------
  setUser(user) {
    this.state.user = user;
    this.saveToStorage();
    this.notify('user', user);
  }

  getPlannedIncome() {
    return Number(this.state.settings?.monthly_income) || 45000.0;
  }

  async setMonthlyIncome(newIncome) {
    const val = Math.max(0, Number(newIncome) || 0);
    this.state.settings.monthly_income = val;
    this.saveToStorage();
    this.notify('income', val);
    this.notify('settings', this.state.settings);

    if (API.isLoggedIn()) {
      try {
        await API.auth.updateSettings({
          ...this.state.settings,
          monthly_income: val
        });
      } catch (e) {
        console.warn('Failed to sync monthly income to backend:', e);
      }
    }
  }

  async setMonthlyBudget(newBudget) {
    const val = Math.max(100, Number(newBudget) || 25000.0);
    this.state.settings.monthly_budget = val;
    this.saveToStorage();
    this.notify('budget', val);
    this.notify('settings', this.state.settings);

    // Sync with backend if logged in
    if (API.isLoggedIn()) {
      try {
        await API.auth.updateSettings({
          ...this.state.settings,
          monthly_budget: val
        });
      } catch (e) {
        console.warn('Failed to sync budget to backend:', e);
      }
    }
  }

  async setDailyFocusGoal(minutes) {
    const val = Math.max(10, Math.min(720, Number(minutes) || 100));
    this.state.settings.daily_focus_goal = val;
    this.saveToStorage();
    this.notify('settings', this.state.settings);
    this.notify('focus-goal', val);

    if (API.isLoggedIn()) {
      try {
        await API.auth.updateSettings(this.state.settings);
      } catch {}
    }
  }

  async updateSettings(partial) {
    this.state.settings = { ...this.state.settings, ...partial };
    this.saveToStorage();
    this.notify('settings', this.state.settings);

    if (API.isLoggedIn()) {
      try {
        await API.auth.updateSettings(this.state.settings);
      } catch (e) {
        console.warn('Failed to update settings in backend', e);
      }
    }
  }

  // Tasks
  setTasks(tasks) {
    this.state.tasks = Array.isArray(tasks) ? tasks : [];
    this.saveToStorage();
    this.notify('tasks', this.state.tasks);
  }

  async addTask(taskData) {
    let created = null;
    try {
      created = await API.tasks.create(taskData);
    } catch (e) {
      console.warn('API task create failed, using local offline object', e);
      created = {
        id: 'local_task_' + Date.now(),
        title: taskData.title,
        category: taskData.category || 'work',
        priority: taskData.priority || 'medium',
        estimated_pomodoros: taskData.estimated_pomodoros || 1,
        completed_pomodoros: 0,
        completed: 0,
        due_date: taskData.due_date || null,
        in_focus_queue: taskData.in_focus_queue !== false,
        created_at: new Date().toISOString()
      };
    }
    const existingIdx = this.state.tasks.findIndex(t => t.id === created.id);
    if (existingIdx !== -1) {
      this.state.tasks[existingIdx] = created;
    } else {
      this.state.tasks.unshift(created);
    }
    if (!this.state.activeTaskId) {
      this.setActiveTaskId(created.id);
    }
    this.saveToStorage();
    this.notify('tasks', this.state.tasks);
    return created;
  }

  async createTask(taskData) {
    return this.addTask(taskData);
  }

  async updateTask(id, updates) {
    let updated = null;
    try {
      updated = await API.tasks.update(id, updates);
    } catch (e) {
      console.warn('API task update failed, updating locally', e);
    }
    const idx = this.state.tasks.findIndex(t => t.id === id);
    if (idx !== -1) {
      this.state.tasks[idx] = { ...this.state.tasks[idx], ...(updated || updates) };
      this.saveToStorage();
      this.notify('tasks', this.state.tasks);
    }
    return this.state.tasks[idx];
  }

  async deleteTask(id) {
    try {
      await API.tasks.delete(id);
    } catch (e) {
      console.warn('API task delete failed, deleting locally', e);
    }
    this.state.tasks = this.state.tasks.filter(t => t.id !== id);
    if (this.state.activeTaskId === id) {
      const nextPending = this.state.tasks.find(t => !t.completed);
      this.setActiveTaskId(nextPending ? nextPending.id : null);
    }
    this.saveToStorage();
    this.notify('tasks', this.state.tasks);
  }

  setActiveTaskId(id) {
    this.state.activeTaskId = id || null;
    this.saveToStorage();
    this.notify('active-task', this.getActiveTask());
  }

  // Habits
  setHabits(habits) {
    this.state.habits = Array.isArray(habits) ? habits : [];
    this.saveToStorage();
    this.notify('habits', this.state.habits);
  }

  async addHabit(habitData) {
    let created = null;
    try {
      created = await API.habits.create(habitData);
    } catch (e) {
      console.warn('API habit create failed, using local offline object', e);
      created = {
        id: 'local_habit_' + Date.now(),
        title: habitData.title,
        icon: habitData.icon || '🌱',
        frequency: habitData.frequency || 'daily',
        streak: 0,
        history: [],
        created_at: new Date().toISOString()
      };
    }
    this.state.habits.push(created);
    this.saveToStorage();
    this.notify('habits', this.state.habits);
    return created;
  }

  async createHabit(habitData) {
    return this.addHabit(habitData);
  }

  async updateHabit(id, updates) {
    let updated = null;
    try {
      updated = await API.habits.update(id, updates);
    } catch (e) {
      console.warn('API habit update failed, updating locally', e);
    }
    const idx = this.state.habits.findIndex(h => h.id === id);
    if (idx !== -1) {
      this.state.habits[idx] = { ...this.state.habits[idx], ...(updated || updates) };
      this.saveToStorage();
      this.notify('habits', this.state.habits);
    }
    return this.state.habits[idx];
  }

  async checkInHabit(id, dateStr = null) {
    const date = dateStr || this.getTodayDateString();
    let updated = null;
    try {
      updated = await API.habits.checkIn(id, date);
    } catch (e) {
      console.warn('API habit check failed, checking locally', e);
    }
    const idx = this.state.habits.findIndex(h => h.id === id);
    if (idx !== -1) {
      if (updated) {
        this.state.habits[idx] = updated;
      } else {
        const h = this.state.habits[idx];
        let hist = Array.isArray(h.history) ? [...h.history] : [];
        if (hist.includes(date)) {
          hist = hist.filter(d => d !== date);
          h.streak = Math.max(0, (h.streak || 1) - 1);
        } else {
          hist.push(date);
          h.streak = (h.streak || 0) + 1;
        }
        h.history = hist;
        this.state.habits[idx] = h;
      }
      this.saveToStorage();
      this.notify('habits', this.state.habits);
    }
    return this.state.habits[idx];
  }

  async checkHabit(id, dateStr = null) {
    return this.checkInHabit(id, dateStr);
  }

  async deleteHabit(id) {
    try {
      await API.habits.delete(id);
    } catch (e) {
      console.warn('API habit delete failed, deleting locally', e);
    }
    this.state.habits = this.state.habits.filter(h => h.id !== id);
    this.saveToStorage();
    this.notify('habits', this.state.habits);
  }

  // Expenses
  setExpenses(expenses) {
    this.state.expenses = Array.isArray(expenses) ? expenses : [];
    this.saveToStorage();
    this.notify('expenses', this.state.expenses);
    this.notify('finances', {
      today: this.getTodayExpense(),
      month: this.getMonthExpense(),
      budget: this.getBudget()
    });
  }

  async addExpense(expenseData) {
    let created = null;
    try {
      created = await API.expenses.create(expenseData);
    } catch (e) {
      console.warn('API expense create failed, using local offline object', e);
      created = {
        id: 'local_exp_' + Date.now(),
        amount: Number(expenseData.amount) || 0,
        category: expenseData.category || 'Other',
        note: expenseData.note || '',
        date: expenseData.date || this.getTodayDateString(),
        type: expenseData.type || 'expense',
        created_at: new Date().toISOString()
      };
    }
    this.state.expenses.unshift(created);
    this.saveToStorage();
    this.notify('expenses', this.state.expenses);
    this.notify('finances', {
      today: this.getTodayExpense(),
      month: this.getMonthExpense(),
      budget: this.getBudget()
    });
    return created;
  }

  async createExpense(expenseData) {
    return this.addExpense(expenseData);
  }

  async updateExpense(id, updates) {
    let updated = null;
    try {
      if (API.isLoggedIn()) {
        updated = await API.request(`/api/expenses/${id}`, {
          method: 'PUT',
          body: JSON.stringify(updates)
        });
      }
    } catch (e) {
      console.warn('Offline update for expense:', e);
    }

    const idx = this.state.expenses.findIndex(e => e.id === id);
    if (idx !== -1) {
      this.state.expenses[idx] = { ...this.state.expenses[idx], ...(updated || updates) };
      this.saveToStorage();
      this.notify('expenses', this.state.expenses);
      this.notify('finances', {
        today: this.getTodayExpense(),
        month: this.getMonthExpense(),
        budget: this.getBudget()
      });
    }
    return this.state.expenses[idx];
  }

  async deleteExpense(id) {
    await API.expenses.delete(id);
    this.state.expenses = this.state.expenses.filter(e => e.id !== id);
    this.saveToStorage();
    this.notify('expenses', this.state.expenses);
    this.notify('finances', {
      today: this.getTodayExpense(),
      month: this.getMonthExpense(),
      budget: this.getBudget()
    });
  }

  // Focus Sessions
  setSessions(sessions) {
    this.state.sessions = Array.isArray(sessions) ? sessions : [];
    this.saveToStorage();
    this.notify('sessions', this.state.sessions);
  }

  async recordFocusSession(sessionData) {
    const created = await API.focus.recordSession(sessionData);
    this.state.sessions.unshift(created);
    this.saveToStorage();
    this.notify('sessions', this.state.sessions);
    this.notify('focus', {
      today_minutes: this.getTodayFocusMinutes(),
      today_sessions: this.getTodayFocusSessionsCount()
    });
    return created;
  }

  // Daily Logs
  setDailyLogs(logs) {
    this.state.dailyLogs = Array.isArray(logs) ? logs : [];
    this.saveToStorage();
    this.notify('dailyLogs', this.state.dailyLogs);
  }

  async saveDailyLog(logData) {
    const saved = await API.wellness.saveLog(logData);
    const date = logData.date || this.getTodayDateString();
    const idx = this.state.dailyLogs.findIndex(l => l.date === date);
    if (idx !== -1) {
      this.state.dailyLogs[idx] = saved;
    } else {
      this.state.dailyLogs.unshift(saved);
    }
    this.saveToStorage();
    this.notify('dailyLogs', this.state.dailyLogs);
    this.notify('todayLog', saved);
    return saved;
  }

  // -------------------------------------------------------------
  // Full Synchronization from Server
  // -------------------------------------------------------------
  async syncAll() {
    if (!API.isLoggedIn()) return;

    try {
      const [userResp, tasks, habits, expenses, sessions, dailyLogs] = await Promise.all([
        API.auth.getMe().catch(() => null),
        API.tasks.getAll().catch(() => []),
        API.habits.getAll().catch(() => []),
        API.expenses.getAll().catch(() => []),
        API.focus.getAll().catch(() => []),
        API.wellness.getLogs().catch(() => [])
      ]);

      if (userResp && userResp.user) {
        this.state.user = userResp.user;
        if (userResp.settings) {
          this.state.settings = { ...this.state.settings, ...userResp.settings };
        }
      }

      this.state.tasks = tasks;
      this.state.habits = habits;
      this.state.expenses = expenses;
      this.state.sessions = sessions;
      this.state.dailyLogs = dailyLogs;

      if (!this.getActiveTask() && tasks.length > 0) {
        const first = tasks.find(t => !t.completed);
        if (first) this.state.activeTaskId = first.id;
      }

      this.saveToStorage();
      this.notify('*', 'sync-complete');
    } catch (err) {
      console.warn('Store full sync warning:', err);
    }
  }
}

export const store = new Store();
