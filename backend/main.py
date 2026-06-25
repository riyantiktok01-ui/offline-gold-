from fastapi import FastAPI, Depends, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
import models
from database import engine, get_db
from scraper import scrape_google_maps
from email_finder import find_business_email
import datetime
import io
import csv
import asyncio
import os

# Create database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="OfflineGold API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify the actual frontend origin
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Pydantic Models
class SearchRequest(BaseModel):
    niche: str
    location: str
    limit: Optional[int] = 50
    project_id: Optional[int] = None

class ProjectCreate(BaseModel):
    name: str
    description: Optional[str] = None

class LeadUpdate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    follow_up_date: Optional[datetime.datetime] = None

@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "OfflineGold Backend"}

# Projects Endpoints
@app.get("/api/projects")
def list_projects(db: Session = Depends(get_db)):
    return db.query(models.Project).all()

@app.post("/api/projects")
def create_project(project: ProjectCreate, db: Session = Depends(get_db)):
    db_project = models.Project(name=project.name, description=project.description)
    db.add(db_project)
    db.commit()
    db.refresh(db_project)
    return db_project

@app.get("/api/projects/{id}")
def get_project(id: int, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Include leads
    leads = db.query(models.Lead).filter(models.Lead.project_id == id).all()
    return {
        "id": project.id,
        "name": project.name,
        "description": project.description,
        "created_at": project.created_at,
        "leads": leads
    }

@app.delete("/api/projects/{id}")
def delete_project(id: int, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    db.delete(project)
    db.commit()
    return {"message": "Project deleted"}

# Leads Endpoints
@app.get("/api/leads")
def list_leads(
    project_id: int,
    min_score: Optional[int] = None,
    category: Optional[str] = None,
    rating_min: Optional[float] = None,
    reviews_min: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(models.Lead).filter(models.Lead.project_id == project_id)
    
    if min_score is not None:
        query = query.filter(models.Lead.closing_score >= min_score)
    if category:
        query = query.filter(models.Lead.category.ilike(f"%{category}%"))
    if rating_min is not None:
        query = query.filter(models.Lead.rating >= rating_min)
    if reviews_min is not None:
        query = query.filter(models.Lead.reviews_count >= reviews_min)
    if status:
        query = query.filter(models.Lead.status == status)
        
    return query.all()

@app.patch("/api/leads/{id}")
def update_lead(id: int, lead_update: LeadUpdate, db: Session = Depends(get_db)):
    db_lead = db.query(models.Lead).filter(models.Lead.id == id).first()
    if not db_lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    update_data = lead_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_lead, key, value)
    
    db.commit()
    db.refresh(db_lead)
    return db_lead

# Email Finder Endpoints
async def background_find_email(lead_id: int):
    # We need a new session for background tasks
    from database import SessionLocal
    db = SessionLocal()
    try:
        lead = db.query(models.Lead).filter(models.Lead.id == lead_id).first()
        if lead and not lead.email:
            email = await find_business_email(lead.name, lead.address or "")
            if email:
                lead.email = email
                db.commit()
    finally:
        db.close()

async def background_find_emails_project(project_id: int):
    from database import SessionLocal
    db = SessionLocal()
    try:
        leads = db.query(models.Lead).filter(
            models.Lead.project_id == project_id,
            models.Lead.email == None
        ).all()
        
        for lead in leads:
            email = await find_business_email(lead.name, lead.address or "")
            if email:
                lead.email = email
                db.commit()
            # Delay to avoid being blocked
            await asyncio.sleep(5)
    finally:
        db.close()

@app.post("/api/leads/{id}/find-email")
async def find_lead_email(id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    lead = db.query(models.Lead).filter(models.Lead.id == id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    background_tasks.add_task(background_find_email, id)
    return {"message": "Email search started in background"}

@app.post("/api/projects/{id}/find-emails")
async def find_project_emails(id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    background_tasks.add_task(background_find_emails_project, id)
    return {"message": "Email search for project started in background"}

# CSV Export
@app.get("/api/projects/{id}/export")
def export_project_leads(id: int, db: Session = Depends(get_db)):
    project = db.query(models.Project).filter(models.Project.id == id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    leads = db.query(models.Lead).filter(
        models.Lead.project_id == id,
        models.Lead.website == None
    ).all()
    
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Business Name", "Phone", "Address", "Score", "Category", "Email"])
    
    for lead in leads:
        writer.writerow([
            lead.name,
            lead.phone or "",
            lead.address or "",
            lead.closing_score,
            lead.category or "",
            lead.email or ""
        ])
    
    output.seek(0)
    
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=project_{id}_leads.csv"}
    )

@app.post("/api/search")
async def search_leads(request: SearchRequest, db: Session = Depends(get_db)):
    try:
        # 1. Perform scraping
        leads_data = await scrape_google_maps(
            niche=request.niche,
            location=request.location,
            limit=request.limit
        )

        # 2. Record search in history
        search_history = models.SearchHistory(
            niche=request.niche,
            location=request.location,
            results_count=len(leads_data)
        )
        db.add(search_history)
        
        # 3. If project_id provided, save leads to project
        saved_leads = []
        if request.project_id:
            for data in leads_data:
                lead = models.Lead(
                    project_id=request.project_id,
                    name=data["name"],
                    phone=data.get("phone"),
                    address=data["address"],
                    category=data["category"],
                    rating=data["rating"],
                    reviews_count=data["reviews_count"],
                    website=data["website"],
                    closing_score=data["closing_score"]
                )
                db.add(lead)
                saved_leads.append(lead)
        
        db.commit()
        
        return {
            "niche": request.niche,
            "location": request.location,
            "results_count": len(leads_data),
            "leads": leads_data if not request.project_id else saved_leads
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# Frontend Static Files
FRONTEND_DIST = "/home/team/shared/frontend-dist"

if os.path.exists(FRONTEND_DIST):
    app.mount("/assets", StaticFiles(directory=f"{FRONTEND_DIST}/assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # If the path looks like an API call, it should have been caught by the API routes above
        # If it doesn't exist as a file in FRONTEND_DIST, serve index.html
        file_path = os.path.join(FRONTEND_DIST, full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=3000)
