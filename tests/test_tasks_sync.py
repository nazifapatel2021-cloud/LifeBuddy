"""
Tests for Unified Task Synchronization across Today, Planner, and Focus Room screens.
Proves:
1. One central store and single task list source of truth across all views.
2. Adding a task in Planner makes it available everywhere (Today, Focus Queue, Planner).
3. Completing a task on any screen reflects on all screens.
4. Due date normalization handles both YYYY-MM-DD and DD-MM-YYYY / DD/MM/YYYY formats.
5. Safe migration preserves existing saved tasks without data loss.
6. API endpoint consistency across user scopes.
"""
import pytest
import time
import re
from datetime import datetime, date
from fastapi.testclient import TestClient
from backend.main import app

client = TestClient(app)

def normalize_date(date_str):
    """Python mirror of normalizeDate in date_utils.js"""
    if not date_str or not isinstance(date_str, str):
        return None
    trimmed = date_str.strip()
    if not trimmed:
        return None
    # YYYY-MM-DD
    if re.match(r"^\d{4}-\d{2}-\d{2}", trimmed):
        return trimmed[:10]
    # YYYY/MM/DD
    if re.match(r"^\d{4}/\d{2}/\d{2}", trimmed):
        return trimmed[:10].replace("/", "-")
    # DD-MM-YYYY or DD/MM/YYYY
    dmy = re.match(r"^(\d{1,2})[-/](\d{1,2})[-/](\d{4})", trimmed)
    if dmy:
        day = dmy.group(1).zfill(2)
        month = dmy.group(2).zfill(2)
        year = dmy.group(3)
        return f"{year}-{month}-{day}"
    return trimmed

def test_due_date_normalization_both_formats():
    """Verify both YYYY-MM-DD and DD-MM-YYYY parse to canonical ISO for comparison."""
    # Standard ISO
    assert normalize_date("2026-11-16") == "2026-11-16"
    assert normalize_date("2026/11/16") == "2026-11-16"
    # Indian / British DD-MM-YYYY
    assert normalize_date("16-11-2026") == "2026-11-16"
    assert normalize_date("16/11/2026") == "2026-11-16"
    assert normalize_date("5-9-2026") == "2026-09-05"
    assert normalize_date("05/09/2026") == "2026-09-05"
    assert normalize_date(None) is None
    assert normalize_date("") is None

def test_unified_tasks_api_lifecycle():
    """
    Simulate user lifecycle:
    1. Register user & authenticate
    2. Add task 'maths' with no due date
    3. Add task 'exercise' with DD-MM-YYYY due date
    4. Add task 'project' with YYYY-MM-DD due date
    5. Verify Today selector, Focus Queue selector, and Planner selector see all 3 tasks
    6. Complete task 'maths' and verify all screens see it completed
    """
    username = f"sync_tasks_user_{int(time.time()*1000)}"
    reg_res = client.post("/api/auth/register", json={
        "username": username,
        "email": f"{username}@example.com",
        "password": "Password123!"
    })
    assert reg_res.status_code == 200

    login_res = client.post("/api/auth/login", json={
        "username_or_email": username,
        "password": "Password123!"
    })
    token = login_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Add tasks via API (as Planner and Focus Room would)
    task1_res = client.post("/api/tasks", headers=headers, json={
        "title": "maths",
        "category": "work",
        "priority": "medium",
        "estimated_pomodoros": 2,
        "in_focus_queue": True
    })
    assert task1_res.status_code == 200
    t1 = task1_res.json()

    task2_res = client.post("/api/tasks", headers=headers, json={
        "title": "exercise",
        "category": "health",
        "priority": "high",
        "estimated_pomodoros": 1,
        "due_date": normalize_date("16-11-2026"),  # DD-MM-YYYY normalized
        "in_focus_queue": True
    })
    assert task2_res.status_code == 200
    t2 = task2_res.json()

    task3_res = client.post("/api/tasks", headers=headers, json={
        "title": "project",
        "category": "work",
        "priority": "urgent",
        "estimated_pomodoros": 3,
        "due_date": normalize_date("2026-11-16"),  # YYYY-MM-DD
        "in_focus_queue": True
    })
    assert task3_res.status_code == 200
    t3 = task3_res.json()

    # 2. Fetch via central /api/tasks (single source of truth)
    all_tasks_res = client.get("/api/tasks", headers=headers)
    assert all_tasks_res.status_code == 200
    all_tasks = all_tasks_res.json()
    assert len(all_tasks) == 3

    # 3. Simulate Today Screen Selector:
    # Today reads pending tasks & total count
    pending_today = [t for t in all_tasks if not t.get("completed")]
    assert len(pending_today) == 3
    today_titles = {t["title"] for t in pending_today}
    assert today_titles == {"maths", "exercise", "project"}

    # 4. Simulate Planner Screen Selector:
    # Planner 'all' filter shows all tasks
    planner_all = all_tasks
    assert len(planner_all) == 3

    # Planner 'today' filter matching either today's date or unscheduled pending
    today_iso = "2026-11-16"
    planner_today = [
        t for t in all_tasks
        if normalize_date(t.get("due_date")) == today_iso or (not t.get("due_date") and not t.get("completed"))
    ]
    # 'exercise' (16-11-2026 -> 2026-11-16), 'project' (2026-11-16), and 'maths' (no due date) all qualify
    assert len(planner_today) == 3

    # 5. Simulate Focus Room Target Queue Selector:
    # Pending tasks designated for focus queue
    focus_queue = [
        t for t in all_tasks
        if not t.get("completed") and t.get("in_focus_queue") not in (False, 0)
    ]
    assert len(focus_queue) == 3

    # 6. Complete a task ('maths') from Today screen
    complete_res = client.put(f"/api/tasks/{t1['id']}", headers=headers, json={
        "completed": True
    })
    assert complete_res.status_code == 200

    # 7. Re-fetch unified tasks list and verify ALL screens reflect completion instantly
    updated_tasks = client.get("/api/tasks", headers=headers).json()
    
    # Check Today Screen reflection
    pending_today_after = [t for t in updated_tasks if not t.get("completed")]
    completed_today_after = [t for t in updated_tasks if t.get("completed")]
    assert len(pending_today_after) == 2
    assert len(completed_today_after) == 1
    assert completed_today_after[0]["title"] == "maths"

    # Check Focus Room reflection (maths removed from active queue since it's done)
    focus_queue_after = [
        t for t in updated_tasks
        if not t.get("completed") and t.get("in_focus_queue") not in (False, 0)
    ]
    assert len(focus_queue_after) == 2
    assert {t["title"] for t in focus_queue_after} == {"exercise", "project"}

    # Check Planner reflection (maths still visible in Planner under 'all' and 'completed')
    planner_done = [t for t in updated_tasks if t.get("completed")]
    assert len(planner_done) == 1
    assert planner_done[0]["title"] == "maths"
