/* LifeBuddy Task & Planner Management System */
import { API } from './api.js';

export const PRIORITY_CONFIG = {
  'urgent': { label: 'Urgent', class: 'badge-urgent' },
  'high': { label: 'High', class: 'badge-high' },
  'medium': { label: 'Medium', class: 'badge-medium' },
  'low': { label: 'Low', class: 'badge-low' }
};

export const CATEGORY_ICONS = {
  'work': '💼 Work',
  'study': '📚 Study',
  'personal': '🏠 Personal',
  'health': '🌱 Health'
};

export class TaskManager {
  constructor(options = {}) {
    this.tasks = [];
    this.activeTaskId = localStorage.getItem('lifebuddy_active_task_id') || null;
    this.filter = 'all'; // all, today, pending, completed
    this.onTasksChanged = options.onTasksChanged || (() => {});
    this.onActiveTaskChanged = options.onActiveTaskChanged || (() => {});
  }

  async init() {
    await this.loadTasks();
  }

  async loadTasks() {
    try {
      this.tasks = await API.tasks.getAll();
      if (!this.getActiveTask() && this.tasks.length > 0) {
        const firstPending = this.tasks.find(t => !t.completed);
        if (firstPending) this.setActiveTask(firstPending.id);
      }
      this.onTasksChanged(this.tasks);
      this.onActiveTaskChanged(this.getActiveTask());
    } catch (e) {
      console.error('Failed to load tasks', e);
    }
  }

  getTasks() {
    return this.tasks;
  }

  getActiveTask() {
    return this.tasks.find(t => t.id === this.activeTaskId) || null;
  }

  async addTask(title, estPomodoros = 1, category = 'work', priority = 'medium', dueDate = null) {
    if (!title.trim()) return;

    const task = await API.tasks.create({
      title: title.trim(),
      estimated_pomodoros: Math.max(1, parseInt(estPomodoros) || 1),
      category,
      priority,
      due_date: dueDate
    });

    await this.loadTasks();
    if (!this.activeTaskId) {
      this.setActiveTask(task.id);
    }
    return task;
  }

  async toggleTask(id) {
    const task = this.tasks.find(t => t.id === id);
    if (task) {
      const nextCompleted = !task.completed;
      await API.tasks.update(id, { completed: nextCompleted });
      await this.loadTasks();
    }
  }

  async deleteTask(id) {
    await API.tasks.delete(id);
    if (this.activeTaskId === id) {
      this.setActiveTask(null);
    }
    await this.loadTasks();
  }

  setActiveTask(id) {
    this.activeTaskId = id;
    if (id) {
      localStorage.setItem('lifebuddy_active_task_id', id);
    } else {
      localStorage.removeItem('lifebuddy_active_task_id');
    }
    this.onActiveTaskChanged(this.getActiveTask());
    this.onTasksChanged(this.tasks);
  }

  async incrementActiveTaskPomodoro() {
    const activeTask = this.getActiveTask();
    if (activeTask) {
      const current = activeTask.completed_pomodoros || activeTask.actPomodoros || 0;
      await API.tasks.update(activeTask.id, { completed_pomodoros: current + 1 });
      await this.loadTasks();
    }
  }

  renderTaskList(containerEl, filterOverride = null) {
    if (!containerEl) return;
    const activeFilter = filterOverride || this.filter;

    let filtered = [...this.tasks];
    if (activeFilter === 'pending') {
      filtered = filtered.filter(t => !t.completed);
    } else if (activeFilter === 'completed') {
      filtered = filtered.filter(t => t.completed);
    } else if (activeFilter === 'today') {
      const today = new Date().toISOString().split('T')[0];
      filtered = filtered.filter(t => t.due_date === today || (!t.due_date && !t.completed));
    }

    if (filtered.length === 0) {
      containerEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🌱</div>
          <p>No tasks found in this view. Keep calm and organize your day!</p>
        </div>
      `;
      return;
    }

    containerEl.innerHTML = filtered.map(task => {
      const isSelected = task.id === this.activeTaskId;
      const isCompleted = !!task.completed;
      const priorityInfo = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG['medium'];
      const act = task.completed_pomodoros ?? task.actPomodoros ?? 0;
      const est = task.estimated_pomodoros ?? task.estPomodoros ?? 1;

      return `
        <div class="task-item glass-pill ${isSelected ? 'selected' : ''} ${isCompleted ? 'completed' : ''}" data-id="${task.id}">
          <div class="task-left">
            <button class="task-checkbox ${isCompleted ? 'checked' : ''}" data-action="toggle" title="${isCompleted ? 'Mark uncompleted' : 'Mark completed'}">
              ${isCompleted ? '✓' : ''}
            </button>
            <div class="task-details">
              <span class="task-text">${this.escapeHtml(task.title)}</span>
              <div class="task-tags">
                <span class="badge ${priorityInfo.class}">${priorityInfo.label}</span>
                <span class="badge badge-subtle">${CATEGORY_ICONS[task.category] || task.category || 'work'}</span>
                ${task.due_date ? `<span class="badge badge-subtle">📅 ${task.due_date}</span>` : ''}
              </div>
            </div>
          </div>
          <div class="task-actions-right">
            <div class="task-pomo-badge" title="Completed / Estimated Pomodoros">
              <span>🍅</span> <span>${act}/${est}</span>
            </div>
            <button class="btn-focus-task btn-icon-small" data-action="select" title="Focus on this task">
              ${isSelected ? '🎯 Active' : 'Select'}
            </button>
            <button class="btn-delete-task btn-icon-small" data-action="delete" title="Delete task">✕</button>
          </div>
        </div>
      `;
    }).join('');

    // Attach listeners
    containerEl.querySelectorAll('.task-item').forEach(item => {
      const id = item.dataset.id;
      item.querySelector('[data-action="toggle"]').addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleTask(id);
      });

      item.querySelector('[data-action="select"]').addEventListener('click', (e) => {
        e.stopPropagation();
        this.setActiveTask(id);
      });

      item.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteTask(id);
      });

      item.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
          this.setActiveTask(id);
        }
      });
    });
  }

  escapeHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
