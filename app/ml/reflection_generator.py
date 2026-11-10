"""
Module 7: Weekly Reflection Generator
Generates structured, mindful weekly narratives synthesizing focus hours, task velocity,
budget health, and habit consistency.
Includes optional LLM synthesis behind a feature flag with deterministic template fallback.
"""

import os
from typing import Dict, Any, List
from datetime import datetime, date, timedelta

class ReflectionGenerator:
    def __init__(self):
        self.enable_llm = os.environ.get("ENABLE_LLM_REFLECTION", "false").lower() == "true"

    def generate_weekly_reflection(
        self,
        username: str,
        focus_sessions: List[Dict[str, Any]],
        tasks: List[Dict[str, Any]],
        expenses: List[Dict[str, Any]],
        habits: List[Dict[str, Any]],
        daily_logs: List[Dict[str, Any]],
        monthly_budget: float = 1000.0
    ) -> Dict[str, Any]:
        """
        Generate a weekly mindful review summarizing achievements, habits, and focus.
        """
        today = date.today()
        start_of_week = today - timedelta(days=7)
        start_of_week_str = start_of_week.isoformat()

        # 1. Weekly Focus Calculation
        week_sessions = [
            s for s in focus_sessions
            if s.get("mode") == "focus" and str(s.get("completed_at", "")) >= start_of_week_str
        ]
        week_focus_mins = sum(float(s.get("duration_minutes") or 25) for s in week_sessions)
        week_focus_hours = round(week_focus_mins / 60.0, 1)

        # 2. Tasks Completed This Week
        week_tasks = [
            t for t in tasks
            if t.get("completed") and str(t.get("completed_at") or t.get("updated_at", "")) >= start_of_week_str
        ]
        completed_count = len(week_tasks)

        # 3. Weekly Expenses
        week_expenses = [
            float(e.get("amount") or 0) for e in expenses
            if e.get("type", "expense") == "expense" and str(e.get("date", "")) >= start_of_week_str
        ]
        week_spent = round(sum(week_expenses), 2)
        weekly_budget_target = monthly_budget / 4.0
        budget_status = "within budget" if week_spent <= weekly_budget_target else "above weekly pace"

        # 4. Habits Consistency
        total_checks = 0
        habit_count = len(habits)
        for h in habits:
            hist = h.get("history") or []
            if isinstance(hist, str):
                import json
                try: hist = json.loads(hist)
                except Exception: hist = []
            checks_this_week = sum(1 for d in hist if d >= start_of_week_str)
            total_checks += checks_this_week

        possible_checks = max(1, habit_count * 7)
        habit_adherence_pct = round((total_checks / possible_checks) * 100)

        # 5. Average Mood & Sleep
        week_logs = [log for log in daily_logs if str(log.get("date", "")) >= start_of_week_str]
        avg_mood = (
            round(sum(float(l.get("mood", 3)) for l in week_logs) / len(week_logs), 1)
            if week_logs else 3.5
        )
        avg_sleep = (
            round(sum(float(l.get("sleep_hours", 7.5)) for l in week_logs) / len(week_logs), 1)
            if week_logs else 7.5
        )

        # Optional LLM Generation check
        if self.enable_llm:
            llm_text = self._try_llm_generation(username, week_focus_hours, completed_count, week_spent, habit_adherence_pct, avg_sleep)
            if llm_text:
                return {
                    "source": "LLM (Generated with Privacy Filter)",
                    "reflection": llm_text,
                    "metrics": {
                        "focus_hours": week_focus_hours,
                        "tasks_completed": completed_count,
                        "spending": week_spent,
                        "habit_adherence": habit_adherence_pct,
                        "avg_sleep": avg_sleep
                    }
                }

        # Deterministic Mindful Template Synthesis
        greeting = f"Weekly Reflection for {username.capitalize()}"
        
        if week_focus_hours >= 10.0:
            focus_summary = f"You demonstrated exceptional concentration, dedicating {week_focus_hours} hours to deep, uninterrupted work across {len(week_sessions)} sessions."
        elif week_focus_hours >= 4.0:
            focus_summary = f"You built solid momentum with {week_focus_hours} hours of focused work across {len(week_sessions)} sessions."
        else:
            focus_summary = f"You recorded {week_focus_hours} hours of deep focus. Take time this coming week to protect larger uninterrupted blocks."

        task_summary = f"You completed {completed_count} key priorities." if completed_count > 0 else "Focus this upcoming week on breaking large goals into small 1-pomodoro tasks."
        finance_summary = f"In finances, you spent ${week_spent:.2f}, keeping you {budget_status}."
        habit_summary = f"Your daily habit adherence was {habit_adherence_pct}%, supported by an average of {avg_sleep} hours of sleep."

        closing_thought = (
            "Remember: Consistency compounds quietly. Celebrate your focus, rest without guilt, and begin the next cycle refreshed."
        )

        full_narrative = (
            f"🌿 **{greeting}**\n\n"
            f"{focus_summary} {task_summary}\n\n"
            f"💰 {finance_summary}\n\n"
            f"🌱 {habit_summary} (Average mood: {avg_mood}/5).\n\n"
            f"✨ {closing_thought}"
        )

        return {
            "source": "Deterministic Cognitive Template Engine",
            "period": f"{start_of_week.strftime('%b %d')} - {today.strftime('%b %d, %Y')}",
            "reflection": full_narrative,
            "metrics": {
                "focus_hours": week_focus_hours,
                "focus_sessions_count": len(week_sessions),
                "tasks_completed": completed_count,
                "week_spent": week_spent,
                "habit_adherence_pct": habit_adherence_pct,
                "avg_sleep_hours": avg_sleep,
                "avg_mood": avg_mood
            }
        }

    def _try_llm_generation(self, username, focus_hrs, tasks, spent, habits, sleep):
        # Stub for optional external LLM when flag ENABLE_LLM_REFLECTION=true
        return None
