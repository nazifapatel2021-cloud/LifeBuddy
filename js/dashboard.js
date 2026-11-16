/* LifeBuddy Today's Command Center & Overview */
import { API } from './api.js';
import { store } from './store.js';
import { formatCurrency } from './currency.js';
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

    // Subscribe to central store updates
    store.subscribe(() => {
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

    let summary = null;
    try {
      summary = await API.dashboard.getSummary();
    } catch {
      summary = {
        focus: { today_minutes: store.getTodayFocusMinutes() },
        tasks: { completed: 0, total: store.state.tasks.length, top_pending: store.getPendingTasks() },
        finances: { today_expense: store.getTodayExpense(), month_expense: store.getMonthExpense(), monthly_budget: store.getBudget(), currency_symbol: '₹' },
        habits: { done_today: store.getHabitsDoneToday(), total: store.state.habits.length }
      };
    }

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
    const completedTasks = allTasks.filter(t => t.completed);
    const tasksDone = completedTasks.length;
    const tasksTotal = allTasks.length;

    const allHabits = store.state.habits || [];
    const habitsDone = store.getHabitsDoneToday();
    const habitsTotal = allHabits.length;

    // Load recent daily logs for the dashboard reflection section
    const todayLog = store.getTodayLog();
    const currentMood = todayLog ? todayLog.mood : null; // null if not yet checked in!
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
      <!-- Hero Briefing Header -->
      <div class="today-hero-panel">
        <div class="today-hero-left">
          <div class="today-date-badge">
            <span class="pulse-dot"></span>
            <span>${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</span>
          </div>
          <h1 class="today-greeting">${greeting}, <span class="highlight-name">${this.escapeHtml(userName)}</span></h1>
          <p class="today-quote">"${quote}"</p>
        </div>
        <div class="today-hero-actions">
          <button id="hero-quick-focus-btn" class="btn-primary btn-hero-cta">
            <span>▶</span> <span>Start Focus</span>
          </button>
          <button id="hero-quick-expense-btn" class="btn-secondary btn-hero-cta">
            <span>+</span> <span>Log Expense</span>
          </button>
        </div>
      </div>

      ${nextActionHtml}

      <!-- Raycast-Style AI Natural Language Quick-Add Command Bar -->
      <div class="command-bar-container">
        <form id="nl-task-form" class="command-bar-form">
          <div class="command-input-frame">
            <span class="command-sparkle-icon">✨</span>
            <input 
              type="text" 
              id="nl-task-input" 
              class="command-input-field" 
              placeholder="Quick task or milestone (e.g., 'Finish database schema friday 5pm urgent 3 pomos')" 
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
            <div class="kpi-title">Deep Focus (Target: ${focusTarget}m)</div>
          </div>
          <div class="kpi-progress-bar">
            <div class="kpi-progress-fill" style="width: ${focusPct}%;"></div>
          </div>
        </div>

        <div class="kpi-card" data-nav="planner">
          <div class="kpi-top">
            <span class="kpi-icon">📋</span>
            <span class="kpi-badge">${tasksDone}/${tasksTotal} done</span>
          </div>
          <div class="kpi-body">
            <div class="kpi-number">${pendingTasks.length}<span class="kpi-unit">tasks</span></div>
            <div class="kpi-title">Pending Milestones</div>
          </div>
          <div class="kpi-progress-bar">
            <div class="kpi-progress-fill" style="width: ${tasksTotal > 0 ? (tasksDone / tasksTotal) * 100 : 0}%;"></div>
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
            <span class="kpi-badge">${habitsDone}/${habitsTotal} checked</span>
          </div>
          <div class="kpi-body">
            <div class="kpi-number">${habitsDone}<span class="kpi-unit">done</span></div>
            <div class="kpi-title">Habits Maintained</div>
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
              <h2 class="panel-title">Priority Tasks</h2>
              <p class="panel-subtitle">Immediate high-impact focus targets</p>
            </div>
            <button class="btn-link" data-nav="planner">Open Planner →</button>
          </div>
          <div id="dash-priority-tasks-container" class="priority-tasks-stream">
            ${this.renderTopTasks(pendingTasks.slice(0, 5))}
          </div>
        </div>

        <!-- Column 2: Financial Pulse & Budget Meter -->
        <div class="content-panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title">Monthly Budget Meter</h2>
              <p class="panel-subtitle">Daily allowance: ${formatCurrency(dailyAllowance)}</p>
            </div>
            <button class="btn-link" data-nav="finances">Open Finances →</button>
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

          <!-- Quick Habit Check-Ins Strip -->
          <div class="dash-habits-quick-section" style="margin-top: 18px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span class="sub-label">Today's Habits</span>
              <button class="btn-link" data-nav="habits">View All →</button>
            </div>
            <div class="dash-habits-pills-row">
              ${this.renderHabitPills(allHabits.slice(0, 4))}
            </div>
          </div>
        </div>
      </div>

      <!-- Section 3: Today's Wellness & Daily Reflection Log -->
      <div class="content-panel" style="margin-top: 20px;">
        <div class="panel-header">
          <div>
            <h2 class="panel-title">Daily Wellness & Reflection</h2>
            <p class="panel-subtitle">Review your energy, rest, and mindful focus notes</p>
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

            <!-- Recent 7-Day History -->
            <div class="dash-recent-history-row" style="margin-top: 10px;">
              ${this.renderRecentWellnessDots(store.state.wellness_logs || [])}
            </div>
          </div>
        </div>
      </div>
    `;

    this.bindEvents(container);
  }

  isHabitDoneToday(habit) {
    const todayStr = new Date().toISOString().split('T')[0];
    return Array.isArray(habit.history) && habit.history.includes(todayStr);
  }

  renderHabitPills(habits) {
    if (!habits || habits.length === 0) {
      return `<span style="font-size: 0.8rem; color: var(--text-muted);">No habits configured yet.</span>`;
    }
    return habits.map(h => {
      const isDone = this.isHabitDoneToday(h);
      return `
        <button class="btn-quick-habit-pill ${isDone ? 'done' : ''}" data-id="${h.id}">
          <span>${isDone ? '✓' : h.icon || '🌱'}</span>
          <span>${this.escapeHtml(h.title)}</span>
          <span class="habit-pill-streak">🔥${h.streak || 0}</span>
        </button>
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
          const today = new Date().toISOString().split('T')[0];
          await store.checkHabit(habitId, today);
          this.render(container);
        }
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
              <span class="badge badge-subtle">🏷️ ${this.escapeHtml(parsed.title)}</span>
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
          await store.createTask({
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

    return tasks.map(t => {
      const isCompleted = !!t.completed;
      return `
        <div class="task-stream-item">
          <div class="task-stream-left">
            <button class="dash-task-toggle ${isCompleted ? 'checked' : ''}" data-id="${t.id}" title="${isCompleted ? 'Mark pending' : 'Mark completed'}">
              ${isCompleted ? '✓' : ''}
            </button>
            <span class="task-stream-title ${isCompleted ? 'completed-text' : ''}">${this.escapeHtml(t.title)}</span>
            <span class="badge badge-${t.priority === 'urgent' ? 'urgent' : 'subtle'}">${t.priority || 'medium'}</span>
            ${t.due_date ? `<span class="badge badge-subtle">📅 ${t.due_date}</span>` : ''}
          </div>
          <button class="btn-task-quick-focus btn-focus-action" data-id="${t.id}" title="Focus on this task">
            <span>🎯</span> <span>Focus</span>
          </button>
        </div>
      `;
    }).join('');
  }
}
