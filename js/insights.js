/* LifeBuddy Insights & Explainable Intelligence Coordinator */
import { API } from './api.js';

export class InsightsCoordinator {
  constructor(options = {}) {
    this.container = options.container || document.getElementById('ml-insights-container') || document.getElementById('view-insights');
    this.currentExplanation = null;
  }

  async render() {
    if (!this.container) return;

    // Load data from ML endpoints concurrently
    const [focusRec, spendForecast, habitRisks, insights, reflection] = await Promise.all([
      API.ml.getFocusRecommendation(),
      API.ml.getSpendingForecast(),
      API.ml.getHabitRisks(),
      API.ml.getCrossModuleInsights(),
      API.ml.getWeeklyReflection()
    ]);

    this.container.innerHTML = `
      <!-- Top Section: Weekly Reflection & Best Focus Window -->
      <div class="dashboard-columns" style="margin-bottom: 24px;">
        <!-- Card 1: Best Deep-Work Window -->
        <div class="glass-card">
          <div class="section-header-flex">
            <h2 class="section-title"><span>⏱️ Recommended Focus Window</span></h2>
            <span class="badge badge-subtle">${focusRec.confidence || 'Personalized'}</span>
          </div>
          <div class="recom-hero-box">
            <div class="recom-window-title">${focusRec.recommended_window}</div>
            <p class="recom-explanation">${focusRec.explanation}</p>
          </div>
          <div style="margin-top: 14px; display: flex; justify-content: flex-end;">
            <button class="btn-text btn-explain" data-topic="focus" title="Understand how this is calculated">
              Why am I seeing this? →
            </button>
          </div>
        </div>

        <!-- Card 2: Weekly Mindful Reflection -->
        <div class="glass-card">
          <div class="section-header-flex">
            <h2 class="section-title"><span>🌿 Weekly Mindful Reflection</span></h2>
            <span class="badge badge-subtle">${reflection.period || 'Past 7 Days'}</span>
          </div>
          <div class="reflection-box">
            <div class="reflection-content">${this.formatMarkdown(reflection.reflection)}</div>
          </div>
        </div>
      </div>

      <!-- Second Section: Spending Forecast vs Budget (Pure Native SVG Chart) -->
      <div class="glass-card" style="margin-bottom: 24px;">
        <div class="section-header-flex">
          <div>
            <h2 class="section-title"><span>💰 Month-End Spending Forecast vs Budget</span></h2>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">
              ${spendForecast.explanation || 'Projected month-end spending with 95% confidence intervals.'}
            </p>
          </div>
          <button class="btn-text btn-explain" data-topic="spending" title="Explain forecast methodology">
            Why am I seeing this? →
          </button>
        </div>

        <!-- Native SVG Forecast Chart -->
        <div class="forecast-chart-wrapper" style="margin-top: 16px;">
          ${this.renderNativeForecastSVG(spendForecast)}
        </div>
      </div>

      <!-- Third Section: Habit Miss Risk Nudges -->
      <div class="glass-card" style="margin-bottom: 24px;">
        <div class="section-header-flex">
          <div>
            <h2 class="section-title"><span>🌱 Habit Consistency & Tomorrow's Risk Nudges</span></h2>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">
              Predictive risk scores for tomorrow based on your streaks, weekday habits, and recent energy.
            </p>
          </div>
          <button class="btn-text btn-explain" data-topic="habits" title="Explain habit risk model">
            Why am I seeing this? →
          </button>
        </div>

        <div class="habit-risks-grid">
          ${this.renderHabitRiskCards(habitRisks)}
        </div>
      </div>

      <!-- Fourth Section: Cross-Module Causal Insights -->
      <div class="glass-card">
        <div class="section-header-flex">
          <div>
            <h2 class="section-title"><span>🔗 Cross-Module Lifestyle Correlations</span></h2>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">
              Statistically significant relationships between sleep, focus, habits, and spending (p &lt; 0.05).
            </p>
          </div>
          <button class="btn-text btn-explain" data-topic="cross_module" title="Explain correlation methodology">
            Why am I seeing this? →
          </button>
        </div>

        <div class="insights-grid">
          ${this.renderInsightCards(insights)}
        </div>
      </div>

      <!-- Explainability Drawer Container -->
      <div id="explain-drawer" class="explain-drawer">
        <div class="explain-drawer-backdrop" id="explain-drawer-backdrop"></div>
        <div class="explain-drawer-content">
          <div class="explain-drawer-header">
            <h3 id="explain-drawer-title" class="modal-title">Model Explainability</h3>
            <button id="close-explain-drawer" class="btn-icon">✕</button>
          </div>
          <div id="explain-drawer-body" class="explain-drawer-body"></div>
        </div>
      </div>
    `;

    this.bindEvents(focusRec, spendForecast, habitRisks, insights);
  }

  renderNativeForecastSVG(forecast) {
    const width = 800;
    const height = 220;
    const padX = 60;
    const padY = 30;

    const spent = forecast.spent_so_far || 0;
    const budget = forecast.monthly_budget || 1000;
    const projected = forecast.projected_month_end || spent;
    const ci = forecast.confidence_interval_95 || [projected * 0.9, projected * 1.1];

    const maxVal = Math.max(budget * 1.25, ci[1] * 1.15, 100);
    const minVal = 0;

    const scaleY = (v) => height - padY - ((v - minVal) / (maxVal - minVal)) * (height - 2 * padY);

    const budgetY = scaleY(budget);
    const today = new Date();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const dayPassed = today.getDate();

    const startX = padX;
    const currentX = padX + (dayPassed / daysInMonth) * (width - 2 * padX);
    const endX = width - padX;

    const startY = scaleY(0);
    const currentY = scaleY(spent);
    const projY = scaleY(projected);
    const ciUpperY = scaleY(ci[1]);
    const ciLowerY = scaleY(ci[0]);

    // Path 1: Spent so far
    const pathSpent = `M ${startX} ${startY} L ${currentX} ${currentY}`;
    // Path 2: Projected path
    const pathProj = `M ${currentX} ${currentY} L ${endX} ${projY}`;
    // Polygon: Confidence interval cone
    const polyCI = `${currentX},${currentY} ${endX},${ciUpperY} ${endX},${ciLowerY}`;

    const isOver = projected > budget;
    const breachProb = Math.round((forecast.budget_breach_probability || 0) * 100);

    return `
      <svg class="forecast-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="ciGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--accent-primary)" stop-opacity="0.22" />
            <stop offset="100%" stop-color="var(--accent-primary)" stop-opacity="0.04" />
          </linearGradient>
        </defs>

        <!-- Background grid lines -->
        <line x1="${padX}" y1="${scaleY(maxVal * 0.75)}" x2="${endX}" y2="${scaleY(maxVal * 0.75)}" stroke="var(--border-color)" stroke-dasharray="4" />
        <line x1="${padX}" y1="${scaleY(maxVal * 0.50)}" x2="${endX}" y2="${scaleY(maxVal * 0.50)}" stroke="var(--border-color)" stroke-dasharray="4" />
        <line x1="${padX}" y1="${scaleY(maxVal * 0.25)}" x2="${endX}" y2="${scaleY(maxVal * 0.25)}" stroke="var(--border-color)" stroke-dasharray="4" />

        <!-- 95% Confidence Interval Polygon -->
        <polygon points="${polyCI}" fill="url(#ciGradient)" />

        <!-- Monthly Budget Threshold Line -->
        <line x1="${padX}" y1="${budgetY}" x2="${endX}" y2="${budgetY}" stroke="#ef4444" stroke-width="2" stroke-dasharray="6,4" />
        <text x="${endX - 10}" y="${budgetY - 8}" text-anchor="end" fill="#ef4444" font-size="12" font-weight="700">Budget Limit: $${budget.toFixed(0)}</text>

        <!-- Current Spent Line -->
        <path d="${pathSpent}" fill="none" stroke="var(--accent-primary)" stroke-width="3.5" stroke-linecap="round" />

        <!-- Projected Path (Dashed) -->
        <path d="${pathProj}" fill="none" stroke="${isOver ? '#ef4444' : 'var(--accent-primary)'}" stroke-width="2.5" stroke-dasharray="5,5" />

        <!-- Current Date Marker Dot -->
        <circle cx="${currentX}" cy="${currentY}" r="6" fill="var(--accent-primary)" stroke="#ffffff" stroke-width="2" />
        <text x="${currentX}" y="${currentY - 12}" text-anchor="middle" font-size="11" font-weight="700" fill="var(--text-main)">Spent: $${spent.toFixed(0)}</text>

        <!-- Projected End Dot -->
        <circle cx="${endX}" cy="${projY}" r="5" fill="${isOver ? '#ef4444' : 'var(--accent-primary)'}" />
        <text x="${endX}" y="${projY - 10}" text-anchor="end" font-size="11" font-weight="700" fill="${isOver ? '#ef4444' : 'var(--text-main)'}">Forecast: $${projected.toFixed(0)}</text>

        <!-- Axis Labels -->
        <text x="${padX}" y="${height - 8}" font-size="11" fill="var(--text-muted)">Day 1</text>
        <text x="${currentX}" y="${height - 8}" text-anchor="middle" font-size="11" fill="var(--text-muted)">Today (Day ${dayPassed})</text>
        <text x="${endX}" y="${height - 8}" text-anchor="end" font-size="11" fill="var(--text-muted)">Month-End (Day ${daysInMonth})</text>
      </svg>
      <div class="forecast-legend">
        <span><span class="legend-dot" style="background: var(--accent-primary);"></span> Actual Spend</span>
        <span><span class="legend-dot" style="background: var(--accent-primary); border: 1px dashed;"></span> Projected Trend</span>
        <span><span class="legend-dot" style="background: rgba(59, 110, 88, 0.3);"></span> 95% Confidence Band ($${ci[0].toFixed(0)} – $${ci[1].toFixed(0)})</span>
        <span><span class="legend-dot" style="background: #ef4444;"></span> Budget Cap ($${budget.toFixed(0)})</span>
        ${isOver ? `<span class="badge badge-danger">Risk: ${breachProb}% chance of exceeding budget</span>` : `<span class="badge badge-safe">On Track</span>`}
      </div>
    `;
  }

  renderHabitRiskCards(risks) {
    if (!risks || risks.length === 0) {
      return `
        <div class="empty-state-sm" style="grid-column: 1 / -1;">
          <span>🌱</span> <span>All habits are in steady rhythm. No high-risk triggers detected for tomorrow!</span>
        </div>
      `;
    }

    return risks.map(r => {
      const riskPct = Math.round(r.risk_probability * 100);
      let badgeClass = 'badge-safe';
      if (r.risk_level === 'High') badgeClass = 'badge-danger';
      else if (r.risk_level === 'Moderate') badgeClass = 'badge-high';

      return `
        <div class="habit-risk-card glass-pill">
          <div class="habit-risk-header">
            <span class="habit-risk-title">${r.icon} ${r.title}</span>
            <span class="badge ${badgeClass}">${riskPct}% Miss Risk</span>
          </div>
          <div class="habit-risk-streak">🔥 ${r.streak} day streak at stake</div>
          <p class="habit-risk-nudge">${r.nudge}</p>
        </div>
      `;
    }).join('');
  }

  renderInsightCards(insights) {
    if (!insights || insights.length === 0) {
      return `
        <div class="empty-state-sm" style="grid-column: 1 / -1;">
          <span>🔍</span> <span>Analyzing longitudinal logs. Insights unlock as correlations achieve p &lt; 0.05.</span>
        </div>
      `;
    }

    return insights.map(i => {
      const isPositive = i.direction === 'positive';
      const icon = i.category === 'focus' ? '🧠' : (i.category === 'finances' ? '💸' : (i.category === 'habits' ? '🏃' : '✨'));

      return `
        <div class="insight-card glass-pill">
          <div class="insight-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 1.25rem;">${icon}</span>
              <span class="insight-title">${i.title}</span>
            </div>
            <span class="badge ${i.confidence.includes('High') ? 'badge-safe' : 'badge-subtle'}">${i.confidence}</span>
          </div>
          <p class="insight-narrative">${i.narrative}</p>
          <div class="insight-meta">
            ${i.p_value !== undefined ? `<span>p = ${i.p_value}</span> • <span>r = ${i.correlation > 0 ? '+' : ''}${i.correlation}</span> • <span>${i.effect_size} Effect</span>` : ''}
          </div>
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
      let title = 'Model Explainability';
      let content = '';

      if (topic === 'focus') {
        title = 'Why this Deep-Work Window?';
        content = `
          <h4>1. Algorithm & Data Used</h4>
          <p>We analyze every focus session you have completed, recording the hour of day, day of the week, and interruption frequency.</p>
          <h4>2. Bayesian Smoothing Method</h4>
          <p>A single good session at 3am does not make 3am optimal. We apply <strong>Bayesian Shrinkage Smoothing (weight m = 5.0)</strong> which regularizes sparse observations toward a physiological circadian prior.</p>
          <h4>3. Findings</h4>
          <p>${focusRec.explanation}</p>
          <div class="explain-tip-box">
            💡 <strong>Actionable Tip:</strong> Block your calendar for this window and put your phone on 'Do Not Disturb' to maximize flow state.
          </div>
        `;
      } else if (topic === 'spending') {
        title = 'How is the Forecast Calculated?';
        content = `
          <h4>1. Algorithm & Data Used</h4>
          <p>This forecast combines <strong>Isolation Forest</strong> anomaly screening with <strong>Linear Time-Series Trend Extrapolation</strong> across your daily transactions.</p>
          <h4>2. 95% Confidence Interval</h4>
          <p>The shaded band represents the <strong>95% Gaussian standard error bounds</strong> over the remaining days in the month. There is a 95% mathematical probability that your final balance falls inside this interval if your current trajectory continues.</p>
          <h4>3. Status</h4>
          <p>${spendForecast.explanation}</p>
        `;
      } else if (topic === 'habits') {
        title = 'How is Habit Risk Evaluated?';
        content = `
          <h4>1. Predictive Features</h4>
          <p>Our per-user L2 Logistic Regression evaluates: your current streak, tomorrow's weekday, your 7-day adherence velocity, yesterday's focus minutes, and daily mood.</p>
          <h4>2. Behavioral Science Backing</h4>
          <p>Research in habit formation shows that adherence drops on transition days (e.g. Thursdays or weekends) following days with low sleep or high cognitive fatigue. Nudges trigger only when risk &gt; 60%.</p>
        `;
      } else if (topic === 'cross_module') {
        title = 'Cross-Module Correlation Rigor';
        content = `
          <h4>1. Statistical Filter</h4>
          <p>We calculate lagged Pearson ($r$) and Spearman ($\rho$) coefficients. We strictly filter for <strong>p &lt; 0.05</strong> and minimum <strong>N &ge; 14 days</strong>.</p>
          <h4>2. What does p &lt; 0.05 mean?</h4>
          <p>A p-value under 0.05 means there is less than a 5% chance that this connection occurred purely at random. It represents an empirically observed behavioral feedback loop in your personal routine.</p>
        `;
      }

      drawerTitle.textContent = title;
      drawerBody.innerHTML = content;
      drawer.classList.add('active');
    };

    this.container.querySelectorAll('.btn-explain').forEach(btn => {
      btn.addEventListener('click', () => {
        openDrawer(btn.dataset.topic);
      });
    });

    if (closeBtn) closeBtn.addEventListener('click', () => drawer.classList.remove('active'));
    if (drawerBackdrop) drawerBackdrop.addEventListener('click', () => drawer.classList.remove('active'));
  }

  formatMarkdown(text) {
    if (!text) return '';
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\n\n/g, '<br><br>');
  }
}
