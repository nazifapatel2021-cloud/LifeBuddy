"""
One-command LifeBuddy Demo Data Seeder.
Run: python scripts/seed_demo.py
"""
import sys
import os

try:
    sys.stdout.reconfigure(encoding='utf-8')
except Exception:
    pass

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from scripts.generate_demo_data import generate_data

if __name__ == "__main__":
    print("=" * 60)
    print("  [*] LifeBuddy - Seeding 90 Days x 5 Realistic Personas")
    print("=" * 60)
    generate_data()
    print("=" * 60)
    print("  Demo users created:")
    print("  1. alex_student       (Deep Work Student - 90 days)")
    print("  2. maya_freelancer    (Burnout Freelancer - 90 days)")
    print("  3. sam_habits         (Consistent Habit Builder - 90 days)")
    print("  4. jordan_nightowl    (Night Owl Developer - 90 days)")
    print("  5. taylor_coldstart   (Fresh Cold Start User - 4 days)")
    print("  Password for all: password123")
    print("=" * 60)
