/* LifeBuddy Habits & Daily Routines Manager */
import { API } from './api.js';
import { store } from './store.js';

export class HabitManager {
  constructor(options = {}) {
    this.onChanged = options.onChanged || (() => {});

    // Subscribe to store updates
    store.subscribe(() => {
      this.onChanged(store.state.habits || []);
      const container = document.getElementById('habits-list-container');
      if (container) this.renderHabitsList(container);
    });
  }

  async init() {
    await store.fetchState();
    this.onChanged(store.state.habits || []);
  }

  getHabits() {
    return store.state.habits || [];
  }

  async addHabit({ title, icon = '🌱', frequency = 'daily', target = 1 }) {
    if (!title || !title.trim()) return;
    const created = await store.createHabit({
      title: title.trim(),
      icon: icon || '🌱',
      frequency: frequency || 'daily',
      target: parseInt(target, 10) || 1
    });
    return created;
  }

  async toggleCheck(id) {
    const today = new Date().toISOString().split('T')[0];
    await store.checkHabit(id, today);
  }

  async deleteHabit(id) {
    if (confirm('Delete this habit routine and its streak history?')) {
      await store.deleteHabit(id);
    }
  }

  isDoneToday(habit) {
    const today = new Date().toISOString().split('T')[0];
    return Array.isArray(habit.history) && habit.history.includes(today);
  }

  renderHabitsList(container) {
    if (!container) return;
    container.innerHTML = '';

    const habits = store.state.habits || [];

    if (habits.length === 0) {
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
      const streak = habit.streak || 0;
      const bestStreak = habit.best_streak || streak;
      const history = habit.history || [];

      // Render 7-day mini consistency dots
      const last7Days = [];
      const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const isDone = history.includes(dateStr);
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
            <button class="habit-check-btn ${doneToday ? 'checked' : ''}" data-id="${habit.id}" title="${doneToday ? 'Completed today! Click to undo' : 'Mark done for today'}">
              ${doneToday ? '✓' : ''}
            </button>
            <span class="habit-icon">${habit.icon || '🌱'}</span>
            <div class="habit-info">
              <span class="habit-title">${this.escapeHtml(habit.title)}</span>
              <div class="habit-stats-row">
                <span class="habit-streak-badge">🔥 <strong>${streak}</strong> day streak</span>
                <span class="habit-best-badge">🏆 Best: ${bestStreak}d</span>
                <span class="badge badge-subtle">${habit.frequency || 'daily'}</span>
              </div>
            </div>
          </div>
          <div class="habit-actions">
            <button class="btn-delete-habit btn-icon-small" title="Delete habit" data-id="${habit.id}">✕</button>
          </div>
        </div>

        <!-- 7-Day Consistency Micro-Strip -->
        <div class="habit-strip-row">
          <span class="habit-strip-label">7-Day Consistency:</span>
          <div class="habit-strip-dots">
            ${stripHtml}
          </div>
        </div>
      `;

      el.querySelector('.habit-check-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.toggleCheck(habit.id);
      });

      el.querySelector('.btn-delete-habit').addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.deleteHabit(habit.id);
      });

      container.appendChild(el);
    });
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
