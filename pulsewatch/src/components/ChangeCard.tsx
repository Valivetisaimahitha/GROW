'use client';

import React, { useState } from 'react';
import { 
  ArrowUpRight, 
  ArrowDownRight, 
  ChevronDown, 
  ChevronUp, 
  Info, 
  Clock, 
  ShieldAlert, 
  Zap, 
  BarChart2,
  CheckCircle2
} from 'lucide-react';
import { ChangeEventDomain, SeverityBucket } from '@/lib/domain/types';

interface ChangeCardProps {
  event: ChangeEventDomain;
  marketStatus?: 'OPEN' | 'CLOSED' | 'PRE_OPEN';
  onSelect: (event: ChangeEventDomain) => void;
}

export const ChangeCard: React.FC<ChangeCardProps> = ({ event, marketStatus, onSelect }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const isPosPersonal = (event.personalChangePct ?? 0) >= 0;
  const isPosToday = (event.todayChangePct ?? 0) >= 0;
  const isUnavailable = event.dataQuality?.status === 'UNAVAILABLE';
  const isClosed = marketStatus === 'CLOSED';

  // Severity Badge Styling
  const getSeverityBadge = (sev: SeverityBucket) => {
    switch (sev) {
      case 'HIGH_ATTENTION':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-rose-500/15 text-rose-400 border border-rose-500/30 flex items-center space-x-1">
            <Zap className="w-3 h-3 text-rose-400" />
            <span>High Attention</span>
          </span>
        );
      case 'SIGNIFICANT':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center space-x-1">
            <Zap className="w-3 h-3 text-amber-400" />
            <span>Significant Move</span>
          </span>
        );
      case 'WORTH_A_LOOK':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">
            Worth a Look
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium uppercase text-slate-400 bg-slate-800 border border-slate-700">
            Normal
          </span>
        );
    }
  };

  return (
    <div className="glass-panel glass-panel-hover rounded-2xl p-5 border border-slate-800/90 shadow-xl relative overflow-hidden">
      {/* Top Accent Line for High Attention */}
      {event.severity === 'HIGH_ATTENTION' && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-rose-500 via-amber-500 to-rose-500" />
      )}
      {event.severity === 'SIGNIFICANT' && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-amber-500" />
      )}

      {/* Header Row */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <h3 className="text-lg font-bold text-white tracking-tight">{event.symbol}</h3>
            {getSeverityBadge(event.severity)}
          </div>
          <p className="text-xs text-slate-400 font-medium truncate max-w-[200px]">
            {event.companyName}
          </p>
        </div>

        {/* Current Price & Day Move */}
        <div className="text-right">
          <div className="text-lg font-mono font-bold text-white">
            {isUnavailable || event.currentPrice === null
              ? (event.previousObservationPrice !== null && event.previousObservationPrice !== undefined
                  ? `₹${event.previousObservationPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })} (Last)`
                  : 'Price Unavailable')
              : `₹${event.currentPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`}
          </div>
          {isUnavailable || event.todayChangePct === null ? (
            <div className="text-xs font-semibold text-amber-400 flex items-center justify-end space-x-0.5">
              <span>Data Unavailable</span>
            </div>
          ) : (
            <div className={`text-xs font-semibold flex items-center justify-end space-x-0.5 ${isPosToday ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isPosToday ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              <span>{isPosToday ? '+' : ''}{event.todayChangePct.toFixed(2)}% {isClosed ? 'at last close' : 'today'}</span>
            </div>
          )}
        </div>
      </div>

      {/* Core Personal Baseline Callout */}
      <div className="mt-4 p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between">
        <div>
          <span className="text-[11px] text-slate-400 uppercase font-semibold tracking-wider block">
            Since You Last Checked
          </span>
          <span className="text-xs text-slate-500 font-mono">
            {event.previousObservationPrice !== null && event.previousObservationPrice !== undefined
              ? `Was ₹${event.previousObservationPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`
              : 'First Visit (Baseline Set)'}
          </span>
        </div>

        <div className="text-right">
          {isUnavailable || event.personalChangePct === null ? (
            <span className="text-xs font-medium text-amber-400 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/50">
              Unavailable
            </span>
          ) : event.isFirstVisit ? (
            <span className="text-xs font-medium text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-800/50">
              Initial Baseline
            </span>
          ) : (
            <div className={`text-sm font-bold font-mono ${isPosPersonal ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isPosPersonal ? '+' : ''}{event.personalChangePct.toFixed(2)}%
            </div>
          )}
        </div>
      </div>

      {/* Explanations & Signals Drawer */}
      <div className="mt-4 pt-3 border-t border-slate-800/60">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <div className="flex items-center space-x-1.5 font-medium">
            <Info className="w-3.5 h-3.5 text-cyan-400" />
            <span>Why am I seeing this? ({event.reasons.length} signals)</span>
          </div>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {isExpanded && (
          <div className="mt-3 space-y-2 text-xs bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 animate-fadeIn">
            {event.reasons.map((reason, idx) => (
              <div key={idx} className="flex items-start space-x-2 text-slate-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                <span>{reason.text}</span>
              </div>
            ))}

            {/* Additional Behavioral Metrics Breakdown */}
            <div className="mt-3 pt-2 border-t border-slate-800 text-[11px] grid grid-cols-2 gap-2 text-slate-400">
              <div>
                <span className="text-slate-500 block">Unusualness Factor</span>
                <span className="font-mono text-slate-200">{event.unusualnessFactor}× baseline</span>
              </div>
              <div>
                <span className="text-slate-500 block">Volume Ratio</span>
                <span className="font-mono text-slate-200">{event.volumeAnomalyRatio}× average</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Card Footer */}
      <div className="mt-4 pt-3 border-t border-slate-800/40 flex items-center justify-between text-xs">
        <div className="flex items-center space-x-2 text-slate-500 text-[11px]">
          <Clock className="w-3 h-3" />
          <span>{event.dataQuality.message}</span>
          {event.confidence === 'LOW' && (
            <span className="text-amber-400 flex items-center space-x-0.5">
              <ShieldAlert className="w-3 h-3" />
              <span>Low Confidence</span>
            </span>
          )}
        </div>

        <button
          onClick={() => onSelect(event)}
          className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-300 hover:bg-blue-600 hover:text-white transition-all font-semibold text-xs border border-blue-500/30"
        >
          <BarChart2 className="w-3.5 h-3.5" />
          <span>View Details</span>
        </button>
      </div>
    </div>
  );
};
