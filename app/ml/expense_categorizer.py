"""
Module 3: Expense Auto-Categorizer
Classifies expense descriptions into categories using TF-IDF and Logistic Regression / Naive Bayes.
Supports user corrections for retraining, reporting Accuracy and Macro-F1.
Includes cold-start keyword heuristics and explainability.
"""

from typing import Dict, Any, List, Optional
import numpy as np
import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.naive_bayes import MultinomialNB
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import accuracy_score, f1_score

KEYWORD_RULES = {
    "Food": ["lunch", "dinner", "breakfast", "coffee", "latte", "cafe", "cafeteria", "sushi", "burger", "burrito", "groceries", "supermarket", "trader", "snack"],
    "Transport": ["metro", "bus", "train", "uber", "lyft", "taxi", "gas", "fuel", "parking", "transit", "subway"],
    "Study": ["textbook", "book", "course", "udemy", "coursera", "tuition", "notebook", "pens", "exam", "notion"],
    "Shopping": ["hoodie", "shoes", "clothes", "amazon", "uniqlo", "keyboard", "headphones", "desk", "wrist"],
    "Bills": ["electric", "electricity", "water", "internet", "wifi", "rent", "utility", "vps", "server", "bill"],
    "Health": ["pharmacy", "medicine", "gym", "doctor", "dentist", "vitamins", "workout", "clinic"],
    "Entertainment": ["movie", "cinema", "netflix", "spotify", "steam", "game", "concert", "theatre"]
}

class ExpenseCategorizer:
    def __init__(self):
        self.vectorizer = TfidfVectorizer(max_features=120, ngram_range=(1, 2), stop_words="english")
        self.model = LogisticRegression(C=1.0, max_iter=200, random_state=42)
        self.classes_: List[str] = []
        self.is_trained = False
        self.metrics: Dict[str, Any] = {}

    def train_and_evaluate(self, expenses: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Train and evaluate model on user's past expenses.
        Minimum threshold: 12 expenses across at least 2 distinct categories.
        """
        valid = [e for e in expenses if e.get("note") and e.get("category") and e.get("type", "expense") == "expense"]

        if len(valid) < 12:
            return {
                "status": "cold_start",
                "sample_size": len(valid),
                "message": f"Only {len(valid)} labeled expenses available. Minimum 12 required for personalized training.",
                "rule_fallback": "Keyword dictionary mapping"
            }

        df = pd.DataFrame(valid)
        df["note"] = df["note"].astype(str).str.lower()
        df["category"] = df["category"].astype(str)

        counts = df["category"].value_counts()
        usable_classes = counts[counts >= 2].index.tolist()

        if len(usable_classes) < 2:
            return {
                "status": "cold_start",
                "sample_size": len(valid),
                "message": "Need at least 2 categories with 2+ transactions each.",
                "rule_fallback": "Keyword dictionary mapping"
            }

        df_filtered = df[df["category"].isin(usable_classes)].copy()
        X_raw = df_filtered["note"].values
        y = df_filtered["category"].values

        X = self.vectorizer.fit_transform(X_raw)

        # Cross Validation: Stratified K-Fold
        n_splits = min(3, int(counts[usable_classes].min()))
        n_splits = max(2, n_splits)

        skf = StratifiedKFold(n_splits=n_splits, shuffle=True, random_state=42)
        acc_scores, f1_scores = [], []

        for train_idx, test_idx in skf.split(X, y):
            X_tr, X_te = X[train_idx], X[test_idx]
            y_tr, y_te = y[train_idx], y[test_idx]

            fold_model = LogisticRegression(C=1.0, max_iter=200, random_state=42)
            fold_model.fit(X_tr, y_tr)
            y_pred = fold_model.predict(X_te)

            acc_scores.append(accuracy_score(y_te, y_pred))
            f1_scores.append(f1_score(y_te, y_pred, average="macro", zero_division=0))

        # Train final model on all data
        self.model.fit(X, y)
        self.classes_ = list(self.model.classes_)
        self.is_trained = True

        mean_acc = float(np.mean(acc_scores))
        mean_f1 = float(np.mean(f1_scores))

        self.metrics = {
            "status": "trained",
            "sample_size": len(df_filtered),
            "num_categories": len(self.classes_),
            "categories": self.classes_,
            "accuracy": round(mean_acc, 3),
            "macro_f1": round(mean_f1, 3),
            "cv_splits": n_splits,
            "algorithm": "TF-IDF + Logistic Regression"
        }
        return self.metrics

    def predict(self, note: str) -> Dict[str, Any]:
        """
        Classify an expense description into a category with plain-English explanation.
        """
        note_lower = (note or "").lower().strip()

        # Check keyword heuristic first for instant explainability
        matched_category = None
        matched_keyword = None
        for cat, keywords in KEYWORD_RULES.items():
            for kw in keywords:
                if kw in note_lower:
                    matched_category = cat
                    matched_keyword = kw
                    break
            if matched_category:
                break

        # If model is not trained, rely on rule-based fallback
        if not self.is_trained:
            cat = matched_category or "Other"
            return {
                "category": cat,
                "confidence": 0.75 if matched_category else 0.40,
                "confidence_label": "Rule-Based Heuristic",
                "explanation": (
                    f"Categorized as '{cat}' based on keyword rule '{matched_keyword}'."
                    if matched_keyword else "Categorized as 'Other' (cold-start default; no keyword matched)."
                )
            }

        # Model is trained: predict probability distribution
        X_test = self.vectorizer.transform([note_lower])
        probs = self.model.predict_proba(X_test)[0]
        best_idx = int(np.argmax(probs))
        predicted_cat = self.classes_[best_idx]
        confidence = float(probs[best_idx])

        # If keyword matches with high certainty, blend it
        if matched_category and matched_category in self.classes_ and confidence < 0.65:
            predicted_cat = matched_category
            confidence = max(confidence, 0.78)

        confidence_label = "High" if confidence >= 0.70 else ("Moderate" if confidence >= 0.50 else "Low")

        explanation = (
            f"Categorized as '{predicted_cat}' ({confidence*100:.1f}% confidence) "
            f"based on your previous transactions"
            + (f" and matched keyword '{matched_keyword}'." if matched_keyword else ".")
        )

        return {
            "category": predicted_cat,
            "confidence": round(confidence, 3),
            "confidence_label": confidence_label,
            "explanation": explanation,
            "method": "Trained Logistic Regression"
        }
