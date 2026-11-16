/* LifeBuddy Personal Finances & Mindful Budget Manager */
import { API } from './api.js';
import { store } from './store.js';
import { formatCurrency } from './currency.js';

export const CATEGORY_ICONS = {
  'Food': '🍔',
  'Study': '📚',
  'Transport': '🚗',
  'Shopping': '🛍️',
  'Bills': '⚡',
  'Health': '💊',
  'Entertainment': '🎬',
  'Income': '💰',
  'Salary': '💼',
  'Investment': '📈',
  'Other': '📦'
};

const CATEGORY_COLORS = {
  'Food': '#f59e0b',
  'Study': '#6366f1',
  'Transport': '#0ea5e9',
  'Shopping': '#ec4899',
  'Bills': '#ef4444',
  'Health': '#10b981',
  'Entertainment': '#8b5cf6',
  'Income': '#10b981',
  'Other': '#64748b'
};

export class ExpenseManager {
  constructor(options = {}) {
    this.currency = '₹';
    this.selectedMonth = new Date().toISOString().slice(0, 7);
    this.selectedCategory = 'all';
    this.searchQuery = '';
    this.onChanged = options.onChanged || (() => {});

    // Subscribe to store updates
    store.subscribe(() => {
      this.render();
    });
  }

  async init() {
    await store.fetchState();
    this.render();
    this.bindGlobalFinanceEvents();
  }

  bindGlobalFinanceEvents() {
    const addBtn = document.getElementById('btn-add-expense-modal');
    const modal = document.getElementById('expense-modal');
    const closeBtn = document.getElementById('close-expense-modal');
    const form = document.getElementById('expense-form');

    if (addBtn && modal) {
      addBtn.addEventListener('click', () => {
        modal.classList.add('active');
        const dateInput = document.getElementById('exp-date-input');
        if (dateInput && !dateInput.value) {
          dateInput.value = new Date().toISOString().split('T')[0];
        }
      });
    }

    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => {
        modal.classList.remove('active');
      });
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const amountInput = document.getElementById('exp-amount-input');
        const noteInput = document.getElementById('exp-note-input');
        const catSelect = document.getElementById('exp-category-select');
        const dateInput = document.getElementById('exp-date-input');
        const typeSelect = document.getElementById('exp-type-select');

        const amount = parseFloat(amountInput?.value) || 0;
        const note = noteInput?.value.trim() || '';
        const category = catSelect?.value || 'Food';
        const date = dateInput?.value || new Date().toISOString().split('T')[0];
        const type = typeSelect?.value || 'expense';

        if (amount > 0) {
          await store.createExpense({ amount, note, category, date, type });
          form.reset();
          if (modal) modal.classList.remove('active');
        }
      });
    }
  }

  getFilteredExpenses() {
    let list = store.state.expenses || [];

    // Filter by Month
    if (this.selectedMonth) {
      list = list.filter(e => (e.date || '').startsWith(this.selectedMonth));
    }

    // Filter by Category
    if (this.selectedCategory !== 'all') {
      list = list.filter(e => e.category === this.selectedCategory);
    }

    // Filter by Search
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      list = list.filter(e => 
        (e.note || '').toLowerCase().includes(q) || 
        (e.category || '').toLowerCase().includes(q)
      );
    }

    // Sort newest first
    return [...list].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }

  getFinancesSummary() {
    const list = (store.state.expenses || []).filter(e => (e.date || '').startsWith(this.selectedMonth));
    const budget = store.getBudget();

    const totalExpense = list
      .filter(e => e.type === 'expense')
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const totalIncome = list
      .filter(e => e.type === 'income')
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    // Group expenses by category
    const categoryTotals = {};
    list
      .filter(e => e.type === 'expense')
      .forEach(e => {
        categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
      });

    // Days calculation for pacing
    const now = new Date();
    const [year, month] = this.selectedMonth.split('-').map(Number);
    const isCurrentMonth = (now.getFullYear() === year && (now.getMonth() + 1) === month);
    const daysInMonth = new Date(year, month, 0).getDate();
    const daysPassed = isCurrentMonth ? Math.max(1, now.getDate()) : daysInMonth;

    const dailyAverage = totalExpense / daysPassed;
    const projectedMonthEnd = isCurrentMonth ? dailyAverage * daysInMonth : totalExpense;

    // Top Category
    let topCategory = 'None';
    let maxCatAmount = 0;
    Object.entries(categoryTotals).forEach(([cat, amt]) => {
      if (amt > maxCatAmount) {
        maxCatAmount = amt;
        topCategory = cat;
      }
    });

    const budgetPercent = budget > 0 ? Math.min(100, Math.round((totalExpense / budget) * 100)) : 0;
    const remaining = Math.max(0, budget - totalExpense);

    return {
      totalExpense,
      totalIncome,
      netBalance: totalIncome - totalExpense,
      monthlyBudget: budget,
      budgetPercent,
      remaining,
      dailyAverage,
      projectedMonthEnd,
      topCategory,
      categoryTotals,
      daysInMonth,
      daysPassed,
      count: list.length
    };
  }

  render() {
    const widgetContainer = document.getElementById('budget-widget-container');
    const listContainer = document.getElementById('expense-list-container');
    const chartContainer = document.getElementById('finance-category-chart');

    if (widgetContainer) this.renderBudgetWidget(widgetContainer);
    if (listContainer) this.renderExpenseList(listContainer);
    if (chartContainer) this.renderCategoryBreakdown(chartContainer);
  }

  renderBudgetWidget(container) {
    const summary = this.getFinancesSummary();
    const isOver = summary.totalExpense > summary.monthlyBudget;

    let barColor = 'var(--accent-primary)';
    if (summary.budgetPercent > 90) barColor = 'var(--color-danger, #ef4444)';
    else if (summary.budgetPercent > 70) barColor = 'var(--color-warning, #f59e0b)';

    container.innerHTML = `
      <!-- Budget Pacing Overview -->
      <div class="finances-kpi-summary-row">
        <div class="fin-kpi-card">
          <span class="fin-kpi-label">Month-to-Date Spend</span>
          <span class="fin-kpi-value text-expense">${formatCurrency(summary.totalExpense)}</span>
          <span class="fin-kpi-sub">${summary.budgetPercent}% of monthly limit</span>
        </div>

        <div class="fin-kpi-card">
          <span class="fin-kpi-label">Remaining Safe Budget</span>
          <span class="fin-kpi-value ${isOver ? 'text-expense' : 'text-income'}">
            ${isOver ? `-${formatCurrency(summary.totalExpense - summary.monthlyBudget)}` : formatCurrency(summary.remaining)}
          </span>
          <span class="fin-kpi-sub">${isOver ? 'Exceeded Budget' : 'Safe to spend'}</span>
        </div>

        <div class="fin-kpi-card">
          <span class="fin-kpi-label">Daily Burn Rate</span>
          <span class="fin-kpi-value">${formatCurrency(summary.dailyAverage)}<span style="font-size: 0.75rem; color: var(--text-muted); font-weight: normal;">/day</span></span>
          <span class="fin-kpi-sub">Day ${summary.daysPassed} of ${summary.daysInMonth}</span>
        </div>

        <div class="fin-kpi-card">
          <span class="fin-kpi-label">Projected Month-End</span>
          <span class="fin-kpi-value ${summary.projectedMonthEnd > summary.monthlyBudget ? 'text-expense' : ''}">
            ${formatCurrency(summary.projectedMonthEnd)}
          </span>
          <span class="fin-kpi-sub">Top: ${summary.topCategory}</span>
        </div>
      </div>

      <!-- Interactive Budget Card with Inline Edit -->
      <div class="budget-card" style="margin-top: 16px;">
        <div class="budget-header">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="budget-label">Monthly Spending Cap:</span>
              <strong id="display-monthly-budget" style="font-size: 1.1rem; color: var(--text-main); font-weight: 700;">
                ${formatCurrency(summary.monthlyBudget)}
              </strong>
              <button id="btn-edit-budget" class="btn-icon-tiny" title="Edit Budget Limit">✏️ Edit</button>
            </div>
            <!-- Inline Budget Input (Hidden by default) -->
            <div id="budget-edit-box" style="display: none; align-items: center; gap: 6px; margin-top: 6px;">
              <span style="font-size: 0.85rem; font-weight: 600;">₹</span>
              <input type="number" id="input-new-budget" class="field-input" style="width: 120px; padding: 4px 8px; font-size: 0.85rem;" value="${summary.monthlyBudget}" step="500" min="1000">
              <button id="btn-save-new-budget" class="btn-primary" style="padding: 4px 10px; font-size: 0.78rem;">Save</button>
              <button id="btn-cancel-new-budget" class="btn-secondary" style="padding: 4px 8px; font-size: 0.78rem;">✕</button>
            </div>
          </div>
          <div class="budget-badge ${isOver ? 'badge-danger' : 'badge-safe'}">
            ${isOver ? 'Exceeded Budget' : `${summary.budgetPercent}% Paced`}
          </div>
        </div>

        <div class="progress-bar-bg" style="margin-top: 14px;">
          <div class="progress-bar-fill" style="width: ${summary.budgetPercent}%; background: ${barColor};"></div>
        </div>

        <div class="budget-footer" style="margin-top: 10px; display: flex; justify-content: space-between; font-size: 0.82rem;">
          <span>Remaining: <strong>${formatCurrency(summary.remaining)}</strong></span>
          <span>Income: <strong>${formatCurrency(summary.totalIncome)}</strong></span>
        </div>
      </div>
    `;

    // Bind Inline Budget Edit handlers
    const editBtn = container.querySelector('#btn-edit-budget');
    const editBox = container.querySelector('#budget-edit-box');
    const saveBtn = container.querySelector('#btn-save-new-budget');
    const cancelBtn = container.querySelector('#btn-cancel-new-budget');
    const inputNewBudget = container.querySelector('#input-new-budget');

    if (editBtn && editBox) {
      editBtn.addEventListener('click', () => {
        editBox.style.display = 'flex';
        editBtn.style.display = 'none';
        if (inputNewBudget) inputNewBudget.focus();
      });
    }

    if (cancelBtn && editBox) {
      cancelBtn.addEventListener('click', () => {
        editBox.style.display = 'none';
        if (editBtn) editBtn.style.display = 'inline-block';
      });
    }

    if (saveBtn && inputNewBudget) {
      saveBtn.addEventListener('click', async () => {
        const val = parseFloat(inputNewBudget.value);
        if (val && val > 0) {
          await store.setMonthlyBudget(val);
          editBox.style.display = 'none';
          if (editBtn) editBtn.style.display = 'inline-block';
          this.render();
        }
      });
    }
  }

  renderExpenseList(container) {
    const list = this.getFilteredExpenses();

    // Controls header: Month selector, Category filter, Search input, CSV Export
    const filterHeaderHtml = `
      <div class="finances-filter-bar">
        <div class="finances-filter-left">
          <input 
            type="month" 
            id="fin-month-selector" 
            class="field-input fin-month-input" 
            value="${this.selectedMonth}"
          >
          <select id="fin-cat-filter" class="field-input fin-cat-select">
            <option value="all" ${this.selectedCategory === 'all' ? 'selected' : ''}>All Categories</option>
            <option value="Food" ${this.selectedCategory === 'Food' ? 'selected' : ''}>🍔 Food</option>
            <option value="Study" ${this.selectedCategory === 'Study' ? 'selected' : ''}>📚 Study</option>
            <option value="Transport" ${this.selectedCategory === 'Transport' ? 'selected' : ''}>🚗 Transport</option>
            <option value="Shopping" ${this.selectedCategory === 'Shopping' ? 'selected' : ''}>🛍️ Shopping</option>
            <option value="Bills" ${this.selectedCategory === 'Bills' ? 'selected' : ''}>⚡ Bills</option>
            <option value="Health" ${this.selectedCategory === 'Health' ? 'selected' : ''}>💊 Health</option>
            <option value="Entertainment" ${this.selectedCategory === 'Entertainment' ? 'selected' : ''}>🎬 Entertainment</option>
            <option value="Income" ${this.selectedCategory === 'Income' ? 'selected' : ''}>💰 Income</option>
            <option value="Other" ${this.selectedCategory === 'Other' ? 'selected' : ''}>📦 Other</option>
          </select>
          <input 
            type="text" 
            id="fin-search-input" 
            class="field-input fin-search-input" 
            placeholder="Search notes..." 
            value="${this.escapeHtml(this.searchQuery)}"
          >
        </div>
        <div class="finances-filter-right">
          <button id="btn-export-csv" class="btn-secondary btn-sm" title="Download spreadsheet of current transactions">
            ⬇ Export CSV
          </button>
        </div>
      </div>
    `;

    if (list.length === 0) {
      container.innerHTML = `
        ${filterHeaderHtml}
        <div class="empty-state" style="margin-top: 16px;">
          <div class="empty-icon">🪙</div>
          <p>No transactions match your current filters. Tap "+ Log Expense" to record spending!</p>
        </div>
      `;
      this.bindFilterEvents(container);
      return;
    }

    const itemsHtml = list.map(exp => {
      const isIncome = exp.type === 'income';
      const icon = CATEGORY_ICONS[exp.category] || '📦';
      const sign = isIncome ? '+' : '-';
      const colorClass = isIncome ? 'text-income' : 'text-expense';

      return `
        <div class="expense-item glass-pill" data-id="${exp.id}">
          <div class="expense-meta">
            <div class="expense-icon-badge">${icon}</div>
            <div class="expense-info">
              <span class="expense-title">${this.escapeHtml(exp.note || exp.category)}</span>
              <span class="expense-sub">${exp.category} • ${exp.date}</span>
            </div>
          </div>
          <div class="expense-actions">
            <span class="expense-amount ${colorClass}">${sign}${formatCurrency(exp.amount)}</span>
            <button class="btn-delete-expense btn-icon-small" title="Delete record" data-id="${exp.id}">✕</button>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      ${filterHeaderHtml}
      <div class="expense-stream" style="margin-top: 14px;">
        ${itemsHtml}
      </div>
    `;

    this.bindFilterEvents(container);

    // Bind Delete Listeners with confirmation
    container.querySelectorAll('.btn-delete-expense').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const id = btn.dataset.id;
        if (confirm('Delete this transaction record?')) {
          await store.deleteExpense(id);
          this.render();
        }
      });
    });
  }

  bindFilterEvents(container) {
    const monthSel = container.querySelector('#fin-month-selector');
    if (monthSel) {
      monthSel.addEventListener('change', (e) => {
        this.selectedMonth = e.target.value;
        this.render();
      });
    }

    const catSel = container.querySelector('#fin-cat-filter');
    if (catSel) {
      catSel.addEventListener('change', (e) => {
        this.selectedCategory = e.target.value;
        this.render();
      });
    }

    const searchInp = container.querySelector('#fin-search-input');
    if (searchInp) {
      searchInp.addEventListener('input', (e) => {
        this.searchQuery = e.target.value;
        this.renderExpenseList(document.getElementById('expense-list-container'));
      });
    }

    const exportBtn = container.querySelector('#btn-export-csv');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        this.exportCSV();
      });
    }
  }

  renderCategoryBreakdown(container) {
    const summary = this.getFinancesSummary();
    const categories = Object.entries(summary.categoryTotals)
      .sort((a, b) => b[1] - a[1]);

    if (categories.length === 0 || summary.totalExpense === 0) {
      container.innerHTML = `
        <div class="empty-state-sm">
          <span>📊</span> <span>No expense data logged for this month yet.</span>
        </div>
      `;
      return;
    }

    const rowsHtml = categories.map(([cat, amt]) => {
      const pct = Math.round((amt / summary.totalExpense) * 100);
      const color = CATEGORY_COLORS[cat] || '#64748b';
      const icon = CATEGORY_ICONS[cat] || '📦';

      return `
        <div class="category-breakdown-row" style="margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; font-size: 0.82rem; margin-bottom: 4px;">
            <span>${icon} <strong>${cat}</strong> (${pct}%)</span>
            <span style="font-weight: 600; color: var(--text-main);">${formatCurrency(amt)}</span>
          </div>
          <div class="progress-bar-bg" style="height: 6px;">
            <div class="progress-bar-fill" style="width: ${pct}%; background: ${color};"></div>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = `
      <div class="category-breakdown-box">
        ${rowsHtml}
      </div>
    `;
  }

  exportCSV() {
    const list = this.getFilteredExpenses();
    if (list.length === 0) {
      alert('No transactions to export.');
      return;
    }

    const headers = ['Date', 'Type', 'Category', 'Note', 'Amount (INR)'];
    const rows = list.map(e => [
      `"${e.date || ''}"`,
      `"${e.type || 'expense'}"`,
      `"${e.category || ''}"`,
      `"${(e.note || '').replace(/"/g, '""')}"`,
      e.amount || 0
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `lifebuddy_finances_${this.selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
}
