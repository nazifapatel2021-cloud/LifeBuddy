/* LifeBuddy Daily Reflection & Wellness Log Controller
   Allows users to check in daily: mood (1-5), sleep hours, today's achievements,
   and mindful reflection notes, plus review their 7-day history.
*/
import { API } from './api.js';
import { store } from './store.js';
import { formatCurrency } from './currency.js';

export class DailyLogController {
  constructor() {
    this.modal = document.getElementById('daily-log-modal');
    this.selectedMood = null;
  }

  init() {
    const triggerBtn = document.getElementById('daily-log-btn');
    const closeBtn = document.getElementById('close-daily-log-modal');

    if (triggerBtn) {
      triggerBtn.addEventListener('click', () => {
        this.open();
      });
    }

    if (closeBtn && this.modal) {
      closeBtn.addEventListener('click', () => {
        this.modal.classList.remove('active');
      });
    }
  }

  async open() {
    if (!API.isLoggedIn()) {
      alert('Please sign in to access your daily review and wellness log.');
      return;
    }
    if (!this.modal) return;
    this.modal.classList.add('active');
    await this.render();
  }

  async render() {
    const todayStr = new Date().toISOString().split('T')[0];
    const prettyDate = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });

    let logs = store.state.wellness_logs || [];
    try {
      logs = await API.wellness.getLogs();
      store.state.wellness_logs = logs;
    } catch (e) {
      console.warn('Could not load wellness logs from API, using store', e);
    }

    const todayLog = logs.find(l => l.date === todayStr);
    this.selectedMood = todayLog ? todayLog.mood : null; // None preselected if not logged today!

    const focusMins = store.getTodayFocusMinutes();
    const tasksDone = (store.state.tasks || []).filter(t => t.completed).length;
    const spentToday = store.getTodayExpense();
    const habitsDone = store.getHabitsDoneToday();

    const moodEmojis = [
      { level: 1, emoji: '😫', label: 'Drained' },
      { level: 2, emoji: '😕', label: 'Low' },
      { level: 3, emoji: '😐', label: 'Steady' },
      { level: 4, emoji: '😊', label: 'Focused' },
      { level: 5, emoji: '🤩', label: 'Thriving' }
    ];

    const container = document.getElementById('daily-log-modal-body');
    if (!container) return;

    container.innerHTML = `
      <div class="daily-log-header-info" style="margin-bottom: 20px;">
        <span class="badge badge-subtle">📅 ${prettyDate}</span>
        <h3 style="font-size: 1.25rem; font-weight: 700; margin-top: 6px; letter-spacing: -0.02em;">Daily Check-In & Mindful Review</h3>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 2px;">
          Take 60 seconds to review your energy, sleep, and today's achievements.
        </p>
      </div>

      <!-- Quick Metrics Recap of Today -->
      <div class="metrics-grid" style="grid-template-columns: repeat(4, 1fr); gap: 10px; margin-bottom: 20px;">
        <div class="glass-pill" style="text-align: center; padding: 10px 8px;">
          <div style="font-size: 0.75rem; color: var(--text-muted);">Deep Focus</div>
          <div style="font-weight: 700; font-size: 1rem; color: var(--text-main);">${focusMins}m</div>
        </div>
        <div class="glass-pill" style="text-align: center; padding: 10px 8px;">
          <div style="font-size: 0.75rem; color: var(--text-muted);">Tasks Done</div>
          <div style="font-weight: 700; font-size: 1rem; color: var(--text-main);">${tasksDone}</div>
        </div>
        <div class="glass-pill" style="text-align: center; padding: 10px 8px;">
          <div style="font-size: 0.75rem; color: var(--text-muted);">Spent Today</div>
          <div style="font-weight: 700; font-size: 1rem; color: var(--text-main);">${formatCurrency(spentToday)}</div>
        </div>
        <div class="glass-pill" style="text-align: center; padding: 10px 8px;">
          <div style="font-size: 0.75rem; color: var(--text-muted);">Habits Done</div>
          <div style="font-weight: 700; font-size: 1rem; color: var(--text-main);">${habitsDone}</div>
        </div>
      </div>

      <form id="daily-log-inner-form">
        <!-- Mood Selector -->
        <div class="form-group" style="margin-bottom: 18px;">
          <label class="form-label" style="font-weight: 600; margin-bottom: 8px;">
            How was your energy & mood today? ${this.selectedMood === null ? '<span style="color: var(--text-muted); font-weight: 400;">(Choose one)</span>' : ''}
          </label>
          <div class="mood-selector-group" style="display: flex; gap: 8px; justify-content: space-between;">
            ${moodEmojis.map(m => {
              const isSelected = this.selectedMood === m.level;
              return `
                <button 
                  type="button" 
                  class="mood-btn ${isSelected ? 'active' : ''}" 
                  data-level="${m.level}"
                  style="flex: 1; padding: 10px 6px; border-radius: 12px; border: 1px solid var(--border-color); background: ${isSelected ? 'var(--accent-soft)' : 'var(--bg-card)'}; cursor: pointer; text-align: center; transition: all 0.2s;"
                >
                  <div style="font-size: 1.5rem;">${m.emoji}</div>
                  <div style="font-size: 0.72rem; font-weight: 600; color: var(--text-main); margin-top: 4px;">${m.label}</div>
                </button>
              `;
            }).join('')}
          </div>
        </div>

        <!-- Sleep Hours Slider -->
        <div class="form-group" style="margin-bottom: 18px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <label class="form-label" style="font-weight: 600;">Sleep Duration Last Night</label>
            <span id="sleep-val-display" style="font-weight: 700; color: var(--accent-primary); font-size: 0.95rem;">
              ${todayLog && todayLog.sleep_hours !== undefined ? todayLog.sleep_hours : 7.5} hours
            </span>
          </div>
          <input 
            type="range" 
            id="log-sleep-range" 
            min="3.0" 
            max="12.0" 
            step="0.5" 
            value="${todayLog && todayLog.sleep_hours !== undefined ? todayLog.sleep_hours : 7.5}" 
            style="width: 100%; accent-color: var(--accent-primary);"
          >
        </div>

        <!-- Reflection Notes -->
        <div class="form-group" style="margin-bottom: 20px;">
          <label class="form-label" style="font-weight: 600; margin-bottom: 6px;">Mindful Reflection & Priorities</label>
          <textarea 
            id="log-notes-input" 
            class="input-field" 
            rows="3" 
            placeholder="What went well today? What will you prioritize tomorrow?"
            style="width: 100%; resize: vertical; font-size: 0.88rem;"
          >${todayLog ? (todayLog.notes || '') : ''}</textarea>
        </div>

        <button type="submit" id="save-daily-log-btn" class="btn-primary" style="width: 100%; padding: 12px; font-weight: 600; border-radius: 10px;">
          💾 Save Daily Check-In
        </button>
      </form>
    `;

    // Bind inner form events
    const moodBtns = container.querySelectorAll('.mood-btn');
    moodBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        this.selectedMood = parseInt(btn.dataset.level, 10);
        moodBtns.forEach(b => {
          b.classList.remove('active');
          b.style.background = 'var(--bg-card)';
        });
        btn.classList.add('active');
        btn.style.background = 'var(--accent-soft)';
      });
    });

    const sleepSlider = container.querySelector('#log-sleep-range');
    const sleepDisplay = container.querySelector('#sleep-val-display');
    if (sleepSlider && sleepDisplay) {
      sleepSlider.addEventListener('input', (e) => {
        sleepDisplay.textContent = `${parseFloat(e.target.value).toFixed(1)} hours`;
      });
    }

    const innerForm = container.querySelector('#daily-log-inner-form');
    if (innerForm) {
      innerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.handleSave();
      });
    }
  }

  renderRecentLogs(logs) {
    if (!logs || logs.length === 0) {
      return `
        <div class="empty-state-sm">
          <span>🌱</span> <span>No previous check-ins logged yet. Today is day 1!</span>
        </div>
      `;
    }

    const moodMap = { 1: '😫', 2: '😕', 3: '😐', 4: '😊', 5: '🤩' };

    return logs.map(l => {
      const dateLabel = new Date(l.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      return `
        <div class="glass-pill" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; margin-bottom: 8px;">
          <div>
            <span style="font-weight: 600; font-size: 0.88rem; color: var(--text-main);">${dateLabel}</span>
            <span style="margin-left: 8px;">${moodMap[l.mood] || '😐'}</span>
            <span style="font-size: 0.8rem; color: var(--text-muted); margin-left: 6px;">💤 ${l.sleep_hours}h sleep</span>
            ${l.notes ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px; font-style: italic;">"${l.notes}"</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  async handleSave() {
    if (!API.isLoggedIn()) {
      alert('Please sign in to save your daily check-in.');
      return;
    }
    const sleepVal = parseFloat(document.getElementById('log-sleep-range')?.value) || 7.5;
    const notesVal = document.getElementById('log-notes-input')?.value.trim() || '';
    const todayStr = new Date().toISOString().split('T')[0];

    const moodVal = this.selectedMood !== null ? this.selectedMood : 3;

    const saveBtn = document.getElementById('save-daily-log-btn');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'Saving...';
    }

    try {
      await store.saveDailyLog({
        date: todayStr,
        mood: moodVal,
        sleep_hours: sleepVal,
        notes: notesVal
      });

      if (this.modal) {
        this.modal.classList.remove('active');
      }

      // Show toast confirmation
      const toast = document.createElement('div');
      toast.className = 'toast';
      toast.innerHTML = `<span>✨</span> <span>Daily check-in saved! Keep compounding consistency.</span>`;
      const toastContainer = document.getElementById('toast-container');
      if (toastContainer) {
        toastContainer.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
      }
    } catch (err) {
      alert('Could not save check-in. Please ensure backend is running.');
    } finally {
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = '💾 Save Daily Check-In';
      }
    }
  }
}

export const dailyLogController = new DailyLogController();
