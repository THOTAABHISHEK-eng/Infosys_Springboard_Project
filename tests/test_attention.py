"""Checks for the counting, date, and validation bugs in the attention API."""

from datetime import datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

import backend.database as database
from backend.main import app, strip_url
from backend.ml_engine import MLAttentionEngine
from backend.models import ActivityRecord

engine = create_engine("sqlite:///./test_attention.db", connect_args={"check_same_thread": False})
TestingSession = sessionmaker(autocommit=False, autoflush=False, bind=engine)
database.Base.metadata.create_all(bind=engine)


def override_get_db():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[database.get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_tables():
    db = TestingSession()
    for table in reversed(database.Base.metadata.sorted_tables):
        db.execute(table.delete())
    db.commit()
    db.close()


def test_empty_analysis_does_not_invent_a_score():
    result = MLAttentionEngine().analyze([])
    assert result["status"] == "insufficient_data"
    assert result["attention_score"] is None
    assert result["cluster"] is None


def test_long_productive_session_is_not_labelled_distracted():
    activities = [
        {
            "duration_seconds": 240,
            "is_productive": True,
            "category": "PROGRAMMING",
            "domain": "github.com",
        }
        for _ in range(4)
    ]
    result = MLAttentionEngine().analyze(activities)
    assert result["status"] == "ok"
    assert result["method"] == "nearest_centroid"
    assert result["cluster"]["id"] in {"FLOW", "RESEARCH"}
    assert result["attention_score"] >= 50


def test_enough_domains_uses_kmeans():
    activities = []
    for index in range(8):
        activities.append({
            "duration_seconds": 40 + index,
            "is_productive": index % 2 == 0,
            "category": "OTHER",
            "domain": f"site{index}.example",
        })
    result = MLAttentionEngine().analyze(activities)
    assert result["method"] == "kmeans"
    assert result["segments"]


def test_query_strings_are_not_stored():
    assert strip_url("https://example.com/watch?token=secret&v=1") == "https://example.com/watch"
    response = client.post("/api/activities", json={
        "eventId": "url-1",
        "url": "https://example.com/a?token=secret",
        "domain": "example.com",
        "websiteName": "Example",
        "durationSeconds": 5,
        "isProductive": False,
    })
    assert response.status_code == 200
    db = TestingSession()
    row = db.query(ActivityRecord).filter_by(event_id="url-1").one()
    db.close()
    assert row.url == "https://example.com/a"
    assert "secret" not in row.url


def test_today_endpoint_ignores_older_days():
    db = TestingSession()
    db.add(ActivityRecord(
        event_id="old-day",
        session_id="s",
        domain="old.example",
        website_name="Old",
        duration_seconds=80,
        timestamp=datetime(2020, 1, 1, 12, 0, 0),
    ))
    db.add(ActivityRecord(
        event_id="today-row",
        session_id="s",
        domain="now.example",
        website_name="Now",
        duration_seconds=15,
        timestamp=datetime.now(),
    ))
    db.commit()
    db.close()

    body = client.get("/api/activities/today").json()
    assert body["record_count"] == 1
    assert body["total_seconds"] == 15
    assert "old.example" not in body["category_breakdown"] or body["total_seconds"] == 15


def test_duration_above_one_day_is_rejected():
    response = client.post("/api/activities", json={
        "eventId": "too-long",
        "durationSeconds": 200000,
        "domain": "example.com",
    })
    assert response.status_code == 422


def test_clear_requires_confirmation_header():
    denied = client.delete("/api/data/clear")
    assert denied.status_code == 400
    client.post("/api/activities", json={"eventId": "keep", "durationSeconds": 3, "domain": "example.com"})
    allowed = client.delete("/api/data/clear", headers={"X-Confirm-Clear": "yes"})
    assert allowed.status_code == 200
    assert client.get("/api/activities/today").json()["record_count"] == 0


def test_focus_session_keeps_the_callers_times():
    response = client.post("/api/focus/session", json={
        "id": "focus-1",
        "goal": "Read",
        "elapsedSeconds": 60,
        "startTime": "2026-11-12T10:00:00",
        "endTime": "2026-11-12T10:25:00",
    })
    assert response.status_code == 200
    history = client.get("/api/focus/history").json()
    saved = next(item for item in history if item["id"] == "focus-1")
    assert saved["start_time"].startswith("2026-11-12T10:00:00")
    assert saved["end_time"].startswith("2026-11-12T10:25:00")
    assert saved["actual_duration_seconds"] == 60


def test_health_endpoint_returns_healthy():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_category_override_save_and_list():
    response = client.post("/api/settings/override", json={
        "domain": "example.com",
        "category": "EDUCATION",
        "isProductive": True,
    })
    assert response.status_code == 200
    assert response.json()["status"] == "saved"


def test_distraction_log_and_retrieve():
    client.post("/api/distractions", json={
        "type": "RAPID_BOUNCE",
        "severity": "HIGH",
        "title": "Test distraction",
        "description": "desc",
        "domain": "youtube.com",
    })
    events = client.get("/api/distractions?limit=5").json()
    assert any(e["title"] == "Test distraction" for e in events)


def test_duration_negative_is_rejected():
    response = client.post("/api/activities", json={
        "eventId": "neg-dur",
        "durationSeconds": -5,
        "domain": "example.com",
    })
    assert response.status_code == 422


def test_analyze_returns_insufficient_data_when_empty():
    result = MLAttentionEngine().analyze([])
    assert result["status"] == "insufficient_data"
    assert result["attention_score"] is None
