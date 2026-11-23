/* LifeBuddy Today's Command Center & Overview */
import { API } from './api.js';
import { store } from './store.js';
import { formatCurrency } from './currency.js';
import { dailyLogController } from './daily_log.js';
import { formatFriendlyDate, getLocalDateString, normalizeDate } from './date_utils.js';

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
    this.getActiveTaskId = options.getActiveTaskId || (() => {
      return localStorage.getItem('lifebuddy_active_task_id') || localStorage.getItem('zen_pomodoro_active_task') || null;
    });

    // Subscribe to central store updates
    store.subscribe(() => {
      const container = document.getElementById('view-dashboard');
      if (container && container.classList.contains('active')) {
        this.render(container);
      }
    });

    // Also listen for explicit daily log updates
    window.addEventListener('lifebuddy:daily-log-updated', () => {
      const container = document.getElementById('view-dashboard');
      if (container && container.classList.contains('active')) {
        this.render(container);
      }
    });
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

    const userName = store.getDisplayName();
    const quote = this.getRandomQuote();
    const greeting = this.getGreeting();

    const focusMins = store.getTodayFocusMinutes();
    const focusTarget = store.state.settings?.daily_focus_goal || 100;
    const focusPct = Math.min(100, Math.round((focusMins / focusTarget) * 100));

    const todayExpense = store.getTodayExpense();
    const monthExpense = store.getMonthExpense();
    const budget = store.getBudget();
    const dailyAllowance = store.getDailyBudgetAllowance();

    const allTasks = store.state.tasks || [];
    const pendingTasks = store.getPendingTasks();
    const todayStr = getLocalDateString();
    const todayTasks = allTasks.filter(t => normalizeDate(t.due_date) === todayStr);
    const todayTasksDone = todayTasks.filter(t => t.completed).length;
    const todayTasksTotal = todayTasks.length;

    const allHabits = store.state.habits || [];
    const habitsDone = store.getHabitsDoneToday();
    const habitsTotal = allHabits.length;

    // Load today's check-in
    const todayLog = store.getTodayLog();
    const currentMood = todayLog ? todayLog.mood : null;
    const currentSleep = todayLog ? todayLog.sleep_hours : null;
    const currentNotes = todayLog ? (todayLog.notes || '') : '';

    const moodList = [
      { level: 1, emoji: '😫', label: 'Drained' },
      { level: 2, emoji: '😕', label: 'Low' },
      { level: 3, emoji: '😐', label: 'Steady' },
      { level: 4, emoji: '😊', label: 'Focused' },
      { level: 5, emoji: '🤩', label: 'Thriving' }
    ];

    // Compute Next Best Action
    let nextActionHtml = '';
    if (pendingTasks.length > 0) {
      const topTask = pendingTasks[0];
      nextActionHtml = `
        <div class="next-action-card">
          <div class="next-action-badge">🎯 NEXT BEST ACTION</div>
          <div class="next-action-content">
            <div class="next-action-info">
              <span class="next-action-title">${this.escapeHtml(topTask.title)}</span>
              <span class="next-action-sub">Estimated: ${topTask.estimated_pomodoros || 1} Pomodoro • ${topTask.category || 'work'}</span>
            </div>
            <button class="btn-primary btn-sm btn-task-quick-focus" data-id="${topTask.id}">
              ▶ Start Focus
            </button>
          </div>
        </div>
      `;
    } else if (allHabits.some(h => !this.isHabitDoneToday(h))) {
      const pendingHabit = allHabits.find(h => !this.isHabitDoneToday(h));
      nextActionHtml = `
        <div class="next-action-card">
          <div class="next-action-badge">🌱 HABIT MOMENTUM</div>
          <div class="next-action-content">
            <div class="next-action-info">
              <span class="next-action-title">${pendingHabit.icon || '🌱'} ${this.escapeHtml(pendingHabit.title)}</span>
              <span class="next-action-sub">Current Streak: ${pendingHabit.streak || 0} days</span>
            </div>
            <button class="btn-secondary btn-sm btn-quick-habit-check" data-id="${pendingHabit.id}">
              ✓ Check In
            </button>
          </div>
        </div>
      `;
    }

    container.innerHTML = `
      <!-- Hero Briefing Header (Clean, only Start Focus action in Next Best Action) -->
      <div class="today-hero-panel">
        <div class="today-hero-left">
          <div class="today-date-badge">
            <span class="pulse-dot"></span>
            <span>${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
          </div>
          <h1 class="today-greeting">${greeting}, <span class="highlight-name">${this.escapeHtml(userName)}</span></h1>
          <p class="today-quote">"${quote}"</p>
        </div>
      </div>

      ${nextActionHtml}

      <!-- Executive Metric KPI Cards Grid -->
      <div class="metrics-kpi-grid">
        <div class="kpi-card" data-nav="focus">
          <div class="kpi-top">
            <span class="kpi-icon">⏱️</span>
            <span class="kpi-badge">${focusPct}% of Goal</span>
          </div>
          <div class="kpi-body">
            <div class="kpi-number">${focusMins} <span class="kpi-unit">mins</span></div>
            <div class="kpi-title">Deep Focus (Target: ${focusTarget}m)</div>
          </div>
          <div class="kpi-progress-bar">
            <div class="kpi-progress-fill" style="width: ${focusPct}%;"></div>
          </div>
        </div>

        <div class="kpi-card" data-nav="planner">
          <div class="kpi-top">
            <span class="kpi-icon">📋</span>
            ${todayTasksTotal > 0 ? `<span class="kpi-badge">${todayTasksDone} / ${todayTasksTotal} done</span>` : ''}
          </div>
          <div class="kpi-body">
            <div class="kpi-number">${pendingTasks.length} <span class="kpi-unit">tasks</span></div>
            <div class="kpi-title">Pending Milestones</div>
          </div>
          <div class="kpi-progress-bar">
            <div class="kpi-progress-fill" style="width: ${todayTasksTotal > 0 ? (todayTasksDone / todayTasksTotal) * 100 : 0}%;"></div>
          </div>
        </div>

        <div class="kpi-card" data-nav="finances">
          <div class="kpi-top">
            <span class="kpi-icon">💰</span>
            <span class="kpi-badge">${formatCurrency(todayExpense)} today</span>
          </div>
          <div class="kpi-body">
            <div class="kpi-number">${formatCurrency(monthExpense)}</div>
            <div class="kpi-title">Month-to-Date Spend</div>
          </div>
          <div class="kpi-progress-bar">
            <div class="kpi-progress-fill" style="width: ${Math.min(100, (monthExpense / budget) * 100)}%;"></div>
          </div>
        </div>

        <div class="kpi-card" data-nav="habits">
          <div class="kpi-top">
            <span class="kpi-icon">🌱</span>
            <span class="kpi-badge">${habitsDone} / ${habitsTotal} checked</span>
          </div>
          <div class="kpi-body">
            <div class="kpi-number">${habitsDone} <span class="kpi-unit">done</span></div>
            <div class="kpi-title">Habits Maintained</div>
          </div>
          <div class="kpi-progress-bar">
            <div class="kpi-progress-fill" style="width: ${habitsTotal > 0 ? (habitsDone / habitsTotal) * 100 : 0}%;"></div>
          </div>
        </div>
      </div>

      <!-- Main Three-Card Balanced Content Stream -->
      <div class="today-tri-grid">
        <!-- Card 1: Today's Tasks -->
        <div class="content-panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">Today's Tasks</h2>
              <p class="panel-subtitle">Today's active milestones — check off as you complete</p>
            </div>
            <button class="btn-link" data-nav="planner">Planner →</button>
          </div>
          <div id="dash-priority-tasks-container" class="priority-tasks-stream">
            ${this.renderTopTasks(pendingTasks.slice(0, 5))}
          </div>
        </div>

        <!-- Card 2: Financial Pulse & Budget Meter -->
        <div class="content-panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">Monthly Budget Meter</h2>
              <p class="panel-subtitle">Daily allowance: ${formatCurrency(dailyAllowance)}</p>
            </div>
            <button class="btn-link" data-nav="finances">Finances →</button>
          </div>
          <div class="budget-snapshot-box">
            <div class="budget-stat-item">
              <span class="stat-label">Monthly Budget</span>
              <span class="stat-num">${formatCurrency(budget)}</span>
            </div>
            <div class="budget-stat-item">
              <span class="stat-label">Spent This Month</span>
              <span class="stat-num text-expense">${formatCurrency(monthExpense)}</span>
            </div>
            <div class="budget-stat-item">
              <span class="stat-label">Available Balance</span>
              <span class="stat-num text-income">${formatCurrency(Math.max(0, budget - monthExpense))}</span>
            </div>
            <div class="progress-bar-bg" style="margin-top: 16px;">
              <div class="progress-bar-fill" style="width: ${Math.min(100, (monthExpense / budget) * 100)}%;"></div>
            </div>
          </div>
        </div>

        <!-- Card 3: Today's Habits -->
        <div class="content-panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">Today's Habits</h2>
              <p class="panel-subtitle">Quick check-in to build momentum</p>
            </div>
            <button class="btn-link" data-nav="habits">View All →</button>
          </div>
          <div class="dash-habits-pills-row" style="display: flex; flex-direction: column; gap: 8px;">
            ${this.renderHabitPills(allHabits.slice(0, 5))}
          </div>
        </div>
      </div>

      <!-- Section 3: Today's Wellness & Daily Reflection Log (With Recent Check-Ins on Dashboard) -->
      <div class="content-panel" style="margin-top: 20px;">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Daily Wellness & Reflection</h2>
            <p class="panel-subtitle">Record your energy, sleep, and mindful notes</p>
          </div>
          <button id="dash-open-review-btn" class="btn-primary" style="padding: 5px 12px; font-size: 0.78rem;">
            <span>📖</span> <span>Review Day</span>
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
              <span>🛌 Sleep: <strong style="color: var(--text-main);">${currentSleep !== null ? `${currentSleep} hrs` : 'Not recorded'}</strong></span>
              <span>⚡ Status: <strong style="color: ${todayLog ? 'var(--color-success)' : 'var(--text-muted)'};">${todayLog ? 'Checked In ✓' : 'Pending Today'}</strong></span>
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
                Save
              </button>
            </div>

            <div class="dash-recent-history-row" style="margin-top: 10px;">
              ${this.renderRecentWellnessDots(store.getDailyLogs() || [])}
            </div>
          </div>
        </div>

        <!-- Recent Daily Check-Ins Section Directly on Main Dashboard -->
        <div class="dash-recent-checkins-panel" style="margin-top: 20px; border-top: 1px solid var(--border-color); padding-top: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div>
              <span style="font-size: 0.88rem; font-weight: 600; color: var(--text-main);">Recent Daily Check-Ins</span>
              <p style="font-size: 0.75rem; color: var(--text-muted); margin: 0;">Your historical reflections, energy logs, and sleep</p>
            </div>
          </div>
          <div class="dash-recent-logs-feed">
            ${this.renderRecentLogs(store.getDailyLogs() || [])}
          </div>
        </div>
      </div>
    `;

    this.bindEvents(container);
  }

  isHabitDoneToday(habit) {
    const todayStr = getLocalDateString();
    return Array.isArray(habit.history) && habit.history.some(d => String(d).slice(0, 10) === todayStr);
  }

  cleanHabitTitle(title, icon) {
    if (!title) return '';
    let clean = title.trim();
    if (icon && clean.startsWith(icon)) {
      clean = clean.slice(icon.length).trim();
    }
    // Strip any leading emoji + whitespace if duplicated
    clean = clean.replace(/^[\p{Extended_Pictographic}\u200d\ufe0f]+\s*/u, '');
    return clean || title;
  }

  renderHabitPills(habits) {
    if (!habits || habits.length === 0) {
      return `<span style="font-size: 0.8rem; color: var(--text-muted);">No habits configured yet.</span>`;
    }
    return habits.map(h => {
      const isDone = this.isHabitDoneToday(h);
      const displayTitle = this.cleanHabitTitle(h.title, h.icon);
      return `
        <button class="btn-quick-habit-pill ${isDone ? 'done' : ''}" data-id="${h.id}">
          <span>${isDone ? '✓' : h.icon || '🌱'}</span>
          <span>${this.escapeHtml(displayTitle)}</span>
          <span class="habit-pill-streak">🔥${h.streak || 0}</span>
        </button>
      `;
    }).join('');
  }

  renderRecentLogs(logs) {
    if (!logs || logs.length === 0) {
      return `
        <div class="empty-state-sm" style="padding: 16px 0;">
          <span>🌱</span> <span>No previous check-ins logged yet. Today is day 1!</span>
        </div>
      `;
    }

    const moodMap = {
      1: { emoji: '😫', label: 'Drained' },
      2: { emoji: '😕', label: 'Low' },
      3: { emoji: '😐', label: 'Steady' },
      4: { emoji: '😊', label: 'Focused' },
      5: { emoji: '🤩', label: 'Thriving' }
    };

    return logs.slice(0, 5).map(l => {
      const dateLabel = new Date(l.date + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      const moodInfo = moodMap[l.mood] || { emoji: '😐', label: 'Steady' };
      return `
        <div class="glass-pill" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; margin-bottom: 8px;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 600; font-size: 0.85rem; color: var(--text-main);">${dateLabel}</span>
              <span class="badge badge-subtle">${moodInfo.emoji} ${moodInfo.label}</span>
              <span style="font-size: 0.78rem; color: var(--text-muted);">💤 ${l.sleep_hours || 0}h sleep</span>
            </div>
            ${l.notes ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 4px; font-style: italic;">"${this.escapeHtml(l.notes)}"</div>` : ''}
          </div>
        </div>
      `;
    }).join('');
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

    container.querySelectorAll('.btn-task-quick-focus').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const taskId = btn.dataset.id;
        this.onTaskFocus(taskId);
        this.onNavigate('focus');
      });
    });

    // Checkbox toggle right from dashboard
    container.querySelectorAll('.dash-task-toggle').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const taskId = btn.dataset.id;
        const task = (store.state.tasks || []).find(t => t.id === taskId);
        if (task) {
          const nextCompleted = !task.completed;
          await store.updateTask(taskId, { completed: nextCompleted });
          this.render(container);
        }
      });
    });

    container.querySelectorAll('.btn-quick-habit-pill, .btn-quick-habit-check').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const habitId = btn.dataset.id;
        if (habitId) {
          const today = getLocalDateString();
          await store.checkHabit(habitId, today);
          this.render(container);
        }
      });
    });

    // Wellness & Daily Reflection Log Handlers
    const openReviewBtn = container.querySelector('#dash-open-review-btn');
    if (openReviewBtn) {
      openReviewBtn.addEventListener('click', () => {
        dailyLogController.open();
      });
    }

    const todayStr = getLocalDateString();

    container.querySelectorAll('.dash-quick-mood-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const selectedMood = parseInt(btn.dataset.mood, 10);
        try {
          const todayEntry = store.getTodayLog();
          await store.saveDailyLog({
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
          const todayEntry = store.getTodayLog();
          await store.saveDailyLog({
            date: todayStr,
            mood: todayEntry && todayEntry.mood !== undefined ? todayEntry.mood : 4,
            sleep_hours: todayEntry && todayEntry.sleep_hours !== undefined ? todayEntry.sleep_hours : 7.5,
            notes: text
          });
          if (noteStatus) {
            noteStatus.style.display = 'inline';
            setTimeout(() => {
              if (noteStatus) noteStatus.style.display = 'none';
            }, 2500);
          }
          await this.render(container);
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

    const moodIcons = { 1: '😫', 2: '😕', 3: '😐', 4: '😊', 5: '🤩' };
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

    const categoryIcons = {
      work: '💼 Work',
      study: '📚 Study',
      personal: '🏠 Personal',
      health: '🌱 Health'
    };

    const activeId = typeof this.getActiveTaskId === 'function' 
      ? this.getActiveTaskId() 
      : (localStorage.getItem('lifebuddy_active_task_id') || localStorage.getItem('zen_pomodoro_active_task') || null);

    return tasks.map(t => {
      const isCompleted = !!t.completed;
      const isActive = !isCompleted && activeId && (t.id === activeId);
      const friendlyDate = t.due_date ? formatFriendlyDate(t.due_date) : '';
      const catLabel = categoryIcons[t.category] || t.category || '💼 Work';
      return `
        <div class="task-stream-item ${isActive ? 'task-item-active' : ''}">
          <div class="task-stream-left">
            <button class="dash-task-toggle ${isCompleted ? 'checked' : ''}" data-id="${t.id}" title="${isCompleted ? 'Mark pending' : 'Mark completed'}">
              ${isCompleted ? '✓' : ''}
            </button>
            <div class="task-stream-details">
              <span class="task-stream-title ${isCompleted ? 'completed-text' : ''}" title="${this.escapeHtml(t.title)}">${this.escapeHtml(t.title)}</span>
              <div class="task-stream-badges">
                <span class="badge badge-subtle">${catLabel}</span>
                <span class="badge badge-${t.priority === 'urgent' ? 'urgent' : 'subtle'}">${t.priority || 'medium'}</span>
                ${friendlyDate ? `<span class="badge badge-subtle">📅 ${friendlyDate}</span>` : ''}
              </div>
            </div>
          </div>
          ${!isCompleted ? `
            <button class="btn-task-quick-focus btn-focus-action ${isActive ? 'active' : ''}" data-id="${t.id}" title="${isActive ? 'Active focus task — click to open focus timer' : 'Set as active focus task'}">
              <span>🎯</span> <span>${isActive ? 'Active' : 'Focus'}</span>
            </button>
          ` : ''}
        </div>
      `;
    }).join('');
  }
}
