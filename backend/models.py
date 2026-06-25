from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey, DateTime, Text
from sqlalchemy.orm import relationship
from database import Base
import datetime

class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    leads = relationship("Lead", back_populates="project", cascade="all, delete-orphan")

class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"))
    name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    address = Column(String, nullable=True)
    rating = Column(Float, nullable=True)
    reviews_count = Column(Integer, default=0)
    category = Column(String, nullable=True)
    website = Column(String, nullable=True)
    email = Column(String, nullable=True)
    closing_score = Column(Integer, default=0)
    google_maps_url = Column(String, nullable=True)
    is_offline = Column(Boolean, default=True) # Usually True since we target businesses without websites
    scraped_at = Column(DateTime, default=datetime.datetime.utcnow)
    status = Column(String, default="not-called") # not-called, called, interested, closed, not-interested
    notes = Column(Text, nullable=True)
    follow_up_date = Column(DateTime, nullable=True)
    years_in_business = Column(Integer, nullable=True)

    project = relationship("Project", back_populates="leads")

class SearchHistory(Base):
    __tablename__ = "search_history"

    id = Column(Integer, primary_key=True, index=True)
    niche = Column(String, nullable=False)
    location = Column(String, nullable=False)
    results_count = Column(Integer, default=0)
    timestamp = Column(DateTime, default=datetime.datetime.utcnow)
