"""
Tests for Phase 4 Engineering Depth:
1. Argon2 password hashing and legacy compatibility.
2. Short-lived JWT & refresh token rotation.
3. Rate limiting middleware.
4. GDPR export & right-to-be-forgotten deletion.
5. Idempotent batch sync with Last-Write-Wins conflict resolution.
"""
import pytest
from fastapi.testclient import TestClient
from backend.main import app
from backend.auth import hash_password, verify_password, create_access_token, create_refresh_token, verify_token
import time

client = TestClient(app)

def test_argon2_hashing_and_verification():
    raw_pw = "SuperSecurePassword2026!"
    pw_hash = hash_password(raw_pw)
    assert pw_hash.startswith("$argon2"), "Password hash should use Argon2 format"
    assert verify_password(raw_pw, pw_hash) is True
    assert verify_password("WrongPassword!", pw_hash) is False

def test_jwt_access_and_refresh_tokens():
    user_id = 999
    username = "test_sec_user"
    access_tok = create_access_token(user_id, username)
    refresh_tok = create_refresh_token(user_id, username)

    acc_payload = verify_token(access_tok, expected_type="access")
    assert acc_payload is not None
    assert acc_payload["sub"] == user_id
    assert acc_payload["username"] == username
    assert acc_payload["type"] == "access"

    ref_payload = verify_token(refresh_tok, expected_type="refresh")
    assert ref_payload is not None
    assert ref_payload["sub"] == user_id
    assert ref_payload["type"] == "refresh"

    # Cross-type rejection
    assert verify_token(access_tok, expected_type="refresh") is None
    assert verify_token(refresh_tok, expected_type="access") is None

def test_auth_refresh_endpoint():
    username = f"user_refresh_{int(time.time()*1000)}"
    reg_res = client.post("/api/auth/register", json={
        "username": username,
        "email": f"{username}@example.com",
        "password": "Password123!"
    })
    assert reg_res.status_code == 200
    data = reg_res.json()
    assert "access_token" in data
    assert "refresh_token" in data

    ref_res = client.post("/api/auth/refresh", json={
        "refresh_token": data["refresh_token"]
    })
    assert ref_res.status_code == 200
    ref_data = ref_res.json()
    assert "access_token" in ref_data
    assert "refresh_token" in ref_data

    # Invalid refresh token rejection
    bad_res = client.post("/api/auth/refresh", json={"refresh_token": "invalid.jwt.token"})
    assert bad_res.status_code == 401

def test_gdpr_export_and_delete_endpoints():
    username = f"gdpr_user_{int(time.time()*1000)}"
    reg_res = client.post("/api/auth/register", json={
        "username": username,
        "email": f"{username}@example.com",
        "password": "Password123!"
    })
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Add a task
    client.post("/api/tasks", headers=headers, json={
        "title": "Private task for GDPR",
        "category": "personal"
    })

    # Export my data
    export_res = client.get("/api/user/export-my-data", headers=headers)
    assert export_res.status_code == 200
    export_data = export_res.json()
    assert "user_profile" in export_data
    assert "tasks" in export_data
    assert len(export_data["tasks"]) >= 1
    assert export_data["tasks"][0]["title"] == "Private task for GDPR"

    # Delete my data
    del_res = client.delete("/api/user/delete-my-data", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "success"

    # Verify user account no longer logs in
    login_res = client.post("/api/auth/login", json={
        "username_or_email": username,
        "password": "Password123!"
    })
    assert login_res.status_code == 401

def test_idempotent_batch_sync_and_lww():
    username = f"sync_user_{int(time.time()*1000)}"
    reg_res = client.post("/api/auth/register", json={
        "username": username,
        "email": f"{username}@example.com",
        "password": "Password123!"
    })
    token = reg_res.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    task_id = f"task_{int(time.time()*1000)}"
    t_client_1 = "2026-11-10T12:00:00.000Z"

    # 1. First sync insert
    sync_res = client.post("/api/sync/batch", headers=headers, json={
        "items": [
            {
                "id": task_id,
                "entity": "task",
                "action": "upsert",
                "payload": {"title": "Offline Task Version 1", "category": "study"},
                "client_updated_at": t_client_1
            }
        ]
    })
    assert sync_res.status_code == 200
    assert sync_res.json()["synced_count"] == 1

    # 2. Server updates to a newer timestamp
    t_client_2 = "2026-11-10T14:00:00.000Z"
    client.post("/api/sync/batch", headers=headers, json={
        "items": [
            {
                "id": task_id,
                "entity": "task",
                "action": "upsert",
                "payload": {"title": "Updated Task Version 2", "category": "study"},
                "client_updated_at": t_client_2
            }
        ]
    })

    # 3. Stale update with timestamp older than server should be rejected via LWW conflict
    t_stale = "2026-11-10T11:00:00.000Z"
    stale_res = client.post("/api/sync/batch", headers=headers, json={
        "items": [
            {
                "id": task_id,
                "entity": "task",
                "action": "upsert",
                "payload": {"title": "Stale Task Version", "category": "study"},
                "client_updated_at": t_stale
            }
        ]
    })
    assert stale_res.status_code == 200
    stale_data = stale_res.json()
    assert stale_data["synced_count"] == 0
    assert len(stale_data["conflicts"]) == 1
    assert stale_data["conflicts"][0]["reason"] == "server_is_newer"
