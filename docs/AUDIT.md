# LifeBuddy System Audit (Phase 0)

## 1. Executive Summary & Thesis Alignment
**Thesis Statement:**
> *"A self-learning, privacy-first productivity system that connects focus, tasks, habits and spending data to give personalised, explainable insights and predictions, and keeps working offline."*

This audit reviews the baseline implementation of LifeBuddy, identifies current strengths and architectural gaps, and charts the execution plan for all subsequent phases to satisfy the final-year engineering degree requirements.

---

## 2. Current Architecture
- **Backend:** FastAPI (Python 3.14) serving REST endpoints and static files.
- **Database:** SQLite (`lifebuddy.db`) initialized via raw SQL (`CREATE TABLE IF NOT EXISTS`) in `backend/database.py`.
- **Authentication:** Custom PBKDF2-HMAC-SHA256 password hashing + HS256 JWT-like access tokens.
- **Frontend:** Zero-build vanilla HTML5, CSS3 (glassmorphic aesthetic with 5 custom themes), and modern ES6 modules.
- **Audio Synthesizer:** Real-time Web Audio API signal generation (sine waves, white noise filters, exponential gain decays) for ambient soundscapes and Tibetan singing bowl chimes.
- **Client-Side Storage:** Browser `LocalStorage` used as an offline-first fallback.

---

## 3. Data Models Assessment
Current entities stored in SQLite:
1. `users` (id, username, email, password_hash, created_at)
2. `user_settings` (user_id, monthly_budget, currency_symbol, focus_duration, short_break, long_break, theme)
3. `tasks` (id, user_id, title, category, priority, estimated_pomodoros, completed_pomodoros, completed, due_date, created_at, updated_at)
4. `habits` (id, user_id, title, icon, frequency, streak, last_completed, history, created_at)
5. `expenses` (id, user_id, type, amount, category, note, date, created_at)
6. `focus_sessions` (id, user_id, task_id, mode, duration_minutes, completed_at)

---

## 4. Current API Surface
- **Auth:**
  - `POST /api/auth/register`
  - `POST /api/auth/login`
  - `GET /api/auth/me`
  - `PUT /api/auth/settings`
- **Tasks:**
  - `GET /api/tasks`
  - `POST /api/tasks`
  - `PUT /api/tasks/{task_id}`
  - `DELETE /api/tasks/{task_id}`
- **Habits:**
  - `GET /api/habits`
  - `POST /api/habits`
  - `POST /api/habits/{habit_id}/check`
  - `DELETE /api/habits/{habit_id}`
- **Expenses:**
  - `GET /api/expenses`
  - `POST /api/expenses`
  - `DELETE /api/expenses/{expense_id}`
- **Focus Sessions:**
  - `GET /api/focus-sessions`
  - `POST /api/focus-sessions`
- **Dashboard & Sync:**
  - `GET /api/dashboard`
  - `GET /api/sync/export`

---

## 5. Weak Points & Critical Gaps
1. **Data Model Granularity (Phase 1):**
   - Focus sessions lack explicit `start_time`, `end_time`, and `interruption_count`.
   - Tasks lack explicit completion timestamps (`completed_at`).
   - Habit check-ins lack granular timestamps (currently stores day strings).
   - Expenses lack exact transaction times.
   - Missing holistic daily wellness variables: `daily_mood` (1–5 scale) and `sleep_hours`, preventing cross-module causal inference.
2. **Database Migrations & Portability:**
   - Database lacks Alembic migration version control.
   - Hardcoded SQLite; does not support enterprise PostgreSQL via `DATABASE_URL`.
3. **Absence of Machine Learning / Statistical Intelligence (Phase 2):**
   - Zero predictive or personalized recommendations.
   - No cold-start heuristics or transparent explanations.
   - No correlation or lag effect modeling (e.g., poor sleep impacting next-day focus or impulse spending).
4. **Offline Sync Robustness (Phase 4):**
   - Simple `localStorage` lacks a transactional outbox queue with conflict resolution (LWW) and client timestamps.
5. **Security Hardening (Phase 4):**
   - Tokens lack refresh cycle; endpoints lack rate limiting and strict CORS origin validation.
6. **Evaluation & Empirical Validation (Phase 5):**
   - Missing baseline benchmarks, comparative accuracy/F1/MAE metrics, and reproducible Jupyter evaluation artifacts.

---

## 6. Execution Roadmap

| Phase | Core Deliverables | Target Artifacts |
|---|---|---|
| **Phase 1: Data Foundation** | Granular schema (interruptions, sleep, mood, exact timestamps), PostgreSQL/SQLite switch, Alembic migrations, 90-day x 5-persona realistic generator with fixed seed. | `alembic/`, `scripts/generate_demo_data.py`, `scripts/seed_demo.py` |
| **Phase 2: Analytics & ML Engine** | Per-user ML models (`app/ml/`): Focus window recommender, task duration regressor, expense categorizer, anomaly detector + forecast, habit risk classifier, cross-module insight engine, weekly reflection generator, NL task parser. | `app/ml/`, `/api/ml/...`, `evaluation_report.md` |
| **Phase 3: Frontend Modernization** | Explainability drawer ("Why am I seeing this?"), NL quick-add bar, Model Transparency dashboard, forecast charts in pure SVG/Canvas. | `index.html`, `js/insights.js`, `js/transparency.js` |
| **Phase 4: Engineering Depth** | IndexedDB outbox queue, client-timestamped idempotent sync, Argon2/short-lived JWT + refresh, rate limiting, pytest test suite (>=80% coverage on ML), Docker & docker-compose. | `js/sync.js`, `backend/security.py`, `tests/`, `Dockerfile` |
| **Phase 5: Evaluation & Thesis Docs** | Jupyter notebooks with EDA, ROC curves, confusion matrices, ablation tests, SUS questionnaire, `DEMO_SCRIPT.md`, and complete `VIVA_NOTES.md`. | `notebooks/`, `docs/DEMO_SCRIPT.md`, `docs/VIVA_NOTES.md` |
