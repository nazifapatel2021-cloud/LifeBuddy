/* LifeBuddy In-App Usability Study, SUS Questionnaire & Anonymous Telemetry */

const STUDY_STORAGE_KEY = 'lifebuddy_study_data';
const EVENTS_STORAGE_KEY = 'lifebuddy_study_events';

export class UsabilityStudyController {
  constructor() {
    this.modal = document.getElementById('study-modal');
    this.initAnonymousId();
  }

  initAnonymousId() {
    let studyId = localStorage.getItem('lifebuddy_anon_study_id');
    if (!studyId) {
      studyId = 'STUDY_' + Math.random().toString(36).substring(2, 8).toUpperCase();
      localStorage.setItem('lifebuddy_anon_study_id', studyId);
    }
    this.studyId = studyId;
  }

  init() {
    const triggerBtn = document.getElementById('study-modal-btn');
    const closeBtn = document.getElementById('close-study-modal');

    if (triggerBtn) {
      triggerBtn.addEventListener('click', () => {
        this.open();
      });
    }

    if (closeBtn && this.modal) {
      closeBtn.addEventListener('click', () => {
        this.modal.classList.remove('active');
      });
    }

    this.bindForm();
  }

  logEvent(eventName) {
    try {
      const raw = localStorage.getItem(EVENTS_STORAGE_KEY) || '{}';
      const events = JSON.parse(raw);
      events[eventName] = (events[eventName] || 0) + 1;
      events._last_active = new Date().toISOString();
      localStorage.setItem(EVENTS_STORAGE_KEY, JSON.stringify(events));
    } catch {}
  }

  open() {
    if (!this.modal) return;
    this.modal.classList.add('active');
    this.renderQuestionnaire();
  }

  renderQuestionnaire() {
    const body = document.getElementById('study-modal-body');
    if (!body) return;

    const susQuestions = [
      "1. I think that I would like to use LifeBuddy frequently.",
      "2. I found the system unnecessarily complex.",
      "3. I thought the system was easy to use.",
      "4. I think that I would need the support of a technical person to be able to use this system.",
      "5. I found the various functions in this system were well integrated.",
      "6. I thought there was too much inconsistency in this system.",
      "7. I would imagine that most people would learn to use this system very quickly.",
      "8. I found the system very cumbersome to use.",
      "9. I felt very confident using the system.",
      "10. I needed to learn a lot of things before I could get going with this system."
    ];

    const rawData = localStorage.getItem(STUDY_STORAGE_KEY);
    const existing = rawData ? JSON.parse(rawData) : null;
    const existingScores = existing ? existing.answers : {};
    const existingFeedback = existing ? existing.qualitative_feedback : '';

    body.innerHTML = `
      <div class="glass-pill" style="margin-bottom: 20px; padding: 14px 18px; font-size: 0.88rem; line-height: 1.5;">
        <strong>Participant ID:</strong> <code style="background: rgba(0,0,0,0.06); padding: 2px 6px; border-radius: 4px;">${this.studyId}</code><br>
        <span style="color: var(--text-muted); font-size: 0.82rem;">
          This 10-item System Usability Scale (SUS) questionnaire evaluates the usability of LifeBuddy. All answers and telemetry are strictly anonymized.
        </span>
      </div>

      <form id="sus-form" style="display: flex; flex-direction: column; gap: 18px;">
        ${susQuestions.map((q, idx) => {
          const qNum = idx + 1;
          const currentVal = existingScores[qNum] || 3;
          return `
            <div class="sus-item glass-card" style="padding: 14px 18px;">
              <div style="font-weight: 600; font-size: 0.9rem; margin-bottom: 10px;">${q}</div>
              <div class="sus-scale-row" style="display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem;">
                <span style="color: var(--text-muted);">Strongly Disagree</span>
                <div style="display: flex; gap: 14px;">
                  ${[1, 2, 3, 4, 5].map(val => `
                    <label style="display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer;">
                      <input type="radio" name="sus_q_${qNum}" value="${val}" ${currentVal == val ? 'checked' : ''} style="accent-color: var(--accent-primary);">
                      <span style="font-size: 0.75rem;">${val}</span>
                    </label>
                  `).join('')}
                </div>
                <span style="color: var(--text-muted);">Strongly Agree</span>
              </div>
            </div>
          `;
        }).join('')}

        <div class="glass-card" style="padding: 16px;">
          <label class="form-label" for="sus-feedback-text">Qualitative Feedback & Viva Notes (Optional):</label>
          <textarea id="sus-feedback-text" class="input-field" rows="3" style="width: 100%; resize: vertical;" placeholder="What feature was most useful? Any bugs or friction encountered?">${existingFeedback}</textarea>
        </div>

        <div style="display: flex; gap: 12px; justify-content: flex-end; margin-top: 10px;">
          <button type="button" id="btn-export-study-json" class="btn-secondary">
            📥 Download Study Report (JSON)
          </button>
          <button type="submit" class="btn-primary">
            ✓ Submit Evaluation
          </button>
        </div>
      </form>
    `;

    const exportBtn = body.querySelector('#btn-export-study-json');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportStudyData());
    }
  }

  bindForm() {
    document.addEventListener('submit', (e) => {
      if (e.target && e.target.id === 'sus-form') {
        e.preventDefault();
        const formData = new FormData(e.target);
        const answers = {};
        for (let i = 1; i <= 10; i++) {
          answers[i] = parseInt(formData.get(`sus_q_${i}`)) || 3;
        }

        // Calculate standard SUS score (0 to 100)
        let total = 0;
        for (let i = 1; i <= 10; i++) {
          if (i % 2 === 1) total += (answers[i] - 1);
          else total += (5 - answers[i]);
        }
        const susScore = total * 2.5;

        const feedback = document.getElementById('sus-feedback-text')?.value || '';
        const eventsRaw = localStorage.getItem(EVENTS_STORAGE_KEY) || '{}';
        const events = JSON.parse(eventsRaw);

        const studyReport = {
          study_id: this.studyId,
          submission_time: new Date().toISOString(),
          sus_score: susScore,
          answers,
          qualitative_feedback: feedback,
          usage_telemetry: events
        };

        localStorage.setItem(STUDY_STORAGE_KEY, JSON.stringify(studyReport));
        alert(`Evaluation Submitted! Your computed SUS Score: ${susScore.toFixed(1)} / 100 (Industry Benchmark: 68.0 = Above Average). Thank you for participating in the LifeBuddy research study!`);
        if (this.modal) this.modal.classList.remove('active');
      }
    });
  }

  exportStudyData() {
    const rawData = localStorage.getItem(STUDY_STORAGE_KEY);
    const eventsRaw = localStorage.getItem(EVENTS_STORAGE_KEY) || '{}';
    const report = rawData ? JSON.parse(rawData) : {
      study_id: this.studyId,
      status: "In-Progress (Unsubmitted)",
      usage_telemetry: JSON.parse(eventsRaw)
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lifebuddy_study_${this.studyId}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const studyController = new UsabilityStudyController();
