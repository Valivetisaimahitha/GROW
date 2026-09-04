'use client';

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Search, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  AlertCircle, 
  ArrowUpRight, 
  ArrowDownRight,
  ListFilter,
  CheckCircle2
} from 'lucide-react';
import { DEFAULT_SECURITIES } from '@/lib/domain/marketDataProvider';

interface WatchlistViewProps {
  onSelectSymbol: (symbol: string) => void;
  onRefreshDashboard: () => void;
}

export const WatchlistView: React.FC<WatchlistViewProps> = ({
  onSelectSymbol,
  onRefreshDashboard,
}) => {
  const [watchlists, setWatchlists] = useState<any[]>([]);
  const [activeWatchlistId, setActiveWatchlistId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Search & Modal States
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState(DEFAULT_SECURITIES);
  const [addError, setAddError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Create Watchlist Inline State
  const [isCreatingList, setIsCreatingList] = useState(false);
  const [newListName, setNewListName] = useState('');

  const fetchWatchlists = async () => {
    try {
      const res = await fetch(`/api/watchlists`);
      const json = await res.json();
      if (json.success && json.data.length > 0) {
        setWatchlists(json.data);
        if (!activeWatchlistId) {
          setActiveWatchlistId(json.data[0].id);
        }
      }
    } catch (e) {
      console.error('Failed to fetch watchlists:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWatchlists();
  }, []);

  const activeWatchlist = watchlists.find(w => w.id === activeWatchlistId) || watchlists[0];

  // Handle Security Search Filter
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(DEFAULT_SECURITIES);
    } else {
      const q = searchQuery.toLowerCase();
      setSearchResults(
        DEFAULT_SECURITIES.filter(
          s => s.symbol.toLowerCase().includes(q) || s.companyName.toLowerCase().includes(q)
        )
      );
    }
  }, [searchQuery]);

  const handleCreateWatchlist = async () => {
    if (!newListName.trim()) return;
    try {
      const res = await fetch('/api/watchlists', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newListName.trim() }),
      });
      const json = await res.json();
      if (json.success) {
        setNewListName('');
        setIsCreatingList(false);
        await fetchWatchlists();
        setActiveWatchlistId(json.data.id);
        setToastMessage(`Created watchlist "${json.data.name}"`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleAddStock = async (symbol: string) => {
    if (!activeWatchlistId) return;
    setAddError(null);
    try {
      const res = await fetch(`/api/watchlists/${activeWatchlistId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol }),
      });
      const json = await res.json();

      if (!res.ok || !json.success) {
        setAddError(json.error?.message || 'Failed to add security');
        return;
      }

      await fetchWatchlists();
      onRefreshDashboard();
      setToastMessage(`Added ${symbol} to ${activeWatchlist.name}`);
      setIsSearchOpen(false);
    } catch (e: any) {
      setAddError(e.message || 'Error adding security');
    }
  };

  const handleRemoveStock = async (symbol: string) => {
    if (!activeWatchlistId) return;
    try {
      const res = await fetch(`/api/watchlists/${activeWatchlistId}/items?symbol=${symbol}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        await fetchWatchlists();
        onRefreshDashboard();
        setToastMessage(`Removed ${symbol}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return <div className="max-w-7xl mx-auto px-4 py-8 text-slate-400">Loading watchlists...</div>;
  }

  const items = activeWatchlist?.items || [];
  const currentSymbols = new Set(items.map((i: any) => i.symbol));

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 space-y-6 animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-blue-600 text-white px-4 py-2.5 rounded-xl shadow-2xl flex items-center space-x-2 text-xs font-semibold animate-fadeIn">
          <CheckCircle2 className="w-4 h-4" />
          <span>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} className="ml-2 hover:opacity-80">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Watchlist Header & Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div className="flex items-center space-x-2 overflow-x-auto pb-2 sm:pb-0">
          {watchlists.map((wl) => (
            <button
              key={wl.id}
              onClick={() => setActiveWatchlistId(wl.id)}
              className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                activeWatchlistId === wl.id
                  ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {wl.name} ({wl.items?.length || 0})
            </button>
          ))}

          {isCreatingList ? (
            <div className="flex items-center space-x-1 bg-slate-900 p-1 rounded-xl border border-slate-800">
              <input
                type="text"
                value={newListName}
                onChange={(e) => setNewListName(e.target.value)}
                placeholder="List name..."
                className="bg-slate-950 text-white px-2 py-1 rounded text-xs focus:outline-none w-28"
                autoFocus
              />
              <button onClick={handleCreateWatchlist} className="p-1 text-emerald-400 hover:bg-slate-800 rounded">
                <Check className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setIsCreatingList(false)} className="p-1 text-slate-400 hover:bg-slate-800 rounded">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsCreatingList(true)}
              className="flex items-center space-x-1 px-3 py-2 rounded-xl bg-slate-900/60 text-slate-400 hover:text-white border border-dashed border-slate-700 text-xs font-medium"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>New List</span>
            </button>
          )}
        </div>

        {/* Add Stock Action */}
        <button
          onClick={() => {
            setAddError(null);
            setIsSearchOpen(true);
          }}
          className="flex items-center justify-center space-x-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-lg shadow-blue-600/30 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Add Stock to Watchlist</span>
        </button>
      </div>

      {/* Stock Items List / Table */}
      {items.length === 0 ? (
        <div className="glass-panel rounded-3xl p-12 text-center space-y-4">
          <ListFilter className="w-12 h-12 text-slate-600 mx-auto" />
          <h3 className="text-lg font-bold text-white">Your watchlist is empty</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto">
            Add a few securities and PulseWatch will remember what you saw and highlight meaningful changes when you return.
          </p>
          <button
            onClick={() => setIsSearchOpen(true)}
            className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-xs font-bold hover:bg-blue-500"
          >
            <Plus className="w-4 h-4" />
            <span>Add your first stock</span>
          </button>
        </div>
      ) : (
        <div className="glass-panel rounded-2xl border border-slate-800/90 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/80 text-slate-400 font-mono text-[11px] uppercase border-b border-slate-800">
                <tr>
                  <th className="px-6 py-3.5">Security</th>
                  <th className="px-6 py-3.5 text-right">Base Price</th>
                  <th className="px-6 py-3.5 text-right">Typical Volatility</th>
                  <th className="px-6 py-3.5 text-right">Average Volume</th>
                  <th className="px-6 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-medium">
                {items.map((item: any) => {
                  const secMeta = DEFAULT_SECURITIES.find(s => s.symbol === item.symbol);
                  return (
                    <tr key={item.id} className="hover:bg-slate-900/40 transition-colors">
                      <td className="px-6 py-4">
                        <div className="font-bold text-white text-sm">{item.symbol}</div>
                        <div className="text-xs text-slate-400">{item.displayName}</div>
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-slate-200">
                        ₹{(secMeta?.basePrice || 1000).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-slate-300">
                        ±{((secMeta?.volatility || 0.012) * 100).toFixed(1)}% / day
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-slate-400">
                        {((secMeta?.avgVol || 1000000) / 100000).toFixed(1)}L
                      </td>
                      <td className="px-6 py-4 text-right space-x-2">
                        <button
                          onClick={() => onSelectSymbol(item.symbol)}
                          className="px-3 py-1.5 rounded-lg bg-blue-600/20 text-blue-300 hover:bg-blue-600 hover:text-white transition-all font-semibold"
                        >
                          Inspect
                        </button>
                        <button
                          onClick={() => handleRemoveStock(item.symbol)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-all"
                          title="Remove from watchlist"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Add Stock Search Modal */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel w-full max-w-lg rounded-3xl p-6 border border-slate-800 shadow-2xl space-y-4 animate-fadeIn">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">Add Security to Watchlist</h3>
              <button onClick={() => setIsSearchOpen(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Error Banner */}
            {addError && (
              <div className="p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{addError}</span>
              </div>
            )}

            {/* Input Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search stocks by symbol or company (e.g. INFY, Reliance)..."
                className="w-full bg-slate-900 text-white text-xs pl-10 pr-4 py-2.5 rounded-xl border border-slate-800 focus:outline-none focus:border-blue-500"
                autoFocus
              />
            </div>

            {/* Search Results List */}
            <div className="max-h-64 overflow-y-auto space-y-1 divide-y divide-slate-800/40">
              {searchResults.map((sec) => {
                const isAlreadyAdded = currentSymbols.has(sec.symbol);
                return (
                  <div key={sec.symbol} className="pt-2 flex items-center justify-between p-2 hover:bg-slate-900/60 rounded-xl transition-colors">
                    <div>
                      <div className="font-bold text-white text-xs">{sec.symbol}</div>
                      <div className="text-[11px] text-slate-400">{sec.companyName}</div>
                    </div>
                    {isAlreadyAdded ? (
                      <span className="text-[11px] text-slate-500 font-mono bg-slate-900 px-2 py-1 rounded border border-slate-800">
                        Added
                      </span>
                    ) : (
                      <button
                        onClick={() => handleAddStock(sec.symbol)}
                        className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm"
                      >
                        + Add
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
