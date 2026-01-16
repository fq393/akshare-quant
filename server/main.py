from fastapi import FastAPI, HTTPException, Query, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from typing import List
import os
import jwt
from datetime import datetime, timedelta
from .models import DailyData, SectorOption, MarketRequest, AnalysisRequest, Token
from .services import get_sector_list, get_merged_data
from .ai_service import generate_market_analysis

SECRET_KEY = "your-secret-key-keep-it-secret"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24  # 24 hours

app = FastAPI(title="AKShare Alpha Analysis API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/login")

def create_access_token(data: dict, expires_delta: timedelta | None = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(token: str = Depends(oauth2_scheme)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
    return username

@app.post("/api/login", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends()):
    # Hardcoded password check
    # Username is ignored in this simple case, or we can enforce "admin"
    if form_data.password != "yydxccjnnyswxdy":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": form_data.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

@app.get("/api/sectors", response_model=List[SectorOption])
def read_sectors(current_user: str = Depends(get_current_user)):
    sectors = get_sector_list()
    if not sectors:
        raise HTTPException(status_code=500, detail="Failed to fetch sector list")
    return sectors

@app.get("/api/market_data", response_model=List[DailyData])
def read_market_data(
    sector_name: str = Query(..., description="Name of the sector, e.g., '半导体'"),
    market_symbol: str = Query("sh000001", description="Market index symbol"),
    days: int = Query(365, description="Number of days to fetch"),
    current_user: str = Depends(get_current_user)
):
    try:
        data = get_merged_data(sector_name, market_symbol, days)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze")
async def analyze_market(request: AnalysisRequest, current_user: str = Depends(get_current_user)):
    return StreamingResponse(generate_market_analysis(request), media_type="text/plain")

# Serve Frontend Static Files
# Mount only if the directory exists (it will in Docker)
static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
# Or if we copy it to a local folder in docker
# Let's assume we copy it to ./static in Docker
docker_static_dir = "static"

target_static_dir = None
if os.path.exists(docker_static_dir):
    target_static_dir = docker_static_dir
elif os.path.exists(static_dir):
    target_static_dir = static_dir

if target_static_dir:
    # 1. Mount assets (JS/CSS/Images)
    assets_dir = os.path.join(target_static_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    # 2. Serve index.html for root
    @app.get("/")
    async def read_index():
        return FileResponse(os.path.join(target_static_dir, "index.html"))

    # 3. Catch-all for other static files (favicon.ico, etc) or SPA routing
    @app.get("/{full_path:path}")
    async def read_static(full_path: str):
        # Check if file exists in static dir
        file_path = os.path.join(target_static_dir, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)
        
        # Fallback to index.html for SPA routing (if path doesn't start with /api)
        if not full_path.startswith("api/"):
             return FileResponse(os.path.join(target_static_dir, "index.html"))
        
        raise HTTPException(status_code=404, detail="Not Found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
