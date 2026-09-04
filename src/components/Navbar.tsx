'use client';

import React from 'react';
import { Activity, Eye, History, ListFilter, ShieldAlert, Wifi, LogOut, User } from 'lucide-react';

interface AuthUser {
  id: string;
  name: string;
  email: string;
}

interface NavbarProps {
  activeTab: 'dashboard' | 'watchlist' | 'journal';
  setActiveTab: (tab: 'dashboard' | 'watchlist' | 'journal') => void;
  marketStatus: 'OPEN' | 'CLOSED' | 'PRE_OPEN';
  dataQualitySummary: {
    fresh: number;
    stale: number;
    unavailable: number;
  };
  demoScenario: string;
  currentUser?: AuthUser | null;
  onLogout?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  marketStatus,
  dataQualitySummary,
  demoScenario,
  currentUser,
  onLogout,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-[#0b0f19]/90 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-3">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Brand & Tagline */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 p-0.5 shadow-lg shadow-blue-500/20 flex items-center justify-center">
            <div className="w-full h-full bg-slate-950 rounded-[10px] flex items-center justify-center">
              <Activity className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-bold text-lg tracking-tight text-white">
                PULSE<span className="text-cyan-400">WATCH</span>
              </h1>
              <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                Personal Memory
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Know what changed while you were away.
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center space-x-1 bg-slate-900/80 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'dashboard'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Eye className="w-4 h-4" />
            <span>Since You Were Away</span>
          </button>

          <button
            onClick={() => setActiveTab('watchlist')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'watchlist'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ListFilter className="w-4 h-4" />
            <span>Watchlists</span>
          </button>

          <button
            onClick={() => setActiveTab('journal')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'journal'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <History className="w-4 h-4" />
            <span>Market Journal</span>
          </button>
        </nav>

        {/* Status Indicators + User */}
        <div className="flex items-center space-x-3 text-xs">
          {/* Market Status */}
          <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800">
            <span className={`w-2 h-2 rounded-full ${marketStatus === 'OPEN' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'}`} />
            <span className="font-mono text-[11px] text-slate-300">
              {marketStatus === 'OPEN' ? 'MARKET OPEN' : 'MARKET CLOSED'}
            </span>
          </div>

          {/* Data Freshness Indicator */}
          {dataQualitySummary.stale > 0 ? (
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>{dataQualitySummary.stale} Stale Data</span>
            </div>
          ) : (
            <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <Wifi className="w-3.5 h-3.5" />
              <span>Data Fresh</span>
            </div>
          )}

          {/* Demo Scenario Pill */}
          {demoScenario && (
            <div className="hidden lg:flex items-center px-2 py-1 rounded bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 font-mono text-[10px]">
              SIM: {demoScenario}
            </div>
          )}

          {/* User avatar + logout */}
          {currentUser && (
            <div className="flex items-center space-x-2 pl-1 border-l border-slate-800 ml-1">
              <div className="flex items-center space-x-1.5 text-slate-400">
                <User className="w-3.5 h-3.5" />
                <span className="text-[11px] font-medium max-w-[80px] truncate hidden md:inline">
                  {currentUser.name}
                </span>
              </div>
              {onLogout && (
                <button
                  id="logout-btn"
                  onClick={onLogout}
                  title="Sign out"
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/20 transition-all text-[11px] font-semibold border border-transparent hover:border-rose-900/40"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">Sign out</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
