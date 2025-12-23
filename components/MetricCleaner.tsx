
import React, { useState, useMemo } from 'react';
import { Target } from '../types';
import { AlertTriangle, Clock, Trash2, Check, Search, Tag, Calendar, Filter } from 'lucide-react';
import { CustomSelect } from './CustomSelect';

interface Props {
    targets: Target[];
    prometheusConfig: any; // AppConfig (kept any to avoid import cycles)
}

// Helper to parse and quote label selectors
const parseAndQuoteMatchers = (input: string): string[] => {
    if (!input) return [];
    return input.split(',').map(part => {
        part = part.trim();
        const match = part.match(/^([^=~]+)(=~?)(.*)$/);
        if (!match) return part; // Return as-is if malformed

        let [, key, op, value] = match;
        value = value.trim();

        // Add quotes if value is not already quoted
        if (!value.startsWith('"') && !value.endsWith('"')) {
            value = `"${value}"`;
        }
        return `${key}${op}${value}`;
    });
};

export const MetricCleaner: React.FC<Props> = ({ targets, prometheusConfig }) => {
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [deleteMode, setDeleteMode] = useState<'all' | 'range'>('all');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
    const [isDeleting, setIsDeleting] = useState(false);
    const [result, setResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [targetSearch, setTargetSearch] = useState('');
  const [labelSelector, setLabelSelector] = useState('');
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);

  const filteredTargetOptions = useMemo(() => {
      const list = targets
        .filter(t => t.name.toLowerCase().includes(targetSearch.toLowerCase()) || t.url.toLowerCase().includes(targetSearch.toLowerCase()))
        .map(t => ({
            value: t.id,
            label: t.name,
            description: t.url
        }));
      return [{ value: '', label: 'Any Target / No Instance Filter', description: 'Apply to all series matching the label selectors' }, ...list];
  }, [targets, targetSearch]);

  const selectedTarget = targets.find(t => t.id === selectedTargetId);
  
  // Ensure we have at least a target OR a label selector to prevent accidental "delete everything"
  const isScopeValid = !!selectedTargetId || !!labelSelector;

    const handleDelete = async () => {
    setConfirmModalOpen(false);
    setIsDeleting(true); 
    setResult(null);
        try {
            if (!prometheusConfig?.prometheusUrl) throw new Error('Prometheus URL not configured');

            const extraFromInput = parseAndQuoteMatchers(labelSelector);
            let parts: string[] = [];
            if (selectedTarget) {
                parts.push(`instance="${selectedTarget.url}"`);
                (selectedTarget.labels || []).forEach(l => {
                    if (l && l.key) parts.push(`${l.key}="${l.value}"`);
                });
                parts = parts.concat(extraFromInput);
            } else {
                parts = parts.concat(extraFromInput);
            }

            if (parts.length === 0) throw new Error('No matchers specified');

            const matcher = `{${parts.join(', ')}}`;

            const body: any = {
                prometheusUrl: prometheusConfig.prometheusUrl,
                matches: [matcher],
                authMethod: prometheusConfig.promAuthMethod,
                authCredentials: prometheusConfig.promAuthCredentials
            };

            if (deleteMode === 'range' && startTime && endTime) {
                body.start = new Date(startTime).toISOString();
                body.end = new Date(endTime).toISOString();
            }

            const res = await fetch('/api/prometheus/delete_series', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Request failed with status ${res.status}`);
            }

            // Tombstone cleaning is not proxied, as it's a separate admin action.
            // The main issue was the series deletion. We can leave this as a future improvement if needed.

            const timeRange = deleteMode === 'all' ? 'ALL TIME' : `${startTime} to ${endTime}`;
            const targetPart = selectedTarget ? `target ${selectedTarget.name}` : 'matching targets';
            setResult({ type: 'success', message: `Successfully requested series deletion for ${targetPart} with labels { ${parts.join(', ')} } (${timeRange}). Tombstone cleaning will run on Prometheus server.` });
        } catch (err: any) {
            setResult({ type: 'error', message: `Failed to purge series: ${err.message || String(err)}` });
        } finally {
            setIsDeleting(false);
        }
  };

    // Build effective matcher for display (same rules as deletion):
    const computeDisplayMatcher = () => {
        const extra = parseAndQuoteMatchers(labelSelector).join(', ');
        if (selectedTarget) {
            const instance = `instance="${selectedTarget.url}"`;
            const lbls = (selectedTarget.labels || []).map(l => `${l.key}="${l.value}"`);
            return [instance, ...lbls, extra].filter(Boolean).join(', ');
        }
        return extra || '';
    };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-10">
      
      {/* Header */}
      <div>
         <h2 className="text-2xl font-bold text-white mb-2">Metrics Operations</h2>
         <p className="text-gray-400 text-sm">Administrative tools for managing the Prometheus Time Series Database (TSDB).</p>
      </div>

      {/* Warning Banner */}
      <div className="bg-red-500/5 border border-red-500/20 p-6 rounded-xl flex items-start gap-5">
        <div className="p-3 bg-red-500/10 rounded-xl text-red-500 shrink-0 shadow-lg shadow-red-500/5"><AlertTriangle className="w-6 h-6" /></div>
        <div>
          <h3 className="text-red-400 font-bold text-base mb-2">Destructive Operation</h3>
          <p className="text-sm text-red-200/70 leading-relaxed">
            You are accessing the TSDB Clean / Tombstone API. Data deleted here cannot be recovered. 
            Ensure your series selectors are precise to avoid accidental data loss.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Main Configuration Panel */}
          <div className="lg:col-span-2 space-y-6">
              
              {/* Step 1: Scope */}
              <div className="glass-panel p-6 rounded-xl border-l-4 border-blue-500">
                  <div className="flex items-center gap-3 mb-6">
                      <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold border border-blue-500/30">1</div>
                      <h3 className="text-lg font-bold text-white">Define Scope</h3>
                  </div>

                  <div className="space-y-5">
                     <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Target Instance (Optional)</label>
                        <div className="relative mb-2">
                             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                             <input 
                                 type="text" 
                                 placeholder="Search targets..." 
                                 value={targetSearch} 
                                 onChange={e => setTargetSearch(e.target.value)}
                                 className="w-full bg-[#18181b] border border-white/10 rounded-lg pl-10 pr-4 py-3 text-sm text-gray-200 focus:border-blue-500 transition-colors"
                             />
                        </div>
                        <CustomSelect 
                            options={filteredTargetOptions}
                            value={selectedTargetId}
                            onChange={setSelectedTargetId}
                            placeholder="Select a target or 'Any'..."
                        />
                     </div>

                     <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                            Label Matchers {selectedTargetId ? '(Optional)' : <span className="text-blue-400">(Required)</span>}
                        </label>
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input 
                                type="text" 
                                placeholder={selectedTargetId ? "e.g. env=prod (optional)" : "e.g. env=staging"} 
                                value={labelSelector} 
                                onChange={e => setLabelSelector(e.target.value)}
                                className={`w-full bg-[#18181b] border rounded-lg pl-10 pr-4 py-3 text-sm text-gray-200 focus:border-blue-500 font-mono transition-colors ${!isScopeValid && !selectedTargetId ? 'border-blue-500/30 ring-1 ring-blue-500/20' : 'border-white/10'}`}
                            />
                        </div>
                        {!selectedTargetId && !labelSelector && (
                            <p className="text-[10px] text-blue-400 mt-2 flex items-center gap-1">
                                <InfoIcon /> You must specify labels if no target is selected.
                            </p>
                        )}
                     </div>
                  </div>
              </div>

              {/* Step 2: Time */}
              <div className="glass-panel p-6 rounded-xl border-l-4 border-purple-500">
                  <div className="flex items-center gap-3 mb-6">
                      <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 font-bold border border-purple-500/30">2</div>
                      <h3 className="text-lg font-bold text-white">Time Window</h3>
                  </div>

                  <div className="space-y-4">
                      <div className="flex gap-4">
                          <label className={`flex-1 flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all ${deleteMode === 'all' ? 'bg-purple-500/10 border-purple-500/50 text-white' : 'bg-[#18181b] border-white/10 text-gray-400 hover:border-white/20'}`}>
                              <input type="radio" name="mode" className="hidden" checked={deleteMode === 'all'} onChange={() => setDeleteMode('all')} />
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${deleteMode === 'all' ? 'border-purple-500' : 'border-gray-600'}`}>
                                  {deleteMode === 'all' && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                              </div>
                              <span className="font-medium text-sm">Everything</span>
                          </label>
                          <label className={`flex-1 flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-all ${deleteMode === 'range' ? 'bg-purple-500/10 border-purple-500/50 text-white' : 'bg-[#18181b] border-white/10 text-gray-400 hover:border-white/20'}`}>
                              <input type="radio" name="mode" className="hidden" checked={deleteMode === 'range'} onChange={() => setDeleteMode('range')} />
                              <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${deleteMode === 'range' ? 'border-purple-500' : 'border-gray-600'}`}>
                                  {deleteMode === 'range' && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                              </div>
                              <span className="font-medium text-sm">Specific Range</span>
                          </label>
                      </div>

                      {deleteMode === 'range' && (
                          <div className="grid grid-cols-2 gap-4 pt-2 animate-slide-up">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Start Time (UTC)</label>
                                <input type="datetime-local" value={startTime} onChange={e => setStartTime(e.target.value)} className="w-full bg-[#18181b] border border-white/10 rounded-lg px-4 py-3 text-gray-200 text-xs font-mono" />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">End Time (UTC)</label>
                                <input type="datetime-local" value={endTime} onChange={e => setEndTime(e.target.value)} className="w-full bg-[#18181b] border border-white/10 rounded-lg px-4 py-3 text-gray-200 text-xs font-mono" />
                            </div>
                          </div>
                      )}
                  </div>
              </div>

          </div>

          {/* Sidebar Summary & Execute */}
          <div className="space-y-6">
              <div className="bg-[#18181b] border border-white/10 rounded-xl p-6 shadow-2xl">
                  <h4 className="text-white font-bold mb-6 flex items-center gap-2">
                      <Trash2 className="w-5 h-5 text-gray-400" />
                      Summary
                  </h4>
                  
                  <div className="space-y-4 mb-8">
                      <div>
                          <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Target Scope</p>
                          {selectedTarget ? (
                             <div className="flex items-center gap-2">
                                 <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                                 <p className="text-sm text-white font-medium truncate" title={selectedTarget.name}>{selectedTarget.name}</p>
                             </div>
                          ) : (
                             <div className="flex items-center gap-2">
                                 <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                                 <p className="text-sm text-white font-medium italic">All Targets / Label Match Only</p>
                             </div>
                          )}
                      </div>
                      
                      <div>
                          <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Period</p>
                          <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-purple-500" />
                              <p className="text-sm text-white">
                                  {deleteMode === 'all' ? 'Entire History' : (startTime && endTime ? 'Custom Range' : 'Invalid Range')}
                              </p>
                          </div>
                      </div>

                      <div className="pt-4 border-t border-white/5">
                          <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-2">Effective Query</p>
                          <div className="bg-black/40 rounded p-3 border border-white/5">
                              <code className="text-[10px] text-blue-300 font-mono break-all block">
                                  {`{${computeDisplayMatcher()}}`}
                              </code>
                          </div>
                      </div>
                  </div>

                  <button 
                    onClick={() => setConfirmModalOpen(true)}
                    disabled={!isScopeValid || isDeleting || (deleteMode === 'range' && (!startTime || !endTime))} 
                    className="w-full py-3.5 bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-900/20 text-sm"
                  >
                      {isDeleting ? 'Processing...' : 'Delete Series'}
                  </button>
              </div>

                            {result && (
                                result.type === 'success' ? (
                                    <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm flex items-start gap-3 animate-slide-up shadow-lg shadow-emerald-900/10">
                                        <Check className="w-5 h-5 shrink-0 mt-0.5" /> 
                                        <p className="leading-relaxed">{result.message}</p>
                                    </div>
                                ) : (
                                    <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-sm flex items-start gap-3 animate-slide-up shadow-lg shadow-rose-900/10">
                                        <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                                        <p className="leading-relaxed">{result.message}</p>
                                    </div>
                                )
                            )}
          </div>
      </div>

      {/* Confirmation Modal */}
      {confirmModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm animate-fade-in">
              <div className="bg-[#18181b] w-full max-w-md rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-slide-up">
                  <div className="p-8 text-center">
                      <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                          <Trash2 className="w-8 h-8 text-red-500" />
                      </div>
                      <h3 className="text-xl font-bold text-white mb-2">Confirm Deletion</h3>
                      <p className="text-gray-400 text-sm leading-relaxed mb-6">
                          You are about to permanently delete metrics 
                          {selectedTarget 
                            ? <span> for <span className="text-white font-bold">{selectedTarget.name}</span></span> 
                            : <span> matching <span className="text-white font-bold font-mono">{labelSelector}</span></span>
                          }.
                          <br/><br/>
                          Scope: <span className="text-purple-400 font-mono bg-purple-500/10 px-1 rounded">{deleteMode === 'all' ? 'All History' : `${startTime} - ${endTime}`}</span>
                      </p>
                      <div className="flex gap-3 justify-center">
                          <button onClick={() => setConfirmModalOpen(false)} className="px-6 py-2.5 rounded-lg border border-white/10 hover:bg-white/5 text-white text-sm font-medium transition-colors">Cancel</button>
                          <button onClick={handleDelete} className="px-6 py-2.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold shadow-lg shadow-red-900/20 transition-colors">Confirm & Delete</button>
                      </div>
                  </div>
              </div>
          </div>
      )}

    </div>
  );
};

const InfoIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0-0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
);
