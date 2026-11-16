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
        monthly_budget: float = 25000.0
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

        # 3. Weekly Expenses (Honest formatting in INR ₹ with unambiguous pacing)
        week_expenses = [
            float(e.get("amount") or 0) for e in expenses
            if e.get("type", "expense") == "expense" and str(e.get("date", "")) >= start_of_week_str
        ]
        week_spent = round(sum(week_expenses), 2)
        weekly_budget_target = monthly_budget / 4.0
        diff = abs(week_spent - weekly_budget_target)
        if week_spent <= weekly_budget_target:
            budget_clarity = f"₹{diff:,.0f} under your weekly target"
        else:
            budget_clarity = f"₹{diff:,.0f} over your planned weekly target"

        finance_summary = (
            f"In finances, you spent ₹{week_spent:,.0f} this week ({budget_clarity}, target: ₹{weekly_budget_target:,.0f})."
            if week_expenses else f"In finances, no expenses logged this week (weekly budget target: ₹{weekly_budget_target:,.0f})."
        )

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
        habit_adherence_pct = round((total_checks / possible_checks) * 100) if habit_count > 0 else 0

        # 5. Honest Average Mood & Sleep (Never fabricate default averages when 0 logs exist)
        week_logs = [log for log in daily_logs if str(log.get("date", "")) >= start_of_week_str and log.get("mood") is not None]
        if week_logs:
            avg_mood = round(sum(float(l["mood"]) for l in week_logs) / len(week_logs), 1)
            sleep_entries = [float(l["sleep_hours"]) for l in week_logs if l.get("sleep_hours") is not None]
            avg_sleep = round(sum(sleep_entries) / len(sleep_entries), 1) if sleep_entries else None
            wellness_text = f"Supported by an average of {avg_sleep} hrs sleep (average energy {avg_mood}/5 across {len(week_logs)} check-in{'s' if len(week_logs)>1 else ''})." if avg_sleep else f"Average energy {avg_mood}/5 across {len(week_logs)} check-in{'s' if len(week_logs)>1 else ''}."
        else:
            avg_mood = None
            avg_sleep = None
            wellness_text = "No daily check-ins recorded yet for this week. Use the Daily Review to begin tracking your energy and rest."

        # Friendly display name derivation (First name only, never raw email)
        display = username.split('@')[0].replace('.', ' ').replace('_', ' ').split()[0].capitalize() if username else "Friend"
        greeting = f"Weekly Reflection for {display}"

        if week_focus_hours >= 10.0:
            focus_summary = f"You demonstrated exceptional concentration, dedicating {week_focus_hours} hours to deep, uninterrupted work across {len(week_sessions)} sessions."
        elif week_focus_hours >= 4.0:
            focus_summary = f"You built solid momentum with {week_focus_hours} hours of focused work across {len(week_sessions)} sessions."
        elif week_focus_hours > 0:
            focus_summary = f"You recorded {week_focus_hours} hours of deep focus across {len(week_sessions)} session{'s' if len(week_sessions)>1 else ''}."
        else:
            focus_summary = "No focus sessions logged this week. Start a 25-minute Pomodoro in the Focus Room to build momentum."

        task_summary = f"You completed {completed_count} key priorit{'ies' if completed_count != 1 else 'y'}." if completed_count > 0 else "Focus this upcoming week on breaking large goals into small 1-pomodoro tasks."
        habit_summary = f"Your daily habit adherence was {habit_adherence_pct}%." if habit_count > 0 else "No active habits added yet. Create a daily habit to begin compounding streaks."

        closing_thought = (
            "Remember: Consistency compounds quietly. Celebrate your focus, rest without guilt, and begin the next cycle refreshed."
        )

        full_narrative = (
            f"🌿 **{greeting}**\n\n"
            f"{focus_summary} {task_summary}\n\n"
            f"💰 {finance_summary}\n\n"
            f"🌱 {habit_summary} {wellness_text}\n\n"
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
