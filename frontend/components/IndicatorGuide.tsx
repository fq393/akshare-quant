import React from 'react';
import { X, TrendingUp, Activity, BarChart3, Scale, Clock, Percent } from 'lucide-react';

export type GuideCategory = 'all' | 'performance' | 'factors' | 'charts' | 'trend';

interface IndicatorGuideProps {
  isOpen: boolean;
  onClose: () => void;
  category?: GuideCategory;
}

export const IndicatorGuide: React.FC<IndicatorGuideProps> = ({ isOpen, onClose, category = 'all' }) => {
  if (!isOpen) return null;

  const showAll = category === 'all';
  const showPerformance = category === 'performance' || showAll;
  const showFactors = category === 'factors' || showAll;
  const showCharts = category === 'charts' || showAll;
  const showTrend = category === 'trend' || showAll;

  // Chart view needs almost everything, so let's adjust logic
  // If chart: show Lag, Alpha, Turnover, Amplitude, PE (basically everything except maybe simple Pct if redundant)
  // Actually, let's keep it clean.
  
  const shouldShow = (section: 'pct' | 'alpha' | 'turnover' | 'amplitude' | 'pe' | 'lag' | 'trend' | 'rs' | 'quant') => {
    if (showAll) return true;
    if (category === 'performance') return ['pct', 'alpha'].includes(section);
    if (category === 'factors') return ['turnover', 'amplitude', 'pe', 'rs', 'quant'].includes(section);
    if (category === 'charts') return ['alpha', 'turnover', 'amplitude', 'pe', 'rs'].includes(section);
    if (category === 'trend') return ['trend', 'lag'].includes(section);
    return false;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto relative animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-700 p-6 flex justify-between items-center z-10">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Activity className="text-blue-500 w-6 h-6" />
            量化指标新手指南
          </h2>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-full text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-8">
          
          {/* -1. Cumulative Trend (Only for Trend) */}
          {shouldShow('trend') && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-blue-400 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                累计收益趋势 (Cumulative Trend)
              </h3>
              <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 space-y-2">
                <p className="text-slate-300 text-sm leading-relaxed">
                  <span className="font-bold text-white">定义：</span> 从选定时间起点开始计算的累计涨跌幅曲线
                </p>
                <p className="text-slate-300 text-sm leading-relaxed">
                  <span className="font-bold text-white">小白解释：</span> 
                  反映了如果您在那一天买入并持有到现在的<span className="text-blue-300">"总收益"</span>。
                  <br/>
                  • <span className="text-blue-400">蓝色线</span>：大盘走势（基准）。
                  <br/>
                  • <span className="text-purple-400">紫色线</span>：板块走势。如果紫色线在蓝色线上方，说明板块跑赢了大盘。
                </p>
              </div>
            </div>
          )}

           {/* 0. Daily Pct Change (Only for Performance) */}
           {shouldShow('pct') && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                <Percent className="w-5 h-5" />
                单日涨跌幅 (Daily Change)
              </h3>
              <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 space-y-2">
                <p className="text-slate-300 text-sm leading-relaxed">
                  <span className="font-bold text-white">定义：</span> (今日收盘价 - 昨日收盘价) / 昨日收盘价
                </p>
                <p className="text-slate-300 text-sm leading-relaxed">
                  <span className="font-bold text-white">小白解释：</span> 
                  就是大家常说的<span className="text-slate-200">"今天涨了多少点"</span>。
                  <br/>
                  • <span className="text-white">板块 (T-Lag)</span>：如果您设置了滞后天数（Lag），这里显示的就是“几天前”那一天的涨跌幅，用来和“今天”的大盘做对比。
                </p>
              </div>
            </div>
          )}

          {/* 1. Alpha Spread */}
          {shouldShow('alpha') && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-emerald-400 flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                超额收益 (Alpha Spread)
              </h3>
              <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 space-y-2">
                <p className="text-slate-300 text-sm leading-relaxed">
                  <span className="font-bold text-white">定义：</span> 板块涨跌幅 - 大盘涨跌幅
                </p>
                <p className="text-slate-300 text-sm leading-relaxed">
                  <span className="font-bold text-white">小白解释：</span> 
                  这是判断板块是否<span className="text-emerald-300">"跑赢大盘"</span>的核心指标。
                  <br/>
                  • <span className="text-red-400">正值 (+)</span>：板块比大盘强。比如大盘涨1%，板块涨3%，超额收益就是+2%。
                  <br/>
                  • <span className="text-green-400">负值 (-)</span>：板块比大盘弱。比如大盘涨1%，板块跌1%，超额收益就是-2%。
                </p>
              </div>
            </div>
          )}

          {/* 2. Relative Strength (RS) */}
          {shouldShow('rs') && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-pink-400 flex items-center gap-2">
                <Activity className="w-5 h-5" />
                相对强弱 (Relative Strength, RS)
              </h3>
              <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 space-y-2">
                <p className="text-slate-300 text-sm leading-relaxed">
                  <span className="font-bold text-white">定义：</span> RS = 板块累计净值 / 大盘累计净值
                </p>
                <p className="text-slate-300 text-sm leading-relaxed">
                  <span className="font-bold text-white">小白解释：</span> 
                  这是比Alpha更直观的“强弱对比”曲线。
                  <br/>
                  • <span className="text-pink-400">曲线向上</span>：板块正在变强，吸血大盘。
                  <br/>
                  • <span className="text-pink-400">曲线向下</span>：板块正在变弱，跑输大盘。
                  <br/>
                  • <span className="text-slate-400">虚线 (MA20)</span>：RS的20日均线。当RS实线突破虚线向上时，通常是<span className="text-emerald-300">"强势确立"</span>的买点信号。
                </p>
              </div>
            </div>
          )}

          {/* 3. Turnover / Net Inflow */}
          {shouldShow('turnover') && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-blue-400 flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                成交额 (Turnover)
              </h3>
              <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 space-y-2">
                <p className="text-slate-300 text-sm leading-relaxed">
                  <span className="font-bold text-white">定义：</span> 该板块当日的总成交金额（亿元）
                </p>
                <p className="text-slate-300 text-sm leading-relaxed">
                  <span className="font-bold text-white">小白解释：</span> 
                  反映了资金的关注度，也就是<span className="text-blue-300">"人气"</span>。
                  <br/>
                  • <span className="text-white">放量</span>：成交额变大，说明很多人在买卖，热度高。
                  <br/>
                  • <span className="text-white">缩量</span>：成交额变小，说明没人玩，关注度低。
                </p>
              </div>
            </div>
          )}

          {/* 4. Amplitude */}
          {shouldShow('amplitude') && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-orange-400 flex items-center gap-2">
                <Activity className="w-5 h-5" />
                板块振幅 (Amplitude)
              </h3>
              <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 space-y-2">
                <p className="text-slate-300 text-sm leading-relaxed">
                  <span className="font-bold text-white">定义：</span> (最高价 - 最低价) / 昨收价
                </p>
                <p className="text-slate-300 text-sm leading-relaxed">
                  <span className="font-bold text-white">小白解释：</span> 
                  反映了日内价格波动的<span className="text-orange-300">"激烈程度"</span>。
                  <br/>
                  • <span className="text-white">振幅大</span>：多空双方分歧大，价格上蹿下跳，风险与机会并存。
                  <br/>
                  • <span className="text-white">振幅小</span>：走势平稳，或者死气沉沉。
                </p>
              </div>
            </div>
          )}

          {/* 5. PE Ratio */}
          {shouldShow('pe') && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-purple-400 flex items-center gap-2">
                <Scale className="w-5 h-5" />
                动态市盈率 (PE-TTM)
              </h3>
              <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 space-y-2">
                <p className="text-slate-300 text-sm leading-relaxed">
                  <span className="font-bold text-white">定义：</span> 总市值 / 过去12个月净利润
                </p>
                <p className="text-slate-300 text-sm leading-relaxed">
                  <span className="font-bold text-white">小白解释：</span> 
                  衡量东西<span className="text-purple-300">"贵不贵"</span>的尺子。
                  <br/>
                  • <span className="text-white">低PE</span>：通常代表便宜，或者大家预期它未来不增长。
                  <br/>
                  • <span className="text-white">高PE</span>：通常代表贵，或者大家预期它未来会高增长。
                  <br/>
                  <span className="text-slate-500 text-xs">*注：不同行业PE差异很大，比如银行通常低PE，科技通常高PE，不能直接横向比。</span>
                </p>
              </div>
            </div>
          )}

          {/* 6. Quant Risk Metrics */}
          {shouldShow('quant') && (
             <div className="space-y-3">
               <h3 className="text-lg font-semibold text-red-400 flex items-center gap-2">
                 <Scale className="w-5 h-5" />
                 量化风险指标 (Beta, Correlation, Lead/Lag)
               </h3>
               <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 space-y-4">
                 <div>
                   <h4 className="text-white font-bold text-sm mb-1">1. Beta (β) 系数</h4>
                   <p className="text-slate-300 text-sm">
                     衡量板块相对于大盘的<span className="text-red-300">波动弹性</span>。<br/>
                    • β &gt; 1：进攻型。大盘涨1%，它可能涨1.5%。(高风险高收益)<br/>
                    • β &lt; 1：防御型。大盘跌1%，它可能只跌0.5%。(抗跌)
                  </p>
                </div>
                <div>
                  <h4 className="text-white font-bold text-sm mb-1">2. Correlation (ρ) 相关性</h4>
                  <p className="text-slate-300 text-sm">
                    衡量板块与大盘的<span className="text-emerald-300">同步程度</span> (0到1)。<br/>
                    • ρ &gt; 0.8：高度同步，基本跟着大盘走。<br/>
                    • ρ &lt; 0.5：走出独立行情，适合做Alpha配置。
                   </p>
                 </div>
                 <div>
                   <h4 className="text-white font-bold text-sm mb-1">3. Lead/Lag (时差相关性)</h4>
                   <p className="text-slate-300 text-sm">
                     通过滑动时间窗口发现板块是<span className="text-orange-300">领先</span>还是<span className="text-blue-300">滞后</span>于大盘。<br/>
                     • <span className="text-orange-400">Leads (+Days)</span>：板块先行指标。比如"Leads +5"，意味着板块现在的走势可能预示了大盘5天后的方向。<br/>
                     • <span className="text-blue-400">Lags (-Days)</span>：板块滞后反应。比如"Lags -3"，意味着大盘动了之后，这板块平均要慢3天才跟上。
                   </p>
                 </div>
               </div>
             </div>
          )}

          {/* 7. Time Lag & Similarity */}
          {shouldShow('lag') && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold text-slate-300 flex items-center gap-2">
                <Clock className="w-5 h-5" />
                相似度分析 (Fréchet & DTW)
              </h3>
              <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 space-y-2">
                <p className="text-slate-300 text-sm leading-relaxed">
                  <span className="font-bold text-white">定义：</span> 
                  <br/>
                  1. <span className="text-emerald-300">Fréchet Distance</span>: “遛狗绳”距离。衡量两条曲线形态的最大偏离程度。
                  <br/>
                  2. <span className="text-blue-300">DTW (动态时间规整)</span>: 能够识别时间轴压缩/拉伸的相似度（比如板块走势和大盘很像，但是慢半拍，DTW也能识别出来）。
                </p>
                <p className="text-slate-300 text-sm leading-relaxed">
                  <span className="font-bold text-white">小白解释：</span> 
                  <br/>
                  • <span className="text-white">分数越高 (接近100)</span>：说明板块和大盘走势形态越像。
                  <br/>
                  • <span className="text-white">Lag (滞后天数)</span>：
                  拖动 Lag 滑块，寻找相似度最高的分数，那个 Lag 天数可能就是该板块对大盘的“反应延迟时间”。
                </p>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-900/95 backdrop-blur border-t border-slate-700 p-6 z-10">
          <button 
            onClick={onClose}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            我明白了
          </button>
        </div>

      </div>
    </div>
  );
};
