import os
import sqlite3
import json
from datetime import datetime

DATABASE_URL = os.environ.get("DATABASE_URL")
SQLITE_DB_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "lifebuddy.db")

def is_postgres():
    return bool(DATABASE_URL and (DATABASE_URL.startswith("postgresql://") or DATABASE_URL.startswith("postgres://")))

def get_db_connection():
    if is_postgres():
        try:
            import psycopg2
            from psycopg2.extras import RealDictCursor
            url = DATABASE_URL.replace("postgres://", "postgresql://", 1)
            conn = psycopg2.connect(url, cursor_factory=RealDictCursor)
            return conn
        except ImportError:
            print("psycopg2 not installed; falling back to SQLite for local storage.")
    
    conn = sqlite3.connect(SQLITE_DB_FILE, timeout=30.0, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    # Concurrency optimizations: WAL mode enables concurrent reads and writes for 50+ users
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA busy_timeout=10000;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    conn.execute("PRAGMA cache_size=-64000;")
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
    """)

    # User Settings Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_settings (
        user_id INTEGER PRIMARY KEY,
        monthly_budget REAL DEFAULT 1000.0,
        currency_symbol TEXT DEFAULT '$',
        focus_duration INTEGER DEFAULT 25,
        short_break INTEGER DEFAULT 5,
        long_break INTEGER DEFAULT 15,
        theme TEXT DEFAULT 'sage',
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    """)

    # Tasks Table (with completed_at)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        category TEXT DEFAULT 'work',
        priority TEXT DEFAULT 'medium',
        estimated_pomodoros INTEGER DEFAULT 1,
        completed_pomodoros INTEGER DEFAULT 0,
        completed INTEGER DEFAULT 0,
        due_date TEXT,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    """)

    # Habits Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS habits (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        icon TEXT DEFAULT '🌱',
        frequency TEXT DEFAULT 'daily',
        streak INTEGER DEFAULT 0,
        last_completed TEXT,
        history TEXT DEFAULT '[]',
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    """)

    # Expenses Table (with time)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        type TEXT DEFAULT 'expense',
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        note TEXT DEFAULT '',
        date TEXT NOT NULL,
        time TEXT DEFAULT '12:00:00',
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    """)

    # Focus Sessions Table (with start_time, end_time, interruptions)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS focus_sessions (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        task_id TEXT,
        mode TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        start_time TEXT,
        end_time TEXT,
        interruptions INTEGER DEFAULT 0,
        completed_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
    );
    """)

    # Daily Wellness Logs Table (mood, sleep)
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS daily_logs (
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        mood INTEGER DEFAULT 3,
        sleep_hours REAL DEFAULT 7.5,
        notes TEXT DEFAULT '',
        created_at TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        UNIQUE(user_id, date)
    );
    """)

    # Ensure columns exist in SQLite if table was created in an earlier revision
    if not is_postgres():
        # Check tasks.completed_at
        cursor.execute("PRAGMA table_info(tasks)")
        task_cols = [row[1] for row in cursor.fetchall()]
        if "completed_at" not in task_cols:
            cursor.execute("ALTER TABLE tasks ADD COLUMN completed_at TEXT")

        # Check expenses.time
        cursor.execute("PRAGMA table_info(expenses)")
        exp_cols = [row[1] for row in cursor.fetchall()]
        if "time" not in exp_cols:
            cursor.execute("ALTER TABLE expenses ADD COLUMN time TEXT DEFAULT '12:00:00'")

        # Check focus_sessions (start_time, end_time, interruptions)
        cursor.execute("PRAGMA table_info(focus_sessions)")
        fs_cols = [row[1] for row in cursor.fetchall()]
        if "start_time" not in fs_cols:
            cursor.execute("ALTER TABLE focus_sessions ADD COLUMN start_time TEXT")
        if "end_time" not in fs_cols:
            cursor.execute("ALTER TABLE focus_sessions ADD COLUMN end_time TEXT")
        if "interruptions" not in fs_cols:
            cursor.execute("ALTER TABLE focus_sessions ADD COLUMN interruptions INTEGER DEFAULT 0")

    conn.commit()
    conn.close()

if __name__ == "__main__":
    init_db()
    print("Database initialized successfully at:", SQLITE_DB_FILE)
