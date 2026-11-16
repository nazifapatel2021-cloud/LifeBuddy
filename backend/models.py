from pydantic import BaseModel, EmailStr
from typing import Optional, List

class UserRegister(BaseModel):
    username: str
    email: str
    password: str
    full_name: Optional[str] = None
    profession: Optional[str] = None
    age_group: Optional[str] = None
    focus_goal: Optional[str] = None

class UserLogin(BaseModel):
    username_or_email: str
    password: str

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: Optional[str] = None
    profession: Optional[str] = None
    age_group: Optional[str] = None
    focus_goal: Optional[str] = None

class UserSettings(BaseModel):
    monthly_budget: float = 25000.0
    currency_symbol: str = "₹"
    focus_duration: int = 25
    short_break: int = 5
    long_break: int = 15
    theme: str = "nordic"
    full_name: Optional[str] = None
    profession: Optional[str] = None
    age_group: Optional[str] = None
    focus_goal: Optional[str] = None

class TaskCreate(BaseModel):
    id: Optional[str] = None
    title: str
    category: str = "work"
    priority: str = "medium"
    estimated_pomodoros: int = 1
    due_date: Optional[str] = None
    completed_at: Optional[str] = None
    in_focus_queue: bool = True

class TaskUpdate(BaseModel):
    title: Optional[str] = None
    category: Optional[str] = None
    priority: Optional[str] = None
    estimated_pomodoros: Optional[int] = None
    completed_pomodoros: Optional[int] = None
    completed: Optional[bool] = None
    due_date: Optional[str] = None
    completed_at: Optional[str] = None
    in_focus_queue: Optional[bool] = None

class HabitCreate(BaseModel):
    id: Optional[str] = None
    title: str
    icon: str = "🌱"
    frequency: str = "daily"

class HabitUpdate(BaseModel):
    title: Optional[str] = None
    icon: Optional[str] = None
    frequency: Optional[str] = None

class HabitCheckIn(BaseModel):
    date: str  # YYYY-MM-DD
    timestamp: Optional[str] = None

class ExpenseCreate(BaseModel):
    id: Optional[str] = None
    type: str = "expense"  # "expense" or "income"
    amount: float
    category: str
    note: Optional[str] = ""
    date: str
    time: Optional[str] = "12:00:00"

class FocusSessionCreate(BaseModel):
    id: Optional[str] = None
    task_id: Optional[str] = None
    mode: str
    duration_minutes: int
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    interruptions: Optional[int] = 0
    completed_at: str

class DailyLogCreate(BaseModel):
    id: Optional[str] = None
    date: str  # YYYY-MM-DD
    mood: int = 3  # 1 to 5
    sleep_hours: float = 7.5
    notes: Optional[str] = ""

class DailyLogResponse(BaseModel):
    id: str
    user_id: int
    date: str
    mood: int
    sleep_hours: float
    notes: str
    created_at: str

class MLEstimateTaskDurationRequest(BaseModel):
    title: str
    category: str = "work"
    priority: str = "medium"

class MLCategorizeExpenseRequest(BaseModel):
    note: str

class MLParseTaskRequest(BaseModel):
    text: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str

class SyncBatchItem(BaseModel):
    id: str
    entity: str  # "task", "habit", "expense", "focus_session", "daily_log"
    action: str = "upsert"  # "upsert" or "delete"
    payload: dict = {}
    client_updated_at: str

class SyncBatchRequest(BaseModel):
    items: List[SyncBatchItem]
