"""
FastAPI Main Application Server
AI-Powered Digital Attention Management System REST API
"""

from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Dict, Any, Optional
from datetime import datetime, date

from .database import engine, get_db, Base
from .models import ActivityRecord, FocusSession, DistractionEvent, CategoryOverride
from .ml_engine import MLAttentionEngine

# Create database tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="AI Digital Attention Management System API",
    description="REST backend for browsing activity logging, distraction detection, and ML behavioural analytics.",
    version="2.0.0"
)

# Enable CORS for browser access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ml_engine = MLAttentionEngine()

@app.get("/api/health")
def health_check():
    return {
        "status": "healthy",
        "service": "Attention Management API",
        "timestamp": datetime.utcnow().isoformat()
    }

@app.post("/api/activities")
def create_activity(data: Dict[str, Any], db: Session = Depends(get_db)):
    """
    Ingests activity records from Browser Extension or Web Dashboard
    """
    event_id = data.get("eventId") or data.get("event_id") or f"evt_{int(datetime.utcnow().timestamp())}"
    
    # Check if duplicate
    existing = db.query(ActivityRecord).filter(ActivityRecord.event_id == event_id).first()
    if existing:
        return {"status": "exists", "id": existing.id}

    record = ActivityRecord(
        event_id=event_id,
        session_id=data.get("sessionId") or data.get("session_id", "default_session"),
        browser_name=data.get("browserName") or data.get("browser_name", "Google Chrome"),
        tab_id=data.get("tabId") or data.get("tab_id", 1),
        website_name=data.get("websiteName") or data.get("website_name", "Unknown"),
        domain=data.get("domain", "unknown"),
        url=data.get("url", ""),
        event_type=data.get("eventType") or data.get("event_type", "TAB_DWELL"),
        category=data.get("category", "OTHER"),
        is_productive=data.get("isProductive") if "isProductive" in data else data.get("is_productive", True),
        duration_seconds=data.get("durationSeconds") or data.get("duration_seconds", 1),
        timestamp=datetime.utcnow()
    )

    db.add(record)
    db.commit()
    db.refresh(record)
    return {"status": "created", "id": record.id, "event_id": record.event_id}

@app.get("/api/activities/today")
def get_today_activities(db: Session = Depends(get_db)):
    """
    Aggregated telemetry for the current calendar day
    """
    records = db.query(ActivityRecord).all()
    total_seconds = sum(r.duration_seconds for r in records)
    total_switches = len(records)
    unique_domains = len(set(r.domain for r in records))

    category_breakdown = {}
    for r in records:
        cat = r.category or "OTHER"
        category_breakdown[cat] = category_breakdown.get(cat, 0) + r.duration_seconds

    return {
        "total_seconds": total_seconds,
        "total_switches": total_switches,
        "unique_domains": unique_domains,
        "category_breakdown": category_breakdown,
        "record_count": len(records)
    }

@app.post("/api/focus/session")
def save_focus_session(data: Dict[str, Any], db: Session = Depends(get_db)):
    session_id = data.get("id") or f"focus_{int(datetime.utcnow().timestamp())}"
    
    session = FocusSession(
        session_id=session_id,
        goal=data.get("goal", "Deep Focus"),
        target_duration_minutes=data.get("targetDurationMinutes", 25),
        actual_duration_seconds=data.get("elapsedSeconds", 0),
        interruptions_count=data.get("interruptions", 0),
        focus_score=data.get("focusScore", 100.0),
        status=data.get("status", "COMPLETED"),
        start_time=datetime.utcnow(),
        end_time=datetime.utcnow()
    )

    db.add(session)
    db.commit()
    db.refresh(session)
    return {"status": "saved", "session_id": session.session_id}

@app.get("/api/focus/history")
def get_focus_history(db: Session = Depends(get_db)):
    sessions = db.query(FocusSession).order_by(FocusSession.start_time.desc()).limit(20).all()
    return [{
        "id": s.session_id,
        "goal": s.goal,
        "target_duration_minutes": s.target_duration_minutes,
        "actual_duration_seconds": s.actual_duration_seconds,
        "interruptions": s.interruptions_count,
        "focus_score": s.focus_score,
        "status": s.status,
        "start_time": s.start_time.isoformat()
    } for s in sessions]

@app.post("/api/distractions")
def log_distraction(data: Dict[str, Any], db: Session = Depends(get_db)):
    event = DistractionEvent(
        event_type=data.get("type", "RAPID_BOUNCE"),
        severity=data.get("severity", "MEDIUM"),
        title=data.get("title", "Distraction Incident"),
        description=data.get("description", ""),
        domain=data.get("domain", ""),
        timestamp=datetime.utcnow()
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return {"status": "logged", "id": event.id}

@app.get("/api/distractions")
def get_distractions(limit: int = 20, db: Session = Depends(get_db)):
    events = db.query(DistractionEvent).order_by(DistractionEvent.timestamp.desc()).limit(limit).all()
    return [{
        "id": e.id,
        "type": e.event_type,
        "severity": e.severity,
        "title": e.title,
        "description": e.description,
        "domain": e.domain,
        "timestamp": e.timestamp.isoformat()
    } for e in events]

@app.get("/api/ml/analyze")
def run_ml_analysis(db: Session = Depends(get_db)):
    """
    Executes K-Means behavioral clustering on real stored activity records
    """
    records = db.query(ActivityRecord).all()
    activity_dicts = [{
        "duration_seconds": r.duration_seconds,
        "is_productive": r.is_productive,
        "category": r.category,
        "domain": r.domain
    } for r in records]

    analysis = ml_engine.analyze(activity_dicts)
    return analysis

@app.post("/api/settings/override")
def set_category_override(data: Dict[str, Any], db: Session = Depends(get_db)):
    domain = data.get("domain", "").strip().lower()
    if not domain:
        raise HTTPException(status_code=400, detail="Domain required")

    existing = db.query(CategoryOverride).filter(CategoryOverride.domain == domain).first()
    if existing:
        existing.category = data.get("category", "OTHER")
        existing.is_productive = data.get("isProductive", True)
    else:
        new_override = CategoryOverride(
            domain=domain,
            category=data.get("category", "OTHER"),
            is_productive=data.get("isProductive", True)
        )
        db.add(new_override)

    db.commit()
    return {"status": "saved", "domain": domain}

@app.delete("/api/data/clear")
def clear_all_data(db: Session = Depends(get_db)):
    db.query(ActivityRecord).delete()
    db.query(FocusSession).delete()
    db.query(DistractionEvent).delete()
    db.commit()
    return {"status": "cleared", "message": "All database records have been wiped."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="127.0.0.1", port=8000, reload=True)

