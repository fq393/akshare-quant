import akshare as ak
import pandas as pd
import datetime

def test_market_data():
    print("Testing Market Data (sh000001)...")
    try:
        # 上证指数
        df = ak.stock_zh_index_daily(symbol="sh000001")
        print(f"Success! Shape: {df.shape}")
        print(df.tail(3))
        # Check columns
        print(f"Columns: {df.columns.tolist()}")
    except Exception as e:
        print(f"Error fetching market data: {e}")

def test_sector_list():
    print("\nTesting Sector List (THS)...")
    try:
        # 同花顺行业板块列表
        df = ak.stock_board_industry_name_ths()
        print(f"Success! Found {len(df)} sectors.")
        print(df.head(5))
        return df
    except Exception as e:
        print(f"Error fetching sector list: {e}")
        return None

def test_sector_data(sector_name):
    print(f"\nTesting Sector Data ({sector_name})...")
    try:
        # 同花顺行业指数历史行情
        # 注意：这里需要确认 symbol 是不是直接用中文名称
        df = ak.stock_board_industry_index_ths(symbol=sector_name, start_date="20240101", end_date="20240201")
        print(f"Success! Shape: {df.shape}")
        print(df.tail(3))
        print(f"Columns: {df.columns.tolist()}")
    except Exception as e:
        print(f"Error fetching sector data: {e}")

if __name__ == "__main__":
    test_market_data()
    sectors = test_sector_list()
    if sectors is not None and not sectors.empty:
        # Pick the first one to test
        first_sector = sectors.iloc[0]['name'] if 'name' in sectors.columns else "半导体及元件"
        test_sector_data(first_sector)
        # Test "半导体及元件" explicitly as it is common
        test_sector_data("半导体及元件")
