/* LifeBuddy Central Application Coordinator */
import { Storage } from './storage.js';
import { store } from './store.js';
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
import { dailyLogController } from './daily_log.js';

function initApp() {
  const CIRCUMFERENCE = 2 * Math.PI * 136; // 854.513 (matches SVG circle r="136")
  const settings = Storage.getSettings();

  // 1. Initialize Controllers
  const themeManager = new ThemeManager();
  const statsVisualizer = new StatsVisualizer();
  const insightsCoordinator = new InsightsCoordinator();
  const transparencyController = new ModelTransparencyController();

  // Initialize Modals
  transparencyController.init();
  dailyLogController.init();

  const taskManager = new TaskManager({
    onTasksChanged: () => {
      taskManager.renderTaskList(document.getElementById('task-list-container'));
      taskManager.renderTaskList(document.getElementById('planner-task-list'));
      dashboardManager.render(document.getElementById('view-dashboard')).catch(console.warn);
    },
    onActiveTaskChanged: (activeTask) => {
      updateActiveTaskBadge(activeTask);
    }
  });

  const habitManager = new HabitManager({
    onChanged: () => {
      habitManager.renderHabitsList(document.getElementById('habits-list-container'));
      dashboardManager.render(document.getElementById('view-dashboard')).catch(console.warn);
    }
  });

  const expenseManager = new ExpenseManager({
    onChanged: () => {
      expenseManager.renderExpenseList(document.getElementById('expense-list-container'));
      expenseManager.renderBudgetWidget(document.getElementById('budget-widget-container'));
      statsVisualizer.renderCategoryBreakdown().catch(console.warn);
      dashboardManager.render(document.getElementById('view-dashboard')).catch(console.warn);
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
      taskManager.loadTasks ? taskManager.loadTasks() : null;
    }
  });

  const authController = new AuthController({
    onUserChanged: async () => {
      try {
        await store.fetchState();
        taskManager.renderTaskList(document.getElementById('planner-task-list'));
        habitManager.renderHabitsList(document.getElementById('habits-list-container'));
        expenseManager.render();
        await dashboardManager.render(document.getElementById('view-dashboard'));
        statsVisualizer.updateStatsUI();
        insightsCoordinator.render();
      } catch (e) {
        console.warn('User change reload error:', e);
      }
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
      updateSessionCounterUI();
    },

    onComplete: async ({ mode, durationMinutes }) => {
      audioSynth.playCompletionChime();

      if (mode === 'focus') {
        try {
          await taskManager.incrementActiveTaskPomodoro();
          Storage.recordCompletedSession(durationMinutes);
          await store.recordFocusSession({
            task_id: taskManager.activeTaskId,
            mode: 'focus',
            duration_minutes: durationMinutes
          });
        } catch (e) {
          console.warn('Failed to record session:', e);
        }
        statsVisualizer.updateStatsUI();
        dashboardManager.render(document.getElementById('view-dashboard')).catch(console.warn);
        showToast('🎉 Focus session completed! Mindful work recognized.');
      } else {
        showToast('🌿 Break finished! Ready to refocus?');
      }

      updateStartPauseBtn(false);
      updateSessionCounterUI();

      const currentSettings = Storage.getSettings();
      if (mode === 'focus' && currentSettings.autoStartBreaks) {
        setTimeout(() => timerEngine.start(), 1500);
      } else if (mode !== 'focus' && currentSettings.autoStartPomodoros) {
        setTimeout(() => timerEngine.start(), 1500);
      }
    }
  });

  function updateSessionCounterUI() {
    const counterEl = document.getElementById('pomodoro-session-counter');
    if (!counterEl) return;
    const current = (timerEngine.completedFocusSessions % 4) + 1;
    counterEl.textContent = `Pomodoro ${current} of 4`;
  }

  // ==========================================
  // 2. Synchronous UI DOM Event Bindings
  // ==========================================

  // View / Tab Navigation Switcher
  const navTabs = document.querySelectorAll('.nav-tab');
  const appViews = document.querySelectorAll('.app-view');

  function switchView(viewName) {
    navTabs.forEach(t => {
      if (t.dataset.view === viewName) t.classList.add('active');
      else t.classList.remove('active');
    });

    appViews.forEach(v => {
      if (v.id === `view-${viewName}`) v.classList.add('active');
      else v.classList.remove('active');
    });

    // Auto-stop ambient sound when leaving Focus Room
    if (viewName !== 'focus') {
      audioSynth.stopAllAmbientSounds();
      document.querySelectorAll('.sound-card').forEach(c => c.classList.remove('active'));
      const stopSoundBtn = document.getElementById('global-sound-stop-btn');
      if (stopSoundBtn) stopSoundBtn.style.display = 'none';
    }

    if (viewName === 'dashboard') {
      dashboardManager.render(document.getElementById('view-dashboard')).catch(console.warn);
    } else if (viewName === 'insights') {
      insightsCoordinator.render().catch(console.warn);
      statsVisualizer.updateStatsUI().catch(console.warn);
    } else if (viewName === 'habits') {
      habitManager.renderHabitsList(document.getElementById('habits-list-container'));
    } else if (viewName === 'planner') {
      taskManager.renderTaskList(document.getElementById('planner-task-list'));
    } else if (viewName === 'focus') {
      taskManager.renderTaskList(document.getElementById('task-list-container'));
    } else if (viewName === 'finances') {
      expenseManager.render();
    }
  }

  navTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      switchView(tab.dataset.view);
    });
  });

  // Timer DOM controls
  const startPauseBtn = document.getElementById('start-pause-btn');
  const resetBtn = document.getElementById('reset-btn');
  const modeBtns = document.querySelectorAll('.mode-btn');

  function toggleStartPause() {
    if (timerEngine.isRunning) {
      timerEngine.pause();
      updateStartPauseBtn(false);
    } else {
      timerEngine.start();
      updateStartPauseBtn(true);
    }
  }

  if (startPauseBtn) {
    startPauseBtn.addEventListener('click', toggleStartPause);
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      timerEngine.reset();
      updateStartPauseBtn(false);
      updateSessionCounterUI();
    });
  }

  modeBtns.forEach(btn => {
    btn.addEventListener('click', (e) => {
      const mode = e.currentTarget.dataset.mode;
      timerEngine.switchMode(mode);
      updateStartPauseBtn(false);
      updateSessionCounterUI();
    });
  });

  // Global Spacebar shortcut for Start/Pause timer
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') {
      const activeEl = document.activeElement;
      const isInput = activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        activeEl.tagName === 'SELECT' || 
        activeEl.isContentEditable
      );
      if (!isInput && !document.querySelector('.modal-overlay.active')) {
        e.preventDefault();
        toggleStartPause();
      }
    }
  });

  function updateStartPauseBtn(isRunning) {
    if (!startPauseBtn) return;
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

  // Quick Task Forms (Focus Room & Planner)
  const taskForm = document.getElementById('task-form');
  const taskTitleInput = document.getElementById('task-title-input');
  const taskPomoInput = document.getElementById('task-pomo-input');

  if (taskForm) {
    taskForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = taskTitleInput ? taskTitleInput.value : '';
      const estPomo = taskPomoInput ? taskPomoInput.value : 1;
      if (title.trim()) {
        await taskManager.addTask(title, estPomo);
        if (taskTitleInput) taskTitleInput.value = '';
        if (taskPomoInput) taskPomoInput.value = '1';
        showToast('Task added to queue');
      }
    });
  }

  const plannerTaskForm = document.getElementById('planner-task-form');
  if (plannerTaskForm) {
    plannerTaskForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('planner-task-title')?.value || '';
      const category = document.getElementById('planner-task-cat')?.value || 'work';
      const priority = document.getElementById('planner-task-priority')?.value || 'medium';
      const estPomo = document.getElementById('planner-task-pomo')?.value || 1;
      const dueDate = document.getElementById('planner-task-due')?.value || null;

      if (title.trim()) {
        await taskManager.addTask(title, estPomo, category, priority, dueDate || null);
        plannerTaskForm.reset();
        showToast('Task created');
      }
    });
  }

  // Filter tabs for Planner
  document.querySelectorAll('.task-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.task-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      taskManager.renderTaskList(document.getElementById('planner-task-list'), filter);
    });
  });

  // Habit Form
  const habitForm = document.getElementById('habit-form');
  if (habitForm) {
    habitForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('habit-title-input')?.value || '';
      const icon = document.getElementById('habit-icon-select')?.value || '🌱';
      if (title.trim()) {
        await habitManager.addHabit({ title, icon });
        habitForm.reset();
        showToast('New daily habit created');
      }
    });
  }

  // Ambient Sound Synthesis & Master Volume / Mute
  const globalSoundBtn = document.getElementById('global-sound-stop-btn');
  const masterSlider = document.getElementById('ambient-master-slider');
  const masterMuteBtn = document.getElementById('ambient-master-mute-btn');

  if (masterSlider) {
    masterSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      audioSynth.setMasterVolume(val);
    });
  }

  if (masterMuteBtn) {
    masterMuteBtn.addEventListener('click', () => {
      audioSynth.isMuted = !audioSynth.isMuted;
      if (audioSynth.isMuted) {
        audioSynth.setMasterVolume(0);
        masterMuteBtn.textContent = '🔇';
        showToast('Muted ambient sounds');
      } else {
        const val = masterSlider ? parseFloat(masterSlider.value) : 0.7;
        audioSynth.setMasterVolume(val);
        masterMuteBtn.textContent = '🔊';
        showToast('Unmuted ambient sounds');
      }
    });
  }

  if (globalSoundBtn) {
    globalSoundBtn.addEventListener('click', () => {
      audioSynth.stopAllAmbientSounds();
      document.querySelectorAll('.sound-card').forEach(c => c.classList.remove('active'));
      globalSoundBtn.style.display = 'none';
      showToast('🔇 Ambient sounds stopped');
    });
  }

  document.querySelectorAll('.sound-card').forEach(card => {
    const type = card.dataset.sound;
    const slider = card.querySelector('.sound-slider');

    card.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT') return;
      const volume = slider ? parseFloat(slider.value) : 0.5;
      const isPlaying = audioSynth.toggleAmbientSound(type, volume);
      if (isPlaying) card.classList.add('active');
      else card.classList.remove('active');

      const anyPlaying = Object.keys(audioSynth.activeNodes).length > 0;
      if (globalSoundBtn) {
        globalSoundBtn.style.display = anyPlaying ? 'inline-flex' : 'none';
      }
    });

    if (slider) {
      slider.addEventListener('input', (e) => {
        const volume = parseFloat(e.target.value);
        audioSynth.setAmbientVolume(type, volume);
      });
    }
  });

  // Theme Swatches
  document.querySelectorAll('.theme-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      const theme = swatch.dataset.theme;
      themeManager.applyTheme(theme);
      showToast(`Applied ${theme.charAt(0).toUpperCase() + theme.slice(1)} theme`);
    });
  });

  // Settings & Preferences Modal
  const settingsBtn = document.getElementById('settings-btn');
  const settingsModal = document.getElementById('settings-modal');
  const closeSettingsBtn = document.getElementById('close-settings-btn');
  const saveSettingsBtn = document.getElementById('save-settings-btn');
  const zenToggleBtn = document.getElementById('zen-toggle-btn');
  const exitZenBtn = document.getElementById('exit-zen-btn');

  if (settingsBtn && settingsModal) {
    settingsBtn.addEventListener('click', () => {
      const curr = Storage.getSettings();
      const fInput = document.getElementById('input-focus-time');
      const sbInput = document.getElementById('input-short-break-time');
      const lbInput = document.getElementById('input-long-break-time');
      const abCheck = document.getElementById('input-auto-breaks');
      const apCheck = document.getElementById('input-auto-pomo');
      const budgetInp = document.getElementById('pref-monthly-budget');
      const focusGoalInp = document.getElementById('pref-daily-focus-goal');

      if (fInput) fInput.value = curr.focusDuration;
      if (sbInput) sbInput.value = curr.shortBreakDuration;
      if (lbInput) lbInput.value = curr.longBreakDuration;
      if (abCheck) abCheck.checked = curr.autoStartBreaks;
      if (apCheck) apCheck.checked = curr.autoStartPomodoros;
      if (budgetInp) budgetInp.value = store.getBudget();
      if (focusGoalInp) focusGoalInp.value = store.state.settings?.daily_focus_goal || 100;

      const sndCheck = document.getElementById('input-sound-enabled');
      if (sndCheck) sndCheck.checked = curr.soundEnabled !== false;

      settingsModal.classList.add('active');
    });
  }

  if (closeSettingsBtn && settingsModal) {
    closeSettingsBtn.addEventListener('click', () => {
      settingsModal.classList.remove('active');
    });
  }

  if (saveSettingsBtn && settingsModal) {
    saveSettingsBtn.addEventListener('click', async () => {
      const focusMin = parseInt(document.getElementById('input-focus-time')?.value) || 25;
      const shortMin = parseInt(document.getElementById('input-short-break-time')?.value) || 5;
      const longMin = parseInt(document.getElementById('input-long-break-time')?.value) || 15;
      const autoBreaks = !!document.getElementById('input-auto-breaks')?.checked;
      const autoPomo = !!document.getElementById('input-auto-pomo')?.checked;
      const soundEnabled = document.getElementById('input-sound-enabled') ? document.getElementById('input-sound-enabled').checked : true;
      const monthlyBudget = parseFloat(document.getElementById('pref-monthly-budget')?.value) || 25000;
      const dailyFocusGoal = parseInt(document.getElementById('pref-daily-focus-goal')?.value) || 100;

      const curr = Storage.getSettings();
      curr.focusDuration = focusMin;
      curr.shortBreakDuration = shortMin;
      curr.longBreakDuration = longMin;
      curr.autoStartBreaks = autoBreaks;
      curr.autoStartPomodoros = autoPomo;
      curr.soundEnabled = soundEnabled;
      if (!soundEnabled) {
        audioSynth.stopAllAmbientSounds();
      }

      Storage.saveSettings(curr);
      timerEngine.setDurations(focusMin, shortMin, longMin);

      // Save budget and focus goal to store
      await store.setMonthlyBudget(monthlyBudget);
      store.state.settings.daily_focus_goal = dailyFocusGoal;
      store.persist();

      settingsModal.classList.remove('active');
      showToast('Preferences saved');
    });
  }

  // Backup Export & Cache Clear
  const btnExportBackup = document.getElementById('btn-export-backup');
  if (btnExportBackup) {
    btnExportBackup.addEventListener('click', () => {
      const backupData = JSON.stringify(store.state, null, 2);
      const blob = new Blob([backupData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `lifebuddy_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('📦 Data export downloaded');
    });
  }

  const btnClearCache = document.getElementById('btn-clear-cache');
  if (btnClearCache) {
    btnClearCache.addEventListener('click', () => {
      if (confirm('Clear local cache and refresh from database?')) {
        localStorage.removeItem('lifebuddy_store_v2');
        window.location.reload();
      }
    });
  }

  if (zenToggleBtn) {
    zenToggleBtn.addEventListener('click', () => {
      document.body.classList.add('zen-mode');
      showToast('Entered Zen Mode (Esc to exit)');
    });
  }

  if (exitZenBtn) {
    exitZenBtn.addEventListener('click', () => {
      document.body.classList.remove('zen-mode');
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && document.body.classList.contains('zen-mode')) {
      document.body.classList.remove('zen-mode');
    }
  });

  // Initial timer visual reset
  timerEngine.reset();
  updateSessionCounterUI();

  // ==========================================
  // 3. Asynchronous Data Initializations
  // ==========================================
  (async () => {
    try {
      await authController.init();
    } catch (e) {
      console.warn('Auth controller init error:', e);
    }

    try {
      await syncEngine.init();
    } catch (e) {
      console.warn('Sync engine init error:', e);
    }

    try {
      await store.fetchState();
      taskManager.renderTaskList(document.getElementById('planner-task-list'));
      habitManager.renderHabitsList(document.getElementById('habits-list-container'));
      expenseManager.render();
    } catch (e) {
      console.warn('Data collections load error:', e);
    }

    try {
      await dashboardManager.render(document.getElementById('view-dashboard'));
    } catch (e) {
      console.warn('Dashboard initial render error:', e);
    }

    try {
      insightsCoordinator.render();
    } catch (e) {
      console.warn('Insights coordinator render error:', e);
    }
  })();

  // Toast Helper
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

  // HTML Escape Helper
  function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>"']/g, match => {
      const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
      return map[match];
    });
  }
}

// Ensure startup regardless of DOM readiness state
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
