"""
SQLAlchemy ORM Data Models for Attention Management
"""

from sqlalchemy import Column, Integer, String, Boolean, Float, DateTime, Text
from datetime import datetime
from .database import Base

class ActivityRecord(Base):
    __tablename__ = "activity_records"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(String(100), unique=True, index=True)
    session_id = Column(String(100), index=True)
    browser_name = Column(String(50), default="Google Chrome")
    tab_id = Column(Integer, default=1)
    website_name = Column(String(200))
    domain = Column(String(150), index=True)
    url = Column(Text)
    event_type = Column(String(50), default="TAB_DWELL")
    category = Column(String(50), index=True)
    is_productive = Column(Boolean, default=True)
    duration_seconds = Column(Integer, default=1)
    timestamp = Column(DateTime, default=datetime.utcnow)

class FocusSession(Base):
    __tablename__ = "focus_sessions"

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(String(100), unique=True, index=True)
    goal = Column(String(255))
    target_duration_minutes = Column(Integer, default=25)
    actual_duration_seconds = Column(Integer, default=0)
    interruptions_count = Column(Integer, default=0)
    focus_score = Column(Float, default=100.0)
    status = Column(String(50), default="COMPLETED") # COMPLETED, INTERRUPTED, IN_PROGRESS
    start_time = Column(DateTime, default=datetime.utcnow)
    end_time = Column(DateTime, nullable=True)

class DistractionEvent(Base):
    __tablename__ = "distraction_events"

    id = Column(Integer, primary_key=True, index=True)
    event_type = Column(String(100)) # RAPID_BOUNCE, FOCUS_VIOLATION, EXCESSIVE_SWITCH, PROLONGED_DISTRACTION
    severity = Column(String(20)) # LOW, MEDIUM, HIGH
    title = Column(String(200))
    description = Column(Text)
    domain = Column(String(150))
    timestamp = Column(DateTime, default=datetime.utcnow)

class CategoryOverride(Base):
    __tablename__ = "category_overrides"

    id = Column(Integer, primary_key=True, index=True)
    domain = Column(String(150), unique=True, index=True)
    category = Column(String(50))
    is_productive = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

