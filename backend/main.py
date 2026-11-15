import os
import json
import uuid
import time
from collections import defaultdict
from datetime import datetime, date
from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

from .database import get_db_connection, init_db
from .auth import (
    hash_password, verify_password, create_access_token, create_refresh_token,
    verify_token, get_current_user
)
from .models import (
    UserRegister, UserLogin, UserSettings,
    TaskCreate, TaskUpdate, HabitCreate, HabitUpdate, HabitCheckIn,
    ExpenseCreate, FocusSessionCreate, DailyLogCreate,
    MLEstimateTaskDurationRequest, MLCategorizeExpenseRequest, MLParseTaskRequest,
    RefreshTokenRequest, SyncBatchRequest
)
from app.ml.pipeline import ml_registry

app = FastAPI(title="LifeBuddy API", description="Mindful productivity, habits, focus and finance companion", version="2.0.0")

# ================= RATE LIMITING MIDDLEWARE =================

class RateLimiterMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self.request_counts = defaultdict(list)
    
    async def dispatch(self, request: Request, call_next):
        client_ip = request.client.host if request.client else "127.0.0.1"
        now = time.time()
        path = request.url.path

        if path.startswith("/api/auth/login") or path.startswith("/api/auth/register"):
            max_requests = 25
            window = 60
            key = f"auth:{client_ip}"
        elif path.startswith("/api/"):
            max_requests = 350
            window = 60
            key = f"api:{client_ip}"
        else:
            return await call_next(request)

        timestamps = [t for t in self.request_counts[key] if now - t < window]
        if len(timestamps) >= max_requests:
            retry_after = int(window - (now - timestamps[0]))
            return JSONResponse(
                status_code=429,
                content={"detail": "Too many requests. Rate limit exceeded."},
                headers={"Retry-After": str(max(1, retry_after))}
            )

        timestamps.append(now)
        self.request_counts[key] = timestamps
        return await call_next(request)

app.add_middleware(RateLimiterMiddleware)

# ================= CORS CONFIGURATION =================

cors_env = os.environ.get("CORS_ORIGINS", "*")
allowed_origins = [o.strip() for o in cors_env.split(",") if o.strip()] if cors_env != "*" else ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health_check():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM users")
        user_count = cursor.fetchone()[0]
        conn.close()
        return {
            "status": "healthy",
            "database": "connected",
            "registered_users": user_count,
            "version": "2.0.0",
            "timestamp": datetime.utcnow().isoformat()
        }
    except Exception as e:
        return JSONResponse(status_code=500, content={"status": "unhealthy", "error": str(e)})

# Startup event and immediate initialization
init_db()

@app.on_event("startup")
def on_startup():
    init_db()

# ================= AUTH & SECURITY ENDPOINTS =================

@app.post("/api/auth/register")
def register(user: UserRegister):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        pw_hash = hash_password(user.password)
        now = datetime.utcnow().isoformat()
        cursor.execute(
            "INSERT INTO users (username, email, password_hash, created_at) VALUES (?, ?, ?, ?)",
            (user.username.strip(), user.email.strip().lower(), pw_hash, now)
        )
        user_id = cursor.lastrowid
        cursor.execute(
            "INSERT INTO user_settings (user_id) VALUES (?)",
            (user_id,)
        )
        conn.commit()
        access_token = create_access_token(user_id, user.username)
        refresh_token = create_refresh_token(user_id, user.username)
        return {
            "token": access_token,
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": {"id": user_id, "username": user.username, "email": user.email}
        }
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail="Username or email already in use.")
    finally:
        conn.close()

@app.post("/api/auth/login")
def login(creds: UserLogin):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, username, email, password_hash FROM users WHERE username = ? OR email = ?",
        (creds.username_or_email.strip(), creds.username_or_email.strip().lower())
    )
    row = cursor.fetchone()
    conn.close()

    if not row or not verify_password(creds.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid username or password.")

    access_token = create_access_token(row["id"], row["username"])
    refresh_token = create_refresh_token(row["id"], row["username"])
    return {
        "token": access_token,
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {"id": row["id"], "username": row["username"], "email": row["email"]}
    }

@app.post("/api/auth/refresh")
def refresh_access_token(req: RefreshTokenRequest):
    payload = verify_token(req.refresh_token, expected_type="refresh")
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token.")
    
    user_id = payload["sub"]
    username = payload["username"]
    new_access = create_access_token(user_id, username)
    new_refresh = create_refresh_token(user_id, username)
    return {
        "token": new_access,
        "access_token": new_access,
        "refresh_token": new_refresh,
        "token_type": "bearer"
    }

@app.get("/api/auth/me")
def get_me(user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, username, email FROM users WHERE id = ?", (user["id"],))
    row = cursor.fetchone()
    cursor.execute("SELECT * FROM user_settings WHERE user_id = ?", (user["id"],))
    settings_row = cursor.fetchone()
    conn.close()

    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    
    settings = dict(settings_row) if settings_row else {}
    return {"user": dict(row), "settings": settings}

@app.put("/api/auth/settings")
def update_settings(settings: UserSettings, user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO user_settings (user_id, monthly_budget, currency_symbol, focus_duration, short_break, long_break, theme)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
            monthly_budget = excluded.monthly_budget,
            currency_symbol = excluded.currency_symbol,
            focus_duration = excluded.focus_duration,
            short_break = excluded.short_break,
            long_break = excluded.long_break,
            theme = excluded.theme
    """, (user["id"], settings.monthly_budget, settings.currency_symbol, settings.focus_duration, settings.short_break, settings.long_break, settings.theme))
    conn.commit()
    conn.close()
    return {"status": "success", "settings": settings.dict()}

# ================= USER DATA EXPORT & RIGHT-TO-BE-FORGOTTEN =================

@app.get("/api/user/export-my-data")
def export_my_data(user: dict = Depends(get_current_user)):
    """GDPR-compliant personal data export containing all behavioral histories."""
    user_id = user["id"]
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, username, email, created_at FROM users WHERE id = ?", (user_id,))
    u_row = cursor.fetchone()
    cursor.execute("SELECT * FROM user_settings WHERE user_id = ?", (user_id,))
    s_row = cursor.fetchone()

    cursor.execute("SELECT * FROM tasks WHERE user_id = ? ORDER BY created_at DESC", (user_id,))
    tasks = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM habits WHERE user_id = ? ORDER BY created_at DESC", (user_id,))
    habits = []
    for r in cursor.fetchall():
        d = dict(r)
        try:
            d["history"] = json.loads(d.get("history") or "[]")
        except Exception:
            pass
        habits.append(d)

    cursor.execute("SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC, time DESC", (user_id,))
    expenses = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM focus_sessions WHERE user_id = ? ORDER BY completed_at DESC", (user_id,))
    sessions = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM daily_logs WHERE user_id = ? ORDER BY date DESC", (user_id,))
    daily_logs = [dict(r) for r in cursor.fetchall()]

    conn.close()

    return {
        "export_timestamp": datetime.utcnow().isoformat(),
        "user_profile": dict(u_row) if u_row else {},
        "user_settings": dict(s_row) if s_row else {},
        "tasks": tasks,
        "habits": habits,
        "expenses": expenses,
        "focus_sessions": sessions,
        "daily_logs": daily_logs
    }

@app.delete("/api/user/delete-my-data")
def delete_my_data(user: dict = Depends(get_current_user)):
    """GDPR-compliant Right-to-be-Forgotten: permanently erases all personal data & models."""
    user_id = user["id"]
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("DELETE FROM daily_logs WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM focus_sessions WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM expenses WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM habits WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM tasks WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM user_settings WHERE user_id = ?", (user_id,))
    cursor.execute("DELETE FROM users WHERE id = ?", (user_id,))
    
    conn.commit()
    conn.close()

    # Clear ML model registry memory for user
    ml_registry.delete_user_data(user_id)

    return {
        "status": "success",
        "message": "All personal account records, activity history, and isolated machine learning models have been permanently erased."
    }

# ================= IDEMPOTENT OFFLINE SYNC BATCH =================

@app.post("/api/sync/batch")
def sync_batch(req: SyncBatchRequest, user: dict = Depends(get_current_user)):
    """Idempotent batch sync endpoint with Last-Write-Wins (LWW) conflict resolution."""
    user_id = user["id"]
    conn = get_db_connection()
    cursor = conn.cursor()
    server_time = datetime.utcnow().isoformat()
    synced_count = 0
    conflicts = []

    try:
        for item in req.items:
            entity = item.entity
            action = item.action
            item_id = item.id
            payload = item.payload or {}
            client_updated_at = item.client_updated_at

            if entity == "task":
                if action == "delete":
                    cursor.execute("DELETE FROM tasks WHERE id = ? AND user_id = ?", (item_id, user_id))
                    synced_count += 1
                else:
                    cursor.execute("SELECT updated_at FROM tasks WHERE id = ? AND user_id = ?", (item_id, user_id))
                    existing = cursor.fetchone()
                    if existing and existing["updated_at"] and existing["updated_at"] > client_updated_at:
                        conflicts.append({"id": item_id, "entity": entity, "reason": "server_is_newer"})
                        continue
                    
                    cursor.execute("""
                        INSERT INTO tasks (id, user_id, title, category, priority, estimated_pomodoros, completed_pomodoros, completed, due_date, completed_at, created_at, updated_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(id) DO UPDATE SET
                            title = excluded.title,
                            category = excluded.category,
                            priority = excluded.priority,
                            estimated_pomodoros = excluded.estimated_pomodoros,
                            completed_pomodoros = excluded.completed_pomodoros,
                            completed = excluded.completed,
                            due_date = excluded.due_date,
                            completed_at = excluded.completed_at,
                            updated_at = excluded.updated_at
                    """, (
                        item_id, user_id,
                        payload.get("title", "Untitled"),
                        payload.get("category", "work"),
                        payload.get("priority", "medium"),
                        int(payload.get("estimated_pomodoros", 1)),
                        int(payload.get("completed_pomodoros", 0)),
                        1 if payload.get("completed") else 0,
                        payload.get("due_date"),
                        payload.get("completed_at"),
                        payload.get("created_at", client_updated_at),
                        client_updated_at
                    ))
                    synced_count += 1

            elif entity == "habit":
                if action == "delete":
                    cursor.execute("DELETE FROM habits WHERE id = ? AND user_id = ?", (item_id, user_id))
                    synced_count += 1
                else:
                    history_str = json.dumps(payload.get("history", [])) if isinstance(payload.get("history"), list) else (payload.get("history") or "[]")
                    cursor.execute("""
                        INSERT INTO habits (id, user_id, title, icon, frequency, streak, last_completed, history, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(id) DO UPDATE SET
                            title = excluded.title,
                            icon = excluded.icon,
                            frequency = excluded.frequency,
                            streak = excluded.streak,
                            last_completed = excluded.last_completed,
                            history = excluded.history
                    """, (
                        item_id, user_id,
                        payload.get("title", "Habit"),
                        payload.get("icon", "🌱"),
                        payload.get("frequency", "daily"),
                        int(payload.get("streak", 0)),
                        payload.get("last_completed"),
                        history_str,
                        payload.get("created_at", client_updated_at)
                    ))
                    synced_count += 1

            elif entity == "expense":
                if action == "delete":
                    cursor.execute("DELETE FROM expenses WHERE id = ? AND user_id = ?", (item_id, user_id))
                    synced_count += 1
                else:
                    cursor.execute("""
                        INSERT INTO expenses (id, user_id, type, amount, category, note, date, time, created_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        ON CONFLICT(id) DO UPDATE SET
                            type = excluded.type,
                            amount = excluded.amount,
                            category = excluded.category,
                            note = excluded.note,
                            date = excluded.date,
                            time = excluded.time
                    """, (
                        item_id, user_id,
                        payload.get("type", "expense"),
                        float(payload.get("amount", 0.0)),
                        payload.get("category", "Other"),
                        payload.get("note", ""),
                        payload.get("date", datetime.utcnow().strftime("%Y-%m-%d")),
                        payload.get("time", "12:00:00"),
                        payload.get("created_at", client_updated_at)
                    ))
                    synced_count += 1

            elif entity == "focus_session":
                cursor.execute("""
                    INSERT INTO focus_sessions (id, user_id, task_id, mode, duration_minutes, start_time, end_time, interruptions, completed_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(id) DO NOTHING
                """, (
                    item_id, user_id,
                    payload.get("task_id"),
                    payload.get("mode", "focus"),
                    int(payload.get("duration_minutes", 25)),
                    payload.get("start_time"),
                    payload.get("end_time"),
                    int(payload.get("interruptions", 0)),
                    payload.get("completed_at", client_updated_at)
                ))
                synced_count += 1

            elif entity == "daily_log":
                cursor.execute("""
                    INSERT INTO daily_logs (id, user_id, date, mood, sleep_hours, notes, created_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(user_id, date) DO UPDATE SET
                        mood = excluded.mood,
                        sleep_hours = excluded.sleep_hours,
                        notes = excluded.notes
                """, (
                    item_id, user_id,
                    payload.get("date", datetime.utcnow().strftime("%Y-%m-%d")),
                    int(payload.get("mood", 3)),
                    float(payload.get("sleep_hours", 7.5)),
                    payload.get("notes", ""),
                    payload.get("created_at", client_updated_at)
                ))
                synced_count += 1

        conn.commit()
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=f"Batch sync error: {str(e)}")
    finally:
        conn.close()

    return {
        "status": "success",
        "synced_count": synced_count,
        "conflicts": conflicts,
        "server_time": server_time
    }

# ================= TASKS ENDPOINTS =================

@app.get("/api/tasks")
def get_tasks(user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM tasks WHERE user_id = ? ORDER BY completed ASC, created_at DESC", (user["id"],))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/tasks")
def create_task(task: TaskCreate, user: dict = Depends(get_current_user)):
    task_id = task.id or str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO tasks (id, user_id, title, category, priority, estimated_pomodoros, completed_pomodoros, completed, due_date, completed_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?)
    """, (task_id, user["id"], task.title.strip(), task.category, task.priority, task.estimated_pomodoros, task.due_date, task.completed_at, now, now))
    conn.commit()
    cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    new_task = dict(cursor.fetchone())
    conn.close()
    return new_task

@app.put("/api/tasks/{task_id}")
def update_task(task_id: str, updates: TaskUpdate, user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM tasks WHERE id = ? AND user_id = ?", (task_id, user["id"]))
    existing = cursor.fetchone()
    if not existing:
        conn.close()
        raise HTTPException(status_code=404, detail="Task not found")

    now = datetime.utcnow().isoformat()
    fields = []
    values = []
    for k, v in updates.dict(exclude_unset=True).items():
        if k == "completed":
            fields.append("completed = ?")
            values.append(1 if v else 0)
            if v and not existing["completed_at"]:
                fields.append("completed_at = ?")
                values.append(now)
            elif not v:
                fields.append("completed_at = ?")
                values.append(None)
        else:
            fields.append(f"{k} = ?")
            values.append(v)
    
    if fields:
        fields.append("updated_at = ?")
        values.append(now)
        values.extend([task_id, user["id"]])
        cursor.execute(f"UPDATE tasks SET {', '.join(fields)} WHERE id = ? AND user_id = ?", values)
        conn.commit()

    cursor.execute("SELECT * FROM tasks WHERE id = ?", (task_id,))
    updated = dict(cursor.fetchone())
    conn.close()
    return updated

@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: str, user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM tasks WHERE id = ? AND user_id = ?", (task_id, user["id"]))
    conn.commit()
    conn.close()
    return {"status": "deleted", "id": task_id}

# ================= HABITS ENDPOINTS =================

@app.get("/api/habits")
def get_habits(user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM habits WHERE user_id = ? ORDER BY created_at ASC", (user["id"],))
    rows = cursor.fetchall()
    conn.close()
    results = []
    for r in rows:
        item = dict(r)
        item["history"] = json.loads(item["history"] or "[]")
        results.append(item)
    return results

@app.post("/api/habits")
def create_habit(habit: HabitCreate, user: dict = Depends(get_current_user)):
    habit_id = habit.id or str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO habits (id, user_id, title, icon, frequency, streak, last_completed, history, created_at)
        VALUES (?, ?, ?, ?, ?, 0, NULL, '[]', ?)
    """, (habit_id, user["id"], habit.title.strip(), habit.icon, habit.frequency, now))
    conn.commit()
    cursor.execute("SELECT * FROM habits WHERE id = ?", (habit_id,))
    item = dict(cursor.fetchone())
    item["history"] = []
    conn.close()
    return item

@app.post("/api/habits/{habit_id}/check")
def toggle_habit_check(habit_id: str, check: HabitCheckIn, user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM habits WHERE id = ? AND user_id = ?", (habit_id, user["id"]))
    row = cursor.fetchone()
    if not row:
        conn.close()
        raise HTTPException(status_code=404, detail="Habit not found")

    history = json.loads(row["history"] or "[]")
    target_date = check.date

    if target_date in history:
        history.remove(target_date)
    else:
        history.append(target_date)
        history.sort()

    streak = 0
    today_str = date.today().isoformat()
    if history:
        sorted_dates = sorted(list(set(history)), reverse=True)
        from datetime import timedelta
        curr = date.today()
        if today_str not in sorted_dates:
            curr = curr - timedelta(days=1)
        while curr.isoformat() in sorted_dates:
            streak += 1
            curr = curr - timedelta(days=1)

    last_comp = history[-1] if history else None
    cursor.execute("""
        UPDATE habits SET history = ?, streak = ?, last_completed = ? WHERE id = ? AND user_id = ?
    """, (json.dumps(history), streak, last_comp, habit_id, user["id"]))
    conn.commit()

    cursor.execute("SELECT * FROM habits WHERE id = ?", (habit_id,))
    updated = dict(cursor.fetchone())
    updated["history"] = history
    conn.close()
    return updated

@app.delete("/api/habits/{habit_id}")
def delete_habit(habit_id: str, user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM habits WHERE id = ? AND user_id = ?", (habit_id, user["id"]))
    conn.commit()
    conn.close()
    return {"status": "deleted", "id": habit_id}

# ================= EXPENSES ENDPOINTS =================

@app.get("/api/expenses")
def get_expenses(user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC, created_at DESC", (user["id"],))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/expenses")
def create_expense(expense: ExpenseCreate, user: dict = Depends(get_current_user)):
    exp_id = expense.id or str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    time_str = expense.time or now[11:19]
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO expenses (id, user_id, type, amount, category, note, date, time, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (exp_id, user["id"], expense.type, expense.amount, expense.category, expense.note or "", expense.date, time_str, now))
    conn.commit()
    cursor.execute("SELECT * FROM expenses WHERE id = ?", (exp_id,))
    item = dict(cursor.fetchone())
    conn.close()
    return item

@app.delete("/api/expenses/{expense_id}")
def delete_expense(expense_id: str, user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM expenses WHERE id = ? AND user_id = ?", (expense_id, user["id"]))
    conn.commit()
    conn.close()
    return {"status": "deleted", "id": expense_id}

# ================= FOCUS SESSIONS ENDPOINTS =================

@app.get("/api/focus-sessions")
def get_focus_sessions(user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM focus_sessions WHERE user_id = ? ORDER BY completed_at DESC LIMIT 200", (user["id"],))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/focus-sessions")
def create_focus_session(session: FocusSessionCreate, user: dict = Depends(get_current_user)):
    session_id = session.id or str(uuid.uuid4())
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO focus_sessions (id, user_id, task_id, mode, duration_minutes, start_time, end_time, interruptions, completed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (session_id, user["id"], session.task_id, session.mode, session.duration_minutes, session.start_time, session.end_time, session.interruptions or 0, session.completed_at))

    if session.task_id and session.mode == "focus":
        cursor.execute("UPDATE tasks SET completed_pomodoros = completed_pomodoros + 1 WHERE id = ? AND user_id = ?", (session.task_id, user["id"]))

    conn.commit()
    cursor.execute("SELECT * FROM focus_sessions WHERE id = ?", (session_id,))
    item = dict(cursor.fetchone())
    conn.close()
    return item

# ================= DAILY WELLNESS LOGS ENDPOINTS =================

@app.get("/api/daily-logs")
def get_daily_logs(user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM daily_logs WHERE user_id = ? ORDER BY date DESC LIMIT 90", (user["id"],))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.post("/api/daily-logs")
def save_daily_log(log: DailyLogCreate, user: dict = Depends(get_current_user)):
    log_id = log.id or str(uuid.uuid4())
    now = datetime.utcnow().isoformat()
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO daily_logs (id, user_id, date, mood, sleep_hours, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, date) DO UPDATE SET
            mood = excluded.mood,
            sleep_hours = excluded.sleep_hours,
            notes = excluded.notes
    """, (log_id, user["id"], log.date, log.mood, log.sleep_hours, log.notes or "", now))
    conn.commit()
    cursor.execute("SELECT * FROM daily_logs WHERE user_id = ? AND date = ?", (user["id"], log.date))
    item = dict(cursor.fetchone())
    conn.close()
    return item

# ================= UNIFIED DASHBOARD STATS =================

@app.get("/api/dashboard")
def get_dashboard(user: dict = Depends(get_current_user)):
    today_str = date.today().isoformat()
    month_prefix = today_str[:7]

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
        SELECT COALESCE(SUM(duration_minutes), 0) as today_focus, COUNT(id) as today_sessions
        FROM focus_sessions
        WHERE user_id = ? AND mode = 'focus' AND substr(completed_at, 1, 10) = ?
    """, (user["id"], today_str))
    focus_data = dict(cursor.fetchone())

    cursor.execute("SELECT COUNT(id) as total_tasks, SUM(completed) as completed_tasks FROM tasks WHERE user_id = ?", (user["id"],))
    task_counts = dict(cursor.fetchone())

    cursor.execute("SELECT * FROM tasks WHERE user_id = ? AND completed = 0 ORDER BY priority DESC LIMIT 5", (user["id"],))
    top_tasks = [dict(r) for r in cursor.fetchall()]

    cursor.execute("""
        SELECT 
            COALESCE(SUM(CASE WHEN type='expense' AND substr(date, 1, 10) = ? THEN amount ELSE 0 END), 0) as today_expense,
            COALESCE(SUM(CASE WHEN type='expense' AND substr(date, 1, 7) = ? THEN amount ELSE 0 END), 0) as month_expense,
            COALESCE(SUM(CASE WHEN type='income' AND substr(date, 1, 7) = ? THEN amount ELSE 0 END), 0) as month_income
        FROM expenses
        WHERE user_id = ?
    """, (today_str, month_prefix, month_prefix, user["id"]))
    finance_data = dict(cursor.fetchone())

    cursor.execute("SELECT * FROM habits WHERE user_id = ?", (user["id"],))
    habits = [dict(r) for r in cursor.fetchall()]
    habits_done_today = sum(1 for h in habits if today_str in json.loads(h["history"] or "[]"))

    cursor.execute("SELECT * FROM user_settings WHERE user_id = ?", (user["id"],))
    user_settings = dict(cursor.fetchone() or {})

    conn.close()

    return {
        "date": today_str,
        "focus": {
            "today_minutes": focus_data["today_focus"],
            "today_sessions": focus_data["today_sessions"]
        },
        "tasks": {
            "total": task_counts["total_tasks"] or 0,
            "completed": task_counts["completed_tasks"] or 0,
            "top_pending": top_tasks
        },
        "finances": {
            "today_expense": finance_data["today_expense"],
            "month_expense": finance_data["month_expense"],
            "month_income": finance_data["month_income"],
            "monthly_budget": user_settings.get("monthly_budget", 25000.0),
            "currency_symbol": user_settings.get("currency_symbol", "₹")
        },
        "habits": {
            "total": len(habits),
            "done_today": habits_done_today
        }
    }

# ================= ML & INTELLIGENCE ENDPOINTS =================

@app.get("/api/ml/focus-recommendation")
def get_focus_recommendation(user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM focus_sessions WHERE user_id = ? ORDER BY completed_at DESC LIMIT 300", (user["id"],))
    sessions = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return ml_registry.get_focus_recommendations(user["id"], sessions)

@app.post("/api/ml/estimate-task-duration")
def estimate_task_duration(req: MLEstimateTaskDurationRequest, user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM tasks WHERE user_id = ?", (user["id"],))
    tasks = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return ml_registry.estimate_task_duration(user["id"], tasks, req.title, req.category, req.priority)

@app.post("/api/ml/categorize-expense")
def categorize_expense_ml(req: MLCategorizeExpenseRequest, user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM expenses WHERE user_id = ? LIMIT 300", (user["id"],))
    expenses = [dict(r) for r in cursor.fetchall()]
    conn.close()
    return ml_registry.categorize_expense(user["id"], expenses, req.note)

@app.get("/api/ml/spending-forecast")
def get_spending_forecast(user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM expenses WHERE user_id = ? ORDER BY date DESC LIMIT 400", (user["id"],))
    expenses = [dict(r) for r in cursor.fetchall()]
    cursor.execute("SELECT monthly_budget FROM user_settings WHERE user_id = ?", (user["id"],))
    s_row = cursor.fetchone()
    budget = float(s_row["monthly_budget"]) if s_row and s_row["monthly_budget"] else 25000.0
    conn.close()
    return ml_registry.detect_spending_anomalies(user["id"], expenses, budget)

@app.get("/api/ml/habit-risks")
def get_habit_risks(user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM habits WHERE user_id = ?", (user["id"],))
    habits = []
    for r in cursor.fetchall():
        item = dict(r)
        item["history"] = json.loads(item["history"] or "[]")
        habits.append(item)

    cursor.execute("SELECT * FROM daily_logs WHERE user_id = ? ORDER BY date DESC LIMIT 90", (user["id"],))
    daily_logs = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM focus_sessions WHERE user_id = ? ORDER BY completed_at DESC LIMIT 200", (user["id"],))
    sessions = [dict(r) for r in cursor.fetchall()]
    conn.close()

    return ml_registry.predict_habit_risks(user["id"], habits, daily_logs, sessions)

@app.get("/api/ml/cross-module-insights")
def get_cross_module_insights(user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM daily_logs WHERE user_id = ? ORDER BY date ASC LIMIT 180", (user["id"],))
    daily_logs = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM focus_sessions WHERE user_id = ? ORDER BY completed_at ASC LIMIT 400", (user["id"],))
    sessions = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM expenses WHERE user_id = ? ORDER BY date ASC LIMIT 400", (user["id"],))
    expenses = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM habits WHERE user_id = ?", (user["id"],))
    habits = []
    for r in cursor.fetchall():
        item = dict(r)
        item["history"] = json.loads(item["history"] or "[]")
        habits.append(item)
    conn.close()

    return ml_registry.discover_insights(user["id"], daily_logs, sessions, expenses, habits)

@app.get("/api/ml/weekly-reflection")
def get_weekly_reflection(user: dict = Depends(get_current_user)):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM focus_sessions WHERE user_id = ?", (user["id"],))
    sessions = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM tasks WHERE user_id = ?", (user["id"],))
    tasks = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM expenses WHERE user_id = ?", (user["id"],))
    expenses = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT * FROM habits WHERE user_id = ?", (user["id"],))
    habits = []
    for r in cursor.fetchall():
        item = dict(r)
        item["history"] = json.loads(item["history"] or "[]")
        habits.append(item)

    cursor.execute("SELECT * FROM daily_logs WHERE user_id = ? ORDER BY date DESC LIMIT 30", (user["id"],))
    daily_logs = [dict(r) for r in cursor.fetchall()]

    cursor.execute("SELECT monthly_budget FROM user_settings WHERE user_id = ?", (user["id"],))
    s_row = cursor.fetchone()
    budget = float(s_row["monthly_budget"]) if s_row and s_row["monthly_budget"] else 25000.0
    conn.close()

    return ml_registry.generate_reflection(
        user["id"], user["username"], sessions, tasks, expenses, habits, daily_logs, budget
    )

@app.post("/api/ml/parse-task")
def parse_natural_task(req: MLParseTaskRequest):
    return ml_registry.parse_natural_task(req.text)

@app.get("/api/ml/transparency")
def get_model_transparency(user: dict = Depends(get_current_user)):
    return ml_registry.get_transparency_metrics(user["id"])

# ================= LEGACY BACKUP ALIAS =================

@app.get("/api/sync/export")
def export_user_data_alias(user: dict = Depends(get_current_user)):
    return export_my_data(user)

# ================= STATIC FILE SERVING =================

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

app.mount("/css", StaticFiles(directory=os.path.join(BASE_DIR, "css")), name="css")
app.mount("/js", StaticFiles(directory=os.path.join(BASE_DIR, "js")), name="js")

@app.get("/")
def serve_index():
    return FileResponse(os.path.join(BASE_DIR, "index.html"))
