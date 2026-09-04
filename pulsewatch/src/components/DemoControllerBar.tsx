'use client';

import React, { useState } from 'react';
import { FastForward, RefreshCw, Sliders, ChevronDown, ChevronUp } from 'lucide-react';
import { DemoScenarioType } from '@/lib/domain/types';

interface DemoControllerBarProps {
  currentScenario: DemoScenarioType;
  timeShiftMinutes: number;
  onScenarioChange: (scenario: DemoScenarioType) => void;
  onAdvanceTime: (minutes: number) => void;
  onResetDemo: () => void;
}

const SCENARIOS: { id: DemoScenarioType; label: string; desc: string }[] = [
  { id: 'NORMAL_NOISE', label: '1. Normal Noise', desc: 'Minor movements; filters noise' },
  { id: 'SIGNIFICANT_SINGLE_MOVE', label: '2. Major Spike (INFY)', desc: '+4.5% move with 2.6x volume' },
  { id: 'MULTIPLE_MOVES', label: '3. Broad Shift', desc: 'Multiple stocks moving significantly' },
  { id: 'UNUSUAL_VOLATILITY', label: '4. Unusual Vol (ITC)', desc: '+2.1% move on low-vol stock' },
  { id: 'STALE_DATA', label: '5. Stale Data', desc: '42m old quote with low confidence' },
  { id: 'PROVIDER_FAILURE', label: '6. Provider Failure', desc: 'Graceful fallback display' },
  { id: 'MARKET_CLOSED', label: '7. Market Closed', desc: 'Exchange closed state' },
  { id: 'PERSONAL_BASELINE_DIVERGENCE', label: '8. Personal Divergence', desc: 'Same market + different user baselines = different personal moves' },
];

export const DemoControllerBar: React.FC<DemoControllerBarProps> = ({
  currentScenario,
  timeShiftMinutes,
  onScenarioChange,
  onAdvanceTime,
  onResetDemo,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  const activeScenarioObj = SCENARIOS.find(s => s.id === currentScenario);

  const handleApplyScenario = async (sc: DemoScenarioType) => {
    setLoading(true);
    await onScenarioChange(sc);
    setLoading(false);
  };

  const handleAdvance = async (mins: number) => {
    setLoading(true);
    await onAdvanceTime(mins);
    setLoading(false);
  };

  const handleReset = async () => {
    if (confirm('Reset demo state? This will restore clean initial observations for evaluation.')) {
      setLoading(true);
      await onResetDemo();
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900/95 border-b border-indigo-500/30 text-xs transition-all duration-200">
      {/* Compact Header Bar (Always Visible) */}
      <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center space-x-2 min-w-0">
          <div className="px-2 py-0.5 rounded bg-indigo-600 text-white font-semibold font-mono text-[10px] uppercase flex items-center space-x-1 shrink-0">
            <Sliders className="w-3 h-3" />
            <span>Judge Demo</span>
          </div>
          
          <div className="flex items-center space-x-2 text-slate-300 font-mono text-[11px] truncate">
            <span className="text-slate-400 shrink-0">Scenario:</span>
            <span className="text-indigo-300 font-medium truncate">
              {activeScenarioObj ? activeScenarioObj.label : currentScenario}
            </span>
            {timeShiftMinutes > 0 && (
              <span className="text-cyan-400 font-mono text-[11px] shrink-0">
                (+{timeShiftMinutes}m)
              </span>
            )}
          </div>
        </div>

        <button
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse Judge Demo Controller' : 'Expand Judge Demo Controller'}
          className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-indigo-950/60 hover:bg-indigo-900/80 text-indigo-300 border border-indigo-500/30 font-medium text-[11px] transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <span>{isExpanded ? 'Collapse' : 'Expand Controls'}</span>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Expanded Controls Panel */}
      {isExpanded && (
        <div className="border-t border-slate-800 bg-slate-950/80 px-4 py-3 animate-fadeIn">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center space-x-2 text-slate-400 font-mono text-[11px]">
              <span>Simulation Pipeline: Provider ➔ AttentionEngine ➔ ChangeEvent</span>
            </div>

            {/* Scenario Selectors */}
            <div className="flex flex-wrap items-center gap-1.5">
              {SCENARIOS.map(sc => {
                const isActive = currentScenario === sc.id;
                return (
                  <button
                    key={sc.id}
                    onClick={() => handleApplyScenario(sc.id)}
                    disabled={loading}
                    title={sc.desc}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-indigo-400'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
                    }`}
                  >
                    {sc.label}
                  </button>
                );
              })}

              <div className="h-4 w-px bg-slate-700 mx-1 hidden sm:block" />

              {/* Time Advance Buttons */}
              <button
                onClick={() => handleAdvance(30)}
                disabled={loading}
                className="flex items-center space-x-1 px-2.5 py-1 rounded bg-slate-800 text-cyan-300 hover:bg-cyan-950/40 border border-cyan-500/30 text-[11px] font-medium"
              >
                <FastForward className="w-3 h-3" />
                <span>+30m</span>
              </button>

              {/* Reset Demo Button */}
              <button
                onClick={handleReset}
                disabled={loading}
                className="flex items-center space-x-1 px-2.5 py-1 rounded bg-rose-950/40 text-rose-300 hover:bg-rose-900/60 border border-rose-500/30 text-[11px] font-medium"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                <span>Reset Demo</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

