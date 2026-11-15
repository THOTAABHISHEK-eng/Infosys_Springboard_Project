"""Request bodies for the attention API. Unknown fields are rejected."""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class ActivityIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    event_id: Optional[str] = Field(default=None, alias="eventId")
    session_id: str = Field(default="default_session", alias="sessionId", max_length=100)
    browser_name: str = Field(default="Unknown", alias="browserName", max_length=50)
    tab_id: int = Field(default=0, alias="tabId")
    website_name: str = Field(default="Unknown", alias="websiteName", max_length=200)
    domain: str = Field(default="unknown", max_length=150)
    url: str = Field(default="", max_length=4000)
    event_type: str = Field(default="TAB_DWELL", alias="eventType", max_length=50)
    category: str = Field(default="OTHER", max_length=50)
    is_productive: bool = Field(default=False, alias="isProductive")
    duration_seconds: int = Field(default=0, alias="durationSeconds", ge=0, le=86400)


class FocusSessionIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    id: Optional[str] = None
    goal: str = Field(default="Deep Focus", max_length=255)
    target_duration_minutes: int = Field(default=25, alias="targetDurationMinutes", ge=1, le=480)
    elapsed_seconds: int = Field(default=0, alias="elapsedSeconds", ge=0, le=86400)
    interruptions: int = Field(default=0, ge=0, le=10000)
    focus_score: float = Field(default=100.0, alias="focusScore", ge=0, le=100)
    status: str = Field(default="COMPLETED", max_length=50)
    start_time: Optional[datetime] = Field(default=None, alias="startTime")
    end_time: Optional[datetime] = Field(default=None, alias="endTime")


class DistractionIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    type: str = Field(default="RAPID_BOUNCE", max_length=100)
    severity: str = Field(default="MEDIUM", max_length=20)
    title: str = Field(default="Distraction Incident", max_length=200)
    description: str = Field(default="", max_length=2000)
    domain: str = Field(default="", max_length=150)


class CategoryOverrideIn(BaseModel):
    model_config = ConfigDict(populate_by_name=True, extra="ignore")

    domain: str = Field(min_length=1, max_length=150)
    category: str = Field(default="OTHER", max_length=50)
    is_productive: bool = Field(default=False, alias="isProductive")
