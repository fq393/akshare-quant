from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from typing import List
import os
from .models import DailyData, SectorOption, MarketRequest, AnalysisRequest
from .services import get_sector_list, get_merged_data
from .ai_service import generate_market_analysis

app = FastAPI(title="AKShare Alpha Analysis API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/api/health")
def health_check():
    return {"status": "ok"}

@app.get("/api/sectors", response_model=List[SectorOption])
def read_sectors():
    sectors = get_sector_list()
    if not sectors:
        raise HTTPException(status_code=500, detail="Failed to fetch sector list")
    return sectors

@app.get("/api/market_data", response_model=List[DailyData])
def read_market_data(
    sector_name: str = Query(..., description="Name of the sector, e.g., '半导体'"),
    market_symbol: str = Query("sh000001", description="Market index symbol"),
    days: int = Query(365, description="Number of days to fetch")
):
    try:
        data = get_merged_data(sector_name, market_symbol, days)
        return data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/analyze")
async def analyze_market(request: AnalysisRequest):
    return StreamingResponse(generate_market_analysis(request), media_type="text/plain")

# Serve Frontend Static Files
# Mount only if the directory exists (it will in Docker)
static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend", "dist")
# Or if we copy it to a local folder in docker
# Let's assume we copy it to ./static in Docker
docker_static_dir = "static"

if os.path.exists(docker_static_dir):
    app.mount("/", StaticFiles(directory=docker_static_dir, html=True), name="static")
elif os.path.exists(static_dir):
    # For local development if one wants to test build serving
    app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
