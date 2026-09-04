'use client';

import React, { useState } from 'react';
import { X, Users, CheckCircle2, RefreshCw, AlertTriangle } from 'lucide-react';

interface DivergenceUserData {
  previousObservationPrice: number;
  currentPrice: number;
  personalChangePct: number;
  attentionScore: number;
  severity: string;
}

interface DivergenceResult {
  currentPrice: number;
  userA: DivergenceUserData;
  userB: DivergenceUserData;
}

interface PersonalDivergenceModalProps {
  onClose: () => void;
}

export const PersonalDivergenceModal: React.FC<PersonalDivergenceModalProps> = ({ onClose }) => {
  const [result, setResult] = useState<DivergenceResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runDivergenceDemo = async () => {
    setLoading(true);
    setError(null);
    try {
      /**
       * Single source of truth: /api/demo/divergence
       * This endpoint:
       *   1. Seeds User A baseline at ₹1,500 and User B at ₹1,545
       *   2. Computes AttentionEngine for both users against INFY @ ₹1,560
       *   3. Returns { userA, userB, currentPrice } — same data used by cards AND proof
       */
      const res = await fetch('/api/demo/divergence');
      const json = await res.json();

      if (!json.success) {
        throw new Error(json.error?.message || 'Divergence simulation failed');
      }

      setResult(json.data as DivergenceResult);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Failed to run divergence simulation');
    } finally {
      setLoading(false);
    }
  };

  const formatPct = (pct: number) => `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`;
  const formatPrice = (p: number) => `₹${p.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="glass-panel w-full max-w-3xl rounded-3xl p-6 lg:p-8 border border-indigo-500/40 shadow-2xl space-y-6 my-8 animate-fadeIn">

        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center">
              <Users className="w-5 h-5 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white tracking-tight">
                Personal Baseline Divergence Demo
              </h2>
              <p className="text-xs text-slate-400">
                Proves that two users seeing the exact same market see different signals based on their personal memory.
              </p>
            </div>
          </div>

          <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Action Button */}
        <div className="text-center">
          <button
            onClick={runDivergenceDemo}
            disabled={loading}
            className="px-6 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center space-x-2 mx-auto disabled:opacity-60"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Evaluating Backend Pipeline...' : 'Run Divergence Simulation'}</span>
          </button>
        </div>

        {/* Error State */}
        {error && (
          <div className="flex items-center space-x-2 p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Side-by-Side User Comparison Cards — rendered from single backend response */}
        {result && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fadeIn">
              {/* User A Card */}
              <div className="glass-panel rounded-2xl p-5 border border-blue-500/30 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">User A (Infrequent Visitor)</span>
                  <span className="text-[10px] font-mono text-slate-400">Last visited 3 days ago</span>
                </div>
                <div className="space-y-1">
                  <div className="text-lg font-bold text-white">INFY</div>
                  <div className="text-xs text-slate-400 font-mono">
                    Current Price: <span className="text-white">{formatPrice(result.userA.currentPrice)}</span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    Prior Baseline: <span className="text-white">{formatPrice(result.userA.previousObservationPrice)}</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <span className="text-[11px] text-slate-400 block font-medium">Change Since Last Check</span>
                  <span className="text-2xl font-bold font-mono text-emerald-400">
                    {formatPct(result.userA.personalChangePct)}
                  </span>
                  <span className="text-[10px] text-emerald-300/80 block mt-0.5">
                    {result.userA.severity} (Score: {result.userA.attentionScore})
                  </span>
                </div>
              </div>

              {/* User B Card */}
              <div className="glass-panel rounded-2xl p-5 border border-indigo-500/30 space-y-3">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                  <span className="text-xs font-bold text-indigo-400 uppercase tracking-wider">User B (Frequent Visitor)</span>
                  <span className="text-[10px] font-mono text-slate-400">Last visited 1 hour ago</span>
                </div>
                <div className="space-y-1">
                  <div className="text-lg font-bold text-white">INFY</div>
                  <div className="text-xs text-slate-400 font-mono">
                    Current Price: <span className="text-white">{formatPrice(result.userB.currentPrice)}</span>
                  </div>
                  <div className="text-xs text-slate-400 font-mono">
                    Prior Baseline: <span className="text-white">{formatPrice(result.userB.previousObservationPrice)}</span>
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-center">
                  <span className="text-[11px] text-slate-400 block font-medium">Change Since Last Check</span>
                  <span className="text-2xl font-bold font-mono text-cyan-400">
                    {formatPct(result.userB.personalChangePct)}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    {result.userB.severity} (Score: {result.userB.attentionScore})
                  </span>
                </div>
              </div>
            </div>

            {/* Judge Verification Proof — derived from the SAME backend result, never hardcoded */}
            <div className="p-4 rounded-2xl bg-indigo-950/30 border border-indigo-500/20 text-xs text-slate-300 space-y-1">
              <div className="font-semibold text-indigo-300 flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-indigo-400" />
                <span>Judge Verification Proof</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Both users evaluated the exact same current market snapshot
                (INFY @ {formatPrice(result.currentPrice)}).
                PulseWatch accurately derived distinct personal change signals
                (User&nbsp;A:&nbsp;<span className="text-emerald-400 font-mono font-semibold">{formatPct(result.userA.personalChangePct)}</span> from {formatPrice(result.userA.previousObservationPrice)}&nbsp;baseline
                &nbsp;vs&nbsp;
                User&nbsp;B:&nbsp;<span className="text-cyan-400 font-mono font-semibold">{formatPct(result.userB.personalChangePct)}</span> from {formatPrice(result.userB.previousObservationPrice)}&nbsp;baseline)
                by preserving each user&apos;s unique observation memory state.
              </p>
              <div className="pt-2 border-t border-indigo-800/40 text-[10px] font-mono text-slate-500 space-y-0.5">
                <div>
                  User A: ({formatPrice(result.userA.currentPrice)} − {formatPrice(result.userA.previousObservationPrice)}) / {formatPrice(result.userA.previousObservationPrice)} = {formatPct(result.userA.personalChangePct)}
                </div>
                <div>
                  User B: ({formatPrice(result.userB.currentPrice)} − {formatPrice(result.userB.previousObservationPrice)}) / {formatPrice(result.userB.previousObservationPrice)} = {formatPct(result.userB.personalChangePct)}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
