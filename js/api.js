/* LifeBuddy API Client & Storage Bridge */

const TOKEN_KEY = 'lifebuddy_token';
const USER_KEY = 'lifebuddy_user';
const OFFLINE_TASKS_KEY = 'lifebuddy_offline_tasks';
const OFFLINE_HABITS_KEY = 'lifebuddy_offline_habits';
const OFFLINE_EXPENSES_KEY = 'lifebuddy_offline_expenses';
const OFFLINE_SESSIONS_KEY = 'lifebuddy_offline_sessions';
const OFFLINE_SETTINGS_KEY = 'lifebuddy_offline_settings';

export const API = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  setAuth(token, user) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);

    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
    else localStorage.removeItem(USER_KEY);
  },

  getUser() {
    try {
      const u = localStorage.getItem(USER_KEY);
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  },

  isLoggedIn() {
    return !!this.getToken();
  },

  async request(endpoint, options = {}) {
    const token = this.getToken();
    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };

    try {
      const res = await fetch(endpoint, {
        ...options,
        headers
      });

      if (res.status === 401) {
        // Token expired or invalid
        this.setAuth(null, null);
        window.dispatchEvent(new CustomEvent('auth-changed', { detail: { user: null } }));
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(errorData.detail || 'API request failed');
      }

      return await res.json();
    } catch (err) {
      // Re-throw so caller can fallback to local offline mode if desired
      throw err;
    }
  },

  // Auth
  auth: {
    async register(username, email, password) {
      const data = await API.request('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password })
      });
      API.setAuth(data.token, data.user);
      return data;
    },

    async login(username_or_email, password) {
      const data = await API.request('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username_or_email, password })
      });
      API.setAuth(data.token, data.user);
      return data;
    },

    async getMe() {
      if (!API.getToken()) return null;
      try {
        return await API.request('/api/auth/me');
      } catch {
        return null;
      }
    },

    async updateSettings(settings) {
      if (API.isLoggedIn()) {
        return await API.request('/api/auth/settings', {
          method: 'PUT',
          body: JSON.stringify(settings)
        });
      } else {
        localStorage.setItem(OFFLINE_SETTINGS_KEY, JSON.stringify(settings));
        return { settings };
      }
    },

    logout() {
      API.setAuth(null, null);
      window.dispatchEvent(new CustomEvent('auth-changed', { detail: { user: null } }));
    }
  },

  // Tasks
  tasks: {
    async getAll() {
      if (API.isLoggedIn()) {
        try {
          return await API.request('/api/tasks');
        } catch (e) {
          console.warn('Backend unavailable, reading local tasks', e);
        }
      }
      return JSON.parse(localStorage.getItem(OFFLINE_TASKS_KEY) || '[]');
    },

    async create(task) {
      const newTask = {
        id: 'task_' + Date.now(),
        title: task.title,
        category: task.category || 'work',
        priority: task.priority || 'medium',
        estimated_pomodoros: task.estimated_pomodoros || 1,
        completed_pomodoros: 0,
        completed: 0,
        due_date: task.due_date || null,
        created_at: new Date().toISOString()
      };

      if (API.isLoggedIn()) {
        try {
          return await API.request('/api/tasks', {
            method: 'POST',
            body: JSON.stringify(newTask)
          });
        } catch (e) {
          console.warn('Backend offline, saving task locally', e);
        }
      }

      const tasks = JSON.parse(localStorage.getItem(OFFLINE_TASKS_KEY) || '[]');
      tasks.unshift(newTask);
      localStorage.setItem(OFFLINE_TASKS_KEY, JSON.stringify(tasks));
      return newTask;
    },

    async update(id, updates) {
      if (API.isLoggedIn()) {
        try {
          return await API.request(`/api/tasks/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
          });
        } catch (e) {
          console.warn('Backend offline, updating task locally', e);
        }
      }

      const tasks = JSON.parse(localStorage.getItem(OFFLINE_TASKS_KEY) || '[]');
      const index = tasks.findIndex(t => t.id === id);
      if (index !== -1) {
        tasks[index] = { ...tasks[index], ...updates };
        if (updates.completed !== undefined) {
          tasks[index].completed = updates.completed ? 1 : 0;
        }
        localStorage.setItem(OFFLINE_TASKS_KEY, JSON.stringify(tasks));
        return tasks[index];
      }
      return null;
    },

    async delete(id) {
      if (API.isLoggedIn()) {
        try {
          return await API.request(`/api/tasks/${id}`, { method: 'DELETE' });
        } catch (e) {
          console.warn('Backend offline, deleting task locally', e);
        }
      }

      let tasks = JSON.parse(localStorage.getItem(OFFLINE_TASKS_KEY) || '[]');
      tasks = tasks.filter(t => t.id !== id);
      localStorage.setItem(OFFLINE_TASKS_KEY, JSON.stringify(tasks));
      return { status: 'deleted', id };
    }
  },

  // Habits
  habits: {
    async getAll() {
      if (API.isLoggedIn()) {
        try {
          return await API.request('/api/habits');
        } catch (e) {
          console.warn('Backend offline, reading habits locally', e);
        }
      }
      const data = JSON.parse(localStorage.getItem(OFFLINE_HABITS_KEY) || '[]');
      return data.length ? data : [
        { id: 'h1', title: 'Drink 2L Water', icon: '💧', frequency: 'daily', streak: 3, history: [new Date().toISOString().split('T')[0]] },
        { id: 'h2', title: 'Mindful Reading (15m)', icon: '📖', frequency: 'daily', streak: 5, history: [] },
        { id: 'h3', title: 'Daily Walk / Exercise', icon: '🏃', frequency: 'daily', streak: 2, history: [] }
      ];
    },

    async create(habit) {
      const newHabit = {
        id: 'habit_' + Date.now(),
        title: habit.title,
        icon: habit.icon || '🌱',
        frequency: habit.frequency || 'daily',
        streak: 0,
        history: [],
        created_at: new Date().toISOString()
      };

      if (API.isLoggedIn()) {
        try {
          return await API.request('/api/habits', {
            method: 'POST',
            body: JSON.stringify(newHabit)
          });
        } catch (e) {
          console.warn('Backend offline, creating habit locally', e);
        }
      }

      const habits = await this.getAll();
      habits.push(newHabit);
      localStorage.setItem(OFFLINE_HABITS_KEY, JSON.stringify(habits));
      return newHabit;
    },

    async check(id, dateStr) {
      if (API.isLoggedIn()) {
        try {
          return await API.request(`/api/habits/${id}/check`, {
            method: 'POST',
            body: JSON.stringify({ date: dateStr })
          });
        } catch (e) {
          console.warn('Backend offline, checking habit locally', e);
        }
      }

      const habits = await this.getAll();
      const habit = habits.find(h => h.id === id);
      if (habit) {
        if (!habit.history) habit.history = [];
        if (habit.history.includes(dateStr)) {
          habit.history = habit.history.filter(d => d !== dateStr);
          if (habit.streak > 0) habit.streak -= 1;
        } else {
          habit.history.push(dateStr);
          habit.streak = (habit.streak || 0) + 1;
        }
        localStorage.setItem(OFFLINE_HABITS_KEY, JSON.stringify(habits));
        return habit;
      }
      return null;
    },

    async delete(id) {
      if (API.isLoggedIn()) {
        try {
          return await API.request(`/api/habits/${id}`, { method: 'DELETE' });
        } catch (e) {
          console.warn('Backend offline, deleting habit locally', e);
        }
      }

      let habits = await this.getAll();
      habits = habits.filter(h => h.id !== id);
      localStorage.setItem(OFFLINE_HABITS_KEY, JSON.stringify(habits));
      return { status: 'deleted', id };
    }
  },

  // Expenses
  expenses: {
    async getAll() {
      if (API.isLoggedIn()) {
        try {
          return await API.request('/api/expenses');
        } catch (e) {
          console.warn('Backend offline, reading expenses locally', e);
        }
      }
      return JSON.parse(localStorage.getItem(OFFLINE_EXPENSES_KEY) || '[]');
    },

    async create(expense) {
      const newExp = {
        id: 'exp_' + Date.now(),
        type: expense.type || 'expense',
        amount: parseFloat(expense.amount),
        category: expense.category,
        note: expense.note || '',
        date: expense.date || new Date().toISOString().split('T')[0],
        created_at: new Date().toISOString()
      };

      if (API.isLoggedIn()) {
        try {
          return await API.request('/api/expenses', {
            method: 'POST',
            body: JSON.stringify(newExp)
          });
        } catch (e) {
          console.warn('Backend offline, saving expense locally', e);
        }
      }

      const expenses = JSON.parse(localStorage.getItem(OFFLINE_EXPENSES_KEY) || '[]');
      expenses.unshift(newExp);
      localStorage.setItem(OFFLINE_EXPENSES_KEY, JSON.stringify(expenses));
      return newExp;
    },

    async delete(id) {
      if (API.isLoggedIn()) {
        try {
          return await API.request(`/api/expenses/${id}`, { method: 'DELETE' });
        } catch (e) {
          console.warn('Backend offline, deleting expense locally', e);
        }
      }

      let expenses = JSON.parse(localStorage.getItem(OFFLINE_EXPENSES_KEY) || '[]');
      expenses = expenses.filter(e => e.id !== id);
      localStorage.setItem(OFFLINE_EXPENSES_KEY, JSON.stringify(expenses));
      return { status: 'deleted', id };
    }
  },

  // Focus Sessions
  focus: {
    async recordSession(session) {
      const newSession = {
        id: 'session_' + Date.now(),
        task_id: session.task_id || null,
        mode: session.mode,
        duration_minutes: session.duration_minutes,
        completed_at: new Date().toISOString()
      };

      if (API.isLoggedIn()) {
        try {
          return await API.request('/api/focus-sessions', {
            method: 'POST',
            body: JSON.stringify(newSession)
          });
        } catch (e) {
          console.warn('Backend offline, recording session locally', e);
        }
      }

      const sessions = JSON.parse(localStorage.getItem(OFFLINE_SESSIONS_KEY) || '[]');
      sessions.unshift(newSession);
      localStorage.setItem(OFFLINE_SESSIONS_KEY, JSON.stringify(sessions));
      return newSession;
    },

    async getAll() {
      if (API.isLoggedIn()) {
        try {
          return await API.request('/api/focus-sessions');
        } catch (e) {
          console.warn('Backend offline, reading focus sessions locally', e);
        }
      }
      return JSON.parse(localStorage.getItem(OFFLINE_SESSIONS_KEY) || '[]');
    }
  },

  // Dashboard Overview
  dashboard: {
    async getSummary() {
      if (API.isLoggedIn()) {
        try {
          return await API.request('/api/dashboard');
        } catch (e) {
          console.warn('Backend offline, synthesizing local dashboard summary', e);
        }
      }

      const today = new Date().toISOString().split('T')[0];
      const monthPrefix = today.slice(0, 7);

      const tasks = JSON.parse(localStorage.getItem(OFFLINE_TASKS_KEY) || '[]');
      const expenses = JSON.parse(localStorage.getItem(OFFLINE_EXPENSES_KEY) || '[]');
      const sessions = JSON.parse(localStorage.getItem(OFFLINE_SESSIONS_KEY) || '[]');
      const habits = JSON.parse(localStorage.getItem(OFFLINE_HABITS_KEY) || '[]');

      const todayFocusMins = sessions
        .filter(s => s.mode === 'focus' && s.completed_at.startsWith(today))
        .reduce((sum, s) => sum + (s.duration_minutes || 0), 0);

      const todayExpenses = expenses
        .filter(e => e.type === 'expense' && e.date === today)
        .reduce((sum, e) => sum + (e.amount || 0), 0);

      const monthExpenses = expenses
        .filter(e => e.type === 'expense' && e.date.startsWith(monthPrefix))
        .reduce((sum, e) => sum + (e.amount || 0), 0);

      const habitsDone = habits.filter(h => (h.history || []).includes(today)).length;

      return {
        date: today,
        focus: {
          today_minutes: todayFocusMins,
          today_sessions: sessions.filter(s => s.mode === 'focus' && s.completed_at.startsWith(today)).length
        },
        tasks: {
          total: tasks.length,
          completed: tasks.filter(t => t.completed).length,
          top_pending: tasks.filter(t => !t.completed).slice(0, 5)
        },
        finances: {
          today_expense: todayExpenses,
          month_expense: monthExpenses,
          month_income: 0,
          monthly_budget: 1000.0,
          currency_symbol: '$'
        },
        habits: {
          total: habits.length,
          done_today: habitsDone
        }
      };
    }
  }
};
