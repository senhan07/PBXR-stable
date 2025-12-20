import React, { useState, useMemo } from 'react';
import { uuid } from '../utils/uuid';
import { Prober } from '../types';
import { Plus, Trash2, X, Search, ChevronLeft, ChevronRight, Rows, LayoutTemplate, Lock, RefreshCw, CheckCircle2, XCircle, Server, Globe, Box, Clock } from 'lucide-react';

interface Props {
  probers: Prober[];
  onAdd: (p: Prober) => void;
  onUpdate: (p: Prober) => void;
  onDelete: (id: string) => void;
  userRole: 'admin' | 'editor' | 'viewer';
}

export const ProberManagement: React.FC<Props> = ({ probers, onAdd, onUpdate, onDelete, userRole }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);
  const [localSearch, setLocalSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8;
  const [formData, setFormData] = useState<Partial<Prober>>({ modules: ['http_2xx'] });
  const [currentStep, setCurrentStep] = useState(1);
  
  // Connection Check State
  const [checkingId, setCheckingId] = useState<string | null>(null);
  const [checkResult, setCheckResult] = useState<{id: string, success: boolean} | null>(null);

  const isReadOnly = userRole === 'viewer';

  const commonModules = ['http_2xx', 'icmp', 'dns_tcp', 'tcp_connect', 'ssh_banner', 'pop3s_banner'];

  const filteredProbers = useMemo(() => {
    if (!localSearch) return probers;
    const q = localSearch.toLowerCase();
    return probers.filter(p => p.name.toLowerCase().includes(q) || p.url.toLowerCase().includes(q) || p.modules.some(m => m.toLowerCase().includes(q)));
  }, [probers, localSearch]);

  const paginatedProbers = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredProbers.slice(start, start + itemsPerPage);
  }, [filteredProbers, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredProbers.length / itemsPerPage);

  const handleSave = () => {
    if (!formData.name || !formData.url) return;
    const newProber: Prober = {
      id: editingId || uuid(), 
      name: formData.name, 
      url: formData.url, 
      modules: formData.modules || ['http_2xx'], 
      region: formData.region || 'default',
      scrapeInterval: formData.scrapeInterval
    };
    if (editingId) onUpdate(newProber); else onAdd(newProber);
    resetForm();
  };

  const resetForm = () => { setIsAdding(false); setEditingId(null); setFormData({ modules: ['http_2xx'] }); setCurrentStep(1); };
  const startEdit = (p: Prober) => { setFormData({ ...p }); setEditingId(p.id); setIsAdding(true); setCurrentStep(1); };
  const confirmDelete = () => { if (deleteConfirmationId) { onDelete(deleteConfirmationId); setDeleteConfirmationId(null); }};

  const handleCheckConnection = (id: string) => {
      (async () => {
        const prober = probers.find(p => p.id === id);
        if (!prober) return;
        setCheckingId(id);
        setCheckResult(null);
        try {
          const url = prober.url.replace(/\/$/, '');
          // Try Prometheus-/blackbox readiness endpoint first, fallback to base URL
          const endpointsToTry = [`${url}/-/ready`, url];
          let ok = false;
          for (const ep of endpointsToTry) {
            try {
              const res = await fetch(ep, { method: 'GET' });
              if (res.ok) { ok = true; break; }
            } catch (e) {
              // ignore and try next
            }
          }
          setCheckResult({ id, success: ok });
        } catch (err) {
          setCheckResult({ id, success: false });
        } finally {
          setCheckingId(null);
        }
      })();
  };

  const toggleModule = (m: string) => {
      const current = formData.modules || [];
      if (current.includes(m)) {
          setFormData({ ...formData, modules: current.filter(x => x !== m) });
      } else {
          setFormData({ ...formData, modules: [...current, m] });
      }
  };

  return (
    <div className="space-y-6 relative h-full flex flex-col animate-fade-in">
      <div className="flex justify-between items-end border-b border-white/10 pb-4">
          <div><h2 className="text-2xl font-bold text-white mb-1">Prober Instances</h2><p className="text-gray-400 text-sm">Blackbox Exporter nodes configuration</p></div>
          {!isReadOnly && (
            <button onClick={() => setIsAdding(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-900/20"><Plus className="w-4 h-4" /> Add Prober</button>
          )}
      </div>

      <div className="flex gap-4 mb-2">
        <div className="relative flex-1">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
             <input type="text" placeholder="Search probers..." value={localSearch} onChange={(e) => { setLocalSearch(e.target.value); setCurrentPage(1); }} className="w-full bg-[#18181b] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-200 focus:border-blue-500 transition-colors" />
        </div>
      </div>

      {deleteConfirmationId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#18181b] w-full max-w-sm p-6 rounded-xl border border-white/10 shadow-2xl">
             <div className="mb-4 text-red-500 bg-red-500/10 p-3 rounded-full w-fit"><Trash2 className="w-6 h-6" /></div>
             <h3 className="text-lg font-bold text-white mb-2">Delete Prober</h3>
             <p className="text-gray-400 text-sm mb-6">Are you sure? Removing a prober will affect targets.</p>
             <div className="flex gap-3 justify-end">
                <button onClick={() => setDeleteConfirmationId(null)} className="px-4 py-2 rounded-lg text-gray-300 hover:bg-white/5 text-sm font-medium">Cancel</button>
                <button onClick={confirmDelete} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold">Confirm</button>
             </div>
          </div>
        </div>
      )}

      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="bg-[#0f0f11] w-full max-w-lg rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-slide-up flex flex-col max-h-[90vh]">
             {/* Header */}
             <div className="flex justify-between items-center px-6 py-5 border-b border-white/10 bg-[#18181b]">
                <h3 className="text-lg font-bold text-white">{editingId ? "Edit Prober" : "New Prober"}</h3>
                <button onClick={resetForm} className="text-gray-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
             </div>

             {/* Stepper Indicators */}
             <div className="flex border-b border-white/10 bg-[#18181b]/50">
                 <button 
                    onClick={() => setCurrentStep(1)}
                    className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center justify-center gap-2 ${currentStep === 1 ? 'border-blue-500 text-blue-400 bg-blue-500/5' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                 >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] border ${currentStep === 1 ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-600'}`}>1</div>
                    Details
                 </button>
                 <button 
                    onClick={() => setCurrentStep(2)}
                    className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-all flex items-center justify-center gap-2 ${currentStep === 2 ? 'border-blue-500 text-blue-400 bg-blue-500/5' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                 >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] border ${currentStep === 2 ? 'border-blue-500 bg-blue-500 text-white' : 'border-gray-600'}`}>2</div>
                    Capabilities
                 </button>
             </div>

             <div className="p-8 overflow-y-auto custom-scrollbar min-h-[300px]">
                {currentStep === 1 ? (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Instance Name</label>
                            <div className="relative">
                                <Server className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input type="text" value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-[#18181b] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white focus:border-blue-500 transition-colors" placeholder="e.g. us-east-1-prober" autoFocus />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Base URL</label>
                            <div className="relative">
                                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input type="text" value={formData.url || ''} onChange={e => setFormData({ ...formData, url: e.target.value })} className="w-full bg-[#18181b] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white focus:border-blue-500 font-mono text-sm transition-colors" placeholder="http://blackbox:9115" />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Region</label>
                                <input type="text" value={formData.region || ''} onChange={e => setFormData({ ...formData, region: e.target.value })} className="w-full bg-[#18181b] border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-blue-500 transition-colors" placeholder="e.g. us-east-1" />
                            </div>
                            <div>
                                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Scrape Interval</label>
                                <div className="relative">
                                    <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                    <input type="text" value={formData.scrapeInterval || ''} onChange={e => setFormData({ ...formData, scrapeInterval: e.target.value })} className="w-full bg-[#18181b] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white focus:border-blue-500 transition-colors font-mono" placeholder="e.g. 15s" />
                                </div>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-6 animate-fade-in">
                        <div>
                             <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Manual Module Entry</label>
                             <div className="relative">
                                <Box className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input type="text" value={formData.modules?.join(', ') || ''} onChange={e => setFormData({ ...formData, modules: e.target.value.split(',').map(s => s.trim()) })} className="w-full bg-[#18181b] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white focus:border-blue-500 font-mono text-sm transition-colors" placeholder="http_2xx, icmp" />
                             </div>
                             <p className="text-[10px] text-gray-500 mt-2">Comma separated list of modules enabled on this probe.</p>
                        </div>
                        
                        <div>
                            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Quick Presets</label>
                            <div className="grid grid-cols-2 gap-2">
                                {commonModules.map(m => (
                                    <button 
                                        key={m}
                                        onClick={() => toggleModule(m)}
                                        className={`flex items-center justify-between px-3 py-2 rounded-lg border text-xs font-mono transition-all ${
                                            formData.modules?.includes(m) 
                                            ? 'bg-blue-600/10 border-blue-500/50 text-blue-100' 
                                            : 'bg-[#18181b] border-white/5 text-gray-400 hover:border-white/20 hover:text-white'
                                        }`}
                                    >
                                        {m}
                                        {formData.modules?.includes(m) && <CheckCircle2 className="w-3.5 h-3.5 text-blue-500" />}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
             </div>

             <div className="px-6 py-5 border-t border-white/10 bg-[#18181b] flex justify-between items-center">
                {currentStep === 2 ? (
                     <button onClick={() => setCurrentStep(1)} className="text-gray-400 hover:text-white text-sm font-medium flex items-center gap-1"><ChevronLeft className="w-4 h-4" /> Back</button>
                ) : (
                    <div></div>
                )}
                
                <div className="flex gap-3">
                    <button onClick={resetForm} className="px-4 py-2 text-gray-400 hover:text-white text-sm font-medium">Cancel</button>
                    {currentStep === 1 ? (
                        <button onClick={() => setCurrentStep(2)} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg shadow-blue-900/20 flex items-center gap-2">Next <ChevronRight className="w-4 h-4" /></button>
                    ) : (
                        <button onClick={handleSave} className="bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg shadow-emerald-900/20 flex items-center gap-2">
                            {editingId ? 'Save Changes' : 'Register Prober'} <CheckCircle2 className="w-4 h-4" />
                        </button>
                    )}
                </div>
             </div>
          </div>
        </div>
      )}

      <div className="glass-panel rounded-xl overflow-hidden flex flex-col flex-1">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-[#18181b]">
                <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Instance Details</th>
                <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Modules</th>
                <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Region / Interval</th>
                <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {paginatedProbers.map(p => (
                  <tr key={p.id} className="group hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                            <div className="font-bold text-gray-200">{p.name}</div>
                            <div className="text-xs text-gray-500 font-mono">{p.url}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                       <div className="flex flex-wrap gap-1">
                          {p.modules.slice(0, 3).map(m => <span key={m} className="px-2 py-1 bg-[#111] text-blue-400 text-[10px] font-mono rounded border border-white/10">{m}</span>)}
                          {p.modules.length > 3 && <span className="px-2 py-1 bg-[#111] text-gray-500 text-[10px] rounded border border-white/10">+{p.modules.length - 3}</span>}
                       </div>
                    </td>
                    <td className="px-6 py-4">
                        <div className="flex flex-col">
                            <span className="text-gray-400 text-xs font-mono">{p.region || 'default'}</span>
                            {p.scrapeInterval && <span className="text-[10px] text-gray-500 font-mono mt-0.5">{p.scrapeInterval}</span>}
                        </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                            onClick={() => handleCheckConnection(p.id)}
                            disabled={checkingId === p.id}
                            className={`p-1.5 rounded transition-colors ${
                                checkResult?.id === p.id 
                                ? checkResult.success ? 'text-emerald-500 bg-emerald-500/10' : 'text-rose-500 bg-rose-500/10'
                                : 'text-gray-400 hover:bg-white/10 hover:text-white'
                            }`}
                            title="Check Connection"
                        >
                             {checkingId === p.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : 
                              checkResult?.id === p.id ? (checkResult.success ? <CheckCircle2 className="w-4 h-4"/> : <XCircle className="w-4 h-4"/>) : 
                              <RefreshCw className="w-4 h-4" />
                             }
                        </button>

                        {!isReadOnly ? (
                            <>
                                <button onClick={() => startEdit(p)} className="text-gray-400 hover:text-blue-400 text-xs font-medium px-2 py-1 hover:bg-white/5 rounded">Edit</button>
                                <button onClick={() => setDeleteConfirmationId(p.id)} className="text-gray-400 hover:text-red-400 text-xs font-medium px-2 py-1 hover:bg-white/5 rounded">Delete</button>
                            </>
                        ) : (
                            <span className="flex items-center gap-1 text-gray-600 text-[10px] uppercase font-bold tracking-wider cursor-not-allowed">
                                <Lock className="w-3 h-3" /> Read Only
                            </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              {paginatedProbers.length === 0 && <tr><td colSpan={4} className="p-12 text-center text-gray-500 text-sm">No probers found</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};