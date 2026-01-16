import { DailyData, AnalysisResult } from "../types";

const API_BASE_URL = '/api';

const getAuthHeaders = () => {
  const token = sessionStorage.getItem('akshare_token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export const analyzeTrendWithGemini = async (
  data: DailyData[],
  sectorName: string,
  marketName: string,
  lagDays: number,
  apiKey: string, // Kept for interface compatibility but not used for backend call if we hardcode it there
  similarityScore: number | null = null,
  onChunk?: (text: string) => void
): Promise<AnalysisResult> => {
  
  // Prepare payload
  // Send last 30 days for context
  const recentData = data.slice(-30);
  
  const payload = {
    sector_name: sectorName,
    market_name: marketName,
    lag_days: lagDays,
    similarity_score: similarityScore,
    recent_data: recentData
  };

  try {
    const response = await fetch(`${API_BASE_URL}/analyze`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders()
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.statusText}`);
    }

    if (!response.body) {
      throw new Error("No response body");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      fullText += chunk;
      
      if (onChunk) {
        onChunk(fullText);
      }
    }

    return {
      summary: fullText,
      sentiment: 'neutral' // Default, as backend just returns text now
    };

  } catch (error: any) {
    console.error("Analysis Error:", error);
    throw new Error(error.message || "分析服务不可用");
  }
};
