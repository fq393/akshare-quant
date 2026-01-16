import React from 'react';
import ReactMarkdown from 'react-markdown';
import { X, BrainCircuit, Download, Copy, Check } from 'lucide-react';

interface AnalysisReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  content: string;
  isGenerating: boolean;
}

export const AnalysisReportModal: React.FC<AnalysisReportModalProps> = ({
  isOpen,
  onClose,
  title,
  content,
  isGenerating
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />

      {/* Modal Content */}
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[85vh] animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 bg-slate-900/50 rounded-t-2xl">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-500/10 rounded-lg">
              <BrainCircuit className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white leading-none">{title}</h3>
              <p className="text-xs text-slate-400 mt-1">
                {isGenerating ? 'AI 正在深度思考与撰写...' : '由 Gemini Pro 生成'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {!isGenerating && content && (
              <button 
                onClick={handleCopy}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                title="复制内容"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            )}
            <button 
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
          {content ? (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown>{content}</ReactMarkdown>
            </div>
          ) : (
             <div className="flex flex-col items-center justify-center h-64 text-slate-500 space-y-4">
               {isGenerating ? (
                 <>
                    <div className="relative w-12 h-12">
                      <div className="absolute inset-0 border-4 border-indigo-500/20 rounded-full"></div>
                      <div className="absolute inset-0 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                    <p className="text-sm animate-pulse">正在分析大盘与板块数据...</p>
                 </>
               ) : (
                 <p>暂无分析内容</p>
               )}
             </div>
          )}
           
           {/* Typing Cursor */}
           {isGenerating && content && (
             <span className="inline-block w-2 h-4 bg-indigo-500 ml-1 animate-pulse align-middle"></span>
           )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50 rounded-b-2xl flex justify-between items-center text-xs text-slate-500">
          <span>* 分析结果仅供参考，不构成投资建议</span>
          <div className="flex gap-2">
             <span className="px-2 py-1 bg-slate-800 rounded border border-slate-700">AKShare Real-Data</span>
             <span className="px-2 py-1 bg-slate-800 rounded border border-slate-700">Fréchet Algo</span>
          </div>
        </div>
      </div>
    </div>
  );
};
