"""Initial and Extended Schema

Revision ID: 001_initial
Revises: 
Create Date: 2026-11-10 16:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '001_initial'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Users
    op.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
    """)

    # User Settings
    op.execute("""
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

    # Tasks with completed_at
    op.execute("""
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

    # Habits
    op.execute("""
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

    # Expenses with time
    op.execute("""
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

    # Focus Sessions with start_time, end_time, interruptions
    op.execute("""
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

    # Daily Wellness Logs (sleep, mood)
    op.execute("""
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


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS daily_logs;")
    op.execute("DROP TABLE IF EXISTS focus_sessions;")
    op.execute("DROP TABLE IF EXISTS expenses;")
    op.execute("DROP TABLE IF EXISTS habits;")
    op.execute("DROP TABLE IF EXISTS tasks;")
    op.execute("DROP TABLE IF EXISTS user_settings;")
    op.execute("DROP TABLE IF EXISTS users;")
