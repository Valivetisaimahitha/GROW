'use client';

import React, { useState, useEffect } from 'react';
import { History, Filter, Zap, Clock, Calendar } from 'lucide-react';
import { SeverityBucket } from '@/lib/domain/types';

interface MarketMemoryJournalViewProps {
  onSelectSymbol: (symbol: string) => void;
}

export const MarketMemoryJournalView: React.FC<MarketMemoryJournalViewProps> = ({
  onSelectSymbol,
}) => {
  const [events, setEvents] = useState<any[]>([]);
  const [severityFilter, setSeverityFilter] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);

  const fetchJournal = async () => {
    setLoading(true);
    try {
      const url = `/api/changes${severityFilter !== 'ALL' ? `?severity=${severityFilter}` : ''}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setEvents(json.data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchJournal();
  }, [severityFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 space-y-6 animate-fadeIn">
      {/* Header & Filter Controls */}
      <div className="glass-panel rounded-3xl p-6 border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-xs text-blue-400 font-semibold uppercase tracking-wider mb-1">
            <History className="w-4 h-4 text-cyan-400" />
            <span>Chronological Market Memory</span>
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">Market Change Journal</h2>
          <p className="text-xs text-slate-400 mt-1">
            Historical log of all meaningful market change events detected for your watchlists.
          </p>
        </div>

        {/* Severity Filters */}
        <div className="flex items-center space-x-1.5 bg-slate-900 p-1.5 rounded-2xl border border-slate-800">
          {(['ALL', 'HIGH_ATTENTION', 'SIGNIFICANT', 'WORTH_A_LOOK'] as const).map((sev) => (
            <button
              key={sev}
              onClick={() => setSeverityFilter(sev)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                severityFilter === sev
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {sev.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline Events List */}
      {loading ? (
        <div className="text-center py-12 text-slate-500 text-xs">Loading market journal timeline...</div>
      ) : events.length === 0 ? (
        <div className="glass-panel rounded-3xl p-12 text-center space-y-3">
          <Calendar className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-base font-bold text-white">No historical change events logged yet</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            As you check back over time and market prices move, PulseWatch will archive past change events into this persistent journal.
          </p>
        </div>
      ) : (
        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-800">
          {events.map((evt) => {
            const date = new Date(evt.createdAt);
            const isPos = evt.personalChangePct >= 0;
            return (
              <div key={evt.id} className="relative group">
                {/* Timeline Dot */}
                <div className="absolute -left-[27px] top-1.5 w-3 h-3 rounded-full bg-blue-500 ring-4 ring-[#0b0f19]" />

                <div className="glass-panel glass-panel-hover rounded-2xl p-5 border border-slate-800/90 shadow-xl space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <button
                        onClick={() => onSelectSymbol(evt.symbol)}
                        className="text-lg font-bold text-white hover:text-cyan-400 transition-colors"
                      >
                        {evt.symbol}
                      </button>
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                        {evt.severity.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className={`text-sm font-mono font-bold ${isPos ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isPos ? '+' : ''}{evt.personalChangePct.toFixed(2)}%
                      </span>
                      <span className="text-[10px] text-slate-500 block font-mono">
                        {date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • {date.toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Reasons Array */}
                  <div className="text-xs text-slate-300 space-y-1 bg-slate-900/60 p-3 rounded-xl border border-slate-800/60">
                    {evt.reasons.map((r: any, idx: number) => (
                      <div key={idx} className="flex items-start space-x-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0 mt-1.5" />
                        <span>{r.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
