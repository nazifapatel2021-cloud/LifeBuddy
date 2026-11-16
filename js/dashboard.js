/* LifeBuddy Today's Command Center & Overview */
import { API } from './api.js';
import { dailyLogController } from './daily_log.js';

const MINDFUL_QUOTES = [
  "Small daily disciplines compound into extraordinary life outcomes.",
  "Focus on being productive instead of busy.",
  "Mindful spending is financial freedom in practice.",
  "Do one thing deeply, rather than ten things shallowly.",
  "Breathe in calm, exhale distractions.",
  "Consistency beats intensity every single time."
];

export class DashboardManager {
  constructor(options = {}) {
    this.onNavigate = options.onNavigate || (() => {});
    this.onStartFocus = options.onStartFocus || (() => {});
    this.onTaskFocus = options.onTaskFocus || (() => {});
    this.onTaskCreated = options.onTaskCreated || (() => {});
  }

  getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  }

  getRandomQuote() {
    const dayIndex = new Date().getDate() % MINDFUL_QUOTES.length;
    return MINDFUL_QUOTES[dayIndex];
  }

  async render(container) {
    if (!container) return;
    const summary = await API.dashboard.getSummary();
    const user = API.getUser();
    const userName = user ? user.username : 'Friend';
    const quote = this.getRandomQuote();
    const greeting = this.getGreeting();

    const focusMins = summary.focus.today_minutes || 0;
    const focusTarget = 100;
    const focusPct = Math.min(100, Math.round((focusMins / focusTarget) * 100));

    const todayExpense = summary.finances.today_expense || 0;
    const monthExpense = summary.finances.month_expense || 0;
    const budget = summary?.finances?.monthly_budget || 25000;
    const currency = summary?.finances?.currency_symbol || '₹';

    const habitsDone = summary.habits.done_today || 0;
    const habitsTotal = summary.habits.total || 0;

    // Load recent daily logs for the dashboard reflection section
    let wellnessLogs = [];
    try {
      wellnessLogs = await API.wellness.getLogs();
    } catch {}
    const todayStr = new Date().toISOString().split('T')[0];
    const todayLog = Array.isArray(wellnessLogs) ? wellnessLogs.find(l => l.date === todayStr) : null;
    const currentMood = todayLog ? todayLog.mood : 3;
    const currentSleep = todayLog ? todayLog.sleep_hours : 7.5;
    const currentNotes = todayLog ? (todayLog.notes || '') : '';

    const moodList = [
      { level: 1, emoji: '😫', label: 'Drained' },
      { level: 2, emoji: '😕', label: 'Low' },
      { level: 3, emoji: '😐', label: 'Steady' },
      { level: 4, emoji: '😊', label: 'Focused' },
      { level: 5, emoji: '🤩', label: 'Thriving' }
    ];

    container.innerHTML = `
      <!-- Hero Briefing Header -->
      <div class="today-hero-panel">
        <div class="today-hero-left">
          <div class="today-date-badge">
            <span class="pulse-dot"></span>
            <span>${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
          </div>
          <h1 class="today-greeting">${greeting}, <span class="highlight-name">${userName}</span></h1>
          <p class="today-quote">"${quote}"</p>
        </div>
        <div class="today-hero-actions">
          <button id="hero-quick-focus-btn" class="btn-primary btn-hero-cta">
            <span>▶</span> <span>Start Focus</span>
          </button>
          <button id="hero-quick-expense-btn" class="btn-secondary btn-hero-cta">
            <span>+</span> <span>Log Expense (₹)</span>
          </button>
        </div>
      </div>

      <!-- Raycast-Style AI Natural Language Quick-Add Command Bar -->
      <div class="command-bar-container">
        <form id="nl-task-form" class="command-bar-form">
          <div class="command-input-frame">
            <span class="command-sparkle-icon">✨</span>
            <input 
              type="text" 
              id="nl-task-input" 
              class="command-input-field" 
              placeholder="Natural-language task add (e.g., 'Finish DBMS report friday 5pm urgent study 3 pomos')" 
              autocomplete="off"
            >
            <div class="command-action-right">
              <span class="kbd-badge">⏎ Enter</span>
              <button type="submit" class="btn-primary btn-command-submit">
                Add Task
              </button>
            </div>
          </div>
          <div id="nl-preview-pills" class="command-preview-row" style="display: none;"></div>
        </form>
      </div>

      <!-- Executive Metric KPI Cards Grid -->
      <div class="metrics-kpi-grid">
        <div class="kpi-card" data-nav="focus">
          <div class="kpi-top">
            <span class="kpi-icon">⏱️</span>
            <span class="kpi-badge">${focusPct}% of Goal</span>
          </div>
          <div class="kpi-body">
            <div class="kpi-number">${focusMins}<span class="kpi-unit">mins</span></div>
            <div class="kpi-title">Deep Focus Today</div>
          </div>
          <div class="kpi-progress-bar">
            <div class="kpi-progress-fill" style="width: ${focusPct}%;"></div>
          </div>
        </div>

        <div class="kpi-card" data-nav="planner">
          <div class="kpi-top">
            <span class="kpi-icon">📋</span>
            <span class="kpi-badge">${summary.tasks.completed}/${summary.tasks.total} done</span>
          </div>
          <div class="kpi-body">
            <div class="kpi-number">${summary.tasks.total - summary.tasks.completed}<span class="kpi-unit">tasks</span></div>
            <div class="kpi-title">Pending Milestones</div>
          </div>
          <div class="kpi-progress-bar">
            <div class="kpi-progress-fill" style="width: ${summary.tasks.total > 0 ? (summary.tasks.completed / summary.tasks.total) * 100 : 0}%;"></div>
          </div>
        </div>

        <div class="kpi-card" data-nav="finances">
          <div class="kpi-top">
            <span class="kpi-icon">💰</span>
            <span class="kpi-badge">${currency}${todayExpense.toFixed(0)} today</span>
          </div>
          <div class="kpi-body">
            <div class="kpi-number">${currency}${monthExpense.toFixed(0)}</div>
            <div class="kpi-title">Month-to-Date Spending</div>
          </div>
          <div class="kpi-progress-bar">
            <div class="kpi-progress-fill" style="width: ${Math.min(100, (monthExpense / budget) * 100)}%;"></div>
          </div>
        </div>

        <div class="kpi-card" data-nav="habits">
          <div class="kpi-top">
            <span class="kpi-icon">🌱</span>
            <span class="kpi-badge">${habitsDone}/${habitsTotal} checked</span>
          </div>
          <div class="kpi-body">
            <div class="kpi-number">${habitsDone}<span class="kpi-unit">done</span></div>
            <div class="kpi-title">Habits Compounded</div>
          </div>
          <div class="kpi-progress-bar">
            <div class="kpi-progress-fill" style="width: ${habitsTotal > 0 ? (habitsDone / habitsTotal) * 100 : 0}%;"></div>
          </div>
        </div>
      </div>

      <!-- Main Two-Column Balanced Content Stream -->
      <div class="today-dual-grid">
        <!-- Column 1: Top Priority Execution -->
        <div class="content-panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">Top Priority Execution</h2>
              <p class="panel-subtitle">Immediate high-impact focus targets</p>
            </div>
            <button class="btn-link" data-nav="planner">Open Planner →</button>
          </div>
          <div id="dash-priority-tasks-container" class="priority-tasks-stream">
            ${this.renderTopTasks(summary.tasks.top_pending)}
          </div>
        </div>

        <!-- Column 2: Financial Pulse & Budget Meter -->
        <div class="content-panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">Monthly Budget Meter (₹)</h2>
              <p class="panel-subtitle">Spending pacing vs ${currency}${budget.toFixed(0)} cap</p>
            </div>
            <button class="btn-link" data-nav="finances">Open Finances →</button>
          </div>
          <div class="budget-snapshot-box">
            <div class="budget-stat-item">
              <span class="stat-label">Monthly Budget</span>
              <span class="stat-num">${currency}${budget.toFixed(2)}</span>
            </div>
            <div class="budget-stat-item">
              <span class="stat-label">Spent This Month</span>
              <span class="stat-num text-expense">${currency}${monthExpense.toFixed(2)}</span>
            </div>
            <div class="budget-stat-item">
              <span class="stat-label">Available Balance</span>
              <span class="stat-num text-income">${currency}${Math.max(0, budget - monthExpense).toFixed(2)}</span>
            </div>
            <div class="progress-bar-bg" style="margin-top: 16px;">
              <div class="progress-bar-fill" style="width: ${Math.min(100, (monthExpense / budget) * 100)}%;"></div>
            </div>
          </div>
        </div>
      </div>

      <!-- Section 3: Today's Wellness & Daily Reflection Log (Grounded Dashboard Footer) -->
      <div class="content-panel" style="margin-top: 20px;">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Daily Wellness & Activity Reflection</h2>
            <p class="panel-subtitle">Review your energy, sleep, and record today's mindful thoughts</p>
          </div>
          <button id="dash-open-review-btn" class="btn-primary" style="padding: 5px 12px; font-size: 0.78rem;">
            <span>📖</span> <span>Open Full Review</span>
          </button>
        </div>

        <div class="dash-wellness-grid">
          <!-- Column A: Quick Mood & Energy Check-in -->
          <div class="dash-wellness-col">
            <span class="sub-label">Today's Energy Check-In</span>
            <div class="dash-mood-row" style="margin-top: 6px;">
              ${moodList.map(m => `
                <button 
                  type="button" 
                  class="dash-quick-mood-btn ${currentMood === m.level ? 'active' : ''}" 
                  data-mood="${m.level}"
                  title="${m.label}"
                >
                  <span class="mood-emoji">${m.emoji}</span>
                  <span class="mood-text">${m.label}</span>
                </button>
              `).join('')}
            </div>

            <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 12px; font-size: 0.8rem; color: var(--text-muted);">
              <span>🛌 Sleep Last Night: <strong style="color: var(--text-main);">${currentSleep} hrs</strong></span>
              <span>⚡ Status: <strong style="color: var(--accent-primary);">${todayLog ? 'Checked In' : 'Pending Today'}</strong></span>
            </div>
          </div>

          <!-- Column B: Quick Daily Reflection Note -->
          <div class="dash-wellness-col">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span class="sub-label">Mindful Reflection & Takeaway</span>
              <span id="dash-note-status" style="font-size: 0.72rem; color: var(--color-success); display: none;">Saved ✓</span>
            </div>
            <div style="display: flex; gap: 8px; margin-top: 6px;">
              <input 
                type="text" 
                id="dash-quick-note-input" 
                class="field-input" 
                placeholder="What went well today? What will you prioritize tomorrow?" 
                value="${this.escapeHtml(currentNotes)}"
                autocomplete="off"
              >
              <button id="dash-save-note-btn" class="btn-secondary" style="padding: 6px 14px; font-size: 0.78rem; flex-shrink: 0;">
                Save Note
              </button>
            </div>

            <!-- Recent 7-Day Reflection Consistency Recap -->
            <div class="dash-recent-history-row" style="margin-top: 10px;">
              ${this.renderRecentWellnessDots(wellnessLogs)}
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents(container);
  }

  bindEvents(container) {
    container.querySelectorAll('[data-nav]').forEach(el => {
      el.addEventListener('click', () => {
        this.onNavigate(el.dataset.nav);
      });
    });

    const heroFocusBtn = container.querySelector('#hero-quick-focus-btn');
    if (heroFocusBtn) {
      heroFocusBtn.addEventListener('click', () => {
        this.onNavigate('focus');
        this.onStartFocus();
      });
    }

    const heroExpBtn = container.querySelector('#hero-quick-expense-btn');
    if (heroExpBtn) {
      heroExpBtn.addEventListener('click', () => {
        this.onNavigate('finances');
        const modal = document.getElementById('expense-modal');
        if (modal) modal.classList.add('active');
      });
    }

    container.querySelectorAll('.btn-task-quick-focus').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const taskId = btn.dataset.id;
        this.onTaskFocus(taskId);
        this.onNavigate('focus');
      });
    });

    // Natural Language Input Handlers
    const nlForm = container.querySelector('#nl-task-form');
    const nlInput = container.querySelector('#nl-task-input');
    const previewPills = container.querySelector('#nl-preview-pills');

    let debounceTimer = null;

    if (nlInput && previewPills) {
      nlInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        const text = nlInput.value.trim();
        if (text.length < 5) {
          previewPills.style.display = 'none';
          return;
        }

        debounceTimer = setTimeout(async () => {
          try {
            const parsed = await API.ml.parseTask(text);
            previewPills.style.display = 'flex';
            previewPills.innerHTML = `
              <span class="badge badge-subtle">🏷️ ${parsed.title}</span>
              <span class="badge ${parsed.priority === 'urgent' ? 'badge-urgent' : 'badge-medium'}">Priority: ${parsed.priority}</span>
              <span class="badge badge-subtle">Category: ${parsed.category}</span>
              ${parsed.due_date ? `<span class="badge badge-subtle">📅 Due: ${parsed.due_date}</span>` : ''}
              <span class="badge badge-subtle">🍅 ${parsed.estimated_pomodoros} pomo</span>
            `;
          } catch (e) {
            previewPills.style.display = 'none';
          }
        }, 300);
      });
    }

    if (nlForm) {
      nlForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = nlInput.value.trim();
        if (!text) return;

        try {
          const parsed = await API.ml.parseTask(text);
          await API.tasks.create({
            title: parsed.title,
            category: parsed.category,
            priority: parsed.priority,
            estimated_pomodoros: parsed.estimated_pomodoros,
            due_date: parsed.due_date
          });
          nlInput.value = '';
          previewPills.style.display = 'none';
          this.onTaskCreated();
          this.render(container);
        } catch (err) {
          console.error('Failed to create parsed task', err);
        }
      });
    }

    // Wellness & Daily Reflection Log Handlers
    const openReviewBtn = container.querySelector('#dash-open-review-btn');
    if (openReviewBtn) {
      openReviewBtn.addEventListener('click', () => {
        dailyLogController.open();
      });
    }

    const todayStr = new Date().toISOString().split('T')[0];

    container.querySelectorAll('.dash-quick-mood-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const selectedMood = parseInt(btn.dataset.mood, 10);
        try {
          const currentLogs = await API.wellness.getLogs();
          const todayEntry = (currentLogs || []).find(l => l.date === todayStr);
          await API.wellness.saveLog({
            date: todayStr,
            mood: selectedMood,
            sleep_hours: todayEntry && todayEntry.sleep_hours !== undefined ? todayEntry.sleep_hours : 7.5,
            notes: todayEntry ? (todayEntry.notes || '') : ''
          });
          await this.render(container);
        } catch (err) {
          console.warn('Failed to save quick mood', err);
        }
      });
    });

    const noteInput = container.querySelector('#dash-quick-note-input');
    const saveNoteBtn = container.querySelector('#dash-save-note-btn');
    const noteStatus = container.querySelector('#dash-note-status');

    if (saveNoteBtn && noteInput) {
      const handleSaveNote = async () => {
        const text = noteInput.value.trim();
        try {
          const currentLogs = await API.wellness.getLogs();
          const todayEntry = (currentLogs || []).find(l => l.date === todayStr);
          await API.wellness.saveLog({
            date: todayStr,
            mood: todayEntry && todayEntry.mood !== undefined ? todayEntry.mood : 3,
            sleep_hours: todayEntry && todayEntry.sleep_hours !== undefined ? todayEntry.sleep_hours : 7.5,
            notes: text
          });
          if (noteStatus) {
            noteStatus.style.display = 'inline';
            setTimeout(() => {
              if (noteStatus) noteStatus.style.display = 'none';
            }, 2500);
          }
        } catch (err) {
          console.warn('Failed to save quick note', err);
        }
      };

      saveNoteBtn.addEventListener('click', handleSaveNote);
      noteInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleSaveNote();
        }
      });
    }
  }

  renderRecentWellnessDots(wellnessLogs) {
    const days = [];
    const logMap = new Map();
    (wellnessLogs || []).forEach(l => {
      if (l.date) logMap.set(l.date, l);
    });

    const moodIcons = { 1: '😞', 2: '😐', 3: '🙂', 4: '😊', 5: '⚡' };
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = dayNames[d.getDay()];
      const log = logMap.get(dateStr);
      days.push({
        date: dateStr,
        dayLabel,
        isToday: i === 0,
        log
      });
    }

    return `
      <div class="wellness-history-strip">
        <span class="history-label">Last 7 Days:</span>
        <div class="wellness-dots-container">
          ${days.map(d => {
            const hasLog = Boolean(d.log);
            const icon = hasLog ? (moodIcons[d.log.mood] || '✓') : '○';
            const tooltip = hasLog 
              ? `${d.date}: Mood ${d.log.mood}/5, ${d.log.sleep_hours || 0}h sleep`
              : `${d.date}: No check-in`;
            return `
              <div class="wellness-dot-pill ${hasLog ? 'logged' : 'unlogged'} ${d.isToday ? 'is-today' : ''}" title="${tooltip}">
                <span class="dot-day">${d.dayLabel}</span>
                <span class="dot-icon">${icon}</span>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
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

  renderTopTasks(tasks) {
    if (!tasks || tasks.length === 0) {
      return `
        <div class="empty-state-sm">
          <span>🎉</span> <span>All clear! No pending tasks right now.</span>
        </div>
      `;
    }

    return tasks.map(t => `
      <div class="task-stream-item">
        <div class="task-stream-left">
          <div class="task-stream-priority-dot dot-${t.priority || 'medium'}"></div>
          <span class="task-stream-title">${t.title}</span>
          <span class="badge badge-${t.priority === 'urgent' ? 'urgent' : 'subtle'}">${t.priority}</span>
        </div>
        <button class="btn-task-quick-focus btn-focus-action" data-id="${t.id}" title="Set as active focus target">
          <span>🎯</span> <span>Focus</span>
        </button>
      </div>
    `).join('');
  }
}
