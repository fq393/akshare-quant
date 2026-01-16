import requests
import json

BASE_URL = "http://localhost:8000/api"

def test_api():
    # 1. Get Sectors
    print("Fetching sectors...")
    try:
        resp = requests.get(f"{BASE_URL}/sectors")
        resp.raise_for_status()
        sectors = resp.json()
        print(f"Success! Found {len(sectors)} sectors.")
        if sectors:
            print(f"First sector: {sectors[0]}")
    except Exception as e:
        print(f"Failed to fetch sectors: {e}")
        return

    # 2. Get Market Data for the first sector
    if sectors:
        sector_name = sectors[0]['name'] # Likely "半导体"
        print(f"\nFetching market data for sector: {sector_name}...")
        try:
            resp = requests.get(f"{BASE_URL}/market_data", params={
                "sector_name": sector_name,
                "market_symbol": "sh000001",
                "days": 30
            })
            if resp.status_code != 200:
                print(f"Error: {resp.text}")
            else:
                data = resp.json()
                print(f"Success! Received {len(data)} records.")
                if data:
                    print(f"Sample: {data[0]}")
        except Exception as e:
            print(f"Failed to fetch market data: {e}")

if __name__ == "__main__":
    test_api()
