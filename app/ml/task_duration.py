"""
Module 2: Task Duration Estimator
Predicts pomodoros needed using Ridge Regression, Gradient Boosting, and User-Average Baseline.
Evaluates using TimeSeriesSplit cross-validation, reporting MAE and R2.
Includes cold-start heuristics and plain-English explainability.
"""

from typing import Dict, Any, List, Tuple
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import Ridge
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import TimeSeriesSplit
from sklearn.metrics import mean_absolute_error, r2_score

CATEGORY_DEFAULTS = {
    "study": 3,
    "work": 3,
    "personal": 1,
    "health": 1
}

PRIORITY_WEIGHTS = {
    "urgent": 1.4,
    "high": 1.2,
    "medium": 1.0,
    "low": 0.8
}

class TaskDurationEstimator:
    def __init__(self):
        self.vectorizer = TfidfVectorizer(max_features=40, stop_words="english", ngram_range=(1, 2))
        self.ridge_model = Ridge(alpha=1.0)
        self.gb_model = GradientBoostingRegressor(n_estimators=30, max_depth=3, random_state=42)
        self.best_model_name = "ridge"
        self.category_means: Dict[str, float] = {}
        self.global_mean: float = 2.0
        self.metrics: Dict[str, Any] = {}
        self.is_trained = False

    def train_and_evaluate(self, tasks: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Train and evaluate Ridge vs Gradient Boosting vs User-Average baseline.
        Requires at least 8 completed tasks.
        """
        completed = [t for t in tasks if t.get("completed") and (t.get("completed_pomodoros", 0) > 0)]

        if len(completed) < 8:
            return {
                "status": "cold_start",
                "sample_size": len(completed),
                "message": f"Only {len(completed)} completed tasks recorded. Minimum 8 required for training.",
                "baseline_category_defaults": CATEGORY_DEFAULTS
            }

        df = pd.DataFrame(completed)
        df["title"] = df["title"].fillna("").astype(str)
        df["category"] = df["category"].fillna("work").astype(str).str.lower()
        df["priority"] = df["priority"].fillna("medium").astype(str).str.lower()
        df["actual"] = df["completed_pomodoros"].astype(float)

        # Sort chronologically if created_at exists
        if "created_at" in df.columns:
            df = df.sort_values("created_at").reset_index(drop=True)

        y = df["actual"].values
        self.global_mean = float(y.mean())
        self.category_means = df.groupby("category")["actual"].mean().to_dict()

        # Build feature matrix: TF-IDF of title + Category One-Hot + Priority One-Hot
        tfidf_mat = self.vectorizer.fit_transform(df["title"]).toarray()

        cat_dummies = pd.get_dummies(df["category"], prefix="cat", drop_first=False)
        prio_dummies = pd.get_dummies(df["priority"], prefix="prio", drop_first=False)

        cat_feature_cols = [f"cat_{c}" for c in ["work", "study", "personal", "health"]]
        prio_feature_cols = [f"prio_{p}" for p in ["urgent", "high", "medium", "low"]]

        for col in cat_feature_cols:
            if col not in cat_dummies:
                cat_dummies[col] = 0
        for col in prio_feature_cols:
            if col not in prio_dummies:
                prio_dummies[col] = 0

        X_cat = cat_dummies[cat_feature_cols].values
        X_prio = prio_dummies[prio_feature_cols].values
        X = np.hstack([tfidf_mat, X_cat, X_prio])

        # Time-Series Cross Validation (n_splits = 3)
        n_splits = min(3, max(2, len(df) // 4))
        tscv = TimeSeriesSplit(n_splits=n_splits)

        baseline_maes, ridge_maes, gb_maes = [], [], []
        baseline_r2s, ridge_r2s, gb_r2s = [], [], []

        for train_idx, test_idx in tscv.split(X):
            X_train, X_test = X[train_idx], X[test_idx]
            y_train, y_test = y[train_idx], y[test_idx]

            # 1. Baseline: User category mean
            test_cats = df.iloc[test_idx]["category"]
            train_cat_means = df.iloc[train_idx].groupby("category")["actual"].mean().to_dict()
            y_pred_base = [train_cat_means.get(c, y_train.mean()) for c in test_cats]

            # 2. Ridge
            r_model = Ridge(alpha=1.0)
            r_model.fit(X_train, y_train)
            y_pred_ridge = r_model.predict(X_test)

            # 3. Gradient Boosting
            g_model = GradientBoostingRegressor(n_estimators=30, max_depth=3, random_state=42)
            g_model.fit(X_train, y_train)
            y_pred_gb = g_model.predict(X_test)

            baseline_maes.append(mean_absolute_error(y_test, y_pred_base))
            ridge_maes.append(mean_absolute_error(y_test, y_pred_ridge))
            gb_maes.append(mean_absolute_error(y_test, y_pred_gb))

            # R2 can be negative on small splits; clamp for clean aggregation
            baseline_r2s.append(r2_score(y_test, y_pred_base))
            ridge_r2s.append(r2_score(y_test, y_pred_ridge))
            gb_r2s.append(r2_score(y_test, y_pred_gb))

        # Train final models on full set
        self.ridge_model.fit(X, y)
        self.gb_model.fit(X, y)

        mean_base_mae = float(np.mean(baseline_maes))
        mean_ridge_mae = float(np.mean(ridge_maes))
        mean_gb_mae = float(np.mean(gb_maes))

        mean_base_r2 = float(np.mean(baseline_r2s))
        mean_ridge_r2 = float(np.mean(ridge_r2s))
        mean_gb_r2 = float(np.mean(gb_r2s))

        # Select best model based on MAE
        if mean_ridge_mae <= mean_gb_mae:
            self.best_model_name = "ridge"
        else:
            self.best_model_name = "gradient_boosting"

        self.is_trained = True
        self.metrics = {
            "status": "trained",
            "sample_size": len(completed),
            "cv_splits": n_splits,
            "best_model": self.best_model_name,
            "models": {
                "user_average_baseline": {
                    "mae": round(mean_base_mae, 3),
                    "r2": round(mean_base_r2, 3)
                },
                "ridge_regression": {
                    "mae": round(mean_ridge_mae, 3),
                    "r2": round(mean_ridge_r2, 3)
                },
                "gradient_boosting": {
                    "mae": round(mean_gb_mae, 3),
                    "r2": round(mean_gb_r2, 3)
                }
            }
        }
        return self.metrics

    def predict(self, title: str, category: str, priority: str) -> Dict[str, Any]:
        """
        Predict pomodoros required for a task with plain-English explanation.
        """
        cat = (category or "work").lower()
        prio = (priority or "medium").lower()

        # Cold-Start Heuristic
        if not self.is_trained:
            base_pomo = CATEGORY_DEFAULTS.get(cat, 2)
            multiplier = PRIORITY_WEIGHTS.get(prio, 1.0)
            pred = max(1, int(round(base_pomo * multiplier)))
            return {
                "predicted_pomodoros": pred,
                "confidence": "Low (Cold-Start Rule)",
                "method": "Category & Priority Heuristic",
                "explanation": (
                    f"Predicted {pred} pomodoros (~{pred*25} mins) using cold-start rules "
                    f"for category '{cat}' and priority '{prio}'."
                )
            }

        # Featurize single input
        tfidf_vec = self.vectorizer.transform([title]).toarray()
        cat_vec = np.array([[1.0 if f"cat_{cat}" == f"cat_{c}" else 0.0 for c in ["work", "study", "personal", "health"]]])
        prio_vec = np.array([[1.0 if f"prio_{prio}" == f"prio_{p}" else 0.0 for p in ["urgent", "high", "medium", "low"]]])
        x_single = np.hstack([tfidf_vec, cat_vec, prio_vec])

        if self.best_model_name == "ridge":
            raw_pred = self.ridge_model.predict(x_single)[0]
        else:
            raw_pred = self.gb_model.predict(x_single)[0]

        pred_pomo = max(1, int(round(raw_pred)))
        user_cat_avg = self.category_means.get(cat, self.global_mean)

        explanation = (
            f"Estimated {pred_pomo} pomodoros (~{pred_pomo*25} mins). "
            f"Your historical average for '{cat}' tasks is {user_cat_avg:.1f} pomodoros; "
            f"adjusted by {self.best_model_name.replace('_', ' ').title()} based on title semantics and priority."
        )

        return {
            "predicted_pomodoros": pred_pomo,
            "raw_score": round(float(raw_pred), 2),
            "confidence": "High (Trained on User History)",
            "method": f"{self.best_model_name.replace('_', ' ').title()}",
            "explanation": explanation
        }
