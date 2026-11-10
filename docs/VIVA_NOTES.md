# LifeBuddy — Engineering Viva & Oral Defense Notes

This guide provides technical justifications, architectural trade-offs, and candidate examiner questions with concise, confident answers for the final-year engineering defense.

---

## Phase 0: System Architecture & Design Philosophy

### What Was Built
Comprehensive system audit and engineering roadmap establishing a privacy-first, per-user intelligent life management OS.

### Why This Approach Over Alternatives
1. **Per-User Models vs Centralized Shared Model:**
   - *Alternative:* Multi-tenant model trained across all users in the cloud.
   - *Why Per-User:* Preserves user data privacy (data does not leave the user's boundary), eliminates cold-start cross-user bias, enables completely offline computation, and avoids GDPR/HIPAA compliance complexities.
2. **FastAPI + SQLite/PostgreSQL vs Django/Node:**
   - *Alternative:* Heavy Django monolith or Node.js/Express.
   - *Why FastAPI:* Built-in async capability, native OpenAPI/Swagger documentation, strict Pydantic type safety, and seamless support for Python's scientific ecosystem (scikit-learn, numpy, pandas).
3. **Zero-Build Vanilla JS Frontend vs Heavy SPA Frameworks (React/Vue/Angular):**
   - *Alternative:* Complex Webpack/Vite + React bundle.
   - *Why Vanilla ES Modules:* Eliminates fragile `node_modules` dependency trees, loads instantly in any modern browser, and makes the application easily portable across local and edge environments.

### 3 Likely Examiner Questions & Answers
**Q1: Why choose a privacy-first, on-device/per-user architecture instead of sending user activity to an LLM or centralized cloud API?**
> *Answer:* Personal productivity, sleep, daily mood, and financial transactions are highly sensitive personal data. Sending this data to third-party cloud APIs poses significant privacy risks and requires constant internet connectivity. LifeBuddy's per-user approach guarantees that user models are lightweight, transparent, run locally, and remain fully operational even when offline.

**Q2: What is the benefit of integrating focus, tasks, habits, and expenses into a single system rather than using specialized standalone tools?**
> *Answer:* Standalone applications create data silos. A productivity timer knows nothing about financial impulse spending; an expense tracker knows nothing about sleep or focus fatigue. By unifying these streams, LifeBuddy can perform cross-module causal modeling (e.g., detecting that sleep deprivation leads to reduced focus and increased late-night impulse purchases), producing actionable, holistic lifestyle insights.

**Q3: How does the system handle the "Cold Start" problem when a new user registers with zero history?**
> *Answer:* Every intelligent component implements a two-tier strategy: a rule-based statistical heuristic (e.g., population averages or time-of-day defaults) for the initial cold-start phase, followed by an automatic transition to personalized machine learning models once the minimum observation threshold is reached.
