/* LifeBuddy Expense & Budget Manager */
import { API } from './api.js';

export const CATEGORY_ICONS = {
  'Food': '🍔',
  'Study': '📚',
  'Transport': '🚗',
  'Shopping': '🛍️',
  'Bills': '⚡',
  'Health': '💊',
  'Entertainment': '🎬',
  'Income': '💰',
  'Other': '📦'
};

export class ExpenseManager {
  constructor(options = {}) {
    this.expenses = [];
    this.monthlyBudget = 1000.0;
    this.currency = '$';
    this.onChanged = options.onChanged || (() => {});
  }

  async init() {
    await this.loadExpenses();
  }

  async loadExpenses() {
    try {
      this.expenses = await API.expenses.getAll();
      this.onChanged(this.expenses);
    } catch (e) {
      console.error('Failed to load expenses', e);
    }
  }

  async addExpense({ amount, category, note, type = 'expense', date }) {
    const created = await API.expenses.create({
      amount: parseFloat(amount),
      category,
      note,
      type,
      date: date || new Date().toISOString().split('T')[0]
    });
    await this.loadExpenses();
    return created;
  }

  async deleteExpense(id) {
    await API.expenses.delete(id);
    await this.loadExpenses();
  }

  getSummary(selectedMonth = null) {
    const currentMonth = selectedMonth || new Date().toISOString().slice(0, 7);
    const monthExpenses = this.expenses.filter(e => (e.date || '').startsWith(currentMonth));

    const totalExpense = monthExpenses
      .filter(e => e.type === 'expense')
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const totalIncome = monthExpenses
      .filter(e => e.type === 'income')
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    // Group by category
    const categoryTotals = {};
    monthExpenses
      .filter(e => e.type === 'expense')
      .forEach(e => {
        categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
      });

    const budgetPercent = this.monthlyBudget > 0 ? Math.min(100, Math.round((totalExpense / this.monthlyBudget) * 100)) : 0;

    return {
      totalExpense,
      totalIncome,
      netBalance: totalIncome - totalExpense,
      monthlyBudget: this.monthlyBudget,
      budgetPercent,
      categoryTotals,
      count: monthExpenses.length
    };
  }

  renderExpenseList(container) {
    if (!container) return;
    container.innerHTML = '';

    if (this.expenses.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🪙</div>
          <p>No expenses logged yet. Keep your daily spending mindful and intentional!</p>
        </div>
      `;
      return;
    }

    this.expenses.slice(0, 20).forEach(exp => {
      const isIncome = exp.type === 'income';
      const icon = CATEGORY_ICONS[exp.category] || '📦';
      const sign = isIncome ? '+' : '-';
      const colorClass = isIncome ? 'text-income' : 'text-expense';

      const el = document.createElement('div');
      el.className = 'expense-item glass-pill';
      el.innerHTML = `
        <div class="expense-meta">
          <div class="expense-icon-badge">${icon}</div>
          <div class="expense-info">
            <span class="expense-title">${exp.note ? exp.note : exp.category}</span>
            <span class="expense-sub">${exp.category} • ${exp.date}</span>
          </div>
        </div>
        <div class="expense-actions">
          <span class="expense-amount ${colorClass}">${sign}${this.currency}${Number(exp.amount).toFixed(2)}</span>
          <button class="btn-delete-expense btn-icon-small" title="Delete record" data-id="${exp.id}">✕</button>
        </div>
      `;

      el.querySelector('.btn-delete-expense').addEventListener('click', async (e) => {
        e.stopPropagation();
        await this.deleteExpense(exp.id);
      });

      container.appendChild(el);
    });
  }

  renderBudgetWidget(container) {
    if (!container) return;
    const summary = this.getSummary();
    const remaining = Math.max(0, this.monthlyBudget - summary.totalExpense);
    const isOver = summary.totalExpense > this.monthlyBudget;

    let barColor = 'var(--accent-primary)';
    if (summary.budgetPercent > 85) barColor = 'var(--color-danger, #ef4444)';
    else if (summary.budgetPercent > 65) barColor = 'var(--color-warning, #f59e0b)';

    container.innerHTML = `
      <div class="budget-card">
        <div class="budget-header">
          <div>
            <span class="budget-label">Monthly Spending Budget</span>
            <div class="budget-values">
              <span class="budget-current">${this.currency}${summary.totalExpense.toFixed(0)}</span>
              <span class="budget-target"> / ${this.currency}${this.monthlyBudget.toFixed(0)}</span>
            </div>
          </div>
          <div class="budget-badge ${isOver ? 'badge-danger' : 'badge-safe'}">
            ${isOver ? 'Over Budget' : `${summary.budgetPercent}% Used`}
          </div>
        </div>
        <div class="progress-bar-bg">
          <div class="progress-bar-fill" style="width: ${summary.budgetPercent}%; background: ${barColor};"></div>
        </div>
        <div class="budget-footer">
          <span>Remaining: <strong>${this.currency}${remaining.toFixed(0)}</strong></span>
          <span>Income: <strong>${this.currency}${summary.totalIncome.toFixed(0)}</strong></span>
        </div>
      </div>
    `;
  }
}
