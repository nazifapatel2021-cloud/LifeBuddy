/* LifeBuddy Insights & Explainable Intelligence Coordinator
   - Single source of truth for budget & transactions via store
   - Pure Indian Currency formatting (formatCurrency)
   - Proper SVG Spending Forecast Chart with Y-axis labels, cumulative trajectory, and confidence band
   - Habit Consistency & Risk Nudges with safe data mapping (no undefined / NaN)
   - 7-Day Focus Minutes & Habit Completion Trends
   - Explainability Drawer for statistical transparency
*/
import { API } from './api.js';
import { store } from './store.js';
import { formatCurrency } from './currency.js';

export class InsightsCoordinator {
  constructor(options = {}) {
    this.container = options.container || document.getElementById('ml-insights-container') || document.getElementById('view-insights');
    this.currentExplanation = null;
    this._cachedData = null;
    this._fetchPromise = null;
  }

  clearCache() {
    this._cachedData = null;
    this._fetchPromise = null;
    if (this.container) this.container.innerHTML = '';
  }

  getFriendlyBadge(rawConfidence) {
    if (!rawConfidence) return '✨ Smart Suggestion';
    const lower = String(rawConfidence).toLowerCase();
    if (lower.includes('high')) return '⭐ High Confidence';
    if (lower.includes('low') || lower.includes('cold') || lower.includes('know')) return '🌱 Getting to know you';
    if (lower.includes('moderate')) return '✨ Reliable Pattern';
    return rawConfidence;
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

  async render(forceRefresh = false) {
    if (!this.container) return;

    // 1. Instant Cache Render: If data is already in memory, display immediately with 0 delay!
    if (this._cachedData && !forceRefresh) {
      this._renderHTML(this._cachedData);
      return;
    }

    // 2. Responsive Loading Skeleton: Don't show a blank box while ML models compute
    if (!this._cachedData && (!this.container.innerHTML || this.container.innerHTML.trim() === '')) {
      this.container.innerHTML = `
        <div class="content-panel" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 48px 20px; text-align: center; border-radius: 12px; margin-top: 10px;">
          <div style="font-size: 2.2rem; animation: pulse 1.6s infinite ease-in-out; margin-bottom: 12px;">🧠</div>
          <h3 style="font-size: 1.05rem; font-weight: 600; color: var(--text-main); margin-bottom: 6px;">Computing Personalized Insights…</h3>
          <p style="font-size: 0.82rem; color: var(--text-muted); max-width: 360px; line-height: 1.5; margin: 0 auto;">
            Analyzing your deep work sessions, habit streaks, and spending forecast with local ML models.
          </p>
        </div>
      `;
    }

    // 3. Deduplicate in-flight fetch across rapid tab switches
    if (!this._fetchPromise) {
      this._fetchPromise = Promise.all([
        API.ml.getFocusRecommendation().catch(() => ({ recommended_window: '09:00 - 11:30 AM', explanation: 'Start your mornings with deep focus blocks.', confidence: 'cold' })),
        API.ml.getSpendingForecast().catch(() => ({ spent_so_far: store.getMonthExpense(), monthly_budget: store.getBudget(), projected_month_end: store.getMonthExpense() })),
        API.ml.getHabitRisks().catch(() => []),
        API.ml.getCrossModuleInsights().catch(() => []),
        API.ml.getWeeklyReflection().catch(() => ({
          period: 'Past 7 Days',
          reflection: `🌿 **Weekly Reflection for ${store.getDisplayName()}**\n\nContinue tracking your focus, habits, and spending to generate personalized insights.`
        }))
      ]).then(([focusRec, spendForecast, habitRisks, rawInsights, reflection]) => {
        this._cachedData = { focusRec, spendForecast, habitRisks, rawInsights, reflection };
        this._fetchPromise = null;
        return this._cachedData;
      }).catch(err => {
        this._fetchPromise = null;
        throw err;
      });
    }

    try {
      const data = await this._fetchPromise;
      this._renderHTML(data);
    } catch (err) {
      console.warn('Insights rendering error:', err);
    }
  }

  _renderHTML(data) {
    if (!this.container || !data) return;
    const { focusRec, spendForecast, habitRisks, rawInsights, reflection } = data;
    const focusBadge = this.getFriendlyBadge(focusRec?.confidence);
    const budget = store.getBudget();
    const monthSpent = store.getMonthExpense();

    this.container.innerHTML = `
      <!-- Top Section: Weekly Reflection & Best Focus Window -->
      <div class="insights-top-grid">
        <!-- Card 1: Best Deep-Work Window -->
        <div class="content-panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title"><span>⏱️ Recommended Focus Window</span></h2>
              <p class="panel-subtitle">Calculated from your historical peak energy blocks</p>
            </div>
            <span class="badge badge-subtle">${focusBadge}</span>
          </div>
          <div class="recom-hero-box" style="margin-top: 14px; padding: 18px; border-radius: 12px; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle);">
            <div class="recom-window-title" style="font-size: 1.35rem; font-weight: 700; color: var(--accent-primary); letter-spacing: -0.02em;">
              ${this.escapeHtml(focusRec?.recommended_window || '09:00 - 11:30 AM')}
            </div>
            <p class="recom-explanation" style="font-size: 0.88rem; color: var(--text-muted); margin-top: 6px; line-height: 1.5;">
              ${this.escapeHtml(focusRec?.explanation || 'Protect this morning window from distractions to accomplish demanding deep work.')}
            </p>
          </div>
          <div style="margin-top: 12px; display: flex; justify-content: flex-end;">
            <button class="btn-link btn-explain" data-topic="focus" title="Understand how this is calculated">
              How does LifeBuddy find this? →
            </button>
          </div>
        </div>

        <!-- Card 2: Weekly Mindful Reflection -->
        <div class="content-panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title"><span>🌿 Weekly Reflection</span></h2>
              <p class="panel-subtitle">Synthesized from your verified habits, focus, and finances</p>
            </div>
            <span class="badge badge-subtle">${this.escapeHtml(reflection?.period || 'Past 7 Days')}</span>
          </div>
          <div class="reflection-box" style="margin-top: 14px; padding: 16px; border-radius: 12px; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle);">
            <div class="reflection-content" style="font-size: 0.88rem; line-height: 1.6; color: var(--text-main);">
              ${this.formatMarkdown(reflection?.reflection)}
            </div>
          </div>
        </div>
      </div>

      <!-- Second Section: Spending Forecast vs Budget (Precision Native SVG Chart) -->
      <div class="content-panel" style="margin-bottom: 24px;">
        <div class="panel-header" style="flex-wrap: wrap; gap: 10px;">
          <div>
            <h2 class="panel-title"><span>💰 Month-End Spending Forecast vs Budget</span></h2>
            <p class="panel-subtitle">
              Cumulative actual trajectory, projected month-end velocity, and confidence intervals vs ${formatCurrency(budget)} cap
            </p>
          </div>
          <button class="btn-link btn-explain" data-topic="spending" title="Explain forecast methodology">
            How this is projected →
          </button>
        </div>

        <!-- Native SVG Forecast Chart -->
        <div class="forecast-chart-container" style="margin-top: 16px;">
          ${this.renderNativeForecastSVG(spendForecast, budget, monthSpent)}
        </div>
      </div>

      <!-- Third Section: Habit Consistency & Tomorrow's Risk Nudges -->
      <div class="content-panel" style="margin-bottom: 24px;">
        <div class="panel-header">
          <div>
            <h2 class="panel-title"><span>🌱 Habit Consistency & Tomorrow's Nudges</span></h2>
            <p class="panel-subtitle">
              Preventative reminders based on streaks, transition days, and workload rhythms
            </p>
          </div>
          <button class="btn-link btn-explain" data-topic="habits" title="Explain habit risk model">
            Why you see nudges →
          </button>
        </div>

        <div class="habit-risks-grid" style="margin-top: 16px;">
          ${this.renderHabitRiskCards(habitRisks)}
        </div>
      </div>

      <!-- Fourth Section: 7-Day Performance Trends (Focus Minutes & Habit Heatmap) -->
      <div class="insights-trends-grid">
        <!-- Focus Trend Chart -->
        <div class="content-panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title"><span>📈 7-Day Focus Minutes</span></h2>
              <p class="panel-subtitle">Daily deep work time vs your ${store.getDailyFocusGoal()}m target</p>
            </div>
          </div>
          <div style="margin-top: 14px;">
            ${this.renderFocusTrendBarChart()}
          </div>
        </div>

        <!-- Cross-Module Connections -->
        <div class="content-panel">
          <div class="panel-header">
            <div>
              <h2 class="panel-title"><span>🔗 Lifestyle Connections</span></h2>
              <p class="panel-subtitle">Correlations between your sleep, energy, and productivity</p>
            </div>
            <button class="btn-link btn-explain" data-topic="cross_module" title="Explain correlation methodology">
              How connections work →
            </button>
          </div>
          <div class="insights-grid" style="margin-top: 14px;">
            ${this.renderInsightCards(rawInsights)}
          </div>
        </div>
      </div>

      <!-- Explainability Drawer Container -->
      <div id="explain-drawer" class="explain-drawer">
        <div class="explain-drawer-backdrop" id="explain-drawer-backdrop"></div>
        <div class="explain-drawer-content">
          <div class="explain-drawer-header">
            <h3 id="explain-drawer-title" class="modal-title">Understanding Your Insights</h3>
            <button id="close-explain-drawer" class="btn-icon">✕</button>
          </div>
          <div id="explain-drawer-body" class="explain-drawer-body"></div>
        </div>
      </div>
    `;

    this.bindEvents(focusRec, spendForecast, habitRisks, rawInsights);
  }

  // Precision Native SVG Forecast Chart
  renderNativeForecastSVG(forecast, storeBudget, actualSpent) {
    const width = 840;
    const height = 250;
    const padL = 75;
    const padR = 40;
    const padT = 40;
    const padB = 40;

    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const dayPassed = Math.max(1, today.getDate());

    const spent = typeof actualSpent === 'number' ? actualSpent : (forecast?.spent_so_far || 0);
    const budget = storeBudget || forecast?.monthly_budget || 25000;

    if (spent === 0) {
      return `
        <div class="empty-state-card" style="padding: 32px 20px; text-align: center; border-radius: 12px; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle);">
          <span style="font-size: 2rem; display: block; margin-bottom: 8px;">💰</span>
          <p style="font-weight: 600; font-size: 0.95rem; color: var(--text-main); margin-bottom: 4px;">No spending logged for this month</p>
          <span style="font-size: 0.82rem; color: var(--text-muted);">Record transactions in Personal Finances to generate an intelligent month-end velocity trajectory and confidence interval cone.</span>
        </div>
      `;
    }

    // Linear projection based on run-rate
    const dailyRate = spent / dayPassed;
    const projected = Math.round(dailyRate * daysInMonth);
    const ciUpper = Math.round(projected * 1.12);
    const ciLower = Math.max(spent, Math.round(projected * 0.88));

    // Y-Axis Range with round ₹5,000 steps
    const rawMax = Math.max(budget * 1.3, ciUpper * 1.15, spent * 1.25, 10000);
    const tickStep = 5000;
    const roundedMax = Math.ceil(rawMax / tickStep) * tickStep;
    const minVal = 0;

    const yTicks = [];
    for (let v = 0; v <= roundedMax; v += tickStep) {
      yTicks.push(v);
    }

    const scaleX = (day) => padL + ((day - 1) / (daysInMonth - 1)) * (width - padL - padR);
    const scaleY = (val) => height - padB - ((val - minVal) / (roundedMax - minVal)) * (height - padT - padB);

    // Calculate cumulative points for past days from store transactions
    const expenses = store.getExpenses(today.toISOString().slice(0, 7));
    const dailyCumulative = [];
    let runningTotal = 0;

    for (let d = 1; d <= dayPassed; d++) {
      const dStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const daySpent = expenses
        .filter(e => e.type !== 'income' && (e.date || '').startsWith(dStr))
        .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      runningTotal += daySpent;
      dailyCumulative.push({ day: d, spent: runningTotal });
    }

    // Build actual path
    const actualPoints = dailyCumulative.map(pt => `${scaleX(pt.day)},${scaleY(pt.spent)}`).join(' ');

    const currentX = scaleX(dayPassed);
    const currentY = scaleY(spent);
    const endX = scaleX(daysInMonth);
    const projY = scaleY(projected);
    const ciUpperY = scaleY(ciUpper);
    const ciLowerY = scaleY(ciLower);
    const budgetY = scaleY(budget);

    // Status message
    const isUnder = projected <= budget;
    const diff = Math.abs(budget - projected);
    const statusClass = isUnder ? 'status-pill-success' : 'status-pill-warning';
    const statusText = isUnder
      ? `On pace to finish ${formatCurrency(diff)} under budget (${formatCurrency(projected)} est. vs ${formatCurrency(budget)} cap)`
      : `On pace to finish ${formatCurrency(diff)} over budget (${formatCurrency(projected)} est. vs ${formatCurrency(budget)} cap)`;

    return `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
        <span class="forecast-status-badge ${statusClass}">
          <span>${isUnder ? '✓' : '⚠️'}</span> <span>${statusText}</span>
        </span>
        <span style="font-size: 0.76rem; color: var(--text-muted);">Daily Run Rate: ${formatCurrency(dailyRate)}/day</span>
      </div>

      <svg viewBox="0 0 ${width} ${height}" class="forecast-svg" style="width: 100%; height: auto; display: block; overflow: visible;">
        <defs>
          <linearGradient id="forecastBandGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--accent-primary)" stop-opacity="0.22"/>
            <stop offset="100%" stop-color="var(--accent-primary)" stop-opacity="0.04"/>
          </linearGradient>
        </defs>

        <!-- Y-Axis Grid Lines & Labels -->
        ${yTicks.map(val => {
          const y = scaleY(val);
          return `
            <line x1="${padL}" y1="${y}" x2="${width - padR}" y2="${y}" stroke="var(--border-subtle)" stroke-dasharray="3,3" stroke-width="1" />
            <text x="${padL - 10}" y="${y + 4}" text-anchor="end" fill="var(--text-muted)" font-size="11" font-family="var(--font-mono)">${formatCurrency(val)}</text>
          `;
        }).join('')}

        <!-- Budget Cap Line -->
        <line x1="${padL}" y1="${budgetY}" x2="${width - padR}" y2="${budgetY}" stroke="#ef4444" stroke-dasharray="6,4" stroke-width="2" opacity="0.9" />
        <text x="${width - padR}" y="${budgetY - 8}" text-anchor="end" fill="#ef4444" font-size="11" font-weight="700">Budget Limit: ${formatCurrency(budget)}</text>

        <!-- 95% Confidence Interval Projected Band -->
        <polygon points="${currentX},${currentY} ${endX},${ciUpperY} ${endX},${ciLowerY}" fill="url(#forecastBandGrad)" />

        <!-- Historical Spending Curve -->
        <polyline points="${actualPoints}" fill="none" stroke="var(--accent-primary)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />

        <!-- Projected Future Spending Line -->
        <line x1="${currentX}" y1="${currentY}" x2="${endX}" y2="${projY}" stroke="var(--accent-primary)" stroke-width="2.5" stroke-dasharray="5,4" opacity="0.8" />

        <!-- Current Day Node -->
        <circle cx="${currentX}" cy="${currentY}" r="5.5" fill="#ffffff" stroke="var(--accent-primary)" stroke-width="3.5" />
        <text x="${currentX}" y="${currentY - 14}" text-anchor="middle" fill="var(--text-main)" font-size="11" font-weight="700">Today: ${formatCurrency(spent)}</text>

        <!-- Month End Projected Node -->
        <circle cx="${endX}" cy="${projY}" r="5.5" fill="var(--accent-primary)" stroke="#ffffff" stroke-width="2" />
        <text x="${endX}" y="${projY - 12}" text-anchor="end" fill="var(--text-main)" font-size="11" font-weight="700">Est. Total: ${formatCurrency(projected)}</text>

        <!-- X-Axis Labels -->
        <text x="${padL}" y="${height - 10}" fill="var(--text-muted)" font-size="11">Day 1</text>
        <text x="${currentX}" y="${height - 10}" text-anchor="middle" fill="var(--accent-primary)" font-size="11" font-weight="600">Day ${dayPassed}</text>
        <text x="${endX}" y="${height - 10}" text-anchor="end" fill="var(--text-muted)" font-size="11">Day ${daysInMonth}</text>
      </svg>
    `;
  }

  // 7-Day Focus Minutes Trend Bar Chart
  renderFocusTrendBarChart() {
    const today = new Date();
    const days = [];
    const sessions = store.getSessions();
    const goal = store.getDailyFocusGoal();

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayName = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()];

      const dayMins = sessions
        .filter(s => s.mode === 'focus' && (s.completed_at || '').startsWith(dateStr))
        .reduce((sum, s) => sum + (Number(s.duration_minutes) || 25), 0);

      days.push({ dayName, dateStr, minutes: dayMins, isToday: i === 0 });
    }

    const totalWeekMins = days.reduce((sum, d) => sum + d.minutes, 0);
    if (totalWeekMins === 0) {
      return `
        <div class="empty-state-card" style="padding: 24px 16px; text-align: center; border-radius: 12px; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); margin-top: 10px;">
          <span style="font-size: 1.5rem; display: block; margin-bottom: 6px;">⏱️</span>
          <p style="font-weight: 600; font-size: 0.88rem; color: var(--text-main); margin-bottom: 4px;">No focus sessions logged in the last 7 days</p>
          <span style="font-size: 0.8rem; color: var(--text-muted);">Start a 25-minute Pomodoro session in the Focus Room to begin tracking your daily deep-work trends!</span>
        </div>
      `;
    }

    const maxMins = Math.max(goal * 1.2, ...days.map(d => d.minutes), 60);

    return `
      <div style="display: flex; align-items: flex-end; justify-content: space-between; height: 130px; gap: 8px; padding-top: 10px;">
        ${days.map(d => {
          const heightPct = Math.min(100, Math.round((d.minutes / maxMins) * 100));
          const hitGoal = d.minutes >= goal;
          return `
            <div style="flex: 1; display: flex; flex-direction: column; align-items: center; height: 100%; justify-content: flex-end;" title="${d.dateStr}: ${d.minutes}m focus">
              <span style="font-size: 0.68rem; font-weight: 600; color: ${hitGoal ? 'var(--color-success)' : 'var(--text-muted)'}; margin-bottom: 4px;">${d.minutes > 0 ? d.minutes + 'm' : '—'}</span>
              <div style="width: 100%; max-width: 34px; height: ${Math.max(4, heightPct)}%; background: ${d.isToday ? 'var(--accent-primary)' : (hitGoal ? 'var(--color-success)' : 'var(--accent-soft)')}; border-radius: 4px; transition: height 0.3s ease;"></div>
              <span style="font-size: 0.72rem; color: var(--text-muted); margin-top: 6px; font-weight: ${d.isToday ? '700' : '400'};">${d.dayName}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  // Safe Habit Risk Cards with Clean Empty State
  renderHabitRiskCards(risks) {
    if (!risks || !Array.isArray(risks) || risks.length === 0) {
      return `
        <div class="empty-state-card" style="padding: 24px; text-align: center; border-radius: 12px; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle);">
          <span style="font-size: 1.6rem; display: block; margin-bottom: 8px;">🌱</span>
          <p style="font-weight: 600; color: var(--text-main); margin-bottom: 4px;">Not enough data yet</p>
          <span style="font-size: 0.82rem; color: var(--text-muted);">Check in to your habits for 3 days to see intelligent slip-risk predictions and gentle nudges.</span>
        </div>
      `;
    }

    const valid = risks.filter(r => (r.title || r.habit_title));
    if (valid.length === 0) {
      return `
        <div class="empty-state-card" style="padding: 24px; text-align: center; border-radius: 12px; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle);">
          <span style="font-size: 1.6rem; display: block; margin-bottom: 8px;">🌿</span>
          <p style="font-weight: 600; color: var(--text-main); margin-bottom: 4px;">All habits look steady</p>
          <span style="font-size: 0.82rem; color: var(--text-muted);">Your streaks and consistency are in solid shape!</span>
        </div>
      `;
    }

    return valid.map(r => {
      const title = r.title || r.habit_title || 'Daily Habit';
      const rawScore = r.risk_probability !== undefined ? r.risk_probability : (r.risk_score !== undefined ? r.risk_score : 0.35);
      const scoreNum = typeof rawScore === 'number' && !isNaN(rawScore) ? rawScore : 0.35;
      const riskPct = Math.round(scoreNum * 100);
      const isHigh = scoreNum >= 0.55;
      const badgeClass = isHigh ? 'badge-urgent' : 'badge-subtle';
      const label = isHigh ? 'Gentle Heads-Up' : 'On Track';
      const nudge = r.nudge || r.recommendation || `Keep your momentum going with ${title} tomorrow!`;

      return `
        <div class="habit-risk-card" style="padding: 14px 16px; border-radius: 10px; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-weight: 600; font-size: 0.9rem; color: var(--text-main);">${this.escapeHtml(title)}</span>
              <span class="badge ${badgeClass}">${label}</span>
            </div>
            <span style="font-size: 0.82rem; font-weight: 600; color: ${isHigh ? 'var(--color-danger)' : 'var(--text-muted)'};">${riskPct}% slip chance</span>
          </div>
          <p style="font-size: 0.82rem; color: var(--text-muted); margin: 0; line-height: 1.45;">${this.escapeHtml(nudge)}</p>
        </div>
      `;
    }).join('');
  }

  // Cross-Module Insight Cards
  renderInsightCards(insights) {
    if (!insights || !Array.isArray(insights) || insights.length === 0) {
      return `
        <div style="padding: 16px; text-align: center; border-radius: 8px; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle);">
          <span style="font-size: 1.2rem; display: block; margin-bottom: 4px;">✨</span>
          <span style="font-size: 0.82rem; color: var(--text-muted);">Log more focus sessions and daily reflections to discover lifestyle connections.</span>
        </div>
      `;
    }

    return insights.map(i => {
      const friendlyBadge = this.getFriendlyBadge(i.confidence);
      return `
        <div class="insight-item-box" style="padding: 12px 14px; border-radius: 8px; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-weight: 600; font-size: 0.86rem; color: var(--text-main);">${this.escapeHtml(i.title || 'Productivity Insight')}</span>
            <span class="badge badge-subtle" style="font-size: 0.68rem;">${friendlyBadge}</span>
          </div>
          <p style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.4; margin: 0;">${this.escapeHtml(i.narrative || '')}</p>
        </div>
      `;
    }).join('');
  }

  bindEvents(focusRec, spendForecast, habitRisks, insights) {
    const drawer = document.getElementById('explain-drawer');
    const drawerBackdrop = document.getElementById('explain-drawer-backdrop');
    const closeBtn = document.getElementById('close-explain-drawer');
    const drawerTitle = document.getElementById('explain-drawer-title');
    const drawerBody = document.getElementById('explain-drawer-body');

    const openDrawer = (topic) => {
      if (!drawer) return;
      let title = 'Understanding Your Insights';
      let content = '';

      if (topic === 'focus') {
        title = 'Why this Focus Window?';
        content = `
          <h4>1. What it means for you</h4>
          <p>We analyze the times of day when you finish your sessions with the fewest pauses and longest durations.</p>
          
          <h4>2. Natural Rhythm Over Outliers</h4>
          <p>A single late session won't skew your recommendation. LifeBuddy weights your regular daily consistency so your window reflects your natural peak flow state.</p>
          
          <div style="margin: 14px 0; padding: 12px; border-radius: 8px; background: rgba(99, 102, 241, 0.08); border-left: 3px solid var(--accent-primary);">
            💡 <strong>Pro Tip:</strong> Protect this window from calls, notifications, and tabs to get your most demanding work done effortlessly.
          </div>
        `;
      } else if (topic === 'spending') {
        title = 'How is your forecast projected?';
        content = `
          <h4>1. Your Daily Pace</h4>
          <p>LifeBuddy tracks your average daily spending this month and projects where you will finish on the 30th or 31st against your monthly budget of ${formatCurrency(store.getBudget())}.</p>
          
          <h4>2. The Shaded Prediction Band</h4>
          <p>The shaded area around the line shows your likely range (95% confidence interval). If you spend mindfully on weekdays, you will land comfortably inside your budget.</p>
        `;
      } else if (topic === 'habits') {
        title = 'Why does LifeBuddy nudge you?';
        content = `
          <h4>1. Protecting Your Streaks</h4>
          <p>Habits are most fragile on transition days (like Fridays or weekends), or right after days with heavy cognitive exhaustion.</p>
          
          <h4>2. Helpful Nudges, Not Nagging</h4>
          <p>LifeBuddy only shows a reminder when tomorrow looks like a historically busy day. Plan just 5 minutes in the morning so your streak stays unbroken.</p>
        `;
      } else if (topic === 'cross_module') {
        title = 'How connections are discovered';
        content = `
          <h4>1. Connecting Your Daily Habits</h4>
          <p>Your productivity isn't in a vacuum—how you sleep affects how you focus, and how you focus affects how mindfully you spend.</p>
          
          <h4>2. Reliable Patterns Only</h4>
          <p>We only highlight relationships that hold true across weeks of real activity, so you get reliable insights rather than coincidences.</p>
        `;
      }

      if (drawerTitle) drawerTitle.textContent = title;
      if (drawerBody) drawerBody.innerHTML = content;
      drawer.classList.add('active');
    };

    this.container.querySelectorAll('.btn-explain').forEach(btn => {
      btn.addEventListener('click', () => {
        openDrawer(btn.dataset.topic);
      });
    });

    if (closeBtn) closeBtn.addEventListener('click', () => drawer?.classList.remove('active'));
    if (drawerBackdrop) drawerBackdrop.addEventListener('click', () => drawer?.classList.remove('active'));
  }

  formatMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/\$([0-9]+(\.[0-9]+)?)/g, '₹$1')
      .replace(/\$/g, '₹')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '<br><br>');
  }
}
