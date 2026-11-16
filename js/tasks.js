/* LifeBuddy Task & Planner Management System */
import { API } from './api.js';
import { store } from './store.js';
import { getLocalDateString, normalizeDate } from './date_utils.js';

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
    this.activeTaskId = localStorage.getItem('lifebuddy_active_task_id') || null;
    this.filter = 'all'; // all, today, upcoming, overdue, pending, completed
    this.priorityFilter = 'all';
    this.categoryFilter = 'all';
    this.searchQuery = '';
    this.onTasksChanged = options.onTasksChanged || (() => {});
    this.onActiveTaskChanged = options.onActiveTaskChanged || (() => {});

    // Subscribe to central store updates
    store.subscribe(() => {
      this.syncActiveTask();
      this.onTasksChanged(store.state.tasks || []);
      this.onActiveTaskChanged(this.getActiveTask());
    });
  }

  async init() {
    await store.fetchState();
    this.cleanupDailyTasks();
    this.syncActiveTask();
    this.onTasksChanged(store.state.tasks || []);
    this.onActiveTaskChanged(this.getActiveTask());
  }

  cleanupDailyTasks() {
    const todayStr = getLocalDateString();
    const lastCleanup = localStorage.getItem('lifebuddy_last_daily_cleanup');
    if (lastCleanup && lastCleanup !== todayStr) {
      // It's a new day: clean up completed tasks from previous days
      const tasks = store.state.tasks || [];
      const updatedTasks = tasks.filter(t => !t.completed);
      store.state.tasks = updatedTasks;
      store.saveToStorage();
      localStorage.setItem('lifebuddy_last_daily_cleanup', todayStr);
    } else if (!lastCleanup) {
      localStorage.setItem('lifebuddy_last_daily_cleanup', todayStr);
    }
  }

  syncActiveTask() {
    const tasks = store.state.tasks || [];
    if (!this.getActiveTask() && tasks.length > 0) {
      const firstPending = tasks.find(t => !t.completed && (t.in_focus_queue !== false && t.in_focus_queue !== 0));
      if (firstPending) this.setActiveTask(firstPending.id);
    }
  }

  getTasks() {
    return store.state.tasks || [];
  }

  getActiveTask() {
    const tasks = store.state.tasks || [];
    return tasks.find(t => t.id === this.activeTaskId) || null;
  }

  async addTask(title, estPomodoros = 1, category = 'work', priority = 'medium', dueDate = null, inFocusQueue = true) {
    if (!title || !title.trim()) return;

    const task = await store.createTask({
      title: title.trim(),
      estimated_pomodoros: Math.max(1, parseInt(estPomodoros, 10) || 1),
      category: category || 'work',
      priority: priority || 'medium',
      due_date: dueDate || null,
      in_focus_queue: inFocusQueue !== false
    });

    if (!this.activeTaskId && task && task.in_focus_queue) {
      this.setActiveTask(task.id);
    }
    return task;
  }

  async toggleTask(id) {
    const task = (store.state.tasks || []).find(t => t.id === id);
    if (task) {
      const nextCompleted = !task.completed;
      await store.updateTask(id, { completed: nextCompleted });
      if (nextCompleted && this.activeTaskId === id) {
        // Automatically switch active task to the next pending one
        const pending = (store.state.tasks || []).find(t => t.id !== id && !t.completed && t.in_focus_queue !== false);
        this.setActiveTask(pending ? pending.id : null);
      }
    }
  }

  async toggleFocusQueue(id) {
    const task = (store.state.tasks || []).find(t => t.id === id);
    if (task) {
      const currentQueue = task.in_focus_queue !== false && task.in_focus_queue !== 0;
      const nextQueue = !currentQueue;
      await store.updateTask(id, { in_focus_queue: nextQueue });
    }
  }

  async addPomodoroToTask(id) {
    const task = (store.state.tasks || []).find(t => t.id === id);
    if (task) {
      const nextEst = (task.estimated_pomodoros || 1) + 1;
      await store.updateTask(id, { estimated_pomodoros: nextEst });
    }
  }

  async deleteTask(id) {
    if (confirm('Delete this task?')) {
      await store.deleteTask(id);
      if (this.activeTaskId === id) {
        this.setActiveTask(null);
      }
    }
  }

  setActiveTask(id) {
    this.activeTaskId = id;
    if (id) {
      localStorage.setItem('lifebuddy_active_task_id', id);
    } else {
      localStorage.removeItem('lifebuddy_active_task_id');
    }
    this.onActiveTaskChanged(this.getActiveTask());
    this.onTasksChanged(store.state.tasks || []);
  }

  async incrementActiveTaskPomodoro() {
    const activeTask = this.getActiveTask();
    if (activeTask) {
      const current = activeTask.completed_pomodoros || 0;
      await store.updateTask(activeTask.id, { completed_pomodoros: current + 1 });
    }
  }

  /* Render Focus Room Target Queue */
  renderFocusQueueList(containerEl) {
    if (!containerEl) return;
    const allTasks = store.state.tasks || [];
    // Only pending tasks designated for focus queue (default to true if unset or 1)
    const queueTasks = allTasks.filter(t => !t.completed && (t.in_focus_queue !== false && t.in_focus_queue !== 0));

    if (queueTasks.length === 0) {
      containerEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎯</div>
          <p>Focus queue is clear! Select or add tasks from the Planner to pin them here.</p>
        </div>
      `;
      return;
    }

    containerEl.innerHTML = queueTasks.map(task => {
      const isSelected = task.id === this.activeTaskId;
      const isCompleted = !!task.completed;
      const act = task.completed_pomodoros || 0;
      const est = task.estimated_pomodoros || 1;

      return `
        <div class="task-item glass-pill ${isSelected ? 'selected' : ''}" data-id="${task.id}">
          <div class="task-left">
            <button class="task-checkbox ${isCompleted ? 'checked' : ''}" data-action="toggle" title="Mark done">
              ${isCompleted ? '✓' : ''}
            </button>
            <div class="task-details">
              <span class="task-text">${this.escapeHtml(task.title)}</span>
              <div class="task-tags">
                <span class="badge badge-subtle">${CATEGORY_ICONS[task.category] || task.category || 'work'}</span>
                <span class="badge badge-${task.priority === 'urgent' ? 'urgent' : 'subtle'}">${task.priority}</span>
              </div>
            </div>
          </div>
          <div class="task-actions-right">
            <div class="task-pomo-badge" title="Completed / Estimated Pomodoros">
              <span>🍅</span> <span>${act}/${est}</span>
            </div>
            <button class="btn-icon-tiny btn-add-pomo" data-action="add-pomo" title="Need more time? Add +1 Pomodoro">+1 🍅</button>
            <button class="btn-focus-task btn-icon-small" data-action="select" title="Focus on this task">
              ${isSelected ? '🎯 Active' : 'Focus'}
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Attach listeners
    containerEl.querySelectorAll('.task-item').forEach(item => {
      const id = item.dataset.id;
      item.querySelector('[data-action="toggle"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleTask(id);
      });

      item.querySelector('[data-action="add-pomo"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.addPomodoroToTask(id);
      });

      item.querySelector('[data-action="select"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setActiveTask(id);
      });

      item.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
          this.setActiveTask(id);
        }
      });
    });
  }

  /* Render Full Planner Tasks List */
  renderTaskList(containerEl, filterOverride = null) {
    if (!containerEl) return;
    if (filterOverride) {
      this.filter = filterOverride;
    }
    const activeFilter = this.filter;
    const todayStr = getLocalDateString();

    let filtered = [...(store.state.tasks || [])];

    // Priority filter
    if (this.priorityFilter !== 'all') {
      filtered = filtered.filter(t => t.priority === this.priorityFilter);
    }

    // Category filter
    if (this.categoryFilter !== 'all') {
      filtered = filtered.filter(t => t.category === this.categoryFilter);
    }

    // Search query
    if (this.searchQuery) {
      const q = this.searchQuery.toLowerCase();
      filtered = filtered.filter(t => (t.title || '').toLowerCase().includes(q));
    }

    // Tab filter
    if (activeFilter === 'pending') {
      filtered = filtered.filter(t => !t.completed);
    } else if (activeFilter === 'completed') {
      filtered = filtered.filter(t => Boolean(t.completed));
    } else if (activeFilter === 'today') {
      filtered = filtered.filter(t => {
        const norm = normalizeDate(t.due_date);
        return norm === todayStr || (!norm && !t.completed);
      });
    } else if (activeFilter === 'overdue') {
      filtered = filtered.filter(t => {
        const norm = normalizeDate(t.due_date);
        return norm && norm < todayStr && !t.completed;
      });
    } else if (activeFilter === 'upcoming') {
      filtered = filtered.filter(t => {
        const norm = normalizeDate(t.due_date);
        return norm && norm > todayStr && !t.completed;
      });
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
      const act = task.completed_pomodoros ?? 0;
      const est = task.estimated_pomodoros ?? 1;
      const inQueue = task.in_focus_queue !== false && task.in_focus_queue !== 0;

      const normDue = normalizeDate(task.due_date);
      const isOverdue = normDue && normDue < todayStr && !isCompleted;
      const isDueToday = normDue === todayStr && !isCompleted;

      let dueBadge = '';
      if (task.due_date) {
        if (isOverdue) {
          dueBadge = `<span class="badge badge-urgent" title="Overdue!">⚠️ Overdue: ${normDue}</span>`;
        } else if (isDueToday) {
          dueBadge = `<span class="badge badge-high" title="Due today">📅 Today</span>`;
        } else {
          dueBadge = `<span class="badge badge-subtle">📅 ${normDue || task.due_date}</span>`;
        }
      }

      return `
        <div class="task-item glass-pill ${isSelected ? 'selected' : ''} ${isCompleted ? 'completed' : ''} ${isOverdue ? 'task-overdue-border' : ''}" data-id="${task.id}">
          <div class="task-left">
            <button class="task-checkbox ${isCompleted ? 'checked' : ''}" data-action="toggle" title="${isCompleted ? 'Mark uncompleted' : 'Mark completed'}">
              ${isCompleted ? '✓' : ''}
            </button>
            <div class="task-details">
              <span class="task-text ${isCompleted ? 'completed-text' : ''}">${this.escapeHtml(task.title)}</span>
              <div class="task-tags">
                <span class="badge ${priorityInfo.class}">${priorityInfo.label}</span>
                <span class="badge badge-subtle">${CATEGORY_ICONS[task.category] || task.category || 'work'}</span>
                ${dueBadge}
                <button class="btn-icon-tiny ${inQueue ? 'btn-queue-active' : ''}" data-action="toggle-queue" title="${inQueue ? 'Remove from Focus Room queue' : 'Add to Focus Room queue'}">
                  ${inQueue ? '📌 In Focus Queue' : '+ Focus Queue'}
                </button>
              </div>
            </div>
          </div>
          <div class="task-actions-right">
            <div class="task-pomo-badge" title="Completed / Estimated Pomodoros">
              <span>🍅</span> <span>${act}/${est}</span>
            </div>
            <button class="btn-icon-tiny btn-add-pomo" data-action="add-pomo" title="Add +1 Pomodoro to estimate">+1 🍅</button>
            <button class="btn-focus-task btn-icon-small" data-action="select" title="Focus on this task">
              ${isSelected ? '🎯 Active' : 'Focus'}
            </button>
            <button class="btn-delete-task btn-icon-small" data-action="delete" title="Delete task">✕</button>
          </div>
        </div>
      `;
    }).join('');
            <button class="btn-icon-tiny btn-add-pomo" data-action="add-pomo" title="Add +1 Pomodoro to estimate">+1 🍅</button>
            <button class="btn-focus-task btn-icon-small" data-action="select" title="Focus on this task">
              ${isSelected ? '🎯 Active' : 'Focus'}
            </button>
            <button class="btn-delete-task btn-icon-small" data-action="delete" title="Delete task">✕</button>
          </div>
        </div>
      `;
    }).join('');

    // Attach listeners
    containerEl.querySelectorAll('.task-item').forEach(item => {
      const id = item.dataset.id;
      item.querySelector('[data-action="toggle"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleTask(id);
      });

      item.querySelector('[data-action="toggle-queue"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleFocusQueue(id);
      });

      item.querySelector('[data-action="add-pomo"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.addPomodoroToTask(id);
      });

      item.querySelector('[data-action="select"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.setActiveTask(id);
      });

      item.querySelector('[data-action="delete"]')?.addEventListener('click', (e) => {
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
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}
