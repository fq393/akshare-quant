from pydantic import BaseModel
from typing import List, Optional

class DailyData(BaseModel):
    date: str
    marketPrice: float
    sectorPrice: float
    marketPct: float
    sectorPct: float
    spread: float
    netInflow: float
    amplitude: float # Replaces sentimentScore
    peRatio: float

class SectorOption(BaseModel):
    name: str
    code: str
    # category: str = "行业板块" # Optional

class MarketRequest(BaseModel):
    sector_name: str
    market_symbol: str = "sh000001"
    days: int = 365

class AnalysisRequest(BaseModel):
    sector_name: str
    market_name: str
    lag_days: int
    similarity_score: Optional[float] = None
    recent_data: List[DailyData]  # Send last 30 days or so to avoid huge payload

class Token(BaseModel):
    access_token: str
    token_type: str
