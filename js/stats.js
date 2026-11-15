/* LifeBuddy Analytics & Insights Visualizer */
import { Storage } from './storage.js';
import { API } from './api.js';

export class StatsVisualizer {
  constructor() {
    this.updateStatsUI();
  }

  async updateStatsUI() {
    const stats = Storage.getStats();

    const totalMins = Number(stats ? stats.totalMinutes : 0) || 0;
    const hours = (totalMins / 60).toFixed(1);
    const totalMinutesEl = document.getElementById('stat-total-time');
    const totalPomosEl = document.getElementById('stat-total-pomos');
    const streakEl = document.getElementById('stat-streak');

    if (totalMinutesEl) totalMinutesEl.textContent = `${hours}h`;
    if (totalPomosEl) totalPomosEl.textContent = (stats && stats.completedPomodoros) || 0;
    if (streakEl) streakEl.textContent = `${stats.currentStreak} 🔥`;

    this.renderWeeklyChart(stats.dailyHistory);
    await this.renderCategoryBreakdown();
  }

  renderWeeklyChart(dailyHistory = {}) {
    const chartContainer = document.getElementById('weekly-chart-container');
    if (!chartContainer) return;

    // Get last 7 days dates
    const days = [];
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = d.toLocaleDateString('en-US', { weekday: 'short' });
      const minutes = dailyHistory[dateStr] || 0;
      days.push({ dateStr, dayLabel, minutes });
    }

    const maxMinutes = Math.max(...days.map(d => d.minutes), 60);

    chartContainer.innerHTML = `
      <div class="weekly-chart-bars">
        ${days.map(d => {
          const heightPercent = Math.min(100, Math.max(8, (d.minutes / maxMinutes) * 100));
          return `
            <div class="chart-col">
              <span class="chart-val">${d.minutes > 0 ? d.minutes + 'm' : ''}</span>
              <div class="chart-bar" style="height: ${heightPercent}%; opacity: ${d.minutes > 0 ? '0.9' : '0.25'};"></div>
              <span class="chart-label">${d.dayLabel}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  async renderCategoryBreakdown() {
    const container = document.getElementById('finance-category-chart');
    if (!container) return;

    try {
      const expenses = await API.expenses.getAll();
      const currentMonth = new Date().toISOString().slice(0, 7);
      const monthExpenses = expenses.filter(e => (e.date || '').startsWith(currentMonth) && e.type === 'expense');

      if (monthExpenses.length === 0) {
        container.innerHTML = `
          <div class="empty-state-sm">
            <span>🪙</span> <span>No spending logged this month yet.</span>
          </div>
        `;
        return;
      }

      const total = monthExpenses.reduce((sum, e) => sum + e.amount, 0);
      const cats = {};
      monthExpenses.forEach(e => {
        cats[e.category] = (cats[e.category] || 0) + e.amount;
      });

      const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);

      container.innerHTML = sorted.map(([cat, amt]) => {
        const pct = Math.round((amt / total) * 100);
        return `
          <div class="category-breakdown-row">
            <div class="cat-row-top">
              <span class="cat-name">${cat}</span>
              <span class="cat-amt">₹${amt.toFixed(2)} (${pct}%)</span>
            </div>
            <div class="progress-bar-bg" style="height: 6px;">
              <div class="progress-bar-fill" style="width: ${pct}%;"></div>
            </div>
          </div>
        `;
      }).join('');
    } catch (e) {
      console.warn('Could not render category breakdown', e);
    }
  }
}
