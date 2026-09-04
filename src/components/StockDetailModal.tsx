'use client';

import React, { useState, useEffect } from 'react';
import { 
  X, 
  ArrowUpRight, 
  ArrowDownRight, 
  Activity, 
  Clock, 
  Zap, 
  BarChart2, 
  ShieldCheck,
  TrendingUp,
  Info
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';
import { ChangeEventDomain } from '@/lib/domain/types';

interface StockDetailModalProps {
  event: ChangeEventDomain | null;
  symbol: string | null;
  onClose: () => void;
}

export const StockDetailModal: React.FC<StockDetailModalProps> = ({ event, symbol, onClose }) => {
  const activeSymbol = event?.symbol || symbol;
  const [timeframe, setTimeframe] = useState<'1D' | '1W' | '1M' | '3M'>('1M');
  const [chartData, setChartData] = useState<{ timestamp: string; price: number }[]>([]);
  const [loadingChart, setLoadingChart] = useState(false);

  useEffect(() => {
    if (!activeSymbol) return;
    const fetchHistory = async () => {
      setLoadingChart(true);
      try {
        const res = await fetch(`/api/market/history/${activeSymbol}?timeframe=${timeframe}`);
        const json = await res.json();
        if (json.success) {
          setChartData(json.data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingChart(false);
      }
    };
    fetchHistory();
  }, [activeSymbol, timeframe]);

  if (!activeSymbol) return null;

  const currentPrice = event?.currentPrice || 1500;
  const isPosPersonal = (event?.personalChangePct || 0) >= 0;
  const isPosToday = (event?.todayChangePct || 0) >= 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="glass-panel w-full max-w-4xl rounded-3xl p-6 lg:p-8 border border-slate-800 shadow-2xl space-y-6 my-8 animate-fadeIn">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center space-x-3">
              <h2 className="text-2xl font-extrabold text-white tracking-tight">{activeSymbol}</h2>
              {event?.severity && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/30">
                  {event.severity}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 font-medium">
              {event?.companyName || `${activeSymbol} Limited`} • NSE
            </p>
          </div>

          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 3 Baselines Comparison Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Baseline 1: Personal Baseline */}
          <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800/80">
            <span className="text-[11px] font-semibold text-cyan-400 uppercase tracking-wider block">
              1. Personal Baseline
            </span>
            <span className="text-xs text-slate-400 block mt-0.5">What changed since YOU last checked</span>
            <div className={`text-xl font-bold font-mono mt-2 ${isPosPersonal ? 'text-emerald-400' : 'text-rose-400'}`}>
              {event?.dataQuality?.status === 'UNAVAILABLE' || event?.personalChangePct === null || event?.personalChangePct === undefined
                ? 'Unavailable' 
                : event?.isFirstVisit 
                  ? 'Baseline Set' 
                  : `${isPosPersonal ? '+' : ''}${event.personalChangePct.toFixed(2)}%`}
            </div>
            <span className="text-[10px] text-slate-500 block mt-1 font-mono">
              {event?.previousObservationPrice !== null && event?.previousObservationPrice !== undefined
                ? `Previous: ₹${event.previousObservationPrice.toFixed(2)}` 
                : 'First Visit'}
            </span>
          </div>

          {/* Baseline 2: Market Baseline */}
          <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800/80">
            <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider block">
              2. Market Baseline
            </span>
            <span className="text-xs text-slate-400 block mt-0.5">Today's intraday change vs close</span>
            <div className={`text-xl font-bold font-mono mt-2 ${isPosToday ? 'text-emerald-400' : 'text-rose-400'}`}>
              {event?.dataQuality?.status === 'UNAVAILABLE' || event?.todayChangePct === null || event?.todayChangePct === undefined
                ? 'Unavailable'
                : `${isPosToday ? '+' : ''}${event.todayChangePct.toFixed(2)}%`}
            </div>
            <span className="text-[10px] text-slate-500 block mt-1 font-mono">
              {event?.currentPrice !== null && event?.currentPrice !== undefined
                ? `Current Price: ₹${event.currentPrice.toFixed(2)}`
                : 'Price Unavailable'}
            </span>
          </div>

          {/* Baseline 3: Behavioral Baseline */}
          <div className="bg-slate-900/90 p-4 rounded-2xl border border-slate-800/80">
            <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider block">
              3. Behavioral Baseline
            </span>
            <span className="text-xs text-slate-400 block mt-0.5">Unusualness vs typical move</span>
            <div className="text-xl font-bold font-mono text-amber-400 mt-2">
              {(event?.unusualnessFactor || 1.0).toFixed(1)}×
            </div>
            <span className="text-[10px] text-slate-500 block mt-1">
              Volume: {(event?.volumeAnomalyRatio || 1.0).toFixed(1)}× baseline
            </span>
          </div>
        </div>

        {/* Explainable Signals & Reasons */}
        {event && (
          <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-2">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
              <Zap className="w-4 h-4 text-cyan-400" />
              <span>Attention Engine Explanation (Score: {event.attentionScore}/100)</span>
            </h4>
            <div className="space-y-1.5 text-xs text-slate-300 pt-1">
              {event.reasons.map((reason, idx) => (
                <div key={idx} className="flex items-center space-x-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                  <span>{reason.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Financial Chart Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center space-x-1.5">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <span>Historical Price Chart</span>
            </h4>

            {/* Timeframe selector */}
            <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
              {(['1D', '1W', '1M', '3M'] as const).map((tf) => (
                <button
                  key={tf}
                  onClick={() => setTimeframe(tf)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold font-mono transition-all ${
                    timeframe === tf ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          </div>

          <div className="h-64 w-full bg-slate-950/60 p-4 rounded-2xl border border-slate-800/80">
            {loadingChart ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                Loading chart...
              </div>
            ) : chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                Historical chart data unavailable
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0066ff" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0066ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="timestamp" hide />
                  <YAxis domain={['auto', 'auto']} hide />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                    labelStyle={{ color: '#94a3b8' }}
                  />
                  <Area type="monotone" dataKey="price" stroke="#0066ff" strokeWidth={2} fillOpacity={1} fill="url(#chartGradient)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end pt-2">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-all"
          >
            Close Inspection
          </button>
        </div>
      </div>
    </div>
  );
};
