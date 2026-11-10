/* Pomodoro Timer Engine & SVG Progress Renderer */
export class TimerEngine {
  constructor(options = {}) {
    this.focusDuration = (options.focusDuration || 25) * 60;
    this.shortBreakDuration = (options.shortBreakDuration || 5) * 60;
    this.longBreakDuration = (options.longBreakDuration || 15) * 60;
    this.longBreakInterval = options.longBreakInterval || 4;

    this.currentMode = 'focus'; // 'focus', 'shortBreak', 'longBreak'
    this.timeRemaining = this.focusDuration;
    this.totalDuration = this.focusDuration;
    this.isRunning = false;
    this.timerInterval = null;
    this.completedFocusSessions = 0;

    // Callbacks
    this.onTick = options.onTick || (() => {});
    this.onComplete = options.onComplete || (() => {});
    this.onModeChange = options.onModeChange || (() => {});
  }

  setDurations(focusMin, shortMin, longMin) {
    this.focusDuration = focusMin * 60;
    this.shortBreakDuration = shortMin * 60;
    this.longBreakDuration = longMin * 60;

    if (!this.isRunning) {
      this.reset();
    }
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.timerInterval = setInterval(() => {
      if (this.timeRemaining > 0) {
        this.timeRemaining--;
        this.onTick(this.getFormattedTime(), this.getProgressPercentage());
        this.updateDocumentTitle();
      } else {
        this.completeSession();
      }
    }, 1000);
  }

  pause() {
    if (!this.isRunning) return;
    this.isRunning = false;
    clearInterval(this.timerInterval);
    this.timerInterval = null;
    this.updateDocumentTitle();
  }

  reset() {
    this.pause();
    if (this.currentMode === 'focus') {
      this.totalDuration = this.focusDuration;
    } else if (this.currentMode === 'shortBreak') {
      this.totalDuration = this.shortBreakDuration;
    } else if (this.currentMode === 'longBreak') {
      this.totalDuration = this.longBreakDuration;
    }
    this.timeRemaining = this.totalDuration;
    this.onTick(this.getFormattedTime(), 0);
    this.updateDocumentTitle();
  }

  switchMode(mode) {
    if (this.currentMode === mode && !this.isRunning) return;
    this.pause();
    this.currentMode = mode;
    if (mode === 'focus') {
      this.totalDuration = this.focusDuration;
    } else if (mode === 'shortBreak') {
      this.totalDuration = this.shortBreakDuration;
    } else if (mode === 'longBreak') {
      this.totalDuration = this.longBreakDuration;
    }
    this.timeRemaining = this.totalDuration;
    this.onModeChange(this.currentMode);
    this.onTick(this.getFormattedTime(), 0);
    this.updateDocumentTitle();
  }

  completeSession() {
    this.pause();

    const completedMode = this.currentMode;
    const durationMinutes = Math.round(this.totalDuration / 60);

    if (completedMode === 'focus') {
      this.completedFocusSessions++;
      let nextMode = 'shortBreak';
      if (this.completedFocusSessions % this.longBreakInterval === 0) {
        nextMode = 'longBreak';
      }
      this.onComplete({ mode: completedMode, durationMinutes, nextMode });
      this.switchMode(nextMode);
    } else {
      this.onComplete({ mode: completedMode, durationMinutes, nextMode: 'focus' });
      this.switchMode('focus');
    }
  }

  getFormattedTime() {
    const mins = Math.floor(this.timeRemaining / 60);
    const secs = this.timeRemaining % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }

  getProgressPercentage() {
    if (this.totalDuration === 0) return 0;
    return ((this.totalDuration - this.timeRemaining) / this.totalDuration) * 100;
  }

  updateDocumentTitle() {
    const timeStr = this.getFormattedTime();
    const modeLabel = this.currentMode === 'focus' ? 'Focus' : 'Break';
    const statusStr = this.isRunning ? '▶' : '❚❚';
    document.title = `${statusStr} ${timeStr} - ${modeLabel} | Zen Pomodoro`;
  }
}
