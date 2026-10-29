"""
FinanceHub FastAPI Application Entrypoint.
"""

import os
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles 
from fastapi.responses import FileResponse, RedirectResponse
from pydantic import BaseModel, EmailStr
    
BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"

app = FastAPI(
    title="FinanceHub API",
    description="Multi-banking aggregation, intelligence, decisions, and administrative platform.",
    version="1.0.0", 
    docs_url="/docs", 
    redoc_url="/redoc",
)

# CORS Middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
) 

# Mount static frontend directory if it exists
if FRONTEND_DIR.exists(): 
    app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")
    if (FRONTEND_DIR / "assets").exists():
        app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="assets")




# ---------------------------------------------------------------------------
# Template & Page Serving Routes
# ---------------------------------------------------------------------------
@app.get("/", include_in_schema=False)
def root():
    """Default root redirects to login or serves login page."""
    login_path = FRONTEND_DIR / "login.html"
    if login_path.exists(): 
        return FileResponse(str(login_path))
    return RedirectResponse(url="/docs") 


@app.get("/login", include_in_schema=False) 
@app.get("/login.html", include_in_schema=False)
def serve_login():
    """Serves the Admin Staff Login template."""
    return FileResponse(str(FRONTEND_DIR / "login.html"))


@app.get("/dashboard", include_in_schema=False)
@app.get("/dashboard.html", include_in_schema=False)
def serve_dashboard():
    """Serves the Admin Dashboard (Overview) page."""
    return FileResponse(str(FRONTEND_DIR / "dashboard.html"))


@app.get("/admin", include_in_schema=False) 
@app.get("/admin.html", include_in_schema=False)
def serve_admin():
    """Serves the Full Admin Panel Console."""
    return FileResponse(str(FRONTEND_DIR / "admin.html"))


@app.get("/customers", include_in_schema=False)
@app.get("/customer", include_in_schema=False)
@app.get("/customer.html", include_in_schema=False)
@app.get("/customers.html", include_in_schema=False) 
def serve_customers():
    """Serves the Customer Management page."""
    return FileResponse(str(FRONTEND_DIR / "customer.html"))


@app.get("/institutions", include_in_schema=False)
@app.get("/institutional", include_in_schema=False)
@app.get("/institutional.html", include_in_schema=False)
@app.get("/institutions.html", include_in_schema=False)
def serve_institutions():
    """Serves the Institutions & Connections page."""
    return FileResponse(str(FRONTEND_DIR / "institutional.html"))


@app.get("/mono-demo", include_in_schema=False)
@app.get("/mono-demo.html", include_in_schema=False)
def serve_mono_demo():
    """Serves the Interactive Mono Sandbox Demo page."""
    return FileResponse(str(FRONTEND_DIR / "mono-demo.html"))


@app.get("/mono-connect", include_in_schema=False)
@app.get("/mono-connect.html", include_in_schema=False)
def serve_mono_connect():
    """Serves the Mobile WebView Mono Bank Connect page."""
    return FileResponse(str(FRONTEND_DIR / "mono-connect.html"))




from app.core.database import Base, engine
from app.routers import (
    auth_router,
    institution_router,
    public_institution_router,
    customer_router,
    public_customer_router,
    user_institution_router,
    mono_router,
)


# Include Routers
app.include_router(auth_router) 
app.include_router(institution_router) 
app.include_router(public_institution_router)
app.include_router(customer_router)
app.include_router(public_customer_router)
app.include_router(user_institution_router) 
app.include_router(mono_router)



@app.on_event("startup")
def startup_event():
    """Ensure database tables are created on app startup."""
    try:
        Base.metadata.create_all(bind=engine)
    except Exception as e:
        print(f"Startup DB init notice: {e}")


# ---------------------------------------------------------------------------
# System Endpoints
# ---------------------------------------------------------------------------
@app.get("/health", tags=["System"])
def health_check():
    """
    Service health check endpoint.
    """
    return {
        "status": "healthy",
        "service": "FinanceHub API",
        "version": "1.0.0",
    }
