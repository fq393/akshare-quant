export interface DailyData {
  date: string;
  marketPrice: number;
  sectorPrice: number;
  marketPct: number; // Cumulative percentage change
  sectorPct: number; // Cumulative percentage change
  spread: number; // Calculated on the fly based on lag
  // Advanced AKShare-like factors
  netInflow: number; // 资金净流入 (亿) - Category: 资金与市场情绪
  amplitude: number; // 振幅 (Real Data) - Category: 市场热度与情绪 (Replaces sentimentScore)
  peRatio: number; // 动态市盈率 - Category: 公司与财务数据
  rs?: number; // Relative Strength
  rsSMA20?: number; // RS 20-day Moving Average
}

export enum TimeRange {
  ONE_MONTH = '1M',
  THREE_MONTHS = '3M',
  SIX_MONTHS = '6M',
  ONE_YEAR = '1Y',
  THREE_YEARS = '3Y', // New
  FIVE_YEARS = '5Y'   // New
}

export interface SectorOption {
  id: string;
  name: string;
  category?: string; 
  code?: string;
  volatility?: number;
  beta?: number;
}

export interface MarketOption {
  id: string;
  name: string;
  code: string; // e.g. sh000001
  volatility?: number; // Market specific volatility
}

export interface AnalysisResult {
  summary: string;
  sentiment: 'positive' | 'negative' | 'neutral';
}