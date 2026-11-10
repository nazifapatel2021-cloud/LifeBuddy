"""
LifeBuddy Machine Learning & Explainable Analytics Package
Per-user models with Bayesian smoothing, scikit-learn pipelines, and rule-based cold-start fallbacks.
"""
from .focus_recommender import FocusRecommender
from .task_duration import TaskDurationEstimator
from .expense_categorizer import ExpenseCategorizer
from .spending_anomaly import SpendingAnomalyDetector
from .habit_risk import HabitRiskPredictor
from .cross_module_insights import CrossModuleInsightEngine
from .reflection_generator import ReflectionGenerator
from .nl_task_parser import NLTaskParser

__all__ = [
    "FocusRecommender",
    "TaskDurationEstimator",
    "ExpenseCategorizer",
    "SpendingAnomalyDetector",
    "HabitRiskPredictor",
    "CrossModuleInsightEngine",
    "ReflectionGenerator",
    "NLTaskParser"
]
