import React, { useState, useEffect, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  Legend, AreaChart, Area, ReferenceLine, BarChart, Bar, ComposedChart
} from 'recharts';
import { 
  TrendingUp, Activity, BarChart3, RefreshCw, 
  BrainCircuit, ChevronDown, Clock, Layers, CandlestickChart, Scale,
  Settings, X, Save, Key, HelpCircle, LogOut
} from 'lucide-react';
import { fetchSectors, fetchMarketData, AVAILABLE_MARKETS } from './services/dataService';
import { analyzeTrendWithGemini } from './services/geminiService';
import { CustomTooltip } from './components/ChartTooltip';
import { IndicatorGuide, GuideCategory } from './components/IndicatorGuide';
import { AnalysisReportModal } from './components/AnalysisReportModal';
import { LoginModal } from './components/LoginModal';
import { calculateSimilarityScore, calculateBeta, calculateCorrelation, calculateMaxCorrelationLag, calculateSMA } from './utils/quant';
import { DailyData, TimeRange, AnalysisResult, SectorOption } from './types';
import ReactMarkdown from 'react-markdown';

const App: React.FC = () => {
  const [sectors, setSectors] = useState<SectorOption[]>([]);
  const [selectedMarket, setSelectedMarket] = useState(AVAILABLE_MARKETS[0]);
  const [selectedSector, setSelectedSector] = useState<SectorOption | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>(TimeRange.THREE_MONTHS);
  const [timeLag, setTimeLag] = useState<number>(0); 
  const [similarityStats, setSimilarityStats] = useState<{ frechet: number, dtw: number } | null>(null);
  const [quantStats, setQuantStats] = useState<{ beta: number, correlation: number, maxCorrLag: { lag: number, correlation: number } } | null>(null);
  const [indicatorType, setIndicatorType] = useState<'spread' | 'netInflow' | 'amplitude' | 'pe' | 'rs'>('spread');
  const [rawData, setRawData] = useState<DailyData[]>([]);
  
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  // API Key Management
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('gemini_api_key') || '');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [guideCategory, setGuideCategory] = useState<GuideCategory | null>(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Auth State
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return sessionStorage.getItem('akshare_auth') === 'true';
  });

  const handleLogin = async (pwd: string) => {
    try {
      const formData = new FormData();
      formData.append('username', 'admin');
      formData.append('password', pwd);

      const response = await fetch('/api/login', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        sessionStorage.setItem('akshare_token', data.access_token);
        sessionStorage.setItem('akshare_auth', 'true');
        setIsAuthenticated(true);
        return true;
      }
      return false;
    } catch (e) {
      console.error("Login error", e);
      return false;
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('akshare_auth');
    sessionStorage.removeItem('akshare_token');
  };

  // 1. Fetch Sectors on Mount (only if authenticated)
  useEffect(() => {
    if (!isAuthenticated) return;

    const loadSectors = async () => {
      try {
        const list = await fetchSectors();
        setSectors(list);
        if (list.length > 0) {
          // Default to Semiconductor if available, else first one
          const defaultSector = list.find(s => s.name.includes('半导体')) || list[0];
          setSelectedSector(defaultSector);
        }
      } catch (e) {
        console.error("Failed to load sectors", e);
        setErrorMessage("无法加载行业列表，请检查后端服务是否启动。");
      }
    };
    loadSectors();
  }, [isAuthenticated]);

  // 2. Fetch Market Data when selection changes
  useEffect(() => {
    if (!selectedSector || !selectedMarket) return;

    const loadData = async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const newData = await fetchMarketData(selectedSector, selectedMarket, timeRange);
        if (!newData || newData.length === 0) {
             setErrorMessage("该时间段暂无数据或数据获取失败");
             setRawData([]);
        } else {
             setRawData(newData);
        }
        setAnalysis(null);
      } catch (e: any) {
        console.error(e);
        setErrorMessage(e.message || "无法加载市场数据");
        setRawData([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [selectedSector, selectedMarket, timeRange]);

  // 3. Process Data with Time Lag & Calculate Similarity
  const processedData = useMemo(() => {
    if (rawData.length === 0) {
      setSimilarityStats(null);
      return [];
    }
    
    // Prepare arrays for similarity calculation
    const marketCurve: number[] = [];
    const sectorCurve: number[] = [];

    const data = rawData.map((day, index) => {
      const lagIndex = index - timeLag;
      let sectorPct = 0;
      let sectorPrice = 0;
      let amplitude = 0;

      if (lagIndex >= 0 && lagIndex < rawData.length) {
        sectorPct = rawData[lagIndex].sectorPct;
        sectorPrice = rawData[lagIndex].sectorPrice;
        amplitude = rawData[lagIndex].amplitude;
        
        // Add to curves if valid
        marketCurve.push(day.marketPct); 
        sectorCurve.push(sectorPct);
      } else {
        sectorPct = 0; 
      }

      return {
        ...day, 
        sectorPct: sectorPct, 
        sectorPrice: sectorPrice,
        amplitude: amplitude,
        spread: sectorPct - day.marketPct 
      };
    });

    // Calculate Similarity based on Cumulative Returns (Equity Curve)
    // We need to reconstruct the "Curve" from daily Pct to capture shape
    let cumMarket = 100;
    let cumSector = 100;
    const marketCumCurve: number[] = [];
    const sectorCumCurve: number[] = [];
    const rsValues: number[] = [];

    // Re-loop to build cumulative curves for valid overlapping period
    // Skip first 'timeLag' elements where sector is 0/invalid
    for(let i = timeLag; i < rawData.length; i++) {
        const day = rawData[i];
        const lagDay = rawData[i - timeLag];
        
        cumMarket = cumMarket * (1 + day.marketPct / 100);
        cumSector = cumSector * (1 + lagDay.sectorPct / 100);
        
        marketCumCurve.push(cumMarket);
        sectorCumCurve.push(cumSector);

        // RS = Sector / Market (Using cumulative return as proxy for index ratio if price not comparable, 
        // but here we want Relative Strength of the *Trend*)
        // Ideally RS = Price_Sector / Price_Market. 
        // If we don't have absolute index points aligned, Cumulative Return ratio is a good proxy for "Relative Performance" starting from 100.
        rsValues.push(cumSector / cumMarket);
    }

    // Calculate RS SMA20
    const rsSMA20 = calculateSMA(rsValues, 20);

    // Merge RS back into data
    const enrichedData = data.map((d, i) => {
         if (i < timeLag) return { ...d, rs: 0, rsSMA20: 0 };
         const idx = i - timeLag;
         return {
             ...d,
             rs: rsValues[idx],
             rsSMA20: rsSMA20[idx] || 0
         };
    });

    if (marketCumCurve.length > 10) {
       const scores = calculateSimilarityScore(marketCumCurve, sectorCumCurve);
       setSimilarityStats(scores);

       // Calculate Quant Stats (Beta, Correlation)
       // Use daily percentage data (marketCurve, sectorCurve)
       const beta = calculateBeta(marketCurve, sectorCurve);
       const corr = calculateCorrelation(marketCurve, sectorCurve);
       const maxCorrLag = calculateMaxCorrelationLag(marketCurve, sectorCurve, 10);
       
       setQuantStats({ beta, correlation: corr, maxCorrLag });
    } else {
       setSimilarityStats(null);
       setQuantStats(null);
    }

    return enrichedData;
  }, [rawData, timeLag]);

  const handleAnalyze = async () => {
    if (!selectedSector) return;
    setIsReportOpen(true); // Open modal first
    setIsAnalyzing(true);
    setErrorMessage(null);
    
    try {
      const result = await analyzeTrendWithGemini(
        processedData, 
        selectedSector.name, 
        selectedMarket.name, 
        timeLag,
        apiKey,
        similarityStats?.frechet || null,
        (streamedText) => {
           setAnalysis({
             summary: streamedText,
             sentiment: 'neutral'
           });
        }
      );
      setAnalysis(result);
    } catch (e: any) {
      console.error(e);
      setErrorMessage(e.message || "分析请求失败");
      if (e.message.includes("API Key")) {
        setIsSettingsOpen(true);
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveKey = () => {
    localStorage.setItem('gemini_api_key', apiKey);
    setIsSettingsOpen(false);
    setErrorMessage(null);
  };

  const currentStats = useMemo(() => {
    if (processedData.length === 0) return null;
    return processedData[processedData.length - 1];
  }, [processedData]);

  const formatTimeRange = (range: TimeRange) => {
    switch (range) {
      case TimeRange.ONE_MONTH: return '1月';
      case TimeRange.THREE_MONTHS: return '3月';
      case TimeRange.SIX_MONTHS: return '6月';
      case TimeRange.ONE_YEAR: return '1年';
      case TimeRange.THREE_YEARS: return '3年';
      case TimeRange.FIVE_YEARS: return '5年';
      default: return range;
    }
  };

  if (!isAuthenticated) {
    return <LoginModal onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 p-4 md:p-8 relative">
      {/* Header */}
      <header className="max-w-7xl mx-auto mb-8 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-white">
            <Activity className="text-blue-500" />
            AKShare 量化数据分析台 (Real Data)
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            多因子维度：行情 / 资金流 / 财务指标 / 市场情绪
          </p>
        </div>

        <div className="flex flex-col md:flex-row flex-wrap items-start md:items-center gap-3 w-full xl:w-auto">
          
          <div className="flex items-center gap-2 bg-slate-800 p-1.5 rounded-lg border border-slate-700">
             {/* Market Selector */}
             {AVAILABLE_MARKETS.length > 1 ? (
               <div className="relative group">
                 <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                   <Scale className="w-4 h-4" />
                 </div>
                <select
                  value={selectedMarket.id}
                  onChange={(e) => {
                    const m = AVAILABLE_MARKETS.find(mar => mar.id === e.target.value);
                    if (m) setSelectedMarket(m);
                  }}
                  className="appearance-none bg-slate-900 border border-slate-600 text-white pl-9 pr-8 py-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-slate-700 transition-colors text-sm w-32"
                >
                  {AVAILABLE_MARKETS.map(m => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
              </div>
             ) : (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-600 rounded-md text-white min-w-[140px]">
                  <Scale className="w-4 h-4 text-blue-500" />
                  <span className="text-sm font-medium">{selectedMarket.name}</span>
                </div>
             )}
            
            <span className="text-slate-500 font-bold text-lg">VS</span>

            {/* Sector Selector */}
            <div className="relative">
              <select
                value={selectedSector?.id || ''}
                onChange={(e) => {
                  const s = sectors.find(sec => sec.id === e.target.value);
                  if (s) setSelectedSector(s);
                }}
                disabled={sectors.length === 0}
                className="appearance-none bg-slate-900 border border-slate-600 text-white pl-4 pr-10 py-1.5 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 hover:bg-slate-700 transition-colors text-sm min-w-[140px] max-w-[200px]"
              >
                {sectors.length === 0 && <option>加载中...</option>}
                {sectors.map(s => (
                   <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400 pointer-events-none" />
            </div>
          </div>

          {/* Time Range */}
          <div className="bg-slate-800 p-1 rounded-lg border border-slate-700 flex flex-wrap gap-1">
            {Object.values(TimeRange).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-3 py-1 text-xs sm:text-sm rounded-md transition-all ${
                  timeRange === range 
                    ? 'bg-blue-600 text-white shadow' 
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                {formatTimeRange(range)}
              </button>
            ))}
          </div>

          {/* Logout Button */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-1.5 bg-red-900/20 hover:bg-red-900/40 text-red-400 border border-red-900/50 rounded-lg transition-colors text-sm ml-auto xl:ml-0"
            title="退出登录"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">退出</span>
          </button>

          {/* Settings Button */}
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 bg-slate-800 rounded-lg border border-slate-700 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            title="设置 API Key"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Main Chart Section */}
        <div className="lg:col-span-3 space-y-6">
          
          {/* Trend Chart */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 backdrop-blur-sm relative">
             {isLoading && (
                <div className="absolute inset-0 bg-slate-900/50 z-10 flex items-center justify-center backdrop-blur-sm rounded-xl">
                    <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
                </div>
             )}

            {/* Header Area: Split into two rows for better mobile/desktop handling */}
            <div className="flex flex-col gap-4 mb-6">
              
              {/* Row 1: Title & Info */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                   <div className="flex items-center gap-2">
                     <TrendingUp className="w-5 h-5 text-blue-400" />
                     <span>累计收益趋势</span>
                     <button 
                       onClick={() => setGuideCategory('trend')}
                       className="p-1 hover:bg-slate-700 rounded-full transition-colors group"
                       title="查看累计收益趋势说明"
                     >
                       <HelpCircle className="w-4 h-4 text-slate-500 group-hover:text-blue-400 transition-colors" />
                     </button>
                   </div>
                </h2>
                <div className="text-xs font-normal text-slate-500 bg-slate-900/30 px-3 py-1.5 rounded-full border border-slate-700/50">
                   {selectedMarket.name} (T) vs {selectedSector?.name} (T-{timeLag})
                </div>
              </div>

              {/* Row 2: Controls */}
              <div className="flex flex-wrap items-center gap-4">
                {/* Lag Control */}
                <div className="flex items-center gap-3 bg-slate-900/50 p-2 rounded-lg border border-slate-700 flex-1 sm:flex-none min-w-[200px]">
                  <Clock className="w-4 h-4 text-orange-400" />
                  <span className="text-xs text-slate-300 whitespace-nowrap">隔位时间差(Lag):</span>
                  <input 
                    type="range" 
                    min="0" 
                    max="10" 
                    step="1"
                    value={timeLag}
                    onChange={(e) => setTimeLag(Number(e.target.value))}
                    className="w-full sm:w-24 h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                  />
                  <span className="text-sm font-mono text-orange-400 min-w-[20px] text-center">{timeLag}</span>
                  <span className="text-xs text-slate-500">天</span>
                </div>

                 {/* Similarity Score */}
                 {similarityStats && (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center gap-2 bg-slate-900/50 p-2 rounded-lg border border-slate-700 flex-1 sm:flex-none">
                        <Activity className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs text-slate-300 whitespace-nowrap">Fréchet:</span>
                        <span className={`text-sm font-mono font-bold ${similarityStats.frechet > 80 ? 'text-emerald-400' : similarityStats.frechet > 60 ? 'text-yellow-400' : 'text-slate-400'}`}>
                        {similarityStats.frechet}
                        </span>
                    </div>
                     <div className="flex items-center gap-2 bg-slate-900/50 p-2 rounded-lg border border-slate-700 flex-1 sm:flex-none">
                        <Activity className="w-4 h-4 text-blue-400" />
                        <span className="text-xs text-slate-300 whitespace-nowrap">DTW:</span>
                        <span className={`text-sm font-mono font-bold ${similarityStats.dtw > 80 ? 'text-emerald-400' : similarityStats.dtw > 60 ? 'text-yellow-400' : 'text-slate-400'}`}>
                        {similarityStats.dtw}
                        </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={processedData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                  <XAxis 
                    dataKey="date" 
                    stroke="#64748b" 
                    tick={{fontSize: 12}} 
                    tickFormatter={(val) => val.slice(5)} 
                    minTickGap={40}
                  />
                  <YAxis 
                    stroke="#64748b" 
                    tick={{fontSize: 12}} 
                    tickFormatter={(val) => `${val}%`}
                  />
                  <Tooltip content={<CustomTooltip marketName={selectedMarket.name} />} />
                  <Legend wrapperStyle={{paddingTop: '10px'}} />
                  
                  <Line 
                    type="monotone" 
                    dataKey="marketPct" 
                    name={selectedMarket.name} 
                    stroke="#3b82f6" 
                    strokeWidth={2} 
                    dot={false}
                    isAnimationActive={false}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="sectorPct" 
                    name={selectedSector?.name || 'Sector'} 
                    stroke="#a855f7" 
                    strokeWidth={2} 
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Multi-Factor Analysis Chart */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700 p-6 backdrop-blur-sm relative">
             <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-4">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-emerald-400" />
                多因子指标分析
                <button 
                  onClick={() => setGuideCategory('charts')}
                  className="ml-2 p-1 text-slate-500 hover:text-blue-400 hover:bg-slate-700/50 rounded-full transition-colors"
                  title="查看指标详解"
                >
                  <HelpCircle className="w-4 h-4" />
                </button>
              </h2>
              
              {/* Indicator Selector */}
              <div className="flex bg-slate-900/50 p-1 rounded-lg border border-slate-700">
                <button
                  onClick={() => setIndicatorType('spread')}
                  className={`px-3 py-1 text-xs rounded-md transition-all ${indicatorType === 'spread' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  超额收益(Alpha)
                </button>
                <button
                  onClick={() => setIndicatorType('netInflow')}
                  className={`px-3 py-1 text-xs rounded-md transition-all ${indicatorType === 'netInflow' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  成交额
                </button>
                <button
                  onClick={() => setIndicatorType('amplitude')}
                  className={`px-3 py-1 text-xs rounded-md transition-all ${indicatorType === 'amplitude' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  板块振幅
                </button>
                 <button
                  onClick={() => setIndicatorType('pe')}
                  className={`px-3 py-1 text-xs rounded-md transition-all ${indicatorType === 'pe' ? 'bg-purple-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  估值(PE)
                </button>
                 <button
                  onClick={() => setIndicatorType('rs')}
                  className={`px-3 py-1 text-xs rounded-md transition-all ${indicatorType === 'rs' ? 'bg-pink-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  相对强弱(RS)
                </button>
              </div>
            </div>

            <p className="text-slate-400 text-sm mb-6 min-h-[20px]">
              {indicatorType === 'spread' && <span>计算公式: <code className="bg-slate-900 px-1 rounded text-emerald-300">板块(T-{timeLag})涨幅 - {selectedMarket.name}(T)涨幅</code></span>}
              {indicatorType === 'netInflow' && <span>指标说明: <span className="text-blue-300">板块成交额 (亿元)</span> - 反映板块活跃度</span>}
               {indicatorType === 'amplitude' && <span>指标说明: <span className="text-orange-300">日内振幅 (%)</span> - (最高-最低)/昨收，反映多空博弈激烈程度</span>}
               {indicatorType === 'pe' && <span>指标说明: <span className="text-purple-300">动态市盈率 (PE-TTM)</span> - 反映板块估值水平</span>}
               {indicatorType === 'rs' && <span>指标说明: <span className="text-pink-300">相对强弱 (RS)</span> - 板块/大盘累计净值比。向上=跑赢，向下=跑输。虚线=20日均线。</span>}
            </p>

            <div className="h-[240px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                {indicatorType === 'spread' ? (
                  <AreaChart data={processedData} margin={{ top: 5, right: 20, bottom: 20, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="date" stroke="#64748b" tick={{fontSize: 12}} tickFormatter={(val) => val.slice(5)} minTickGap={40} />
                    <YAxis stroke="#64748b" tick={{fontSize: 12}} />
                    <Tooltip content={<CustomTooltip marketName={selectedMarket.name} />} />
                    <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                    <defs>
                      <linearGradient id="splitColor" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area type="monotone" dataKey="spread" name="超额收益差" stroke="#10b981" fill="url(#splitColor)" isAnimationActive={false} />
                  </AreaChart>
                ) : indicatorType === 'netInflow' ? (
                  <BarChart data={processedData} margin={{ top: 5, right: 20, bottom: 20, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="date" stroke="#64748b" tick={{fontSize: 12}} tickFormatter={(val) => val.slice(5)} minTickGap={40} />
                    <YAxis stroke="#64748b" tick={{fontSize: 12}} />
                    <Tooltip content={<CustomTooltip marketName={selectedMarket.name} />} />
                    <Bar dataKey="netInflow" name="成交额" fill="#3b82f6" isAnimationActive={false} />
                  </BarChart>
                ) : indicatorType === 'amplitude' ? (
                    <AreaChart data={processedData} margin={{ top: 5, right: 20, bottom: 20, left: 0 }}>
                     <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                     <XAxis dataKey="date" stroke="#64748b" tick={{fontSize: 12}} tickFormatter={(val) => val.slice(5)} minTickGap={40} />
                     <YAxis stroke="#64748b" tick={{fontSize: 12}} />
                     <Tooltip content={<CustomTooltip marketName={selectedMarket.name} />} />
                     <Area type="monotone" dataKey="amplitude" name="振幅%" stroke="#f97316" fill="#f97316" fillOpacity={0.3} isAnimationActive={false} />
                   </AreaChart>
                ) : indicatorType === 'rs' ? (
                  <ComposedChart data={processedData} margin={{ top: 5, right: 20, bottom: 20, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="date" stroke="#64748b" tick={{fontSize: 12}} tickFormatter={(val) => val.slice(5)} minTickGap={40} />
                    <YAxis stroke="#64748b" tick={{fontSize: 12}} domain={['auto', 'auto']} />
                    <Tooltip content={<CustomTooltip marketName={selectedMarket.name} />} />
                    <Legend />
                    <Line type="monotone" dataKey="rs" name="RS (相对强弱)" stroke="#db2777" strokeWidth={2} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="rsSMA20" name="RS MA20" stroke="#9ca3af" strokeWidth={1} strokeDasharray="5 5" dot={false} isAnimationActive={false} />
                  </ComposedChart>
                ) : (
                  <LineChart data={processedData} margin={{ top: 5, right: 20, bottom: 20, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                    <XAxis dataKey="date" stroke="#64748b" tick={{fontSize: 12}} tickFormatter={(val) => val.slice(5)} minTickGap={40} />
                    <YAxis stroke="#64748b" tick={{fontSize: 12}} domain={['auto', 'auto']} />
                    <Tooltip content={<CustomTooltip marketName={selectedMarket.name} />} />
                    <Line type="monotone" dataKey="peRatio" name="市盈率PE" stroke="#a855f7" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </div>

        </div>

        {/* Sidebar / Stats Section */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* Performance Card */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg relative">
            <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4 border-b border-slate-700 pb-2 flex justify-between items-center">
              最新市场表现 (T日)
              <button 
                  onClick={() => setGuideCategory('performance')}
                  className="p-1 text-slate-500 hover:text-blue-400 hover:bg-slate-700/50 rounded-full transition-colors"
                  title="查看指标详解"
                >
                  <HelpCircle className="w-3 h-3" />
                </button>
            </h3>
            
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">{selectedMarket.name}</span>
                <span className={`font-mono font-medium ${currentStats?.marketPct && currentStats.marketPct >= 0 ? "text-red-400" : "text-green-400"}`}>
                  {currentStats?.marketPct?.toFixed(2)}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-400 text-sm">板块 (T-{timeLag})</span>
                <span className={`font-mono font-medium ${currentStats?.sectorPct && currentStats.sectorPct >= 0 ? "text-red-400" : "text-green-400"}`}>
                  {currentStats?.sectorPct?.toFixed(2)}%
                </span>
              </div>
               <div className="flex justify-between items-center bg-slate-700/50 p-2 rounded">
                <span className="text-slate-300 text-sm font-bold flex items-center gap-1">
                  Alpha 差值
                </span>
                <span className={`font-mono font-bold ${currentStats?.spread && currentStats.spread >= 0 ? "text-red-400" : "text-green-400"}`}>
                  {currentStats?.spread && currentStats.spread > 0 ? '+' : ''}{currentStats?.spread?.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Advanced Factors */}
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 shadow-lg relative">
             <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-4 border-b border-slate-700 pb-2 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-3 h-3" />
                AKShare 高级因子 (代理)
               </div>
               <button 
                   onClick={() => setGuideCategory('factors')}
                   className="p-1 text-slate-500 hover:text-blue-400 hover:bg-slate-700/50 rounded-full transition-colors"
                   title="查看指标详解"
                 >
                   <HelpCircle className="w-3 h-3" />
                 </button>
            </h3>
            
            <div className="space-y-5">
              {/* Capital Flow */}
              <div>
                <div className="flex justify-between text-xs mb-1 text-slate-300">
                  <span>成交金额 (亿)</span>
                  <span className="font-mono">{currentStats?.netInflow}</span>
                </div>
                <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden">
                   <div 
                    className={`h-full rounded-full bg-blue-500`} 
                    style={{width: '100%'}}
                  ></div>
                </div>
              </div>

               {/* Sentiment */}
              <div>
                <div className="flex justify-between text-xs mb-1 text-slate-300">
                  <span>振幅 (Amplitude)</span>
                  <span className="font-mono text-orange-400">{currentStats?.amplitude}%</span>
                </div>
                <div className="w-full bg-slate-900 h-1.5 rounded-full">
                   <div 
                    className="h-full rounded-full bg-orange-500"
                    style={{width: `${Math.min(100, (currentStats?.amplitude || 0) * 10)}%`}}
                  ></div>
                </div>
              </div>

               {/* Valuation */}
              <div>
                <div className="flex justify-between text-xs mb-1 text-slate-300">
                  <span>动态市盈率 (Sim)</span>
                  <span className="font-mono">{currentStats?.peRatio}</span>
                </div>
                <div className="flex items-center gap-1 mt-1">
                   <CandlestickChart className="w-3 h-3 text-slate-500"/>
                   <span className="text-[10px] text-slate-500">估值分位: ---</span>
                </div>
              </div>

               {/* Quant Metrics */}
               {quantStats && (
                  <div className="pt-4 border-t border-slate-700 mt-4">
                     <h4 className="text-[10px] text-slate-500 font-bold uppercase mb-3">量化风险指标</h4>
                     <div className="grid grid-cols-2 gap-2">
                        <div className="bg-slate-900/50 p-2 rounded border border-slate-700/50">
                           <div className="text-[10px] text-slate-400 mb-1">Beta (β)</div>
                           <div className={`font-mono font-bold ${quantStats.beta > 1.2 ? 'text-red-400' : quantStats.beta < 0.8 ? 'text-blue-400' : 'text-white'}`}>
                              {quantStats.beta}
                           </div>
                        </div>
                        <div className="bg-slate-900/50 p-2 rounded border border-slate-700/50">
                           <div className="text-[10px] text-slate-400 mb-1">Correlation (ρ)</div>
                            <div className={`font-mono font-bold ${quantStats.correlation > 0.8 ? 'text-emerald-400' : 'text-white'}`}>
                              {quantStats.correlation}
                           </div>
                        </div>
                        <div className="col-span-2 bg-slate-900/50 p-2 rounded border border-slate-700/50 flex justify-between items-center">
                           <div>
                              <div className="text-[10px] text-slate-400">Lead/Lag (Days)</div>
                              <div className="text-[9px] text-slate-500">Max Corr: {quantStats.maxCorrLag?.correlation?.toFixed(2)}</div>
                           </div>
                           <div className={`font-mono font-bold ${quantStats.maxCorrLag?.lag > 0 ? 'text-orange-400' : quantStats.maxCorrLag?.lag < 0 ? 'text-blue-400' : 'text-slate-400'}`}>
                              {quantStats.maxCorrLag?.lag > 0 ? `+${quantStats.maxCorrLag.lag} (Leads)` : quantStats.maxCorrLag?.lag < 0 ? `${quantStats.maxCorrLag.lag} (Lags)` : '0 (Sync)'}
                           </div>
                        </div>
                     </div>
                  </div>
               )}
            </div>
          </div>

          {/* AI Analysis */}
          <div className="bg-gradient-to-br from-indigo-900/50 to-purple-900/50 border border-indigo-500/30 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <BrainCircuit className="w-5 h-5 text-indigo-400" />
              <h3 className="text-white font-semibold text-sm">Gemini 深度研报</h3>
            </div>

            {errorMessage && (
                <div className="text-red-400 text-xs mb-3 bg-red-900/20 p-2 rounded border border-red-900/50">
                    {errorMessage}
                </div>
            )}

            <div className="text-center py-4">
                <button 
                  onClick={handleAnalyze}
                  disabled={isAnalyzing || !selectedSector}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors flex items-center justify-center gap-2 w-full shadow-lg shadow-indigo-500/20"
                >
                  {isAnalyzing ? (
                    <>
                      <RefreshCw className="w-3 h-3 animate-spin" /> 分析报告生成中...
                    </>
                  ) : analysis ? (
                    '重新生成分析报告'
                  ) : (
                    '基于多因子生成分析'
                  )}
                </button>
                {analysis && !isAnalyzing && (
                  <button 
                     onClick={() => setIsReportOpen(true)}
                     className="mt-3 text-xs text-indigo-300 hover:text-white underline"
                  >
                    查看上次报告
                  </button>
                )}
            </div>
          </div>

        </div>
      </main>

      {/* Modals */}
      <IndicatorGuide 
        isOpen={!!guideCategory} 
        onClose={() => setGuideCategory(null)} 
        category={guideCategory || 'all'}
      />

      <AnalysisReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        title={`${selectedSector?.name} vs ${selectedMarket.name} 深度研报`}
        content={analysis?.summary || ''}
        isGenerating={isAnalyzing}
      />

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-2xl w-full max-w-md p-6">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Settings className="w-5 h-5" />
                设置
              </h3>
              <button onClick={() => setIsSettingsOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-300 mb-2">Gemini API Key</label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input 
                    type="password" 
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="输入您的 Google Gemini API Key"
                    className="w-full bg-slate-900 border border-slate-600 text-white pl-10 pr-4 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Key 仅存储在本地浏览器中，用于调用 Gemini 进行分析。
                </p>
              </div>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button 
                onClick={() => setIsSettingsOpen(false)}
                className="px-4 py-2 text-sm text-slate-300 hover:text-white"
              >
                取消
              </button>
              <button 
                onClick={handleSaveKey}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm rounded-lg flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
