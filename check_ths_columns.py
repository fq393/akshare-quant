
import akshare as ak
import pandas as pd

try:
    print("Fetching sector list...")
    board_df = ak.stock_board_industry_name_ths()
    first_sector = board_df.iloc[0]['name']
    print(f"Testing with sector: {first_sector}")
    
    df = ak.stock_board_industry_index_ths(symbol=first_sector, start_date="20240101", end_date="20240110")
    print("Columns found:", df.columns.tolist())
    if not df.empty:
        print("First row:", df.iloc[0].to_dict())
except Exception as e:
    print(f"Error: {e}")
