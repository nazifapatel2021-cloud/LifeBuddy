import pytest
import time
import concurrent.futures
from fastapi.testclient import TestClient
from backend.main import app

def test_concurrent_read_write_50_users():
    """Verify that backend handles 50 concurrent requests across tasks, dashboard, and ML endpoints."""
    client = TestClient(app)

    # 1. Verify health endpoint
    health = client.get("/api/health")
    assert health.status_code == 200
    assert health.json()["database"] == "connected"

    # 2. Register/login test user
    uid = f"concurrent_{int(time.time()*1000)}"
    reg_res = client.post("/api/auth/register", json={
        "username": uid,
        "email": f"{uid}@example.com",
        "password": "Password123!"
    })
    assert reg_res.status_code == 200
    token = reg_res.json()["token"]
    headers = {"Authorization": f"Bearer {token}"}

    def make_concurrent_request(i):
        endpoint_type = i % 4
        if endpoint_type == 0:
            res = client.get("/api/dashboard", headers=headers)
            return res.status_code == 200
        elif endpoint_type == 1:
            res = client.get("/api/tasks", headers=headers)
            return res.status_code == 200
        elif endpoint_type == 2:
            res = client.get("/api/ml/focus-recommendation", headers=headers)
            return res.status_code == 200
        else:
            res = client.post("/api/tasks", headers=headers, json={
                "title": f"Concurrent task {i}",
                "category": "study",
                "priority": "medium",
                "estimated_pomodoros": 1
            })
            return res.status_code == 200

    # Execute 50 concurrent requests simultaneously using 10 worker threads
    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        results = list(executor.map(make_concurrent_request, range(50)))

    assert all(results), "All 50 concurrent requests across reads, writes, and ML must succeed"
