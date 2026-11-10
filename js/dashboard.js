/* LifeBuddy Today's Command Center & Overview */
import { API } from './api.js';

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
    const focusTarget = 100; // 100 mins daily deep work target
    const focusPct = Math.min(100, Math.round((focusMins / focusTarget) * 100));

    const todayExpense = summary.finances.today_expense || 0;
    const monthExpense = summary.finances.month_expense || 0;
    const budget = summary.finances.monthly_budget || 1000;
    const currency = summary.finances.currency_symbol || '$';

    const habitsDone = summary.habits.done_today || 0;
    const habitsTotal = summary.habits.total || 0;

    container.innerHTML = `
      <div class="dashboard-hero glass-card">
        <div class="hero-header">
          <div>
            <div class="hero-date">${new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</div>
            <h1 class="hero-title">${greeting}, <span class="highlight-text">${userName}</span> 🌱</h1>
            <p class="hero-quote">"${quote}"</p>
          </div>
          <div class="hero-quick-actions">
            <button id="hero-quick-focus-btn" class="btn-primary">
              <span>▶</span> <span>Start Focus</span>
            </button>
            <button id="hero-quick-expense-btn" class="btn-secondary">
              <span>+</span> <span>Log Expense</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Quick Metrics Grid -->
      <div class="metrics-grid">
        <div class="metric-card glass-card" data-nav="focus">
          <div class="metric-header">
            <span class="metric-icon">⏱️</span>
            <span class="metric-badge">${focusPct}% of Goal</span>
          </div>
          <div class="metric-value">${focusMins} <span class="metric-unit">mins</span></div>
          <div class="metric-label">Deep Focus Today</div>
          <div class="metric-progress-bg">
            <div class="metric-progress-fill" style="width: ${focusPct}%;"></div>
          </div>
        </div>

        <div class="metric-card glass-card" data-nav="planner">
          <div class="metric-header">
            <span class="metric-icon">📋</span>
            <span class="metric-badge">${summary.tasks.completed}/${summary.tasks.total} done</span>
          </div>
          <div class="metric-value">${summary.tasks.total - summary.tasks.completed}</div>
          <div class="metric-label">Pending Tasks</div>
          <div class="metric-progress-bg">
            <div class="metric-progress-fill" style="width: ${summary.tasks.total > 0 ? (summary.tasks.completed / summary.tasks.total) * 100 : 0}%;"></div>
          </div>
        </div>

        <div class="metric-card glass-card" data-nav="finances">
          <div class="metric-header">
            <span class="metric-icon">💰</span>
            <span class="metric-badge">${currency}${todayExpense.toFixed(0)} today</span>
          </div>
          <div class="metric-value">${currency}${monthExpense.toFixed(0)}</div>
          <div class="metric-label">Spent This Month</div>
          <div class="metric-progress-bg">
            <div class="metric-progress-fill" style="width: ${Math.min(100, (monthExpense / budget) * 100)}%;"></div>
          </div>
        </div>

        <div class="metric-card glass-card" data-nav="planner">
          <div class="metric-header">
            <span class="metric-icon">🌱</span>
            <span class="metric-badge">${habitsDone}/${habitsTotal} checked</span>
          </div>
          <div class="metric-value">${habitsDone} <span class="metric-unit">done</span></div>
          <div class="metric-label">Habits Today</div>
          <div class="metric-progress-bg">
            <div class="metric-progress-fill" style="width: ${habitsTotal > 0 ? (habitsDone / habitsTotal) * 100 : 0}%;"></div>
          </div>
        </div>
      </div>

      <!-- Two-Column Today Content -->
      <div class="dashboard-columns">
        <!-- Column 1: Priority Tasks -->
        <div class="glass-card">
          <div class="section-header-flex">
            <h2 class="section-title"><span>Top Priorities</span></h2>
            <button class="btn-text" data-nav="planner">View All →</button>
          </div>
          <div id="dash-priority-tasks-container">
            ${this.renderTopTasks(summary.tasks.top_pending)}
          </div>
        </div>

        <!-- Column 2: Mindful Finance Snapshot -->
        <div class="glass-card">
          <div class="section-header-flex">
            <h2 class="section-title"><span>Monthly Budget Meter</span></h2>
            <button class="btn-text" data-nav="finances">Open Tracker →</button>
          </div>
          <div class="dash-budget-box">
            <div class="budget-stat-row">
              <span>Budget Cap:</span>
              <strong>${currency}${budget.toFixed(2)}</strong>
            </div>
            <div class="budget-stat-row">
              <span>Total Spent:</span>
              <strong class="text-expense">${currency}${monthExpense.toFixed(2)}</strong>
            </div>
            <div class="budget-stat-row">
              <span>Remaining:</span>
              <strong class="text-income">${currency}${Math.max(0, budget - monthExpense).toFixed(2)}</strong>
            </div>
            <div class="progress-bar-bg" style="margin-top: 14px;">
              <div class="progress-bar-fill" style="width: ${Math.min(100, (monthExpense / budget) * 100)}%;"></div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Hook click events
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
      <div class="dash-task-row glass-pill">
        <div class="dash-task-info">
          <span class="dash-task-title">${t.title}</span>
          <span class="badge ${t.priority === 'urgent' ? 'badge-urgent' : 'badge-subtle'}">${t.priority}</span>
        </div>
        <button class="btn-task-quick-focus btn-icon-small" data-id="${t.id}" title="Focus on this task">
          🎯 Focus
        </button>
      </div>
    `).join('');
  }
}
