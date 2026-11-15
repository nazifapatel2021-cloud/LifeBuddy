/* LifeBuddy Insights & Explainable Intelligence Coordinator
   - Consumer-friendly, relatable human copywriting (no confusing ML jargon)
   - Clean native SVG charts
   - Explainability drawer with intuitive lifestyle explanations
   - Academic & statistical details tucked into a clean expandable examiner view
*/
import { API } from './api.js';

export class InsightsCoordinator {
  constructor(options = {}) {
    this.container = options.container || document.getElementById('ml-insights-container') || document.getElementById('view-insights');
    this.currentExplanation = null;
  }

  // Friendly confidence label converter
  getFriendlyBadge(rawConfidence) {
    if (!rawConfidence) return '✨ Smart Suggestion';
    const lower = rawConfidence.toLowerCase();
    if (lower.includes('high')) return '⭐ High Confidence';
    if (lower.includes('low') || lower.includes('cold')) return '🌱 Getting to know you';
    if (lower.includes('moderate')) return '✨ Reliable Pattern';
    return rawConfidence;
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

    const focusBadge = this.getFriendlyBadge(focusRec.confidence);

    this.container.innerHTML = `
      <!-- Top Section: Weekly Reflection & Best Focus Window -->
      <div class="dashboard-columns" style="margin-bottom: 24px;">
        <!-- Card 1: Best Deep-Work Window -->
        <div class="glass-card">
          <div class="section-header-flex">
            <h2 class="section-title"><span>⏱️ Recommended Focus Window</span></h2>
            <span class="badge badge-subtle">${focusBadge}</span>
          </div>
          <div class="recom-hero-box">
            <div class="recom-window-title">${focusRec.recommended_window}</div>
            <p class="recom-explanation">${focusRec.explanation}</p>
          </div>
          <div style="margin-top: 14px; display: flex; justify-content: flex-end;">
            <button class="btn-text btn-explain" data-topic="focus" title="Understand how this is calculated">
              How does LifeBuddy find this? →
            </button>
          </div>
        </div>

        <!-- Card 2: Weekly Mindful Reflection -->
        <div class="glass-card">
          <div class="section-header-flex">
            <h2 class="section-title"><span>🌿 Weekly Reflection</span></h2>
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
              Projected end-of-month spending based on your daily pace.
            </p>
          </div>
          <button class="btn-text btn-explain" data-topic="spending" title="Explain forecast methodology">
            How this is projected →
          </button>
        </div>

        <!-- Native SVG Forecast Chart -->
        <div class="forecast-chart-wrapper" style="margin-top: 16px;">
          ${this.renderNativeForecastSVG(spendForecast)}
        </div>
      </div>

      <!-- Third Section: Habit Consistency & Tomorrow's Risk Nudges -->
      <div class="glass-card" style="margin-bottom: 24px;">
        <div class="section-header-flex">
          <div>
            <h2 class="section-title"><span>🌱 Habit Consistency & Tomorrow's Nudges</span></h2>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">
              Smart reminders based on your consistency, streaks, and recent busy days.
            </p>
          </div>
          <button class="btn-text btn-explain" data-topic="habits" title="Explain habit risk model">
            Why you see nudges →
          </button>
        </div>

        <div class="habit-risks-grid">
          ${this.renderHabitRiskCards(habitRisks)}
        </div>
      </div>

      <!-- Fourth Section: Cross-Module Lifestyle Correlations -->
      <div class="glass-card">
        <div class="section-header-flex">
          <div>
            <h2 class="section-title"><span>🔗 Lifestyle & Productivity Connections</span></h2>
            <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">
              Meaningful connections discovered between your sleep, focus, habits, and spending over time.
            </p>
          </div>
          <button class="btn-text btn-explain" data-topic="cross_module" title="Explain correlation methodology">
            How connections are found →
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
            <h3 id="explain-drawer-title" class="modal-title">Understanding Your Insights</h3>
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

    return `
      <svg viewBox="0 0 ${width} ${height}" class="forecast-svg" style="width: 100%; height: auto; display: block;">
        <defs>
          <linearGradient id="forecastBandGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--accent-primary)" stop-opacity="0.25"/>
            <stop offset="100%" stop-color="var(--accent-primary)" stop-opacity="0.03"/>
          </linearGradient>
          <linearGradient id="spentGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="var(--accent-primary)" stop-opacity="0.4"/>
            <stop offset="100%" stop-color="var(--accent-primary)" stop-opacity="0.0"/>
          </linearGradient>
        </defs>

        <!-- Grid Lines -->
        <line x1="${padX}" y1="${budgetY}" x2="${endX}" y2="${budgetY}" stroke="var(--danger-color)" stroke-dasharray="6,4" stroke-width="1.5" opacity="0.8"/>
        <text x="${endX - 8}" y="${budgetY - 8}" text-anchor="end" fill="var(--danger-color)" font-size="11" font-weight="600">Budget Limit (₹${budget.toFixed(0)})</text>

        <!-- 95% Confidence Interval Projected Cone -->
        <polygon points="${currentX},${currentY} ${endX},${ciUpperY} ${endX},${ciLowerY}" fill="url(#forecastBandGrad)" />

        <!-- Historical Spending Line -->
        <line x1="${startX}" y1="${startY}" x2="${currentX}" y2="${currentY}" stroke="var(--accent-primary)" stroke-width="3" stroke-linecap="round"/>

        <!-- Projected Trajectory Line -->
        <line x1="${currentX}" y1="${currentY}" x2="${endX}" y2="${projY}" stroke="var(--accent-primary)" stroke-width="2.5" stroke-dasharray="5,4"/>

        <!-- Current Day Data Point -->
        <circle cx="${currentX}" cy="${currentY}" r="5" fill="var(--bg-card)" stroke="var(--accent-primary)" stroke-width="3"/>
        <text x="${currentX}" y="${currentY - 12}" text-anchor="middle" fill="var(--text-primary)" font-size="11" font-weight="600">Today: ₹${spent.toFixed(0)}</text>

        <!-- End of Month Projection Point -->
        <circle cx="${endX}" cy="${projY}" r="5" fill="var(--accent-primary)"/>
        <text x="${endX}" y="${projY - 10}" text-anchor="end" fill="var(--text-primary)" font-size="11" font-weight="600">Est. Total: ₹${projected.toFixed(0)}</text>

        <!-- Axis Labels -->
        <text x="${padX}" y="${height - 8}" fill="var(--text-muted)" font-size="11">Day 1</text>
        <text x="${currentX}" y="${height - 8}" text-anchor="middle" fill="var(--accent-primary)" font-size="11">Day ${dayPassed}</text>
        <text x="${endX}" y="${height - 8}" text-anchor="end" fill="var(--text-muted)" font-size="11">Day ${daysInMonth}</text>
      </svg>
    `;
  }

  renderHabitRiskCards(risks) {
    if (!risks || risks.length === 0) {
      return `
        <div class="empty-state-sm">
          <span>🌿</span> <span>Habits look steady! Keep up your daily consistency.</span>
        </div>
      `;
    }

    return risks.map(r => {
      const riskPct = Math.round(r.risk_score * 100);
      const isHigh = r.risk_score >= 0.55;
      const badgeClass = isHigh ? 'badge-urgent' : 'badge-subtle';
      const label = isHigh ? 'Gentle Heads-Up' : 'On Track';

      return `
        <div class="habit-risk-card glass-pill">
          <div class="habit-risk-header">
            <div>
              <span class="habit-risk-title">${r.habit_title}</span>
              <span class="badge ${badgeClass}" style="margin-left: 8px;">${label}</span>
            </div>
            <span class="habit-risk-pct">${riskPct}% slip chance</span>
          </div>
          <p class="habit-risk-rec">${r.recommendation}</p>
        </div>
      `;
    }).join('');
  }

  renderInsightCards(insights) {
    if (!insights || insights.length === 0) {
      return `
        <div class="empty-state-sm">
          <span>✨</span> <span>Logging more focus sessions, habits, and rest helps LifeBuddy unlock personal connections!</span>
        </div>
      `;
    }

    return insights.map(i => {
      const friendlyBadge = this.getFriendlyBadge(i.confidence);
      return `
        <div class="insight-card glass-card">
          <div class="insight-header">
            <h3 class="insight-title">${i.title}</h3>
            <span class="badge badge-subtle">${friendlyBadge}</span>
          </div>
          <p class="insight-narrative">${i.narrative}</p>
          <div class="insight-meta">
            <span>🌱 Impact: <strong>${i.effect_size || 'Noticeable'}</strong></span>
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
      let title = 'Understanding Your Insights';
      let content = '';

      if (topic === 'focus') {
        title = 'Why this Focus Window?';
        content = `
          <h4>1. What it means for you</h4>
          <p>We analyze the times of day when you finish your sessions with the fewest pauses and longest durations.</p>
          
          <h4>2. Natural Rhythm Over Outliers</h4>
          <p>A single late session won't skew your recommendation. LifeBuddy weights your regular daily consistency so your window reflects your natural peak flow state.</p>
          
          <div class="explain-tip-box" style="margin: 14px 0; padding: 12px; border-radius: 8px; background: rgba(var(--accent-primary-rgb, 120, 160, 120), 0.12);">
            💡 <strong>Pro Tip:</strong> Protect this window from calls, notifications, and tabs to get your most demanding work done effortlessly.
          </div>

          <details style="margin-top: 18px; padding-top: 14px; border-top: 1px dashed var(--border-color); font-size: 0.82rem; color: var(--text-muted);">
            <summary style="cursor: pointer; font-weight: 600; color: var(--text-primary);">🔬 Technical & Evaluation Details (Academic Mode)</summary>
            <div style="margin-top: 8px;">
              <p><strong>Algorithm:</strong> Bayesian Smoothed Circadian Kernel Density Estimation.</p>
              <p><strong>Smoothing Prior:</strong> Gaussian shrinkage with weight <em>m = 5.0</em> toward a circadian baseline.</p>
              <p><strong>Baseline Comparison:</strong> Evaluated against simple user-mode baseline on time-series holdouts.</p>
            </div>
          </details>
        `;
      } else if (topic === 'spending') {
        title = 'How is your forecast projected?';
        content = `
          <h4>1. Your Daily Pace</h4>
          <p>LifeBuddy tracks your average daily spending this month and projects where you will finish on the 30th or 31st.</p>
          
          <h4>2. The Shaded Prediction Band</h4>
          <p>The shaded area around the line shows your likely range. If you spend mindfully on weekdays, you will easily land comfortably inside your monthly budget.</p>

          <details style="margin-top: 18px; padding-top: 14px; border-top: 1px dashed var(--border-color); font-size: 0.82rem; color: var(--text-muted);">
            <summary style="cursor: pointer; font-weight: 600; color: var(--text-primary);">🔬 Technical & Evaluation Details (Academic Mode)</summary>
            <div style="margin-top: 8px;">
              <p><strong>Anomaly Detection:</strong> Isolation Forest (contamination = 0.05) + rolling Z-score.</p>
              <p><strong>Forecasting Model:</strong> Holt-Winters linear trend extrapolation with 95% Gaussian confidence intervals.</p>
            </div>
          </details>
        `;
      } else if (topic === 'habits') {
        title = 'Why does LifeBuddy nudge you?';
        content = `
          <h4>1. Protecting Your Streaks</h4>
          <p>Habits are most fragile on transition days (like Fridays or weekends), or right after days with heavy cognitive exhaustion.</p>
          
          <h4>2. Helpful Nudges, Not Nagging</h4>
          <p>LifeBuddy only shows a reminder when tomorrow looks like a historically busy day. Plan just 5 minutes in the morning so your streak stays unbroken.</p>

          <details style="margin-top: 18px; padding-top: 14px; border-top: 1px dashed var(--border-color); font-size: 0.82rem; color: var(--text-muted);">
            <summary style="cursor: pointer; font-weight: 600; color: var(--text-primary);">🔬 Technical & Evaluation Details (Academic Mode)</summary>
            <div style="margin-top: 8px;">
              <p><strong>Classifier:</strong> Per-user L2 Logistic Regression on 7-day adherence velocity, current streak, weekday, focus minutes, and daily sleep.</p>
              <p><strong>Trigger Criterion:</strong> Nudge activated when predicted slip probability exceeds 55%.</p>
            </div>
          </details>
        `;
      } else if (topic === 'cross_module') {
        title = 'How connections are discovered';
        content = `
          <h4>1. Connecting Your Daily Habits</h4>
          <p>Your productivity isn't in a vacuum—how you sleep affects how you focus, and how you focus affects how mindfully you spend.</p>
          
          <h4>2. Reliable Patterns Only</h4>
          <p>We only highlight relationships that hold true across weeks of real activity, so you get reliable insights rather than coincidences.</p>

          <details style="margin-top: 18px; padding-top: 14px; border-top: 1px dashed var(--border-color); font-size: 0.82rem; color: var(--text-muted);">
            <summary style="cursor: pointer; font-weight: 600; color: var(--text-primary);">🔬 Technical & Evaluation Details (Academic Mode)</summary>
            <div style="margin-top: 8px;">
              <p><strong>Statistical Tests:</strong> Lagged Pearson (r) and Spearman rank correlations with two-tailed p-values.</p>
              <p><strong>Significance Threshold:</strong> Filtered strictly for <em>p &lt; 0.05</em> and sample size <em>N &ge; 14 days</em>.</p>
            </div>
          </details>
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
