
import React, { useState, useMemo, useEffect } from 'react';
import { AppEvent } from '../types';
import { Search, Info, AlertTriangle, AlertCircle, CheckCircle2, Calendar, User, Filter, ArrowDown, ArrowUp, Download, WrapText, AlignLeft, RefreshCw } from 'lucide-react';
import { CustomSelect } from './CustomSelect';

interface Props {
  events: AppEvent[];
}

export const EventLog: React.FC<Props> = ({ events }) => {
  const [search, setSearch] = useState('');
    const [serverEvents, setServerEvents] = useState<AppEvent[] | null>(null);
    const [autoRefresh, setAutoRefresh] = useState(false);
  const [typeFilter, setTypeFilter] = useState<'all' | 'info' | 'success' | 'warning' | 'error'>('all');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(15);
  
  // View Options
  const [wrapText, setWrapText] = useState(false);

    useEffect(() => {
        if (!autoRefresh) return;
        const id = setInterval(() => fetchEventsFromServer(), 10000);
        return () => clearInterval(id);
    }, [autoRefresh]);

    // Fetch events from server on mount so the UI shows DB events immediately
    useEffect(() => {
        fetchEventsFromServer();
    }, []);

    const fetchEventsFromServer = async () => {
        try {
            const res = await fetch('/api/events');
            if (!res.ok) return;
            const data = await res.json();
            setServerEvents(data || []);
        } catch (e) {
            console.warn('Failed to fetch events from server', e);
        }
    };

    const filteredEvents = useMemo(() => {
        const source = serverEvents || events;
        // initial filter/sort
        const interim = source.filter(e => {
                const matchesSearch = e.message.toLowerCase().includes(search.toLowerCase()) || 
                                                            e.user?.toLowerCase().includes(search.toLowerCase()) ||
                                                            e.id.includes(search);
                const matchesType = typeFilter === 'all' || e.type === typeFilter;
                return matchesSearch && matchesType;
        }).sort((a, b) => {
                const dateA = new Date(a.timestamp).getTime();
                const dateB = new Date(b.timestamp).getTime();
                return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
        });

        // Dedupe login events by user: keep a single login event per user.
        // Prefer events that include IP/UA metadata or longer verbose messages, otherwise keep the latest.
        const loginMap = new Map<string, AppEvent>();
        const others: AppEvent[] = [];
        for (const e of interim) {
            const isLogin = /logged in/i.test(e.message) && !!e.user;
            if (isLogin && e.user) {
                const prev = loginMap.get(e.user);
                if (!prev) {
                    loginMap.set(e.user, e);
                } else {
                    const prevHasMeta = Boolean((prev as any).meta?.ip) || /IP[: ]/i.test(prev.message);
                    const currHasMeta = Boolean((e as any).meta?.ip) || /IP[: ]/i.test(e.message);
                    if (currHasMeta && !prevHasMeta) {
                        loginMap.set(e.user, e);
                    } else if (!currHasMeta && prevHasMeta) {
                        // keep prev
                    } else {
                        const prevTime = new Date(prev.timestamp).getTime();
                        const currTime = new Date(e.timestamp).getTime();
                        if (currTime > prevTime) {
                            loginMap.set(e.user, e);
                        } else if (currTime === prevTime && e.message.length > prev.message.length) {
                            loginMap.set(e.user, e);
                        }
                    }
                }
            } else {
                others.push(e);
            }
        }
        const combined = [...others, ...Array.from(loginMap.values())];
        combined.sort((a, b) => sortOrder === 'desc' ? new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime() : new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        return combined;
    }, [events, search, typeFilter, sortOrder, serverEvents]);

  const paginatedEvents = useMemo(() => {
      const start = (currentPage - 1) * itemsPerPage;
      return filteredEvents.slice(start, start + itemsPerPage);
  }, [filteredEvents, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredEvents.length / itemsPerPage);

  const handleExport = () => {
    const csvHeader = "ID,Timestamp,Type,User,Message\n";
    const csvRows = filteredEvents.map(e => {
        const cleanMsg = e.message.replace(/"/g, '""'); // Escape double quotes
        return `${e.id},"${e.timestamp}",${e.type},${e.user || ''},"${cleanMsg}"`;
    }).join('\n');
    
    const blob = new Blob([csvHeader + csvRows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `event-log-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const getIcon = (type: string) => {
      switch(type) {
          case 'error': return <AlertCircle className="w-4 h-4 text-rose-500" />;
          case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-500" />;
          case 'success': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
          default: return <Info className="w-4 h-4 text-blue-500" />;
      }
  };

  const getTypeStyle = (type: string) => {
    switch(type) {
        case 'error': return "bg-rose-500/10 text-rose-500 border-rose-500/20";
        case 'warning': return "bg-amber-500/10 text-amber-500 border-amber-500/20";
        case 'success': return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
        default: return "bg-blue-500/10 text-blue-500 border-blue-500/20";
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col animate-fade-in">
        <div className="flex justify-between items-end border-b border-white/10 pb-4 shrink-0">
            <div>
                <h2 className="text-2xl font-bold text-white mb-1">System Event Log</h2>
                <p className="text-gray-400 text-sm">Detailed audit trail of all system activities</p>
            </div>
                <div className="flex gap-3 items-center">
                      <button 
                          onClick={handleExport}
                          className="flex items-center gap-2 bg-[#18181b] hover:bg-[#202024] border border-white/10 text-gray-300 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                          <Download className="w-4 h-4" /> Export CSV
                      </button>
                      <button
                          onClick={() => fetchEventsFromServer()}
                          className="flex items-center gap-2 bg-[#18181b] hover:bg-[#202024] border border-white/10 text-gray-300 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        <RefreshCw className="w-4 h-4" /> Refresh
                      </button>
                      <label className="flex items-center gap-2 text-xs text-gray-400 bg-[#18181b] px-3 py-2 rounded-lg border border-white/10">
                          <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} /> Auto
                      </label>
                      <div className="px-3 py-2 bg-[#18181b] rounded-lg border border-white/10 text-xs text-gray-400 flex items-center gap-2">
                            <span>Total:</span>
                            <span className="text-white font-mono font-bold">{(serverEvents || events).length}</span>
                      </div>
                </div>
        </div>

        <div className="flex gap-4 shrink-0 z-10 flex-wrap">
            <div className="flex-1 relative min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input 
                    type="text" 
                    placeholder="Search messages, users, or IDs..." 
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                    className="w-full bg-[#18181b] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-200 focus:border-blue-500 transition-colors"
                />
            </div>
            <div className="w-40">
                <CustomSelect 
                    options={[
                        { value: 'all', label: 'All Types' },
                        { value: 'info', label: 'Info' },
                        { value: 'success', label: 'Success' },
                        { value: 'warning', label: 'Warning' },
                        { value: 'error', label: 'Error' },
                    ]}
                    value={typeFilter}
                    onChange={(v) => { setTypeFilter(v as any); setCurrentPage(1); }}
                />
            </div>
            <div className="flex bg-[#18181b] border border-white/10 rounded-lg p-1 gap-1">
                <button 
                    onClick={() => setWrapText(false)}
                    className={`p-1.5 rounded-md transition-colors ${!wrapText ? 'bg-blue-600/20 text-blue-400' : 'text-gray-500 hover:text-white'}`}
                    title="Single Line"
                >
                    <AlignLeft className="w-4 h-4" />
                </button>
                <button 
                    onClick={() => setWrapText(true)}
                    className={`p-1.5 rounded-md transition-colors ${wrapText ? 'bg-blue-600/20 text-blue-400' : 'text-gray-500 hover:text-white'}`}
                    title="Wrap Text"
                >
                    <WrapText className="w-4 h-4" />
                </button>
            </div>
            <button 
                onClick={() => setSortOrder(prev => prev === 'desc' ? 'asc' : 'desc')}
                className="px-3 py-2 bg-[#18181b] border border-white/10 rounded-lg text-gray-400 hover:text-white flex items-center gap-2"
            >
                {sortOrder === 'desc' ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
                <span className="text-sm font-medium">Time</span>
            </button>
        </div>

        <div className="glass-panel rounded-xl overflow-hidden flex flex-col flex-1 min-h-0">
            <div className="overflow-auto flex-1 custom-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10 bg-[#18181b] border-b border-white/10 shadow-lg">
                        <tr>
                            <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider w-48">Timestamp</th>
                            <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Type</th>
                            <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Message</th>
                            <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider w-48">User</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {paginatedEvents.map(event => (
                            <tr key={event.id} className="hover:bg-white/5 transition-colors group">
                                <td className="px-6 py-4 whitespace-nowrap align-top">
                                    <div className="flex flex-col">
                                        <span className="text-sm text-gray-300 font-mono">{new Date(event.timestamp).toLocaleTimeString()}</span>
                                        <span className="text-[10px] text-gray-600">{new Date(event.timestamp).toLocaleDateString()}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4 align-top">
                                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wide border ${getTypeStyle(event.type)}`}>
                                        {getIcon(event.type)}
                                        {event.type}
                                    </span>
                                </td>
                                <td className="px-6 py-4 align-top min-w-0">
                                    <p className={`text-sm text-gray-200 font-mono leading-relaxed transition-all ${wrapText ? 'whitespace-pre-wrap break-words' : 'truncate max-w-xl'}`} title={!wrapText ? event.message : undefined}>
                                        {event.message}
                                    </p>
                                </td>
                                <td className="px-6 py-4 align-top">
                                    <div className="flex items-center gap-2">
                                        <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center text-[10px] text-gray-400 font-bold border border-white/10">
                                            {event.user?.charAt(0).toUpperCase()}
                                        </div>
                                        <span className="text-sm text-gray-400">{event.user}</span>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {paginatedEvents.length === 0 && (
                            <tr>
                                <td colSpan={4} className="p-12 text-center">
                                    <div className="flex flex-col items-center justify-center gap-3">
                                        <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-gray-600"><Filter className="w-6 h-6" /></div>
                                        <p className="text-gray-500 text-sm">No events found matching your criteria.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Footer */}
            <div className="px-6 py-4 border-t border-white/10 bg-[#18181b] flex justify-between items-center shrink-0">
                <div className="flex items-center gap-4">
                    <div className="text-xs text-gray-500">
                        Showing <span className="text-white font-mono">{paginatedEvents.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</span> to <span className="text-white font-mono">{Math.min(currentPage * itemsPerPage, filteredEvents.length)}</span> of <span className="text-white font-mono">{filteredEvents.length}</span>
                    </div>
                    <div className="h-4 w-px bg-white/10"></div>
                    <select 
                        value={itemsPerPage}
                        onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                        className="bg-[#0f0f11] border border-white/10 rounded text-xs text-gray-300 py-1 px-2 focus:border-blue-500 outline-none"
                    >
                        <option value={15}>15 per page</option>
                        <option value={50}>50 per page</option>
                        <option value={100}>100 per page</option>
                    </select>
                </div>

                {totalPages > 1 && (
                    <div className="flex gap-2">
                        <button 
                            disabled={currentPage === 1}
                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                            className="px-3 py-1.5 rounded-lg border border-white/10 text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Previous
                        </button>
                        <div className="flex items-center gap-1">
                            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                let pageNum = i + 1;
                                if (totalPages > 5 && currentPage > 3) {
                                    pageNum = currentPage - 2 + i;
                                    if (pageNum > totalPages) pageNum = totalPages - (4 - i);
                                }
                                if (pageNum < 1) pageNum = 1;
                                return (
                                    <button
                                        key={pageNum}
                                        onClick={() => setCurrentPage(pageNum)}
                                        className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                                            currentPage === pageNum 
                                            ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                                            : 'text-gray-400 hover:bg-white/5'
                                        }`}
                                    >
                                        {pageNum}
                                    </button>
                                )
                            })}
                        </div>
                        <button 
                            disabled={currentPage === totalPages}
                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                            className="px-3 py-1.5 rounded-lg border border-white/10 text-xs font-medium text-gray-400 hover:text-white hover:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>
        </div>
    </div>
  );
};
