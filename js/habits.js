/* LifeBuddy Habits & Daily Routines Manager */
import { API } from './api.js';
import { store } from './store.js';
import { getLocalDateString } from './date_utils.js';

const CHIP_CATEGORIES = [
  {
    icon: '💧',
    keywords: ['water', 'hydration', '2l', 'drink']
  },
  {
    icon: '📖',
    keywords: ['read', 'book', 'pages', 'reading']
  },
  {
    icon: '🧘',
    keywords: ['meditat', 'mindful', 'meditation']
  },
  {
    icon: '🏃',
    keywords: ['workout', 'exercise', 'gym', 'run', 'morning exercise']
  },
  {
    icon: '✍️',
    keywords: ['reflect', 'journal', 'gratitude', 'diary', 'reflection']
  }
];

export class HabitManager {
  constructor(options = {}) {
    this.onChanged = options.onChanged || (() => {});
    this._eventsBound = false;

    // Bind composer and chip events immediately upon instantiation
    this.bindComposerEvents();

    // Subscribe to store updates
    store.subscribe(() => {
      this.onChanged(store.state.habits || []);
      const container = document.getElementById('habits-list-container');
      if (container) this.renderHabitsList(container);
      this.updateQuickAddChips();
    });
  }

  async init() {
    this.bindComposerEvents();
    this.updateQuickAddChips();
    this.onChanged(store.state.habits || []);
  }

  notifyToast(msg) {
    if (typeof window !== 'undefined' && typeof window.showToast === 'function') {
      window.showToast(msg);
      return;
    }
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>✨</span> <span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  doesHabitMatchChip(habit, chipTitle, chipIcon) {
    if (!habit || !habit.title) return false;
    const cleanHabit = this.cleanHabitTitle(habit.title, habit.icon).toLowerCase().trim();
    const cleanChip = this.cleanHabitTitle(chipTitle, chipIcon).toLowerCase().trim();

    const normHabit = cleanHabit.replace(/[^a-z0-9]/g, '');
    const normChip = cleanChip.replace(/[^a-z0-9]/g, '');

    // Exact or direct substring match
    if (normHabit === normChip) return true;
    if (normHabit && normChip && (normHabit.includes(normChip) || normChip.includes(normHabit))) {
      return true;
    }

    // Category & keyword matching
    for (const cat of CHIP_CATEGORIES) {
      const chipBelongs = (chipIcon === cat.icon) || cat.keywords.some(kw => cleanChip.includes(kw));
      if (chipBelongs) {
        const habitBelongs = (habit.icon === cat.icon) || cat.keywords.some(kw => cleanHabit.includes(kw));
        if (habitBelongs) return true;
      }
    }

    return false;
  }

  updateQuickAddChips(habits = null) {
    const activeHabits = habits || store.state.habits || [];
    const chipsRow = document.querySelector('.habit-quick-chips-row');
    const chips = document.querySelectorAll('.habit-chip-btn');
    if (!chips.length) return;

    let visibleChipsCount = 0;

    chips.forEach(chip => {
      const chipTitle = chip.dataset.title || chip.textContent || '';
      const chipIcon = chip.dataset.icon || '';

      const isAlreadyAdded = activeHabits.some(habit => this.doesHabitMatchChip(habit, chipTitle, chipIcon));

      if (isAlreadyAdded) {
        chip.style.display = 'none';
      } else {
        chip.style.display = 'inline-flex';
        visibleChipsCount++;
      }
    });

    if (chipsRow) {
      chipsRow.style.display = visibleChipsCount > 0 ? 'flex' : 'none';
    }
  }

  isDuplicateHabit(newTitle, newIcon = '', habitList = null) {
    const habits = habitList || store.state.habits || [];
    if (!habits.length || !newTitle) return false;

    const cleanNew = this.cleanHabitTitle(newTitle, newIcon).toLowerCase().trim();
    const normNew = cleanNew.replace(/[^a-z0-9]/g, '');
    if (!normNew) return false;

    return habits.some(existing => {
      const cleanExisting = this.cleanHabitTitle(existing.title, existing.icon).toLowerCase().trim();
      const normExisting = cleanExisting.replace(/[^a-z0-9]/g, '');
      if (!normExisting) return false;

      // 1. Exact normalized title match (e.g. "Drink 2L Water" vs "drink 2l water")
      if (normExisting === normNew) return true;

      // 2. Inclusion of core phrase
      if ((normExisting.includes(normNew) || normNew.includes(normExisting)) && (normNew.length >= 4 || normExisting.length >= 4)) {
        if (existing.icon && newIcon && existing.icon === newIcon) return true;
        const keywords = ['water', 'hydration', '2l', 'read', 'meditat', 'workout', 'exercise', 'reflect', 'journal'];
        if (keywords.some(kw => cleanExisting.includes(kw) && cleanNew.includes(kw))) {
          return true;
        }
      }

      // 3. Category matching (same routine concept)
      for (const cat of CHIP_CATEGORIES) {
        const existingBelongs = (existing.icon === cat.icon) || cat.keywords.some(kw => cleanExisting.includes(kw));
        const newBelongs = (newIcon === cat.icon) || cat.keywords.some(kw => cleanNew.includes(kw));
        if (existingBelongs && newBelongs) {
          return true;
        }
      }

      return false;
    });
  }

  bindComposerEvents() {
    if (this._eventsBound) return;
    const form = document.getElementById('habit-form');
    const chips = document.querySelectorAll('.habit-chip-btn');
    if (!form && !chips.length) return;
    this._eventsBound = true;

    // Quick-start suggestion chips: 1-click Quick Add
    chips.forEach(chip => {
      chip.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const title = chip.dataset.title;
        const icon = chip.dataset.icon || '🌱';

        await this.addHabit({ title, icon, frequency: 'daily' });
      });
    });

    if (form) {
      const titleInput = document.getElementById('habit-title-input');
      const iconSelect = document.getElementById('habit-icon-select');
      const freqSelect = document.getElementById('habit-freq-select');

      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        e.stopPropagation();
        const title = titleInput?.value.trim() || '';
        const icon = iconSelect?.value || '🌱';
        const frequency = freqSelect?.value || 'daily';

        if (title) {
          const created = await this.addHabit({ title, icon, frequency });
          if (created) {
            form.reset();
          }
        }
      });
    }
  }

  getHabits() {
    return store.state.habits || [];
  }

  async addHabit({ title, icon = '🌱', frequency = 'daily' }) {
    if (!title || !title.trim()) return null;

    if (this.isDuplicateHabit(title, icon)) {
      this.notifyToast('⚠️ Habit already exists in your active routines!');
      return null;
    }

    const created = await store.createHabit({
      title: title.trim(),
      icon: icon || '🌱',
      frequency: frequency || 'daily',
      target: 1
    });

    if (created) {
      this.notifyToast(`🌱 Habit added: ${this.cleanHabitTitle(title, icon)}`);
      this.updateQuickAddChips();
    }

    return created;
  }

  async toggleCheck(id) {
    const today = getLocalDateString();
    await store.checkHabit(id, today);
  }

  async incrementTargetCount(habit) {
    const today = getLocalDateString();
    const currentHistory = Array.isArray(habit.history) ? [...habit.history] : [];
    // Record an additional timestamp entry or check
    currentHistory.push(today);
    await store.updateHabit(habit.id, {
      history: currentHistory,
      today_progress: (habit.today_progress || 0) + 1
    });
  }

  async deleteHabit(id) {
    if (confirm('Delete this habit routine and its streak history?')) {
      await store.deleteHabit(id);
      this.notifyToast('Habit routine removed');
      this.updateQuickAddChips();
    }
  }

  formatFrequency(freq) {
    if (!freq) return 'Daily';
    const map = {
      'daily': 'Daily',
      'weekdays': 'Weekdays',
      'weekends': 'Weekends',
      'thrice_weekly': 'Thrice a Week',
      'thrice a week': 'Thrice a Week',
      'twice_weekly': 'Twice a Week',
      'twice a week': 'Twice a Week',
      'weekly': 'Once a Week',
      'once a week': 'Once a Week'
    };
    const key = String(freq).toLowerCase().trim();
    return map[key] || key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  async editHabit(habit) {
    const newTitle = prompt('Edit Habit Title:', habit.title);
    if (newTitle === null) return;
    const trimmed = newTitle.trim();
    if (!trimmed) return;

    // Check if new title duplicates another existing habit
    const otherHabits = (store.state.habits || []).filter(h => h.id !== habit.id);
    if (this.isDuplicateHabit(trimmed, habit.icon, otherHabits)) {
      this.notifyToast('⚠️ Another habit with this routine already exists!');
      return;
    }

    const freqInput = prompt('Frequency (daily, weekdays, weekends, thrice_weekly, twice_weekly, weekly):', habit.frequency || 'daily');
    let updatedFreq = habit.frequency || 'daily';
    if (freqInput !== null && freqInput.trim()) {
      const normalized = freqInput.trim().toLowerCase().replace(/\s+/g, '_');
      const valid = ['daily', 'weekdays', 'weekends', 'thrice_weekly', 'twice_weekly', 'weekly'];
      const aliasMap = {
        'weekend': 'weekends',
        'thrice': 'thrice_weekly',
        'thrice_a_week': 'thrice_weekly',
        '3x': 'thrice_weekly',
        'twice': 'twice_weekly',
        'twice_a_week': 'twice_weekly',
        '2x': 'twice_weekly',
        'once_a_week': 'weekly',
        'once': 'weekly'
      };
      updatedFreq = aliasMap[normalized] || (valid.includes(normalized) ? normalized : updatedFreq);
    }

    await store.updateHabit(habit.id, {
      title: trimmed,
      frequency: updatedFreq
    });
    this.updateQuickAddChips();
  }

  cleanHabitTitle(title, icon) {
    if (!title) return '';
    let clean = title.trim();
    if (icon && clean.startsWith(icon)) {
      clean = clean.slice(icon.length).trim();
    }
    clean = clean.replace(/^[\p{Extended_Pictographic}\u200d\ufe0f]+\s*/u, '');
    return clean || title;
  }

  isDoneToday(habit) {
    const today = getLocalDateString();
    return Array.isArray(habit.history) && habit.history.some(d => String(d).slice(0, 10) === today);
  }

  calculateStreaks(history) {
    if (!Array.isArray(history) || history.length === 0) {
      return { streak: 0, bestStreak: 0 };
    }
    const uniqueDates = [...new Set(history.map(d => String(d).slice(0, 10)))].sort();
    if (uniqueDates.length === 0) return { streak: 0, bestStreak: 0 };

    let bestStreak = 0;
    let currRun = 0;
    let prevDate = null;

    for (const dStr of uniqueDates) {
      const parts = dStr.split('-').map(Number);
      if (parts.length !== 3) continue;
      const d = new Date(parts[0], parts[1] - 1, parts[2]);
      if (prevDate) {
        const diffDays = Math.round((d.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
        if (diffDays === 1) {
          currRun++;
        } else {
          currRun = 1;
        }
      } else {
        currRun = 1;
      }
      prevDate = d;
      if (currRun > bestStreak) bestStreak = currRun;
    }

    const todayStr = getLocalDateString(new Date());
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = getLocalDateString(yesterday);

    let streak = 0;
    const dateSet = new Set(uniqueDates);

    if (dateSet.has(todayStr)) {
      let cur = new Date();
      while (dateSet.has(getLocalDateString(cur))) {
        streak++;
        cur.setDate(cur.getDate() - 1);
      }
    } else if (dateSet.has(yesterdayStr)) {
      let cur = new Date();
      cur.setDate(cur.getDate() - 1);
      while (dateSet.has(getLocalDateString(cur))) {
        streak++;
        cur.setDate(cur.getDate() - 1);
      }
    }

    return {
      streak,
      bestStreak: Math.max(bestStreak, streak)
    };
  }

  renderHabitsList(container) {
    if (!container) return;
    container.innerHTML = '';

    const habits = store.state.habits || [];

    if (habits.length === 0) {
      this.updateQuickAddChips(habits);
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🌱</div>
          <p>No habits added yet. Build consistent daily routines one day at a time!</p>
        </div>
      `;
      return;
    }

    habits.forEach(habit => {
      const doneToday = this.isDoneToday(habit);
      const history = Array.isArray(habit.history) ? habit.history : [];
      const computed = this.calculateStreaks(history);
      const streak = computed.streak;
      const bestStreak = Math.max(habit.best_streak || 0, computed.bestStreak);

      // Render 7-day mini consistency dots (Last 7 days ending today)
      const last7Days = [];
      const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = getLocalDateString(d);
        const isDone = history.some(h => String(h).slice(0, 10) === dateStr);
        last7Days.push({
          date: dateStr,
          dayLetter: dayNames[d.getDay()],
          isDone,
          isToday: i === 0
        });
      }

      const stripHtml = last7Days.map(day => `
        <div class="habit-day-dot ${day.isDone ? 'done' : 'missed'} ${day.isToday ? 'is-today' : ''}" title="${day.date}: ${day.isDone ? 'Completed' : 'Not completed'}">
          <span class="day-dot-label">${day.dayLetter}</span>
          <span class="day-dot-circle">${day.isDone ? '✓' : ''}</span>
        </div>
      `).join('');

      const el = document.createElement('div');
      el.className = `habit-card-expanded glass-pill ${doneToday ? 'habit-completed' : ''}`;
      el.innerHTML = `
        <div class="habit-main-row">
          <div class="habit-left">
            <button class="habit-check-btn ${doneToday ? 'checked' : ''}" data-id="${habit.id}" title="${doneToday ? 'Completed today! Click to toggle' : 'Mark done for today'}">
              ${doneToday ? '✓' : ''}
            </button>
            <span class="habit-icon">${habit.icon || '🌱'}</span>
            <div class="habit-info">
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                <span class="habit-title">${this.escapeHtml(this.cleanHabitTitle(habit.title, habit.icon))}</span>
                <span class="badge badge-subtle" style="font-size: 0.72rem;">${this.formatFrequency(habit.frequency)}</span>
              </div>
              <div class="habit-stats-row" style="margin-top: 4px; display: flex; align-items: center; gap: 10px;">
                <span class="habit-streak-badge">🔥 <strong>${streak}</strong> day streak</span>
                <span class="habit-best-badge">🏆 Best: <strong>${bestStreak}</strong>d</span>
              </div>
            </div>
          </div>
          <div class="habit-actions" style="display: flex; align-items: center; gap: 6px;">
            <button class="btn-edit-habit btn-icon-small" title="Edit habit" data-id="${habit.id}">✏️</button>
            <button class="btn-delete-habit btn-icon-small" title="Delete habit" data-id="${habit.id}">✕</button>
          </div>
        </div>

        <!-- Past 7 Days Consistency Dots -->
        <div class="habit-strip-row" style="margin-top: 10px; display: flex; align-items: center; justify-content: flex-start; gap: 12px;">
          <span class="habit-strip-label" style="font-size: 0.75rem; color: var(--text-muted); font-weight: 600;">Past 7 days:</span>
          <div class="habit-strip-dots" style="display: flex; gap: 6px;">
            ${stripHtml}
          </div>
        </div>
      `;

      el.querySelector('.habit-check-btn')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.toggleCheck(habit.id);
      });

      el.querySelector('.btn-edit-habit')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.editHabit(habit);
      });

      el.querySelector('.btn-delete-habit')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.deleteHabit(habit.id);
      });

      container.appendChild(el);
    });

    this.updateQuickAddChips(habits);
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
