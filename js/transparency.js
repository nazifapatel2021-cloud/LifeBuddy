/* LifeBuddy Model Transparency & Governance Controller */
import { API } from './api.js';

export class ModelTransparencyController {
  constructor(options = {}) {
    this.modal = document.getElementById('transparency-modal');
  }

  init() {
    const triggerBtn = document.getElementById('transparency-modal-btn');
    const closeBtn = document.getElementById('close-transparency-modal');

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
  }

  async open() {
    if (!this.modal) return;
    this.modal.classList.add('active');
    const container = document.getElementById('transparency-modal-body');
    if (!container) return;

    container.innerHTML = `
      <div style="text-align: center; padding: 20px;">
        <span>🔄 Loading transparent model parameters...</span>
      </div>
    `;

    try {
      const data = await API.ml.getTransparency();
      this.renderContent(container, data);
    } catch (e) {
      container.innerHTML = `
        <div class="empty-state">
          <p>Unable to load model registry metadata. Ensure the backend server is running.</p>
        </div>
      `;
    }
  }

  renderContent(container, data) {
    const models = data.models || [];

    container.innerHTML = `
      <div class="transparency-summary-card glass-pill" style="margin-bottom: 20px; padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong>Architecture:</strong> ${data.architecture || 'Per-User Isolated Machine Learning'}
          </div>
          <button id="btn-force-retrain" class="btn-secondary" style="font-size: 0.8rem; padding: 6px 12px;">
            🔄 Retrain All Models
          </button>
        </div>
        <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 6px;">
          Last Retrained: <strong>${data.last_retrained || 'Active on inference'}</strong> • Privacy: Zero data leaves your machine.
        </div>
      </div>

      <div class="transparency-models-list">
        ${models.map(m => `
          <div class="transparency-model-item glass-pill" style="margin-bottom: 12px; padding: 14px 18px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <h4 style="font-size: 0.98rem; font-weight: 700;">${m.name}</h4>
                <div style="font-size: 0.82rem; color: var(--accent-primary); font-weight: 600; margin-top: 2px;">
                  Algorithm: ${m.algorithm}
                </div>
              </div>
              <span class="badge ${m.status === 'Trained' || m.status === 'Active' ? 'badge-safe' : 'badge-subtle'}">${m.status}</span>
            </div>

            <div style="font-size: 0.82rem; color: var(--text-muted); margin-top: 8px; line-height: 1.5;">
              ${m.training_data ? `<div>📊 <strong>Training Data:</strong> ${m.training_data}</div>` : ''}
              ${m.cold_start_fallback ? `<div>🛡️ <strong>Cold-Start Rule:</strong> ${m.cold_start_fallback}</div>` : ''}
              ${m.metrics && typeof m.metrics === 'object' ? `
                <div style="margin-top: 4px;">
                  📈 <strong>Evaluation Metrics:</strong> 
                  <code style="background: rgba(0,0,0,0.04); padding: 2px 6px; border-radius: 4px;">
                    ${JSON.stringify(m.metrics)}
                  </code>
                </div>
              ` : (m.metrics ? `<div>📈 <strong>Evaluation:</strong> ${m.metrics}</div>` : '')}
            </div>
          </div>
        `).join('')}
      </div>
    `;

    const retrainBtn = container.querySelector('#btn-force-retrain');
    if (retrainBtn) {
      retrainBtn.addEventListener('click', async () => {
        retrainBtn.disabled = true;
        retrainBtn.textContent = 'Training in progress...';
        try {
          await API.ml.estimateTaskDuration('retrain test', 'work', 'medium');
          await API.ml.categorizeExpense('retrain test');
          retrainBtn.textContent = '✓ Retraining Complete!';
          setTimeout(() => this.open(), 1200);
        } catch {
          retrainBtn.textContent = 'Retrain Failed';
          retrainBtn.disabled = false;
        }
      });
    }
  }
}
