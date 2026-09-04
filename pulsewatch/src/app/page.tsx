'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { DemoControllerBar } from '@/components/DemoControllerBar';
import { DashboardView } from '@/components/DashboardView';
import { WatchlistView } from '@/components/WatchlistView';
import { MarketMemoryJournalView } from '@/components/MarketMemoryJournalView';
import { StockDetailModal } from '@/components/StockDetailModal';
import { PersonalDivergenceModal } from '@/components/PersonalDivergenceModal';
import { DashboardPayload, ChangeEventDomain, DemoScenarioType } from '@/lib/domain/types';

interface AuthUser {
  id: string;
  name: string;
  email: string;
}

export default function HomePage() {
  const router = useRouter();

  // Authentication state — never trust client-supplied identity
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const [activeTab, setActiveTab] = useState<'dashboard' | 'watchlist' | 'journal'>('dashboard');
  const [payload, setPayload] = useState<DashboardPayload | null>(null);
  const [demoScenario, setDemoScenario] = useState<DemoScenarioType>('NORMAL_NOISE');
  const [timeShiftMinutes, setTimeShiftMinutes] = useState(0);
  const [loading, setLoading] = useState(false);

  const [selectedEvent, setSelectedEvent] = useState<ChangeEventDomain | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string | null>(null);
  const [showDivergenceModal, setShowDivergenceModal] = useState(false);

  // ─── Session check on mount ─────────────────────────────────────────────────
  useEffect(() => {
    fetch('/api/auth/me')
      .then((res) => {
        if (res.status === 401) {
          router.replace('/login');
          return null;
        }
        return res.json();
      })
      .then((json) => {
        if (json?.success) {
          setCurrentUser(json.data);
        }
      })
      .catch(() => {
        router.replace('/login');
      })
      .finally(() => setAuthChecked(true));
  }, [router]);

  // ─── Dashboard fetch (uses cookie automatically — no user-id header needed) ─
  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/dashboard');
      if (res.status === 401) {
        router.replace('/login');
        return;
      }
      const json = await res.json();
      if (json.success) {
        setPayload(json.data);
        setDemoScenario(json.demoScenario);
        setTimeShiftMinutes(json.timeShiftMinutes);
      }
    } catch (e) {
      console.error('Failed to load dashboard:', e);
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Fetch dashboard once authenticated
  useEffect(() => {
    if (authChecked && currentUser) {
      fetchDashboard();
    }
  }, [authChecked, currentUser, fetchDashboard]);

  // ─── Demo controls (no user-id headers — session cookie carries identity) ───
  const handleScenarioChange = async (newScenario: DemoScenarioType) => {
    if (newScenario === 'PERSONAL_BASELINE_DIVERGENCE') {
      setShowDivergenceModal(true);
      return;
    }
    try {
      await fetch('/api/demo/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_scenario', scenario: newScenario }),
      });
      await fetchDashboard();
    } catch (e) {
      console.error(e);
    }
  };

  const handleAdvanceTime = async (minutes: number) => {
    try {
      await fetch('/api/demo/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'advance_time', minutes }),
      });
      await fetchDashboard();
    } catch (e) {
      console.error(e);
    }
  };

  const handleResetDemo = async () => {
    try {
      await fetch('/api/demo/scenario', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset_demo' }),
      });
      await fetchDashboard();
    } catch (e) {
      console.error(e);
    }
  };

  // ─── Logout ─────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (_) {}
    setCurrentUser(null);
    router.replace('/login');
  };

  // ─── Stock inspect ───────────────────────────────────────────────────────────
  const handleInspectSymbol = (sym: string) => {
    const matchedEvt =
      payload?.meaningfulChanges.find((e) => e.symbol === sym) ||
      payload?.lowerSignalChanges.find((e) => e.symbol === sym) ||
      null;
    setSelectedEvent(matchedEvt);
    setSelectedSymbol(sym);
  };

  // ─── Loading / auth-pending state ───────────────────────────────────────────
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Should never render — router.replace('/login') handles redirect, but defensive
  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-[#0b0f19] flex flex-col font-sans">
      {/* Demo Controller Bar */}
      <DemoControllerBar
        currentScenario={demoScenario}
        timeShiftMinutes={timeShiftMinutes}
        onScenarioChange={handleScenarioChange}
        onAdvanceTime={handleAdvanceTime}
        onResetDemo={handleResetDemo}
      />

      {/* Main Navbar — pass user and logout handler */}
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        marketStatus={payload?.marketStatus || 'OPEN'}
        dataQualitySummary={payload?.dataQualitySummary || { fresh: 0, stale: 0, unavailable: 0 }}
        demoScenario={demoScenario}
        currentUser={currentUser}
        onLogout={handleLogout}
      />

      {/* Main Tab Content */}
      <main className="flex-1 pb-16">
        {activeTab === 'dashboard' && (
          <DashboardView
            payload={payload}
            loading={loading}
            onSelectStock={(evt) => {
              setSelectedEvent(evt);
              setSelectedSymbol(evt.symbol);
            }}
            onGoToWatchlist={() => setActiveTab('watchlist')}
          />
        )}

        {activeTab === 'watchlist' && (
          <WatchlistView
            onSelectSymbol={handleInspectSymbol}
            onRefreshDashboard={fetchDashboard}
          />
        )}

        {activeTab === 'journal' && (
          <MarketMemoryJournalView
            onSelectSymbol={handleInspectSymbol}
          />
        )}
      </main>

      {/* Stock Detail Modal */}
      {(selectedEvent || selectedSymbol) && (
        <StockDetailModal
          event={selectedEvent}
          symbol={selectedSymbol}
          onClose={() => {
            setSelectedEvent(null);
            setSelectedSymbol(null);
          }}
        />
      )}

      {/* Personal Baseline Divergence Modal */}
      {showDivergenceModal && (
        <PersonalDivergenceModal
          onClose={() => {
            setShowDivergenceModal(false);
            fetchDashboard();
          }}
        />
      )}
    </div>
  );
}
