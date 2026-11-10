"""
LifeBuddy ML Suite & API Test Verification
Tests all 8 ML modules, their rule-based cold-start fallbacks, plain-English explainability,
and REST endpoints via FastAPI TestClient.
"""

import pytest
from datetime import datetime, date, timedelta
from fastapi.testclient import TestClient

from app.ml.focus_recommender import FocusRecommender
from app.ml.task_duration import TaskDurationEstimator
from app.ml.expense_categorizer import ExpenseCategorizer
from app.ml.spending_anomaly import SpendingAnomalyDetector
from app.ml.habit_risk import HabitRiskPredictor
from app.ml.cross_module_insights import CrossModuleInsightEngine
from app.ml.reflection_generator import ReflectionGenerator
from app.ml.nl_task_parser import NLTaskParser

from backend.main import app

@pytest.fixture
def test_client():
    with TestClient(app) as client:
        yield client

# 1. Test Focus Recommender
def test_focus_recommender_cold_start():
    recommender = FocusRecommender()
    few_sessions = [{"mode": "focus", "duration_minutes": 25, "completed_at": "2026-11-01T10:00:00"}]
    res = recommender.analyze(few_sessions)
    assert res["status"] == "cold_start"
    assert "Mon-Fri 09:00 - 11:00 AM" in res["recommended_window"]
    assert "explanation" in res

def test_focus_recommender_trained():
    recommender = FocusRecommender()
    sessions = []
    for i in range(35):
        day_date = date(2026, 9, 1) + timedelta(days=i)
        hour = 10 if i % 2 == 0 else 14
        sessions.append({
            "mode": "focus",
            "duration_minutes": 25,
            "start_time": f"{day_date.isoformat()}T{hour:02d}:00:00",
            "completed_at": f"{day_date.isoformat()}T{hour:02d}:25:00",
            "interruptions": 0 if hour == 10 else 3
        })
    res = recommender.analyze(sessions)
    assert res["status"] == "trained"
    assert "explanation" in res
    assert len(res["peak_days"]) > 0

# 2. Test Task Duration Estimator
def test_task_duration_cold_start():
    estimator = TaskDurationEstimator()
    res = estimator.predict("Write research paper", "study", "urgent")
    assert res["predicted_pomodoros"] >= 1
    assert "explanation" in res
    assert "Cold-Start" in res["confidence"]

def test_task_duration_trained():
    estimator = TaskDurationEstimator()
    tasks = []
    for i in range(25):
        cat = "study" if i % 2 == 0 else "work"
        prio = "urgent" if i % 3 == 0 else "medium"
        act = 4 if cat == "study" and prio == "urgent" else (2 if cat == "work" else 1)
        tasks.append({
            "id": f"t_{i}",
            "title": f"Complete assignment {i} for module",
            "category": cat,
            "priority": prio,
            "completed": 1,
            "completed_pomodoros": act,
            "created_at": f"2026-10-01T10:00:00"
        })
    metrics = estimator.train_and_evaluate(tasks)
    assert metrics["status"] == "trained"
    assert "models" in metrics
    assert "ridge_regression" in metrics["models"]
    assert "mae" in metrics["models"]["ridge_regression"]

    pred = estimator.predict("Complete complex assignment", "study", "urgent")
    assert pred["predicted_pomodoros"] >= 1
    assert "explanation" in pred

# 3. Test Expense Auto-Categorizer
def test_expense_categorizer_rules_and_trained():
    categorizer = ExpenseCategorizer()
    rule_res = categorizer.predict("Matcha latte at local cafe")
    assert rule_res["category"] == "Food"

    expenses = []
    food_kws = ["lunch burrito", "campus cafeteria", "dinner sushi", "groceries at store", "coffee beans"]
    trans_kws = ["metro subway card", "uber ride home", "gas refill pump", "bus pass reload", "taxi fare"]
    for i in range(16):
        expenses.append({"note": food_kws[i % len(food_kws)], "category": "Food", "type": "expense"})
        expenses.append({"note": trans_kws[i % len(trans_kws)], "category": "Transport", "type": "expense"})

    metrics = categorizer.train_and_evaluate(expenses)
    assert metrics["status"] == "trained"
    assert metrics["accuracy"] >= 0.70
    assert metrics["macro_f1"] >= 0.70

    pred = categorizer.predict("Late dinner with friends")
    assert "explanation" in pred
    assert pred["category"] in ["Food", "Transport", "Other"]

# 4. Test Spending Anomaly Detector & Forecast
def test_spending_anomaly_and_forecast():
    detector = SpendingAnomalyDetector()
    expenses = []
    for i in range(20):
        d = (date.today() - timedelta(days=i)).isoformat()
        expenses.append({"id": f"e_{i}", "amount": 15.0 + (i % 3), "category": "Food", "type": "expense", "date": d})
    expenses.append({"id": "outlier_1", "amount": 350.0, "category": "Shopping", "type": "expense", "date": date.today().isoformat()})

    res = detector.analyze(expenses, monthly_budget=600.0)
    assert res["status"] == "computed"
    assert res["anomaly_count"] >= 1
    assert "confidence_interval_95" in res
    assert res["projected_month_end"] > 0
    assert "explanation" in res

# 5. Test Habit Risk Predictor
def test_habit_risk_predictor():
    predictor = HabitRiskPredictor()
    habits = [{
        "id": "h_test",
        "title": "Morning Run",
        "icon": "🏃",
        "streak": 5,
        "history": [(date.today() - timedelta(days=i)).isoformat() for i in range(1, 15)]
    }]
    daily_logs = [{"date": (date.today() - timedelta(days=i)).isoformat(), "mood": 4, "sleep_hours": 7.5} for i in range(15)]
    focus_sessions = [{"mode": "focus", "duration_minutes": 50, "completed_at": date.today().isoformat() + "T12:00:00"}]

    res = predictor.analyze_habits(habits, daily_logs, focus_sessions)
    assert len(res) == 1
    assert "risk_probability" in res[0]
    assert "nudge" in res[0]
    assert "explanation" in res[0]

# 6. Test Cross-Module Insight Engine
def test_cross_module_insight_engine():
    engine = CrossModuleInsightEngine(min_sample_size=14)
    daily_logs = []
    focus_sessions = []
    expenses = []
    habits = [{"title": "Morning Exercise", "icon": "🏃", "history": []}]

    base_date = date(2026, 8, 1)
    for i in range(30):
        d = (base_date + timedelta(days=i)).isoformat()
        sleep = 8.5 if i < 15 else 5.0
        # Lagged correlation: yesterday's sleep drives today's focus
        prev_sleep = 8.5 if i <= 15 else 5.0
        focus_mins = 120.0 if prev_sleep > 7.0 else 25.0
        daily_logs.append({"date": d, "mood": 4.0 if sleep > 7 else 2.0, "sleep_hours": float(sleep)})
        focus_sessions.append({"mode": "focus", "duration_minutes": float(focus_mins), "completed_at": f"{d}T14:00:00"})

    insights = engine.discover_insights(daily_logs, focus_sessions, expenses, habits)
    assert len(insights) > 0
    first = insights[0]
    assert "narrative" in first
    assert "p_value" in first

# 7. Test Reflection Generator
def test_reflection_generator():
    generator = ReflectionGenerator()
    res = generator.generate_weekly_reflection(
        username="alex",
        focus_sessions=[{"mode": "focus", "duration_minutes": 50, "completed_at": date.today().isoformat()}],
        tasks=[{"completed": 1, "completed_at": date.today().isoformat()}],
        expenses=[{"type": "expense", "amount": 45.0, "date": date.today().isoformat()}],
        habits=[{"title": "Read", "history": [date.today().isoformat()]}],
        daily_logs=[{"date": date.today().isoformat(), "mood": 4, "sleep_hours": 8.0}],
        monthly_budget=500.0
    )
    assert "reflection" in res
    assert "metrics" in res
    assert res["metrics"]["focus_hours"] > 0

# 8. Test Natural Language Parser Benchmark
def test_nl_task_parser_benchmark():
    parser = NLTaskParser()
    res = parser.parse("finish DBMS report friday 5pm urgent study")
    assert res["priority"] == "urgent"
    assert res["category"] == "study"
    assert "DBMS" in res["title"]

    bench = parser.evaluate_benchmark()
    assert bench["status"] == "passed"
    assert bench["overall_accuracy"] >= 0.85
    assert bench["num_test_sentences"] >= 50

# 9. Test API REST Endpoints
def test_api_ml_endpoints(test_client):
    r_log = test_client.post("/api/auth/login", json={"username_or_email": "alex_student", "password": "password123"})
    assert r_log.status_code == 200
    token = r_log.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 1. Focus recommendation
    r_focus = test_client.get("/api/ml/focus-recommendation", headers=headers)
    assert r_focus.status_code == 200
    assert "recommended_window" in r_focus.json()

    # 2. Task duration
    r_dur = test_client.post(
        "/api/ml/estimate-task-duration",
        json={"title": "Prepare operating systems slides", "category": "study", "priority": "urgent"},
        headers=headers
    )
    assert r_dur.status_code == 200
    assert "predicted_pomodoros" in r_dur.json()

    # 3. Expense categorization
    r_cat = test_client.post("/api/ml/categorize-expense", json={"note": "Cafeteria sandwich"}, headers=headers)
    assert r_cat.status_code == 200
    assert "category" in r_cat.json()

    # 4. Spending forecast
    r_spend = test_client.get("/api/ml/spending-forecast", headers=headers)
    assert r_spend.status_code == 200
    assert "projected_month_end" in r_spend.json()

    # 5. Habit risks
    r_habits = test_client.get("/api/ml/habit-risks", headers=headers)
    assert r_habits.status_code == 200
    assert isinstance(r_habits.json(), list)

    # 6. Cross-module insights
    r_ins = test_client.get("/api/ml/cross-module-insights", headers=headers)
    assert r_ins.status_code == 200
    assert isinstance(r_ins.json(), list)

    # 7. Weekly reflection
    r_ref = test_client.get("/api/ml/weekly-reflection", headers=headers)
    assert r_ref.status_code == 200
    assert "reflection" in r_ref.json()

    # 8. NL Parse task
    r_nl = test_client.post("/api/ml/parse-task", json={"text": "clean room tomorrow low personal"})
    assert r_nl.status_code == 200
    assert r_nl.json()["category"] == "personal"

    # 9. Model transparency
    r_trans = test_client.get("/api/ml/transparency", headers=headers)
    assert r_trans.status_code == 200
    assert "models" in r_trans.json()
    assert len(r_trans.json()["models"]) == 7
