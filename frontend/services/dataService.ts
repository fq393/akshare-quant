import { DailyData, SectorOption, MarketOption, TimeRange } from '../types';

const API_BASE_URL = 'http://localhost:8000/api';

export const getDaysFromRange = (range: TimeRange): number => {
  switch (range) {
    case TimeRange.ONE_MONTH: return 30;
    case TimeRange.THREE_MONTHS: return 90;
    case TimeRange.SIX_MONTHS: return 180;
    case TimeRange.ONE_YEAR: return 365;
    case TimeRange.THREE_YEARS: return 365 * 3;
    case TimeRange.FIVE_YEARS: return 365 * 5;
    default: return 365;
  }
};

export const fetchSectors = async (): Promise<SectorOption[]> => {
  try {
    const response = await fetch(`${API_BASE_URL}/sectors`);
    if (!response.ok) {
      throw new Error('Failed to fetch sectors');
    }
    const sectors = await response.json();
    return sectors.map((s: any) => ({
      id: s.code,
      name: s.name,
      code: s.code,
      category: '行业板块' // Default category
    }));
  } catch (error) {
    console.error('Error fetching sectors:', error);
    // Return empty or fallback
    return [];
  }
};

export const fetchMarketData = async (
  sector: SectorOption,
  market: MarketOption,
  range: TimeRange
): Promise<DailyData[]> => {
  const days = getDaysFromRange(range);
  const url = `${API_BASE_URL}/market_data?sector_name=${encodeURIComponent(sector.name)}&market_symbol=${market.code}&days=${days}`;
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to fetch market data: ${errorText}`);
    }
    const data: DailyData[] = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching market data:', error);
    throw error;
  }
};

// Static Market Definitions (Keep for now)
export const AVAILABLE_MARKETS: MarketOption[] = [
  { id: 'sh_000001', name: '上证指数 (sh000001)', code: 'sh000001', volatility: 1.0 },
];

// Fallback sectors if API fails (Optional, can be empty)
export const AVAILABLE_SECTORS: SectorOption[] = [];
