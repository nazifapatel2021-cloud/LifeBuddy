/* LifeBuddy Personal Finances & Mindful Budget Manager */
import { API } from './api.js';
import { store } from './store.js';
import { formatCurrency } from './currency.js';

export const EXPENSE_CATEGORIES = [
  { value: 'Food', label: '🍔 Food', color: '#f59e0b' },
  { value: 'Study', label: '📚 Study', color: '#6366f1' },
  { value: 'Transport', label: '🚗 Transport', color: '#0ea5e9' },
  { value: 'Shopping', label: '🛍️ Shopping', color: '#ec4899' },
  { value: 'Bills', label: '⚡ Bills', color: '#ef4444' },
  { value: 'Health', label: '💊 Health', color: '#10b981' },
  { value: 'Entertainment', label: '🎬 Entertainment', color: '#8b5cf6' },
  { value: 'Other', label: '📦 Other', color: '#64748b' }
];

export const INCOME_CATEGORIES = [
  { value: 'Salary', label: '💼 Salary', color: '#10b981' },
  { value: 'Freelance', label: '💻 Freelance', color: '#0ea5e9' },
  { value: 'Investment', label: '📈 Investment', color: '#6366f1' },
  { value: 'Gift', label: '🎁 Gift', color: '#f59e0b' },
  { value: 'Other Income', label: '💰 Other Income', color: '#8b5cf6' }
];

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
  'Freelance': '💻',
  'Investment': '📈',
  'Gift': '🎁',
  'Other Income': '💰',
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
  'Salary': '#10b981',
  'Freelance': '#0ea5e9',
  'Investment': '#6366f1',
  'Gift': '#f59e0b',
  'Other Income': '#8b5cf6',
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

    const btnExp = document.getElementById('btn-select-expense');
    const btnInc = document.getElementById('btn-select-income');
    const typeHidden = document.getElementById('exp-type-select');
    const catSelect = document.getElementById('exp-category-select');

    // Switch between Expense and Income modes in modal
    const setModalType = (type) => {
      if (typeHidden) typeHidden.value = type;
      if (type === 'income') {
        if (btnInc) {
          btnInc.style.background = '#10b981';
          btnInc.style.color = '#fff';
        }
        if (btnExp) {
          btnExp.style.background = 'transparent';
          btnExp.style.color = 'var(--text-muted)';
        }
        if (catSelect) {
          catSelect.innerHTML = INCOME_CATEGORIES.map(c => `<option value="${c.value}">${c.label}</option>`).join('');
        }
      } else {
        if (btnExp) {
          btnExp.style.background = 'var(--accent-primary)';
          btnExp.style.color = '#fff';
        }
        if (btnInc) {
          btnInc.style.background = 'transparent';
          btnInc.style.color = 'var(--text-muted)';
        }
        if (catSelect) {
          catSelect.innerHTML = EXPENSE_CATEGORIES.map(c => `<option value="${c.value}">${c.label}</option>`).join('');
        }
      }
    };

    if (btnExp) btnExp.addEventListener('click', () => setModalType('expense'));
    if (btnInc) btnInc.addEventListener('click', () => setModalType('income'));

    if (addBtn && modal) {
      addBtn.addEventListener('click', () => {
        setModalType('expense');
        modal.classList.add('active');
        const dateInput = document.getElementById('exp-date-input');
        if (dateInput && !dateInput.value) {
          dateInput.value = new Date().toISOString().split('T')[0];
        }
        const amtInput = document.getElementById('exp-amount-input');
        if (amtInput) amtInput.focus();
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
        const dateInput = document.getElementById('exp-date-input');

        const amount = parseFloat(amountInput?.value) || 0;
        const note = noteInput?.value.trim() || '';
        const category = catSelect?.value || 'Food';
        const date = dateInput?.value || new Date().toISOString().split('T')[0];
        const type = typeHidden?.value || 'expense';

        if (amount > 0) {
          await store.createExpense({ amount, note, category, date, type });
          form.reset();
          if (modal) modal.classList.remove('active');
          this.render();
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
    const plannedIncome = store.getPlannedIncome();

    const totalExpense = list
      .filter(e => e.type !== 'income')
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    const totalIncome = list
      .filter(e => e.type === 'income')
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

    // Group expenses by category
    const categoryTotals = {};
    list
      .filter(e => e.type !== 'income')
      .forEach(e => {
        const cat = e.category || 'Other';
        categoryTotals[cat] = (categoryTotals[cat] || 0) + (Number(e.amount) || 0);
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
      plannedIncome,
      netSavings: totalIncome - totalExpense,
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
      <!-- Distinct Monthly Income & Spending Cap Cards -->
      <div class="finances-kpi-summary-row">
        <!-- Monthly Income Card -->
        <div class="fin-kpi-card">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="fin-kpi-label">Monthly Income Target</span>
            <button id="btn-edit-income" class="btn-icon-tiny" title="Edit Planned Income">✏️</button>
          </div>
          <div class="fin-kpi-value text-income">${formatCurrency(summary.plannedIncome)}</div>
          <span class="fin-kpi-sub">Actual Logged: ${formatCurrency(summary.totalIncome)}</span>
          <!-- Inline Income Edit Box -->
          <div id="income-edit-box" style="display: none; align-items: center; gap: 4px; margin-top: 6px;">
            <input type="number" id="input-new-income" class="field-input" style="width: 100px; padding: 3px 6px; font-size: 0.8rem;" value="${summary.plannedIncome}" step="1000">
            <button id="btn-save-new-income" class="btn-primary" style="padding: 3px 8px; font-size: 0.75rem;">Save</button>
            <button id="btn-cancel-new-income" class="btn-secondary" style="padding: 3px 6px; font-size: 0.75rem;">✕</button>
          </div>
        </div>

        <!-- Monthly Spending Cap Card -->
        <div class="fin-kpi-card">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span class="fin-kpi-label">Monthly Spending Cap</span>
            <button id="btn-edit-budget" class="btn-icon-tiny" title="Edit Spending Cap">✏️</button>
          </div>
          <div class="fin-kpi-value text-expense">${formatCurrency(summary.monthlyBudget)}</div>
          <span class="fin-kpi-sub">Spent: ${formatCurrency(summary.totalExpense)} (${summary.budgetPercent}%)</span>
          <!-- Inline Budget Edit Box -->
          <div id="budget-edit-box" style="display: none; align-items: center; gap: 4px; margin-top: 6px;">
            <input type="number" id="input-new-budget" class="field-input" style="width: 100px; padding: 3px 6px; font-size: 0.8rem;" value="${summary.monthlyBudget}" step="500">
            <button id="btn-save-new-budget" class="btn-primary" style="padding: 3px 8px; font-size: 0.75rem;">Save</button>
            <button id="btn-cancel-new-budget" class="btn-secondary" style="padding: 3px 6px; font-size: 0.75rem;">✕</button>
          </div>
        </div>

        <!-- Net Cash Flow / Savings -->
        <div class="fin-kpi-card">
          <span class="fin-kpi-label">Net Savings / Cash Flow</span>
          <span class="fin-kpi-value ${summary.netSavings >= 0 ? 'text-income' : 'text-expense'}">
            ${summary.netSavings >= 0 ? '+' : ''}${formatCurrency(summary.netSavings)}
          </span>
          <span class="fin-kpi-sub">${summary.netSavings >= 0 ? 'Positive cash flow' : 'Deficit'}</span>
        </div>

        <!-- Safe Remaining / Daily Burn Rate -->
        <div class="fin-kpi-card">
          <span class="fin-kpi-label">Daily Burn Rate</span>
          <span class="fin-kpi-value">${formatCurrency(summary.dailyAverage)}<span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 400;">/day</span></span>
          <span class="fin-kpi-sub">Safe Left: ${formatCurrency(summary.remaining)}</span>
        </div>
      </div>

      <!-- Spending Pacing Visual Progress Bar -->
      <div class="budget-card" style="margin-top: 14px;">
        <div class="budget-header">
          <div>
            <span class="budget-label">Spending vs Monthly Cap</span>
            <div class="budget-values">
              <span class="budget-current">${formatCurrency(summary.totalExpense)}</span>
              <span class="budget-target"> / ${formatCurrency(summary.monthlyBudget)}</span>
            </div>
          </div>
          <div class="budget-badge ${isOver ? 'badge-danger' : 'badge-safe'}">
            ${isOver ? 'Exceeded Cap' : `${summary.budgetPercent}% Used`}
          </div>
        </div>

        <div class="progress-bar-bg" style="margin-top: 12px;">
          <div class="progress-bar-fill" style="width: ${summary.budgetPercent}%; background: ${barColor};"></div>
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
          this.render();
        }
      });
    }

    // Bind Inline Income Edit handlers
    const editIncBtn = container.querySelector('#btn-edit-income');
    const editIncBox = container.querySelector('#income-edit-box');
    const saveIncBtn = container.querySelector('#btn-save-new-income');
    const cancelIncBtn = container.querySelector('#btn-cancel-new-income');
    const inputNewInc = container.querySelector('#input-new-income');

    if (editIncBtn && editIncBox) {
      editIncBtn.addEventListener('click', () => {
        editIncBox.style.display = 'flex';
        editIncBtn.style.display = 'none';
        if (inputNewInc) inputNewInc.focus();
      });
    }

    if (cancelIncBtn && editIncBox) {
      cancelIncBtn.addEventListener('click', () => {
        editIncBox.style.display = 'none';
        if (editIncBtn) editIncBtn.style.display = 'inline-block';
      });
    }

    if (saveIncBtn && inputNewInc) {
      saveIncBtn.addEventListener('click', async () => {
        const val = parseFloat(inputNewInc.value);
        if (val !== undefined && val >= 0) {
          await store.setMonthlyIncome(val);
          this.render();
        }
      });
    }
  }

  renderExpenseList(container) {
    const list = this.getFilteredExpenses();

    // Controls header: Month selector, Category filter, Search input, Ledger Export
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
            <option value="Salary" ${this.selectedCategory === 'Salary' ? 'selected' : ''}>💼 Salary</option>
            <option value="Freelance" ${this.selectedCategory === 'Freelance' ? 'selected' : ''}>💻 Freelance</option>
            <option value="Investment" ${this.selectedCategory === 'Investment' ? 'selected' : ''}>📈 Investment</option>
            <option value="Other" ${this.selectedCategory === 'Other' ? 'selected' : ''}>📦 Other</option>
          </select>
          <input 
            type="text" 
            id="fin-search-input" 
            class="field-input fin-search-input" 
            placeholder="Search transactions..." 
            value="${this.escapeHtml(this.searchQuery)}"
          >
        </div>
        <div class="finances-filter-right">
          <button id="btn-export-csv" class="btn-secondary btn-sm" title="Download ledger for selected month (${this.selectedMonth})">
            📑 Download Monthly Ledger
          </button>
        </div>
      </div>
    `;

    if (list.length === 0) {
      container.innerHTML = `
        ${filterHeaderHtml}
        <div class="empty-state" style="margin-top: 16px;">
          <div class="empty-icon">🪙</div>
          <p>No transactions match your current filters. Tap "+ Log Expense" to record spending or income!</p>
        </div>
      `;
      this.bindFilterEvents(container);
      return;
    }

    const itemsHtml = list.map(exp => {
      const isIncome = exp.type === 'income';
      const icon = CATEGORY_ICONS[exp.category] || (isIncome ? '💰' : '📦');
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
        this.exportMonthlyLedger();
      });
    }
  }

  /* Renders a colorful SVG Donut / Pie Chart for Category Distribution */
  renderCategoryBreakdown(container) {
    const summary = this.getFinancesSummary();
    const categories = Object.entries(summary.categoryTotals)
      .sort((a, b) => b[1] - a[1]);

    if (categories.length === 0 || summary.totalExpense === 0) {
      container.innerHTML = `
        <div class="empty-state-sm">
          <span>📊</span> <span>No expense data logged for ${this.selectedMonth} yet.</span>
        </div>
      `;
      return;
    }

    // Donut Geometry Parameters
    const size = 200;
    const center = size / 2;
    const radius = 68;
    const strokeWidth = 28;
    const circumference = 2 * Math.PI * radius; // ~427.25

    let cumulativePct = 0;
    const slices = categories.map(([cat, amt]) => {
      const pct = (amt / summary.totalExpense) * 100;
      const strokeDash = `${(pct * circumference) / 100} ${circumference}`;
      const strokeOffset = -((cumulativePct * circumference) / 100);
      const color = CATEGORY_COLORS[cat] || '#64748b';
      const icon = CATEGORY_ICONS[cat] || '📦';
      cumulativePct += pct;

      return {
        cat,
        amt,
        pct: Math.round(pct),
        strokeDash,
        strokeOffset,
        color,
        icon
      };
    });

    const slicesSvg = slices.map(s => `
      <circle
        cx="${center}"
        cy="${center}"
        r="${radius}"
        fill="transparent"
        stroke="${s.color}"
        stroke-width="${strokeWidth}"
        stroke-dasharray="${s.strokeDash}"
        stroke-dashoffset="${s.strokeOffset}"
        transform="rotate(-90 ${center} ${center})"
        style="transition: stroke-dashoffset 0.4s ease;"
      >
        <title>${s.cat}: ${formatCurrency(s.amt)} (${s.pct}%)</title>
      </circle>
    `).join('');

    const legendHtml = slices.map(s => `
      <div class="pie-legend-item" style="display: flex; align-items: center; justify-content: space-between; font-size: 0.8rem; padding: 4px 0;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${s.color};"></span>
          <span>${s.icon} <strong>${s.cat}</strong></span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="color: var(--text-muted); font-size: 0.75rem;">${s.pct}%</span>
          <span style="font-weight: 600; color: var(--text-main);">${formatCurrency(s.amt)}</span>
        </div>
      </div>
    `).join('');

    container.innerHTML = `
      <div class="category-pie-card" style="display: flex; flex-direction: column; align-items: center; gap: 14px;">
        <!-- Colorful Donut Chart SVG -->
        <div class="donut-chart-wrap" style="position: relative; width: ${size}px; height: ${size}px;">
          <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" style="display: block;">
            <!-- Background base circle -->
            <circle cx="${center}" cy="${center}" r="${radius}" fill="transparent" stroke="var(--border-subtle)" stroke-width="${strokeWidth}" />
            ${slicesSvg}
          </svg>
          <!-- Center Text Badge -->
          <div style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; flex-direction: column; align-items: center; justify-content: center; pointer-events: none;">
            <span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600;">Total Spend</span>
            <span style="font-size: 0.95rem; font-weight: 700; color: var(--text-main);">${formatCurrency(summary.totalExpense)}</span>
          </div>
        </div>

        <!-- Legend -->
        <div class="pie-legend-stream" style="width: 100%; border-top: 1px solid var(--border-color); padding-top: 10px;">
          ${legendHtml}
        </div>
      </div>
    `;
  }

  /* Downloads Ledger containing ALL records for the selected month regardless of other filters */
  exportMonthlyLedger() {
    const list = (store.state.expenses || [])
      .filter(e => (e.date || '').startsWith(this.selectedMonth))
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));

    if (list.length === 0) {
      alert(`No transaction entries found for ${this.selectedMonth}.`);
      return;
    }

    const headers = ['Date', 'Type', 'Category', 'Description / Note', 'Amount (INR)'];
    const rows = list.map(e => [
      `"${e.date || ''}"`,
      `"${e.type === 'income' ? 'Income' : 'Expense'}"`,
      `"${e.category || ''}"`,
      `"${(e.note || '').replace(/"/g, '""')}"`,
      Number(e.amount) || 0
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `LifeBuddy_Ledger_${this.selectedMonth}.csv`);
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
