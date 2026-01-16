import akshare as ak
import pandas as pd
import datetime
from typing import List, Dict, Any
from .models import DailyData, SectorOption

# Cache for sector list to avoid frequent API calls
_SECTOR_CACHE = None

def get_sector_list() -> List[SectorOption]:
    global _SECTOR_CACHE
    if _SECTOR_CACHE is not None:
        return _SECTOR_CACHE

    try:
        print("Fetching sector list from AKShare...")
        df = ak.stock_board_industry_name_ths()
        # df columns: name, code, ...
        sectors = []
        for _, row in df.iterrows():
            sectors.append(SectorOption(name=row['name'], code=row['code']))
        _SECTOR_CACHE = sectors
        return sectors
    except Exception as e:
        print(f"Error fetching sector list: {e}")
        return []

def get_merged_data(sector_name: str, market_symbol: str = "sh000001", days: int = 365) -> List[DailyData]:
    # Calculate date range
    end_date = datetime.datetime.now()
    start_date = end_date - datetime.timedelta(days=days + 60) # Fetch extra days for pct_change calculation
    
    start_str = start_date.strftime("%Y%m%d")
    end_str = end_date.strftime("%Y%m%d")

    print(f"Fetching data for Sector: {sector_name}, Market: {market_symbol}, Range: {start_str}-{end_str}")

    try:
        # 1. Fetch Market Data (sh000001)
        # ak.stock_zh_index_daily returns all history, so we need to filter
        market_df = ak.stock_zh_index_daily(symbol=market_symbol)
        market_df['date'] = pd.to_datetime(market_df['date'])
        
        # Filter by date
        market_df = market_df[(market_df['date'] >= start_date) & (market_df['date'] <= end_date)].copy()
        
        # Calculate Market Pct Change
        market_df['marketPct'] = market_df['close'].pct_change() * 100
        market_df = market_df.rename(columns={'close': 'marketPrice'})
        
        # 2. Fetch Sector Data (THS)
        # ak.stock_board_industry_index_ths requires YYYYMMDD
        sector_df = ak.stock_board_industry_index_ths(symbol=sector_name, start_date=start_str, end_date=end_str)
        
        if sector_df is None or sector_df.empty:
            raise ValueError(f"No data found for sector {sector_name}")
            
        # Rename columns: 日期 -> date, 收盘价 -> close, 成交额 -> amount
        sector_df = sector_df.rename(columns={
            '日期': 'date', 
            '收盘价': 'close',
            '成交额': 'amount',
            '最高价': 'high',
            '最低价': 'low'
        })
        sector_df['date'] = pd.to_datetime(sector_df['date'])
        
        # Calculate Sector Pct Change
        sector_df['sectorPct'] = sector_df['close'].pct_change() * 100
        
        # Calculate Amplitude: (High - Low) / Pre_Close * 100
        sector_df['pre_close'] = sector_df['close'].shift(1)
        # Handle first row NaN by using Open as proxy for Pre_Close or 0
        sector_df['amplitude'] = 0.0
        mask = sector_df['pre_close'] > 0
        sector_df.loc[mask, 'amplitude'] = (sector_df.loc[mask, 'high'] - sector_df.loc[mask, 'low']) / sector_df.loc[mask, 'pre_close'] * 100
        
        sector_df = sector_df.rename(columns={'close': 'sectorPrice'})

        # 3. Merge Data
        # Inner join to ensure we only keep dates where both have data
        merged = pd.merge(market_df[['date', 'marketPrice', 'marketPct']], 
                          sector_df[['date', 'sectorPrice', 'sectorPct', 'amount', 'amplitude']], 
                          on='date', how='inner')

        # 4. Fill NaN (first row might be NaN due to pct_change)
        merged = merged.fillna(0)
        
        # 5. Calculate Derived Metrics
        result_data = []
        for _, row in merged.iterrows():
            # Heuristic for Net Inflow: use amount (in 100M) as a proxy
            amount_100m = row['amount'] / 100000000 if 'amount' in row else 0
            
            # Amplitude is now real
            amplitude = row['amplitude']
            
            # Simulated PE (random walk around 20)
            pe = 20 + (row['sectorPrice'] % 10) 

            result_data.append(DailyData(
                date=row['date'].strftime("%Y-%m-%d"),
                marketPrice=round(row['marketPrice'], 2),
                sectorPrice=round(row['sectorPrice'], 2),
                marketPct=round(row['marketPct'], 2),
                sectorPct=round(row['sectorPct'], 2),
                spread=round(row['sectorPct'] - row['marketPct'], 2),
                netInflow=round(amount_100m, 2),
                amplitude=round(amplitude, 2),
                peRatio=round(pe, 2)
            ))
            
        # Trim to requested days (since we fetched extra)
        # Return the last N days, but ensure we don't return more than available
        return result_data[-days:] if len(result_data) > days else result_data

    except Exception as e:
        print(f"Error processing data: {e}")
        import traceback
        traceback.print_exc()
        raise e
