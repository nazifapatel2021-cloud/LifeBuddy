/* LifeBuddy Habits & Daily Routines Manager */
import { API } from './api.js';

export class HabitManager {
  constructor(options = {}) {
    this.habits = [];
    this.onChanged = options.onChanged || (() => {});
  }

  async init() {
    await this.loadHabits();
  }

  async loadHabits() {
    try {
      this.habits = await API.habits.getAll();
      this.onChanged(this.habits);
    } catch (e) {
      console.error('Failed to load habits', e);
    }
  }

  async addHabit({ title, icon, frequency = 'daily' }) {
    const created = await API.habits.create({ title, icon, frequency });
    await this.loadHabits();
    return created;
  }

  async toggleCheck(id) {
    const today = new Date().toISOString().split('T')[0];
    await API.habits.check(id, today);
    await this.loadHabits();
  }

  async deleteHabit(id) {
    await API.habits.delete(id);
    await this.loadHabits();
  }

  isDoneToday(habit) {
    const today = new Date().toISOString().split('T')[0];
    return Array.isArray(habit.history) && habit.history.includes(today);
  }

  renderHabitsList(container) {
    if (!container) return;
    container.innerHTML = '';

    if (this.habits.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🌱</div>
          <p>No habits added yet. Build consistent daily routines one day at a time!</p>
        </div>
      `;
      return;
    }

    this.habits.forEach(habit => {
      const doneToday = this.isDoneToday(habit);
      const streak = habit.streak || 0;

      const el = document.createElement('div');
      el.className = `habit-item glass-pill ${doneToday ? 'habit-completed' : ''}`;
      el.innerHTML = `
        <div class="habit-left">
          <button class="habit-check-btn ${doneToday ? 'checked' : ''}" data-id="${habit.id}" title="${doneToday ? 'Completed today! Click to undo' : 'Mark done for today'}">
            ${doneToday ? '✓' : ''}
          </button>
          <span class="habit-icon">${habit.icon || '🌱'}</span>
          <div class="habit-info">
            <span class="habit-title">${habit.title}</span>
            <span class="habit-streak">🔥 ${streak} day streak</span>
          </div>
        </div>
        <div class="habit-actions">
          <button class="btn-delete-habit btn-icon-small" title="Delete habit" data-id="${habit.id}">✕</button>
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
}
