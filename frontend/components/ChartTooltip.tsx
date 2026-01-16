import React from 'react';
import { TooltipProps } from 'recharts';
import { DailyData } from '../types';

interface CustomTooltipProps {
  active?: boolean;
  payload?: any[];
  label?: string;
  marketName: string;
}

export const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label, marketName }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload as DailyData;

    return (
      <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg shadow-xl text-xs backdrop-blur-md bg-opacity-95 z-50 min-w-[180px]">
        <p className="font-semibold text-slate-300 mb-2 border-b border-slate-700 pb-1">{label}</p>
        
        <div className="space-y-2">
          {/* 基础行情 */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              <span className="text-slate-400">{marketName}:</span>
            </div>
            <div className="flex items-center gap-2">
               <span className="font-mono text-slate-300">{data.marketPrice.toFixed(2)}</span>
               <span className={`font-mono font-medium text-[10px] ${data.marketPct >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                ({data.marketPct >= 0 ? '+' : ''}{data.marketPct.toFixed(2)}%)
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-purple-500"></span>
              <span className="text-slate-400">行业板块:</span>
            </div>
             <div className="flex items-center gap-2">
               <span className="font-mono text-slate-300">{data.sectorPrice.toFixed(2)}</span>
               <span className={`font-mono font-medium text-[10px] ${data.sectorPct >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                ({data.sectorPct >= 0 ? '+' : ''}{data.sectorPct.toFixed(2)}%)
              </span>
            </div>
          </div>
          
          <div className="h-px bg-slate-700/50 my-1"></div>
          
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span className="text-slate-200 font-bold">超额收益:</span>
            </div>
            <span className={`font-mono font-bold ${data.spread >= 0 ? 'text-red-400' : 'text-green-400'}`}>
              {data.spread > 0 ? '+' : ''}{data.spread.toFixed(2)}
            </span>
          </div>

          <div className="mt-2 pt-2 border-t border-slate-700 grid grid-cols-2 gap-x-2 gap-y-1 text-[10px] text-slate-500">
             <div className="flex justify-between">
                <span>资金:</span>
                <span className={`font-mono ${data.netInflow >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                  {data.netInflow}亿
                </span>
             </div>
             <div className="flex justify-between">
                <span>情绪(振幅):</span>
                <span className="font-mono text-orange-400">{data.amplitude}%</span>
             </div>
             <div className="flex justify-between col-span-2">
                <span>估值(PE):</span>
                <span className="font-mono text-blue-300">{data.peRatio}</span>
             </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
};