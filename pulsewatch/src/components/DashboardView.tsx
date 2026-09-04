'use client';

import React, { useState } from 'react';
import { 
  Sparkles, 
  ChevronDown, 
  ChevronUp, 
  Layers, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  ShieldCheck,
  Plus
} from 'lucide-react';
import { ChangeCard } from './ChangeCard';
import { DashboardPayload, ChangeEventDomain } from '@/lib/domain/types';

interface DashboardViewProps {
  payload: DashboardPayload | null;
  loading: boolean;
  onSelectStock: (event: ChangeEventDomain) => void;
  onGoToWatchlist: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  payload,
  loading,
  onSelectStock,
  onGoToWatchlist,
}) => {
  const [showLowerSignal, setShowLowerSignal] = useState(false);

  if (loading || !payload) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
        {/* Skeleton Header */}
        <div className="h-32 rounded-2xl bg-slate-900/60 border border-slate-800 animate-pulse" />
        {/* Skeleton Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 rounded-2xl bg-slate-900/40 border border-slate-800 animate-pulse" />
          <div className="h-64 rounded-2xl bg-slate-900/40 border border-slate-800 animate-pulse" />
        </div>
      </div>
    );
  }

  const { summary, meaningfulChanges, lowerSignalChanges, dataQualitySummary, isFirstVisit, lastCheckedAt, marketStatus } = payload;
  const lastCheckedDate = new Date(lastCheckedAt);

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 space-y-8 animate-fadeIn">
      {/* "Since You Were Away" Hero Card */}
      <div className="glass-panel rounded-3xl p-6 lg:p-8 border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <div className="flex items-center space-x-2 text-xs text-blue-400 font-semibold tracking-wider uppercase mb-1">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>Personal Market Memory</span>
            </div>
            <h2 className="text-2xl lg:text-3xl font-extrabold text-white tracking-tight">
              Since You Were Away
            </h2>
            <p className="text-xs lg:text-sm text-slate-400 mt-1 flex items-center space-x-1.5">
              <Clock className="w-4 h-4 text-slate-500" />
              <span>
                Last checked: {lastCheckedDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {lastCheckedDate.toLocaleDateString()}
              </span>
            </p>
          </div>

          {/* Attention Budget Summary Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800/80 text-center">
              <span className="text-[11px] text-slate-400 block font-medium">Tracked</span>
              <span className="text-xl font-bold font-mono text-white">{summary.tracked}</span>
              <span className="text-[10px] text-slate-500 block">Securities</span>
            </div>

            <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800/80 text-center">
              <span className="text-[11px] text-slate-400 block font-medium">Changed</span>
              <span className="text-xl font-bold font-mono text-cyan-400">{summary.changed}</span>
              <span className="text-[10px] text-slate-500 block">Movements</span>
            </div>

            <div className="bg-gradient-to-b from-blue-900/30 to-slate-900 p-3.5 rounded-2xl border border-blue-500/30 text-center relative">
              <span className="text-[11px] text-blue-300 block font-semibold">Attention</span>
              <span className="text-xl font-bold font-mono text-amber-400">{summary.meaningful}</span>
              <span className="text-[10px] text-blue-400/80 block font-medium">Meaningful</span>
            </div>

            <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-slate-800/80 text-center">
              <span className="text-[11px] text-slate-400 block font-medium">Filtered</span>
              <span className="text-xl font-bold font-mono text-slate-400">{summary.lowerSignal}</span>
              <span className="text-[10px] text-slate-500 block">Low signal</span>
            </div>
          </div>
        </div>

        {/* First Visit Banner */}
        {isFirstVisit && (
          <div className="mt-6 p-4 rounded-2xl bg-blue-950/40 border border-blue-500/30 flex items-start space-x-3 text-xs">
            <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-bold text-cyan-300 text-sm">Welcome to your Personal Market Memory</h4>
              <p className="text-slate-300 mt-0.5">
                We have established your initial baseline observation prices for tracked securities. 
                When you return later, PulseWatch will highlight exactly what changed since this visit!
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Meaningful Changes Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse" />
            <h3 className="text-lg font-bold text-white tracking-tight">
              Meaningful Changes ({meaningfulChanges.length})
            </h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            Filtered for Signal over Noise
          </span>
        </div>

        {meaningfulChanges.length === 0 ? (
          <div className="glass-panel rounded-2xl p-8 text-center space-y-3">
            <CheckCircle className="w-10 h-10 text-emerald-400 mx-auto opacity-80" />
            <h4 className="text-base font-bold text-white">Nothing major changed while you were away</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              All tracked securities remained stable within expected volatility ranges. 
              {summary.lowerSignal > 0 && ` ${summary.lowerSignal} minor low-signal movements were filtered below your attention threshold.`}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {meaningfulChanges.map((evt) => (
              <ChangeCard key={evt.symbol} event={evt} marketStatus={marketStatus} onSelect={onSelectStock} />
            ))}
          </div>
        )}
      </div>

      {/* Expandable Lower Signal Changes Section */}
      {lowerSignalChanges.length > 0 && (
        <div className="pt-4 border-t border-slate-800/80">
          <button
            onClick={() => setShowLowerSignal(!showLowerSignal)}
            className="w-full flex items-center justify-between p-4 rounded-2xl bg-slate-900/60 border border-slate-800 hover:bg-slate-900 transition-colors text-xs font-semibold text-slate-300"
          >
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-slate-500" />
              <span>See {lowerSignalChanges.length} lower-signal movements below attention threshold</span>
            </div>
            {showLowerSignal ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showLowerSignal && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
              {lowerSignalChanges.map((evt) => (
                <ChangeCard key={evt.symbol} event={evt} marketStatus={marketStatus} onSelect={onSelectStock} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
