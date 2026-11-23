/* LifeBuddy Central Application Coordinator */
import { Storage } from './storage.js';
import { store } from './store.js';
import { audioSynth } from './audio.js';
import { TimerEngine } from './timer.js';
import { TaskManager } from './tasks.js';
import { HabitManager } from './habits.js';
import { ExpenseManager } from './expenses.js';
import { DashboardManager } from './dashboard.js?v=3.5';
import { AuthController } from './auth.js';
import { StatsVisualizer } from './stats.js';
import { ThemeManager } from './theme.js';
import { InsightsCoordinator } from './insights.js';
import { ModelTransparencyController } from './transparency.js';
import { API } from './api.js';
import { syncEngine } from './sync.js';
import { dailyLogController } from './daily_log.js';
import { getLocalDateString } from './date_utils.js';

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
      taskManager.renderFocusQueueList(document.getElementById('task-list-container'));
      taskManager.renderTaskList(document.getElementById('planner-task-list'));
      dashboardManager.render(document.getElementById('view-dashboard')).catch(console.warn);
      updateSessionCounterUI();
    },
    onActiveTaskChanged: (activeTask) => {
      updateActiveTaskBadge(activeTask);
      updateSessionCounterUI();
      dashboardManager.render(document.getElementById('view-dashboard')).catch(console.warn);
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
      updateSessionCounterUI();
    },
    getActiveTaskId: () => {
      return taskManager.getActiveTask()?.id || null;
    },
    onTaskCreated: () => {
      taskManager.loadTasks ? taskManager.loadTasks() : null;
    }
  });

  const authController = new AuthController({
    onUserChanged: async () => {
      try {
        if (insightsCoordinator.clearCache) insightsCoordinator.clearCache();
        await store.fetchState();
        taskManager.renderFocusQueueList(document.getElementById('task-list-container'));
        taskManager.renderTaskList(document.getElementById('planner-task-list'));
        habitManager.renderHabitsList(document.getElementById('habits-list-container'));
        expenseManager.render();
        await dashboardManager.render(document.getElementById('view-dashboard'));
        statsVisualizer.updateStatsUI();
        insightsCoordinator.render();
        updateSessionCounterUI();
        updateActiveTaskBadge(taskManager.getActiveTask());
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
        renderTodayFocusSessions();
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
    const addPomoBtn = document.getElementById('btn-add-pomo-to-task');
    const activeTask = taskManager.getActiveTask();

    if (!counterEl) return;

    if (activeTask && !activeTask.completed) {
      counterEl.style.display = 'block';
      const act = activeTask.completed_pomodoros || 0;
      const est = activeTask.estimated_pomodoros || 1;
      const current = act + 1;
      if (current > est) {
        counterEl.textContent = `Pomodoro ${current} of ${est} (Extended)`;
      } else {
        counterEl.textContent = `Pomodoro ${current} of ${est}`;
      }
      if (addPomoBtn) addPomoBtn.style.display = 'inline-block';
    } else {
      counterEl.style.display = 'none';
      counterEl.textContent = '';
      if (addPomoBtn) addPomoBtn.style.display = 'none';
    }
  }

  // Add Pomodoro button event
  const addPomoBtn = document.getElementById('btn-add-pomo-to-task');
  if (addPomoBtn) {
    addPomoBtn.addEventListener('click', async () => {
      const activeTask = taskManager.getActiveTask();
      if (activeTask && !activeTask.completed) {
        await taskManager.addPomodoroToTask(activeTask.id);
        updateSessionCounterUI();
        showToast('🍅 Added +1 Pomodoro to target');
      }
    });
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
      taskManager.renderFocusQueueList(document.getElementById('task-list-container'));
      updateSessionCounterUI();
      updateActiveTaskBadge(taskManager.getActiveTask());
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
    const focusDuration = store.state.settings?.focus_duration || settings.focusDuration || 25;
    const shortBreakDuration = store.state.settings?.short_break || settings.shortBreakDuration || 5;
    const longBreakDuration = store.state.settings?.long_break || settings.longBreakDuration || 15;

    modeBtns.forEach(btn => {
      const mode = btn.dataset.mode;
      if (mode === 'focus') btn.textContent = `Focus ${focusDuration}m`;
      else if (mode === 'shortBreak') btn.textContent = `Short ${shortBreakDuration}m`;
      else if (mode === 'longBreak') btn.textContent = `Long ${longBreakDuration}m`;

      if (mode === activeMode) btn.classList.add('active');
      else btn.classList.remove('active');
    });
  }

  function renderTodayFocusSessions() {
    const listEl = document.getElementById('focus-sessions-list');
    const subtitleEl = document.getElementById('focus-sessions-subtitle');
    if (!listEl) return;

    const todayStr = getLocalDateString();
    const sessions = (store.state.sessions || []).filter(s => 
      s.mode === 'focus' && (s.completed_at || '').startsWith(todayStr)
    );
    const totalMinutes = sessions.reduce((sum, s) => sum + (Number(s.duration_minutes) || 25), 0);

    if (subtitleEl) {
      subtitleEl.textContent = `${sessions.length} session${sessions.length !== 1 ? 's' : ''} • ${totalMinutes} mins focused`;
    }

    if (sessions.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state-sm" style="padding: 16px 0; text-align: center;">
          <span style="font-size: 1.4rem;">⏱️</span>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin: 6px 0 0 0;">No sessions completed yet today. Hit Start to log your first focus block!</p>
        </div>
      `;
      return;
    }

    const tasksMap = new Map();
    (store.state.tasks || []).forEach(t => tasksMap.set(t.id, t.title));

    listEl.innerHTML = sessions.slice(0, 8).map(s => {
      const taskTitle = s.task_id ? (tasksMap.get(s.task_id) || 'Task Focus') : 'Deep Focus Block';
      const timeStr = s.completed_at ? new Date(s.completed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      return `
        <div class="glass-pill" style="display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; margin-bottom: 6px; font-size: 0.82rem;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="color: var(--accent-primary);">✓</span>
            <span style="font-weight: 600; color: var(--text-main);">${escapeHtml(taskTitle)}</span>
          </div>
          <div style="display: flex; align-items: center; gap: 8px; color: var(--text-muted);">
            <span class="badge badge-subtle">${s.duration_minutes || 25}m</span>
            ${timeStr ? `<span>${timeStr}</span>` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  function updateActiveTaskBadge(task) {
    const badge = document.getElementById('active-task-badge');
    const addPomoBtn = document.getElementById('btn-add-pomo-to-task');
    if (!badge) return;
    if (task && !task.completed) {
      badge.style.display = 'inline-flex';
      badge.setAttribute('data-full-title', task.title);
      badge.removeAttribute('title');
      badge.innerHTML = `<span>🎯</span> <span class="badge-task-text">${escapeHtml(task.title)}</span>`;
      if (addPomoBtn) addPomoBtn.style.display = 'inline-block';
    } else {
      badge.style.display = 'none';
      badge.removeAttribute('data-full-title');
      badge.removeAttribute('title');
      badge.innerHTML = '';
      if (addPomoBtn) addPomoBtn.style.display = 'none';
    }
    updateSessionCounterUI();
  }

  // Click active task badge to unassign / clear focus target
  const activeTaskBadgeEl = document.getElementById('active-task-badge');
  if (activeTaskBadgeEl) {
    activeTaskBadgeEl.addEventListener('click', () => {
      taskManager.setActiveTask(null);
      showToast('Unassigned focus task target');
    });
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
        await taskManager.addTask(title, estPomo, 'work', 'medium', null, true);
        if (taskTitleInput) taskTitleInput.value = '';
        if (taskPomoInput) taskPomoInput.value = '1';
        showToast('Task added to focus queue');
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
        await taskManager.addTask(title, estPomo, category, priority, dueDate || null, true);
        plannerTaskForm.reset();
        showToast('Task created in Planner');
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

  // Habit Form is managed by habitManager.bindComposerEvents() in js/habits.js

  // Ambient Sound Synthesis & Master Volume / Mute
  const globalSoundBtn = document.getElementById('global-sound-stop-btn');
  const masterSlider = document.getElementById('ambient-master-slider') || document.getElementById('sound-master-volume');
  const soundMuteBtn = document.getElementById('sound-master-mute-btn') || document.getElementById('ambient-master-mute-btn');
  const muteIcon = document.getElementById('sound-mute-icon');
  const muteText = document.getElementById('sound-mute-text');

  if (masterSlider) {
    masterSlider.addEventListener('input', (e) => {
      const val = parseFloat(e.target.value);
      audioSynth.setMasterVolume(val);
    });
  }

  if (soundMuteBtn) {
    soundMuteBtn.addEventListener('click', () => {
      const isMuted = audioSynth.toggleMute();
      if (muteIcon) muteIcon.textContent = isMuted ? '🔇' : '🔊';
      if (muteText) muteText.textContent = isMuted ? 'Unmute' : 'Mute';
      soundMuteBtn.classList.toggle('active', isMuted);
      showToast(isMuted ? '🔇 Ambient sounds muted' : '🔊 Ambient sounds unmuted');
    });
  }

  if (globalSoundBtn) {
    globalSoundBtn.addEventListener('click', () => {
      audioSynth.stopAllAmbientSounds();
      document.querySelectorAll('.sound-card').forEach(c => {
        c.classList.remove('active');
        const toggleBtn = c.querySelector('.btn-sound-toggle');
        if (toggleBtn) toggleBtn.textContent = 'Play';
      });
      globalSoundBtn.style.display = 'none';
      showToast('🔇 Ambient sounds stopped');
    });
  }

  document.querySelectorAll('.sound-card').forEach(card => {
    const type = card.dataset.sound;
    const slider = card.querySelector('.sound-slider');
    const toggleBtn = card.querySelector('.btn-sound-toggle');

    const toggleSound = () => {
      const volume = slider ? parseFloat(slider.value) : 0.5;
      const isPlaying = audioSynth.toggleAmbientSound(type, volume);
      card.classList.toggle('active', isPlaying);
      if (toggleBtn) toggleBtn.textContent = isPlaying ? 'Stop' : 'Play';

      const anyPlaying = Object.keys(audioSynth.activeNodes).length > 0;
      if (globalSoundBtn) {
        globalSoundBtn.style.display = anyPlaying ? 'inline-flex' : 'none';
      }
    };

    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSound();
      });
    }

    card.addEventListener('click', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.classList.contains('btn-sound-toggle')) return;
      toggleSound();
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

      const backupDateEl = document.getElementById('pref-last-backup-date');
      if (backupDateEl) {
        const lastBackup = localStorage.getItem('lifebuddy_last_backup_date');
        backupDateEl.textContent = lastBackup ? new Date(lastBackup).toLocaleString() : 'Never';
      }

      settingsModal.classList.add('active');
    });
  }

  if (closeSettingsBtn && settingsModal) {
    closeSettingsBtn.addEventListener('click', () => {
      settingsModal.classList.remove('active');
    });
  }

  // Reliably closes modal upon saving preferences
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

      try {
        await store.setMonthlyBudget(monthlyBudget);
        store.state.settings.daily_focus_goal = dailyFocusGoal;
        store.persist();
      } catch (err) {
        console.warn('Failed saving settings to store:', err);
      } finally {
        settingsModal.classList.remove('active');
        showToast('Preferences saved');
      }
    });
  }

  // Account Modal & Profile Details
  const authModalBtn = document.getElementById('auth-modal-btn');
  const authModal = document.getElementById('auth-modal');
  const closeAuthBtn = document.getElementById('close-auth-btn');
  const btnEditProfileTrigger = document.getElementById('btn-edit-profile-trigger');
  const profileViewSection = document.getElementById('profile-view-section');
  const profileEditSection = document.getElementById('profile-edit-section');
  const btnCancelEditProfile = document.getElementById('btn-cancel-edit-profile');

  const populateAccountModal = () => {
    const user = API.getUser() || store.state.user || {};
    const settings = store.state.settings || {};
    const loggedInView = document.getElementById('auth-logged-in-view');
    const loggedOutView = document.getElementById('auth-logged-out-view');

    if (API.isLoggedIn()) {
      if (loggedInView) loggedInView.style.display = 'block';
      if (loggedOutView) loggedOutView.style.display = 'none';

      // Always show view section initially
      if (profileViewSection) profileViewSection.style.display = 'block';
      if (profileEditSection) profileEditSection.style.display = 'none';

      const fullNameEl = document.getElementById('profile-fullname');
      const usernameEl = document.getElementById('profile-username');
      const emailEl = document.getElementById('profile-email');
      const profValEl = document.getElementById('profile-profession-val');
      const ageValEl = document.getElementById('profile-age-group-val');
      const goalValEl = document.getElementById('profile-focus-goal-val');

      // Display name shown once, not duplicated
      const rawFullName = (settings.full_name || user.full_name || '').trim();
      const rawUsername = (user.username || '').trim();
      const displayName = rawFullName ? rawFullName : (rawUsername || 'Friend');

      if (fullNameEl) fullNameEl.textContent = displayName;

      // Don't repeat display name twice. If separate handle exists, show @handle in muted text.
      if (usernameEl) {
        if (rawUsername && rawFullName && rawUsername.toLowerCase() !== rawFullName.toLowerCase()) {
          usernameEl.textContent = `@${rawUsername}`;
          usernameEl.style.display = 'block';
        } else {
          usernameEl.style.display = 'none';
        }
      }

      if (emailEl) {
        emailEl.textContent = user.email || 'local@workspace';
      }

      // Show Profession, Age Group and Primary Focus only if user actually set them
      const isCustomValue = (val) => {
        if (!val || typeof val !== 'string') return false;
        const trimmed = val.trim();
        if (!trimmed || trimmed === '-' || trimmed === 'Not set' || trimmed === 'Professional' || trimmed === 'General') {
          return false;
        }
        return true;
      };

      const userProf = settings.profession || user.profession;
      const userAge = settings.age_group || user.age_group;
      const userGoal = settings.focus_goal || user.focus_goal;

      if (profValEl) {
        if (isCustomValue(userProf)) {
          profValEl.innerHTML = `<span>${userProf}</span>`;
        } else {
          profValEl.innerHTML = `<span style="color: var(--text-muted); font-style: italic; font-weight: normal;">Not set</span> <button type="button" class="btn-link btn-inline-edit" style="font-size: 0.74rem; margin-left: 6px; text-decoration: underline; cursor: pointer;">Set</button>`;
        }
      }

      if (ageValEl) {
        if (isCustomValue(userAge)) {
          ageValEl.innerHTML = `<span>${userAge}</span>`;
        } else {
          ageValEl.innerHTML = `<span style="color: var(--text-muted); font-style: italic; font-weight: normal;">Not set</span> <button type="button" class="btn-link btn-inline-edit" style="font-size: 0.74rem; margin-left: 6px; text-decoration: underline; cursor: pointer;">Set</button>`;
        }
      }

      if (goalValEl) {
        if (isCustomValue(userGoal)) {
          goalValEl.innerHTML = `<span>${userGoal}</span>`;
        } else {
          goalValEl.innerHTML = `<span style="color: var(--text-muted); font-style: italic; font-weight: normal;">Not set</span> <button type="button" class="btn-link btn-inline-edit" style="font-size: 0.74rem; margin-left: 6px; text-decoration: underline; cursor: pointer;">Set</button>`;
        }
      }

      // Inline edit triggers
      document.querySelectorAll('.btn-inline-edit').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          switchToEditMode();
        });
      });
    } else {
      if (loggedInView) loggedInView.style.display = 'none';
      if (loggedOutView) loggedOutView.style.display = 'block';
    }
  };

  const switchToEditMode = () => {
    const user = API.getUser() || store.state.user || {};
    const settings = store.state.settings || {};
    if (profileViewSection) profileViewSection.style.display = 'none';
    if (profileEditSection) profileEditSection.style.display = 'block';

    const editName = document.getElementById('edit-fullname-input');
    const editProf = document.getElementById('edit-profession-select');
    const editAge = document.getElementById('edit-age-select');
    const editFocus = document.getElementById('edit-focus-select');

    if (editName) editName.value = settings.full_name || user.full_name || user.username || '';
    if (editProf) editProf.value = settings.profession || user.profession || '';
    if (editAge) editAge.value = settings.age_group || user.age_group || '';
    if (editFocus) editFocus.value = settings.focus_goal || user.focus_goal || '';
  };

  if (btnEditProfileTrigger) {
    btnEditProfileTrigger.addEventListener('click', () => {
      switchToEditMode();
    });
  }

  if (btnCancelEditProfile) {
    btnCancelEditProfile.addEventListener('click', () => {
      if (profileViewSection) profileViewSection.style.display = 'block';
      if (profileEditSection) profileEditSection.style.display = 'none';
    });
  }

  if (profileEditSection) {
    profileEditSection.addEventListener('submit', async (e) => {
      e.preventDefault();
      const newFullName = document.getElementById('edit-fullname-input')?.value.trim() || '';
      const newProf = document.getElementById('edit-profession-select')?.value || '';
      const newAge = document.getElementById('edit-age-select')?.value || '';
      const newFocus = document.getElementById('edit-focus-select')?.value || '';

      const updatedSettings = {
        ...(store.state.settings || {}),
        full_name: newFullName,
        profession: newProf,
        age_group: newAge,
        focus_goal: newFocus
      };

      try {
        await API.auth.updateSettings(updatedSettings);
      } catch (err) {
        console.warn('Backend updateSettings warning:', err);
      }

      store.state.settings = updatedSettings;
      if (store.state.user) {
        store.state.user.full_name = newFullName;
        store.state.user.profession = newProf;
        store.state.user.age_group = newAge;
        store.state.user.focus_goal = newFocus;
      }
      store.saveToStorage();
      store.notify('user', store.state.user);
      store.notify('settings', store.state.settings);

      populateAccountModal();
      showToast('✨ Profile updated successfully');
    });
  }

  if (authModalBtn && authModal) {
    authModalBtn.addEventListener('click', () => {
      populateAccountModal();
      authModal.classList.add('active');
    });
  }

  if (closeAuthBtn && authModal) {
    closeAuthBtn.addEventListener('click', () => {
      authModal.classList.remove('active');
    });
  }

  // ==========================================
  // Data & Privacy Controls in Preferences
  // ==========================================
  // 1. Export My Data
  const btnPrefExport = document.getElementById('pref-btn-export');
  if (btnPrefExport) {
    btnPrefExport.addEventListener('click', async () => {
      try {
        let exportData = null;
        if (API.isLoggedIn()) {
          try {
            exportData = await API.request('/api/user/export-my-data');
          } catch (e) {
            console.warn('Backend export failed, falling back to local state', e);
          }
        }
        if (!exportData) {
          exportData = {
            export_timestamp: new Date().toISOString(),
            ...store.state
          };
        }
        const jsonStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lifebuddy_data_export_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
        localStorage.setItem('lifebuddy_last_backup_date', new Date().toISOString());
        const backupDateEl = document.getElementById('pref-last-backup-date');
        if (backupDateEl) backupDateEl.textContent = new Date().toLocaleString();
        showToast('📦 Data export downloaded & backup timestamp recorded');
      } catch (err) {
        alert('Could not export data: ' + err.message);
      }
    });
  }

  // 2. Import Data
  const btnPrefImport = document.getElementById('pref-btn-import');
  const importFileInput = document.getElementById('pref-import-file-input');
  if (btnPrefImport && importFileInput) {
    btnPrefImport.addEventListener('click', () => {
      importFileInput.click();
    });

    importFileInput.addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = async (evt) => {
        try {
          const parsed = JSON.parse(evt.target.result);
          if (!parsed || typeof parsed !== 'object') {
            throw new Error('Invalid JSON structure');
          }

          if (parsed.tasks && Array.isArray(parsed.tasks)) store.state.tasks = parsed.tasks;
          if (parsed.habits && Array.isArray(parsed.habits)) store.state.habits = parsed.habits;
          if (parsed.expenses && Array.isArray(parsed.expenses)) store.state.expenses = parsed.expenses;
          if (parsed.sessions && Array.isArray(parsed.sessions)) store.state.sessions = parsed.sessions;
          if (parsed.focus_sessions && Array.isArray(parsed.focus_sessions)) store.state.sessions = parsed.focus_sessions;
          if (parsed.dailyLogs && Array.isArray(parsed.dailyLogs)) store.state.dailyLogs = parsed.dailyLogs;
          if (parsed.daily_logs && Array.isArray(parsed.daily_logs)) store.state.dailyLogs = parsed.daily_logs;
          if (parsed.settings && typeof parsed.settings === 'object') store.state.settings = { ...store.state.settings, ...parsed.settings };
          if (parsed.user_settings && typeof parsed.user_settings === 'object') store.state.settings = { ...store.state.settings, ...parsed.user_settings };

          store.saveToStorage();

          if (API.isLoggedIn()) {
            try {
              await API.sync.batch({
                tasks: store.state.tasks,
                habits: store.state.habits,
                expenses: store.state.expenses,
                sessions: store.state.sessions,
                wellness_logs: store.state.dailyLogs,
                settings: store.state.settings
              });
            } catch (syncErr) {
              console.warn('Server batch sync warning during import:', syncErr);
            }
          }

          store.notify('*', 'import-completed');
          showToast('📥 Workspace data successfully imported');
          setTimeout(() => window.location.reload(), 1200);
        } catch (err) {
          alert('Failed to import data: ' + err.message);
        } finally {
          importFileInput.value = '';
        }
      };
      reader.readAsText(file);
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
      await store.syncAll();
      await taskManager.init();
      await habitManager.init();
      await expenseManager.init();
      taskManager.renderFocusQueueList(document.getElementById('task-list-container'));
      taskManager.renderTaskList(document.getElementById('planner-task-list'));
      habitManager.renderHabitsList(document.getElementById('habits-list-container'));
      expenseManager.render();
      updateSessionCounterUI();
      updateActiveTaskBadge(taskManager.getActiveTask());
      updateModeTabs(timerEngine.currentMode);
      renderTodayFocusSessions();
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
  window.showToast = showToast;

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
