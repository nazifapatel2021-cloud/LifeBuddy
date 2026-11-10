/* LifeBuddy Central Application Coordinator */
import { Storage } from './storage.js';
import { audioSynth } from './audio.js';
import { TimerEngine } from './timer.js';
import { TaskManager } from './tasks.js';
import { HabitManager } from './habits.js';
import { ExpenseManager } from './expenses.js';
import { DashboardManager } from './dashboard.js';
import { AuthController } from './auth.js';
import { StatsVisualizer } from './stats.js';
import { ThemeManager } from './theme.js';
import { InsightsCoordinator } from './insights.js';
import { ModelTransparencyController } from './transparency.js';
import { API } from './api.js';
import { syncEngine } from './sync.js';
import { studyController } from './study.js';

document.addEventListener('DOMContentLoaded', async () => {
  const CIRCUMFERENCE = 2 * Math.PI * 140; // 879.64
  const settings = Storage.getSettings();

  // 1. Initialize Controllers
  const themeManager = new ThemeManager();
  const statsVisualizer = new StatsVisualizer();
  const insightsCoordinator = new InsightsCoordinator();
  const transparencyController = new ModelTransparencyController();
  transparencyController.init();
  studyController.init();

  const taskManager = new TaskManager({
    onTasksChanged: () => {
      taskManager.renderTaskList(document.getElementById('task-list-container'));
      taskManager.renderTaskList(document.getElementById('planner-task-list'));
      dashboardManager.render(document.getElementById('view-dashboard'));
    },
    onActiveTaskChanged: (activeTask) => {
      updateActiveTaskBadge(activeTask);
    }
  });

  const habitManager = new HabitManager({
    onChanged: () => {
      habitManager.renderHabitsList(document.getElementById('habits-list-container'));
      dashboardManager.render(document.getElementById('view-dashboard'));
    }
  });

  const expenseManager = new ExpenseManager({
    onChanged: () => {
      expenseManager.renderExpenseList(document.getElementById('expense-list-container'));
      expenseManager.renderBudgetWidget(document.getElementById('budget-widget-container'));
      statsVisualizer.renderCategoryBreakdown();
      dashboardManager.render(document.getElementById('view-dashboard'));
    }
  });

  const dashboardManager = new DashboardManager({
    onNavigate: (viewName) => {
      switchView(viewName);
    },
    onStartFocus: () => {
      timerEngine.start();
      updateStartPauseBtn(true);
    },
    onTaskFocus: (taskId) => {
      taskManager.setActiveTask(taskId);
    },
    onTaskCreated: () => {
      taskManager.loadTasks();
    }
  });

  const authController = new AuthController({
    onUserChanged: async () => {
      await taskManager.loadTasks();
      await habitManager.loadHabits();
      await expenseManager.loadExpenses();
      await dashboardManager.render(document.getElementById('view-dashboard'));
      statsVisualizer.updateStatsUI();
      insightsCoordinator.render();
    }
  });

  const timerEngine = new TimerEngine({
    focusDuration: settings.focusDuration,
    shortBreakDuration: settings.shortBreakDuration,
    longBreakDuration: settings.longBreakDuration,
    longBreakInterval: settings.longBreakInterval || 4,

    onTick: (formattedTime, progressPct) => {
      const timerDigits = document.getElementById('timer-digits');
      const progressRing = document.getElementById('timer-progress-ring');

      if (timerDigits) timerDigits.textContent = formattedTime;
      if (progressRing) {
        const offset = CIRCUMFERENCE - (progressPct / 100) * CIRCUMFERENCE;
        progressRing.style.strokeDashoffset = offset;
      }
    },

    onModeChange: (mode) => {
      updateModeTabs(mode);
      const timerLabel = document.getElementById('timer-label');
      if (timerLabel) {
        if (mode === 'focus') timerLabel.textContent = 'Focus Session';
        else if (mode === 'shortBreak') timerLabel.textContent = 'Short Break';
        else if (mode === 'longBreak') timerLabel.textContent = 'Long Break';
      }
    },

    onComplete: async ({ mode, durationMinutes }) => {
      audioSynth.playCompletionChime();

      if (mode === 'focus') {
        await taskManager.incrementActiveTaskPomodoro();
        Storage.recordCompletedSession(durationMinutes);
        await API.focus.recordSession({
          task_id: taskManager.activeTaskId,
          mode: 'focus',
          duration_minutes: durationMinutes
        });
        statsVisualizer.updateStatsUI();
        dashboardManager.render(document.getElementById('view-dashboard'));
        showToast('🎉 Focus session completed! Mindful work recognized.');
      } else {
        showToast('🌿 Break finished! Ready to refocus?');
      }

      updateStartPauseBtn(false);

      const currentSettings = Storage.getSettings();
      if (mode === 'focus' && currentSettings.autoStartBreaks) {
        setTimeout(() => timerEngine.start(), 1500);
      } else if (mode !== 'focus' && currentSettings.autoStartPomodoros) {
        setTimeout(() => timerEngine.start(), 1500);
      }
    }
  });

  // 2. Initialize Data
  await taskManager.init();
  await habitManager.init();
  await expenseManager.init();
  await authController.init();
  await syncEngine.init();
  await dashboardManager.render(document.getElementById('view-dashboard'));
  insightsCoordinator.render();
  timerEngine.reset();

  // 3. View / Tab Navigation Switcher
  const navTabs = document.querySelectorAll('.nav-tab');
  const appViews = document.querySelectorAll('.app-view');

  function switchView(viewName) {
    audioSynth.playClickSound();

    navTabs.forEach(t => {
      if (t.dataset.view === viewName) t.classList.add('active');
      else t.classList.remove('active');
    });

    appViews.forEach(v => {
      if (v.id === `view-${viewName}`) v.classList.add('active');
      else v.classList.remove('active');
    });

    if (viewName === 'dashboard') {
      dashboardManager.render(document.getElementById('view-dashboard'));
    } else if (viewName === 'insights') {
      insightsCoordinator.render();
      statsVisualizer.updateStatsUI();
    }
  }

  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      switchView(tab.dataset.view);
    });
  });

  // 4. Timer DOM controls
  const startPauseBtn = document.getElementById('start-pause-btn');
  const resetBtn = document.getElementById('reset-btn');
  const modeBtns = document.querySelectorAll('.mode-btn');

  startPauseBtn.addEventListener('click', () => {
    audioSynth.playClickSound();
    if (timerEngine.isRunning) {
      timerEngine.pause();
      updateStartPauseBtn(false);
    } else {
      timerEngine.start();
      updateStartPauseBtn(true);
    }
  });

  resetBtn.addEventListener('click', () => {
    audioSynth.playClickSound();
    timerEngine.reset();
    updateStartPauseBtn(false);
  });

  modeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      audioSynth.playClickSound();
      const mode = e.target.dataset.mode;
      timerEngine.switchMode(mode);
      updateStartPauseBtn(false);
    });
  });

  function updateStartPauseBtn(isRunning) {
    if (isRunning) {
      startPauseBtn.innerHTML = `<span>❚❚</span> <span>Pause</span>`;
      startPauseBtn.style.background = 'var(--accent-primary-hover)';
    } else {
      startPauseBtn.innerHTML = `<span>▶</span> <span>Start</span>`;
      startPauseBtn.style.background = 'var(--accent-primary)';
    }
  }

  function updateModeTabs(activeMode) {
    modeBtns.forEach(btn => {
      if (btn.dataset.mode === activeMode) btn.classList.add('active');
      else btn.classList.remove('active');
    });
  }

  function updateActiveTaskBadge(task) {
    const badge = document.getElementById('active-task-badge');
    if (!badge) return;
    if (task) {
      badge.style.display = 'inline-flex';
      badge.innerHTML = `<span>🎯</span> <span>${escapeHtml(task.title)}</span>`;
    } else {
      badge.style.display = 'none';
    }
  }

  // 5. Quick Task Forms (Focus Room & Planner)
  const taskForm = document.getElementById('task-form');
  const taskTitleInput = document.getElementById('task-title-input');
  const taskPomoInput = document.getElementById('task-pomo-input');

  if (taskForm) {
    taskForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = taskTitleInput.value;
      const estPomo = taskPomoInput.value;
      if (title.trim()) {
        await taskManager.addTask(title, estPomo);
        taskTitleInput.value = '';
        taskPomoInput.value = '1';
        showToast('Task added');
      }
    });
  }

  const plannerTaskForm = document.getElementById('planner-task-form');
  if (plannerTaskForm) {
    plannerTaskForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('planner-task-title').value;
      const category = document.getElementById('planner-task-cat').value;
      const priority = document.getElementById('planner-task-priority').value;
      const estPomo = document.getElementById('planner-task-pomo').value;
      const dueDate = document.getElementById('planner-task-due').value;

      if (title.trim()) {
        await taskManager.addTask(title, estPomo, category, priority, dueDate || null);
        plannerTaskForm.reset();
        showToast('Planner task saved');
      }
    });
  }

  // Filter tabs for Planner
  document.querySelectorAll('.task-filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      document.querySelectorAll('.task-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      taskManager.renderTaskList(document.getElementById('planner-task-list'), filter);
    });
  });

  // 6. Habit Form
  const habitForm = document.getElementById('habit-form');
  if (habitForm) {
    habitForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('habit-title-input').value;
      const icon = document.getElementById('habit-icon-select').value;
      if (title.trim()) {
        await habitManager.addHabit({ title, icon });
        habitForm.reset();
        showToast('New daily habit created');
      }
    });
  }

  // 7. Expense Form with ML Auto-Categorization!
  const expenseForm = document.getElementById('expense-form');
  const expNoteInput = document.getElementById('exp-note-input');
  const expCategorySelect = document.getElementById('exp-category-select');

  if (expNoteInput && expCategorySelect) {
    let expDebounce = null;
    expNoteInput.addEventListener('input', () => {
      clearTimeout(expDebounce);
      const text = expNoteInput.value.trim();
      if (text.length >= 3) {
        expDebounce = setTimeout(async () => {
          try {
            const pred = await API.ml.categorizeExpense(text);
            if (pred && pred.category) {
              const options = Array.from(expCategorySelect.options);
              const match = options.find(o => o.value.toLowerCase() === pred.category.toLowerCase());
              if (match) {
                expCategorySelect.value = match.value;
                showToast(`✨ Auto-categorized as ${match.value}`);
              }
            }
          } catch {}
        }, 350);
      }
    });
  }

  if (expenseForm) {
    expenseForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const amount = document.getElementById('exp-amount-input').value;
      const category = expCategorySelect.value;
      const note = expNoteInput.value;
      const date = document.getElementById('exp-date-input').value;
      const type = document.getElementById('exp-type-select').value;

      if (amount && category) {
        await expenseManager.addExpense({ amount, category, note, date, type });
        expenseForm.reset();
        document.getElementById('exp-date-input').value = new Date().toISOString().split('T')[0];
        const modal = document.getElementById('expense-modal');
        if (modal) modal.classList.remove('active');
        showToast('Expense recorded');
      }
    });
  }

  // 8. Ambient Sound Synthesis
  document.querySelectorAll('.sound-card').forEach(card => {
    const type = card.dataset.sound;
    const slider = card.querySelector('.sound-slider');

    card.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT') return;
      audioSynth.playClickSound();
      const volume = parseFloat(slider.value);
      const isPlaying = audioSynth.toggleAmbientSound(type, volume);
      if (isPlaying) card.classList.add('active');
      else card.classList.remove('active');
    });

    slider.addEventListener('input', (e) => {
      const volume = parseFloat(e.target.value);
      audioSynth.setAmbientVolume(type, volume);
    });
  });

  // 9. Floating Action Button (FAB)
  const fabBtn = document.getElementById('fab-quick-btn');
  const expenseModal = document.getElementById('expense-modal');
  const closeExpenseModal = document.getElementById('close-expense-modal');

  if (fabBtn && expenseModal) {
    fabBtn.addEventListener('click', () => {
      audioSynth.playClickSound();
      expenseModal.classList.add('active');
    });
  }

  if (closeExpenseModal && expenseModal) {
    closeExpenseModal.addEventListener('click', () => {
      expenseModal.classList.remove('active');
    });
  }

  // 10. Theme Swatches
  document.querySelectorAll('.theme-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      audioSynth.playClickSound();
      const theme = swatch.dataset.theme;
      themeManager.applyTheme(theme);
      showToast(`Applied ${theme.charAt(0).toUpperCase() + theme.slice(1)} theme`);
    });
  });

  // 11. Settings & Zen Mode
  const settingsBtn = document.getElementById('settings-btn');
  const settingsModal = document.getElementById('settings-modal');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  const saveSettingsBtn = document.getElementById('save-settings-btn');
  const zenToggleBtn = document.getElementById('zen-toggle-btn');
  const exitZenBtn = document.getElementById('exit-zen-btn');

  settingsBtn.addEventListener('click', () => {
    audioSynth.playClickSound();
    const curr = Storage.getSettings();
    document.getElementById('input-focus-time').value = curr.focusDuration;
    document.getElementById('input-short-break-time').value = curr.shortBreakDuration;
    document.getElementById('input-long-break-time').value = curr.longBreakDuration;
    document.getElementById('input-auto-breaks').checked = curr.autoStartBreaks;
    document.getElementById('input-auto-pomo').checked = curr.autoStartPomodoros;
    settingsModal.classList.add('active');
  });

  closeSettingsBtn.addEventListener('click', () => {
    settingsModal.classList.remove('active');
  });

  saveSettingsBtn.addEventListener('click', () => {
    audioSynth.playClickSound();
    const focusMin = parseInt(document.getElementById('input-focus-time').value) || 25;
    const shortMin = parseInt(document.getElementById('input-short-break-time').value) || 5;
    const longMin = parseInt(document.getElementById('input-long-break-time').value) || 15;
    const autoBreaks = document.getElementById('input-auto-breaks').checked;
    const autoPomo = document.getElementById('input-auto-pomo').checked;

    const curr = Storage.getSettings();
    curr.focusDuration = focusMin;
    curr.shortBreakDuration = shortMin;
    curr.longBreakDuration = longMin;
    curr.autoStartBreaks = autoBreaks;
    curr.autoStartPomodoros = autoPomo;

    Storage.saveSettings(curr);
    timerEngine.setDurations(focusMin, shortMin, longMin);
    settingsModal.classList.remove('active');
    showToast('Preferences saved');
  });

  zenToggleBtn.addEventListener('click', () => {
    audioSynth.playClickSound();
    document.body.classList.add('zen-mode');
    showToast('Entered Zen Mode (Esc to exit)');
  });

  exitZenBtn.addEventListener('click', () => {
    document.body.classList.remove('zen-mode');
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('zen-mode')) {
      document.body.classList.remove('zen-mode');
    }
  });

  function showToast(msg) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<span>✨</span> <span>${msg}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 2800);
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, match => {
      const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
      return map[match];
    });
  }
});
