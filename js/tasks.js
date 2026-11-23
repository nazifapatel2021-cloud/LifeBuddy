/* LifeBuddy Task & Planner Management System */
import { API } from './api.js';
import { store } from './store.js';
import { getLocalDateString, normalizeDate, formatFriendlyDate } from './date_utils.js';

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
    this.initEditModal();
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
    const active = this.getActiveTask();
    if (!active) {
      const priorityWeights = { urgent: 1, high: 2, medium: 3, low: 4 };
      const pendingTasks = tasks
        .filter(t => !t.completed)
        .sort((a, b) => (priorityWeights[a.priority?.toLowerCase()] || 3) - (priorityWeights[b.priority?.toLowerCase()] || 3));
      if (pendingTasks.length > 0) {
        this.setActiveTask(pendingTasks[0].id);
      } else {
        this.setActiveTask(null);
      }
    }
  }

  getTasks() {
    return store.state.tasks || [];
  }

  getActiveTask() {
    const tasks = store.state.tasks || [];
    if (!this.activeTaskId) return null;
    const task = tasks.find(t => t.id === this.activeTaskId && !t.completed);
    if (!task) {
      this.activeTaskId = null;
      localStorage.removeItem('lifebuddy_active_task_id');
      localStorage.removeItem('zen_pomodoro_active_task');
      return null;
    }
    return task;
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
        // Automatically switch active task to the highest-priority remaining pending one
        const priorityWeights = { urgent: 1, high: 2, medium: 3, low: 4 };
        const remaining = (store.state.tasks || [])
          .filter(t => t.id !== id && !t.completed)
          .sort((a, b) => (priorityWeights[a.priority?.toLowerCase()] || 3) - (priorityWeights[b.priority?.toLowerCase()] || 3));
        this.setActiveTask(remaining.length > 0 ? remaining[0].id : null);
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
        const priorityWeights = { urgent: 1, high: 2, medium: 3, low: 4 };
        const remaining = (store.state.tasks || [])
          .filter(t => t.id !== id && !t.completed)
          .sort((a, b) => (priorityWeights[a.priority?.toLowerCase()] || 3) - (priorityWeights[b.priority?.toLowerCase()] || 3));
        this.setActiveTask(remaining.length > 0 ? remaining[0].id : null);
      }
    }
  }

  setActiveTask(id) {
    if (id) {
      const task = (store.state.tasks || []).find(t => t.id === id);
      if (task && task.completed) {
        id = null;
      }
    }
    this.activeTaskId = id || null;
    if (this.activeTaskId) {
      localStorage.setItem('lifebuddy_active_task_id', this.activeTaskId);
      localStorage.setItem('zen_pomodoro_active_task', this.activeTaskId);
    } else {
      localStorage.removeItem('lifebuddy_active_task_id');
      localStorage.removeItem('zen_pomodoro_active_task');
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

  openEditTaskModal(id) {
    const task = (store.state.tasks || []).find(t => t.id === id);
    if (!task) return;

    const modal = document.getElementById('edit-task-modal');
    const idInput = document.getElementById('edit-task-id');
    const titleInput = document.getElementById('edit-task-title-input');
    const catSelect = document.getElementById('edit-task-cat-select');
    const prioritySelect = document.getElementById('edit-task-priority-select');
    const pomoInput = document.getElementById('edit-task-pomo-input');
    const dueInput = document.getElementById('edit-task-due-input');
    const queueCheckbox = document.getElementById('edit-task-focus-queue');

    if (idInput) idInput.value = task.id;
    if (titleInput) titleInput.value = task.title || '';
    if (catSelect) catSelect.value = task.category || 'work';
    if (prioritySelect) prioritySelect.value = task.priority || 'medium';
    if (pomoInput) pomoInput.value = task.estimated_pomodoros || 1;
    if (dueInput) dueInput.value = normalizeDate(task.due_date) || '';

    if (modal) modal.classList.add('active');
    if (titleInput) titleInput.focus();
  }

  initEditModal() {
    const modal = document.getElementById('edit-task-modal');
    const form = document.getElementById('edit-task-form');
    const closeBtn = document.getElementById('close-edit-task-modal');
    const cancelBtn = document.getElementById('btn-cancel-edit-task');

    if (closeBtn && modal) {
      closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    }
    if (cancelBtn && modal) {
      cancelBtn.addEventListener('click', () => modal.classList.remove('active'));
    }

    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('edit-task-id')?.value;
        const title = document.getElementById('edit-task-title-input')?.value.trim();
        const category = document.getElementById('edit-task-cat-select')?.value || 'work';
        const priority = document.getElementById('edit-task-priority-select')?.value || 'medium';
        const estimated_pomodoros = parseInt(document.getElementById('edit-task-pomo-input')?.value, 10) || 1;
        const due_date = document.getElementById('edit-task-due-input')?.value || null;

        if (id && title) {
          await store.updateTask(id, {
            title,
            category,
            priority,
            estimated_pomodoros,
            due_date
          });
          if (modal) modal.classList.remove('active');
        }
      });
    }
  }

  /* Render Focus Room Target Queue (Automatically Prioritized) */
  renderFocusQueueList(containerEl) {
    if (!containerEl) return;
    const allTasks = store.state.tasks || [];
    const priorityWeights = { urgent: 1, high: 2, medium: 3, low: 4 };

    // Incomplete tasks ordered by Priority (Urgent > High > Medium > Low), then earlier Due Date
    const queueTasks = allTasks
      .filter(t => !t.completed)
      .sort((a, b) => {
        const weightA = priorityWeights[a.priority?.toLowerCase()] || 3;
        const weightB = priorityWeights[b.priority?.toLowerCase()] || 3;
        if (weightA !== weightB) {
          return weightA - weightB;
        }
        if (a.due_date && b.due_date) {
          return a.due_date.localeCompare(b.due_date);
        }
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return 0;
      });

    if (queueTasks.length === 0) {
      containerEl.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🎯</div>
          <p>All tasks completed! Add new tasks from the Planner to focus on them here.</p>
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
        if (this.activeTaskId === id) {
          this.setActiveTask(null);
        } else {
          this.setActiveTask(id);
        }
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

    // 7-day cutoff for completed tasks to prevent historical clutter over time
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = getLocalDateString(sevenDaysAgo);

    let filtered = [...(store.state.tasks || [])];

    // Automatically hide completed tasks older than 7 days
    filtered = filtered.filter(t => {
      if (!t.completed) return true; // Always keep all pending tasks
      const compDateRaw = t.completed_at || t.updated_at || t.due_date || t.created_at;
      if (!compDateRaw) return true;
      const compDate = compDateRaw.split('T')[0];
      return compDate >= sevenDaysAgoStr;
    });

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

    // Sort: Pending tasks first (ordered by Priority & Due Date), then recently completed tasks
    const priorityWeights = { urgent: 1, high: 2, medium: 3, low: 4 };
    filtered.sort((a, b) => {
      if (Boolean(a.completed) !== Boolean(b.completed)) {
        return a.completed ? 1 : -1;
      }
      if (!a.completed) {
        const weightA = priorityWeights[a.priority?.toLowerCase()] || 3;
        const weightB = priorityWeights[b.priority?.toLowerCase()] || 3;
        if (weightA !== weightB) return weightA - weightB;
        if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date);
        if (a.due_date) return -1;
        if (b.due_date) return 1;
        return 0;
      }
      const dateA = a.completed_at || a.updated_at || '';
      const dateB = b.completed_at || b.updated_at || '';
      return dateB.localeCompare(dateA);
    });

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
      const isCompleted = !!task.completed;
      const isSelected = !isCompleted && task.id === this.activeTaskId;
      const priorityInfo = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG['medium'];
      const act = task.completed_pomodoros ?? 0;
      const est = task.estimated_pomodoros ?? 1;

      const normDue = normalizeDate(task.due_date);
      const isOverdue = normDue && normDue < todayStr && !isCompleted;
      const isDueToday = normDue === todayStr && !isCompleted;

      let dueBadge = '';
      if (task.due_date) {
        const friendlyDue = formatFriendlyDate(normDue || task.due_date);
        if (isOverdue) {
          dueBadge = `<span class="badge badge-urgent" title="Overdue!">⚠️ Overdue: ${friendlyDue}</span>`;
        } else if (isDueToday) {
          dueBadge = `<span class="badge badge-high" title="Due today">📅 Today</span>`;
        } else {
          dueBadge = `<span class="badge badge-subtle">📅 ${friendlyDue}</span>`;
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
              </div>
            </div>
          </div>
          <div class="task-actions-right">
            <div class="task-pomo-badge" title="Completed / Estimated Pomodoros">
              <span>🍅</span> <span>${act}/${est}</span>
            </div>
            ${!isCompleted ? `
              <button class="btn-icon-tiny btn-add-pomo" data-action="add-pomo" title="Add +1 Pomodoro to estimate">+1 🍅</button>
            ` : ''}
            <button class="btn-edit-task btn-icon-small" data-action="edit" title="Edit task details">✏️</button>
            ${!isCompleted ? `
              <button class="btn-focus-task btn-icon-small" data-action="select" title="Focus on this task">
                ${isSelected ? '🎯 Active' : 'Focus'}
              </button>
            ` : ''}
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

      item.querySelector('[data-action="edit"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.openEditTaskModal(id);
      });

      item.querySelector('[data-action="select"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const task = (store.state.tasks || []).find(t => t.id === id);
        if (task && task.completed) return;
        if (this.activeTaskId === id) {
          this.setActiveTask(null);
        } else {
          this.setActiveTask(id);
        }
      });

      item.querySelector('[data-action="delete"]')?.addEventListener('click', (e) => {
        e.stopPropagation();
        this.deleteTask(id);
      });

      item.addEventListener('click', (e) => {
        if (!e.target.closest('button')) {
          const task = (store.state.tasks || []).find(t => t.id === id);
          if (task && !task.completed) {
            this.setActiveTask(id);
          }
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
