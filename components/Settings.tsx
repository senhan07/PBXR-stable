import React, { useRef, useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AppState, AppConfig } from '../types';
import { Download, Upload, Server, Shield, Database, RefreshCw, CheckCircle2, XCircle, Archive, KeyRound, Clock, Save, Zap, Info, Globe, Copy, FileCode, Code, Lock, Network, Fingerprint, MousePointerClick, ArrowRight, X } from 'lucide-react';
import { CustomSelect } from './CustomSelect';

interface Props {
  state: AppState;
  onUpdateConfig: (c: AppConfig) => void;
  onImport: (data: Partial<AppState>) => void;
  onLogout: () => void;
}

export const Settings: React.FC<Props> = ({ state, onUpdateConfig, onImport, onLogout }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [checkingConn, setCheckingConn] = useState(false);
  const [connStatus, setConnStatus] = useState<'none' | 'success' | 'fail'>('none');
  const [activeTab, setActiveTab] = useState<'prometheus' | 'endpoints' | 'security' | 'backup'>('prometheus');
  
  // Local state for editing configuration
  const [localConfig, setLocalConfig] = useState<AppConfig>(state.config);
  const [isDirty, setIsDirty] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  
  // Reload state
  const [reloadStatus, setReloadStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');

  // Modal State
  const [activeModal, setActiveModal] = useState<'targets' | 'prometheus' | 'prom-connection' | 'prom-template' | null>(null);

  // Sync local state when external state changes (e.g. after import)
  useEffect(() => {
    setLocalConfig(state.config);
    setIsDirty(false);
  }, [state.config]);

  const updateConfigField = (updates: Partial<AppConfig>) => {
      setLocalConfig(prev => ({ ...prev, ...updates }));
      setIsDirty(true);
      setSaveStatus('idle');
  };

  const handleSave = () => {
      setSaveStatus('saving');
      // Simulate network delay for better UX
      setTimeout(() => {
          onUpdateConfig(localConfig);
          setSaveStatus('saved');
          setIsDirty(false);
          setTimeout(() => setSaveStatus('idle'), 2000);
      }, 500);
  };

  const handleExport = () => {
    const dataStr = JSON.stringify(state, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `blackbox_manager_backup_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try { 
          onImport(JSON.parse(event.target?.result as string)); 
          window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: 'Configuration imported successfully!', type: 'success' } }));
      } catch (err) { 
          window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: 'Invalid JSON file', type: 'error' } }));
      }
    };
    reader.readAsText(file);
  };

  const checkConnection = () => {
      (async () => {
          setCheckingConn(true);
          setConnStatus('none');
          try {
              const base = (localConfig.prometheusUrl || '').replace(/\/$/, '');
              if (!base) throw new Error('No Prometheus URL configured');
              const readyUrl = `${base}/-/ready`;
              const res = await fetch(readyUrl, { method: 'GET' });
              setConnStatus(res.ok ? 'success' : 'fail');
          } catch (err) {
              // Fallback: try base URL
              try {
                  const base = (localConfig.prometheusUrl || '').replace(/\/$/, '');
                  const res2 = await fetch(base || '', { method: 'GET' });
                  setConnStatus(res2.ok ? 'success' : 'fail');
              } catch (e) {
                  setConnStatus('fail');
              }
          } finally {
              setCheckingConn(false);
          }
      })();
  };

  const handleReloadConfig = () => {
      (async () => {
          setReloadStatus('loading');
          try {
              const base = (localConfig.prometheusUrl || '').replace(/\/$/, '');
              if (!base) throw new Error('No Prometheus URL configured');
              const reloadUrl = `${base}/-/reload`;
              const headers: Record<string, string> = {};
              if (localConfig.promAuthMethod === 'basic' && localConfig.promAuthCredentials) {
                  headers['Authorization'] = 'Basic ' + btoa(localConfig.promAuthCredentials);
              } else if (localConfig.promAuthMethod === 'bearer' && localConfig.promAuthCredentials) {
                  headers['Authorization'] = 'Bearer ' + localConfig.promAuthCredentials;
              }
              const res = await fetch(reloadUrl, { method: 'POST', headers });
              setReloadStatus(res.ok ? 'success' : 'error');
          } catch (err) {
              setReloadStatus('error');
          } finally {
              setTimeout(() => setReloadStatus('idle'), 4000);
          }
      })();
  };

  const getDiscoveryUrl = () => {
      const baseUrl = window.location.origin + '/targets';
      if (localConfig.targetsEndpoint.authRequired && localConfig.targetsEndpoint.authToken) {
          return `${baseUrl}?token=${localConfig.targetsEndpoint.authToken}`;
      }
      return baseUrl;
  };

  const getPrometheusConfigUrl = (proberId?: string) => {
      const baseUrl = window.location.origin + (proberId ? `/prometheus/${proberId}` : '/prometheus');
      // Use specific token if available for this prober, otherwise fall back to global token if required
      if (localConfig.prometheusEndpoint.authRequired) {
          const token = (proberId && localConfig.prometheusEndpoint.proberSpecificTokens?.[proberId]) || localConfig.prometheusEndpoint.authToken;
          if (token) {
              return `${baseUrl}?token=${token}`;
          }
      }
      return baseUrl;
  };

  const updateSpecificToken = (proberId: string, token: string) => {
      const currentTokens = localConfig.prometheusEndpoint.proberSpecificTokens || {};
      const newTokens = { ...currentTokens };
      if (token) {
          newTokens[proberId] = token;
      } else {
          delete newTokens[proberId];
      }
      updateConfigField({
          prometheusEndpoint: {
              ...localConfig.prometheusEndpoint,
              proberSpecificTokens: newTokens
          }
      });
  };

  return (
    <div className="max-w-5xl mx-auto h-full flex flex-col animate-fade-in pb-6">
      <div className="flex justify-between items-end border-b border-zinc-800 pb-4 shrink-0 mb-6">
         <div>
            <h2 className="text-xl font-bold text-white">System Settings</h2>
            <p className="text-zinc-500 text-sm">Global parameters and state management</p>
         </div>
         <div className="flex items-center gap-3">
             <button 
                onClick={handleSave}
                disabled={!isDirty && saveStatus !== 'saved'}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    saveStatus === 'saved' 
                    ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-900/20' 
                    : isDirty 
                        ? 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20' 
                        : 'bg-zinc-800 text-zinc-500 cursor-not-allowed border border-zinc-700'
                }`}
             >
                {saveStatus === 'saving' ? <RefreshCw className="w-4 h-4 animate-spin" /> : 
                 saveStatus === 'saved' ? <CheckCircle2 className="w-4 h-4" /> : 
                 <Save className="w-4 h-4" />}
                {saveStatus === 'saving' ? 'Saving...' : 
                 saveStatus === 'saved' ? 'Saved' : 'Save Changes'}
             </button>
         </div>
      </div>

      {/* Tabs Navigation */}
      <div className="flex gap-1 bg-zinc-900/50 p-1.5 rounded-xl border border-white/5 shrink-0 mb-8 self-start w-full md:w-auto overflow-x-auto">
         <button
           onClick={() => setActiveTab('prometheus')}
           className={`px-6 py-2.5 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
             activeTab === 'prometheus' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'
           }`}
         >
           <Server className="w-4 h-4" /> Prometheus
         </button>
         <button
           onClick={() => setActiveTab('endpoints')}
           className={`px-6 py-2.5 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
             activeTab === 'endpoints' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'
           }`}
         >
           <Globe className="w-4 h-4" /> Endpoints
         </button>
         <button
           onClick={() => setActiveTab('security')}
           className={`px-6 py-2.5 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
             activeTab === 'security' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'
           }`}
         >
           <Shield className="w-4 h-4" /> Security
         </button>
         <button
           onClick={() => setActiveTab('backup')}
           className={`px-6 py-2.5 text-sm font-medium rounded-lg transition-all flex items-center gap-2 ${
             activeTab === 'backup' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' : 'text-zinc-400 hover:text-white hover:bg-white/5'
           }`}
         >
           <Database className="w-4 h-4" /> Backup & Restore
         </button>
      </div>

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-y-auto pr-2 custom-scrollbar">
        
        {/* PROMETHEUS TAB RE-DESIGNED */}
        {activeTab === 'prometheus' && (
          <div className="space-y-10 animate-fade-in">
             <div>
                 <h3 className="text-lg font-bold text-white mb-5 pl-4 border-l-4 border-indigo-500 flex items-center gap-3">
                     Server Configuration
                     <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-mono border border-indigo-500/20 uppercase tracking-wide">Infrastructure</span>
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     
                     {/* Summary Card 1: Server Connection */}
                     <div onClick={() => setActiveModal('prom-connection')} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-indigo-500/30 transition-all cursor-pointer group shadow-sm hover:shadow-lg hover:shadow-indigo-900/10">
                         <div className="flex justify-between items-start mb-4">
                             <div className="p-3 bg-indigo-500/10 rounded-lg text-indigo-400 group-hover:scale-110 transition-transform shadow-inner"><Server className="w-6 h-6" /></div>
                             <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${localConfig.prometheusUrl ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-zinc-800 text-zinc-500 border-zinc-700'}`}>
                                 {localConfig.prometheusUrl ? 'CONFIGURED' : 'NOT SET'}
                             </div>
                         </div>
                         <h4 className="text-base font-bold text-white mb-1">Server Connection</h4>
                         <p className="text-sm text-zinc-500 mb-6 truncate">{localConfig.prometheusUrl || 'http://localhost:9090'}</p>
                         <div className="text-xs text-indigo-400 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform uppercase tracking-wider">
                             Manage Connection <ArrowRight className="w-3 h-3" />
                         </div>
                     </div>

                     {/* Summary Card 2: Configuration Template */}
                     <div onClick={() => setActiveModal('prom-template')} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-orange-500/30 transition-all cursor-pointer group shadow-sm hover:shadow-lg hover:shadow-orange-900/10">
                         <div className="flex justify-between items-start mb-4">
                             <div className="p-3 bg-orange-500/10 rounded-lg text-orange-400 group-hover:scale-110 transition-transform shadow-inner"><FileCode className="w-6 h-6" /></div>
                             <div className="px-2.5 py-1 rounded-full text-[10px] font-bold border bg-zinc-800 text-zinc-500 border-zinc-700">
                                 YAML
                             </div>
                         </div>
                         <h4 className="text-base font-bold text-white mb-1">Scrape Template</h4>
                         <p className="text-sm text-zinc-500 mb-6">Customize generation rules</p>
                         <div className="text-xs text-orange-400 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform uppercase tracking-wider">
                             Edit Template <ArrowRight className="w-3 h-3" />
                         </div>
                     </div>
                 </div>
             </div>
          </div>
        )}

        {/* ENDPOINTS TAB */}
        {activeTab === 'endpoints' && (
           <div className="space-y-10 animate-fade-in">
             <div>
                 <h3 className="text-lg font-bold text-white mb-5 pl-4 border-l-4 border-blue-500 flex items-center gap-3">
                     Integration & Connectivity
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     
                     {/* Summary Card 1: Targets Discovery */}
                     <div onClick={() => setActiveModal('targets')} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-blue-500/30 transition-all cursor-pointer group shadow-sm hover:shadow-lg hover:shadow-blue-900/10">
                         <div className="flex justify-between items-start mb-4">
                             <div className="p-3 bg-blue-500/10 rounded-lg text-blue-400 group-hover:scale-110 transition-transform shadow-inner"><Globe className="w-6 h-6" /></div>
                             <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${localConfig.targetsEndpoint.enabled ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-zinc-800 text-zinc-500 border-zinc-700'}`}>
                                 {localConfig.targetsEndpoint.enabled ? 'ENABLED' : 'DISABLED'}
                             </div>
                         </div>
                         <h4 className="text-base font-bold text-white mb-1">HTTP Service Discovery</h4>
                         <p className="text-sm text-zinc-500 mb-6">/targets endpoint configuration</p>
                         <div className="text-xs text-blue-400 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform uppercase tracking-wider">
                             Configure Settings <ArrowRight className="w-3 h-3" />
                         </div>
                     </div>

                     {/* Summary Card 2: Prometheus Config */}
                     <div onClick={() => setActiveModal('prometheus')} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 hover:border-orange-500/30 transition-all cursor-pointer group shadow-sm hover:shadow-lg hover:shadow-orange-900/10">
                         <div className="flex justify-between items-start mb-4">
                             <div className="p-3 bg-orange-500/10 rounded-lg text-orange-400 group-hover:scale-110 transition-transform shadow-inner"><Network className="w-6 h-6" /></div>
                             <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${localConfig.prometheusEndpoint.enabled ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-zinc-800 text-zinc-500 border-zinc-700'}`}>
                                 {localConfig.prometheusEndpoint.enabled ? 'ENABLED' : 'DISABLED'}
                             </div>
                         </div>
                         <h4 className="text-base font-bold text-white mb-1">Scrape Configuration</h4>
                         <p className="text-sm text-zinc-500 mb-6">Prometheus YAML generation</p>
                         <div className="text-xs text-orange-400 font-bold flex items-center gap-1 group-hover:translate-x-1 transition-transform uppercase tracking-wider">
                             Configure Settings <ArrowRight className="w-3 h-3" />
                         </div>
                     </div>
                 </div>
             </div>
           </div>
        )}

        {/* SECURITY TAB RE-DESIGNED */}
        {activeTab === 'security' && (
           <div className="space-y-10 animate-fade-in">
             {/* SECTION: GOVERNANCE & POLICIES */}
             <div>
                 <h3 className="text-lg font-bold text-white mb-5 pl-4 border-l-4 border-emerald-500 flex items-center gap-3">
                     Governance & Policies
                     <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-mono border border-emerald-500/20 uppercase tracking-wide">Internal Control</span>
                 </h3>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                     
                     {/* Password Policy */}
                     <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-sm flex flex-col gap-4">
                         <div className="flex items-center gap-2 mb-2">
                             <div className="p-1.5 bg-zinc-800 rounded text-zinc-400"><Fingerprint className="w-4 h-4" /></div>
                             <h4 className="text-sm font-bold text-white">Password Policy</h4>
                         </div>
                         <div className="space-y-3">
                             <div>
                                 <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Min Length</label>
                                 <input 
                                    type="number" min="4" max="64"
                                    value={localConfig.passwordPolicy.minLength}
                                    onChange={(e) => updateConfigField({ passwordPolicy: { ...localConfig.passwordPolicy, minLength: parseInt(e.target.value) } })}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 text-sm outline-none focus:border-emerald-600" 
                                />
                             </div>
                             <div className="space-y-2 pt-2">
                                 <label className="flex items-center gap-2 cursor-pointer">
                                     <input type="checkbox" checked={localConfig.passwordPolicy.requireNumber} onChange={(e) => updateConfigField({ passwordPolicy: { ...localConfig.passwordPolicy, requireNumber: e.target.checked } })} className="bg-zinc-950 border-zinc-800 rounded text-emerald-600" />
                                     <span className="text-xs text-zinc-400">Require Numbers</span>
                                 </label>
                                 <label className="flex items-center gap-2 cursor-pointer">
                                     <input type="checkbox" checked={localConfig.passwordPolicy.requireSpecialChar} onChange={(e) => updateConfigField({ passwordPolicy: { ...localConfig.passwordPolicy, requireSpecialChar: e.target.checked } })} className="bg-zinc-950 border-zinc-800 rounded text-emerald-600" />
                                     <span className="text-xs text-zinc-400">Require Special Chars</span>
                                 </label>
                             </div>
                         </div>
                     </div>

                     {/* Session Timeout */}
                     <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-sm flex flex-col gap-4">
                         <div className="flex items-center gap-2 mb-2">
                             <div className="p-1.5 bg-zinc-800 rounded text-zinc-400"><MousePointerClick className="w-4 h-4" /></div>
                             <h4 className="text-sm font-bold text-white">Session Security</h4>
                         </div>
                         <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Auto-Logout (Minutes)</label>
                            <input 
                                type="number" min="0" max="480"
                                value={localConfig.autoLogoutMinutes || 0} 
                                onChange={(e) => updateConfigField({ autoLogoutMinutes: parseInt(e.target.value) || 0 })} 
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 text-sm outline-none focus:border-emerald-600" 
                            />
                            <p className="text-[10px] text-zinc-500 mt-2 leading-tight">
                                Set to 0 to disable automatic logout. Timer resets on user activity.
                            </p>
                         </div>
                     </div>

                     {/* Data Retention */}
                     <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 shadow-sm flex flex-col gap-4">
                         <div className="flex items-center gap-2 mb-2">
                             <div className="p-1.5 bg-zinc-800 rounded text-zinc-400"><Archive className="w-4 h-4" /></div>
                             <h4 className="text-sm font-bold text-white">Data Lifecycle</h4>
                         </div>
                         <div>
                            <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block mb-1">Event Log Retention (Days)</label>
                            <input 
                                type="number" min="1" max="365"
                                value={localConfig.logRetentionDays || 30} 
                                onChange={(e) => updateConfigField({ logRetentionDays: parseInt(e.target.value) || 30 })} 
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-zinc-200 text-sm outline-none focus:border-emerald-600" 
                            />
                            <p className="text-[10px] text-zinc-500 mt-2 leading-tight">
                                Audit logs older than this limit are automatically purged.
                            </p>
                         </div>
                     </div>

                 </div>
             </div>
           </div>
        )}

        {/* BACKUP TAB */}
        {activeTab === 'backup' && (
           <div className="space-y-6 animate-fade-in max-w-4xl">
             <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 shadow-sm">
               <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                    <Database className="w-5 h-5 text-blue-500" /> State Management
               </h3>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="p-6 bg-zinc-950/50 rounded-xl border border-zinc-800 flex flex-col items-center text-center hover:border-blue-500/30 transition-colors">
                       <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 mb-4">
                           <Download className="w-6 h-6" />
                       </div>
                       <h4 className="text-white font-bold mb-2">Export Configuration</h4>
                       <p className="text-zinc-500 text-sm mb-6">Download a JSON snapshot of targets, probers, and settings.</p>
                       <button onClick={handleExport} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2.5 rounded-lg text-sm transition-all shadow-lg shadow-blue-900/20">
                           Download Backup
                       </button>
                   </div>

                   <div className="p-6 bg-zinc-950/50 rounded-xl border border-zinc-800 flex flex-col items-center text-center hover:border-purple-500/30 transition-colors">
                       <div className="w-12 h-12 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500 mb-4">
                           <Upload className="w-6 h-6" />
                       </div>
                       <h4 className="text-white font-bold mb-2">Import Configuration</h4>
                       <p className="text-zinc-500 text-sm mb-6">Restore system state from a previously exported JSON file.</p>
                       <button onClick={() => fileInputRef.current?.click()} className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-2.5 rounded-lg text-sm transition-all border border-zinc-700">
                           Select File
                       </button>
                       <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".json" />
                   </div>
               </div>
             </div>
           </div>
        )}
      </div>

      {/* --- MODALS FOR PROMETHEUS SETTINGS --- */}
      {activeModal === 'prom-connection' && createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setActiveModal(null)}>
                <div className="bg-[#18181b] w-full max-w-lg rounded-xl border border-white/10 shadow-2xl overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="flex justify-between items-center px-6 py-5 border-b border-white/10 bg-[#18181b]">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400"><Server className="w-5 h-5" /></div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Prometheus Server</h3>
                                <p className="text-xs text-zinc-500 font-mono">Connection & Authentication</p>
                            </div>
                        </div>
                        <button onClick={() => setActiveModal(null)} className="text-zinc-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                    </div>
                    
                    {/* Content */}
                    <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                        <div>
                            <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Server URL</label>
                            <div className="flex gap-2">
                                <input value={localConfig.prometheusUrl} onChange={(e) => updateConfigField({ prometheusUrl: e.target.value })} className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-200 outline-none focus:border-indigo-600 font-mono text-sm transition-colors" placeholder="http://localhost:9090" />
                                <button 
                                    onClick={checkConnection}
                                    disabled={checkingConn}
                                    className={`px-4 py-2 rounded-lg border flex items-center gap-2 text-sm font-medium transition-colors min-w-[100px] justify-center ${
                                        connStatus === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' :
                                        connStatus === 'fail' ? 'bg-rose-500/10 border-rose-500/30 text-rose-500' :
                                        'bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                                    }`}
                                >
                                    {checkingConn ? <RefreshCw className="w-4 h-4 animate-spin" /> : 
                                    connStatus === 'success' ? <CheckCircle2 className="w-4 h-4" /> :
                                    connStatus === 'fail' ? <XCircle className="w-4 h-4" /> :
                                    'Check'
                                    }
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Default Scrape Interval</label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600" />
                                <input value={localConfig.scrapeInterval} onChange={(e) => updateConfigField({ scrapeInterval: e.target.value })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-10 pr-4 py-2.5 text-zinc-200 outline-none focus:border-indigo-600 font-mono text-sm transition-colors" placeholder="e.g. 60s" />
                            </div>
                        </div>

                        <div className="border-t border-zinc-800 pt-4">
                            <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                                <KeyRound className="w-4 h-4 text-zinc-400" /> Authentication
                            </h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Auth Method</label>
                                    <CustomSelect 
                                        value={localConfig.promAuthMethod}
                                        onChange={(v) => updateConfigField({ promAuthMethod: v as any })}
                                        options={[
                                            { value: 'none', label: 'No Authentication' },
                                            { value: 'basic', label: 'Basic Auth' },
                                            { value: 'bearer', label: 'Bearer Token' },
                                        ]}
                                    />
                                </div>
                                {localConfig.promAuthMethod !== 'none' && (
                                    <div className="animate-fade-in">
                                        <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">
                                            {localConfig.promAuthMethod === 'basic' ? 'Credentials (user:pass)' : 'Bearer Token'}
                                        </label>
                                        <input 
                                            type="password"
                                            value={localConfig.promAuthCredentials || ''}
                                            onChange={(e) => updateConfigField({ promAuthCredentials: e.target.value })}
                                            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-200 outline-none focus:border-indigo-600 font-mono text-sm transition-colors"
                                            placeholder={localConfig.promAuthMethod === 'basic' ? 'admin:password' : 'ey...'}
                                        />
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Operations Section embedded within Modal */}
                        <div className="border-t border-zinc-800 pt-4 mt-4">
                            <div className="flex items-center justify-between bg-zinc-900 border border-zinc-800 p-3 rounded-lg">
                                <div>
                                    <h5 className="text-xs font-bold text-white flex items-center gap-2">
                                        <Zap className="w-3 h-3 text-yellow-500" /> Server Operations
                                    </h5>
                                    <p className="text-[10px] text-zinc-500 mt-1">Triggers a configuration reload via web API.</p>
                                    {reloadStatus === 'success' && <p className="text-[10px] text-emerald-500 mt-1">Reload successful</p>}
                                    {reloadStatus === 'error' && <p className="text-[10px] text-rose-500 mt-1">Reload failed</p>}
                                </div>
                                <button 
                                    onClick={handleReloadConfig}
                                    disabled={reloadStatus === 'loading'}
                                    className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded text-xs font-medium flex items-center gap-2 transition-colors border border-zinc-700"
                                >
                                    <RefreshCw className={`w-3 h-3 ${reloadStatus === 'loading' ? 'animate-spin' : ''}`} />
                                    {reloadStatus === 'loading' ? '...' : 'Reload'}
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    {/* Footer */}
                    <div className="px-6 py-4 bg-zinc-900/50 border-t border-white/5 flex justify-end">
                        <button onClick={() => setActiveModal(null)} className="px-4 py-2 bg-white text-black font-bold rounded-lg text-sm hover:bg-gray-200 transition-colors">Done</button>
                    </div>
                </div>
            </div>,
            document.body
      )}

      {activeModal === 'prom-template' && createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setActiveModal(null)}>
                <div className="bg-[#18181b] w-full max-w-4xl rounded-xl border border-white/10 shadow-2xl overflow-hidden animate-slide-up flex flex-col h-[80vh]" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="flex justify-between items-center px-6 py-5 border-b border-white/10 bg-[#18181b] shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-500/10 rounded-lg text-orange-400"><FileCode className="w-5 h-5" /></div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Scrape Configuration Template</h3>
                                <p className="text-xs text-zinc-500 font-mono">YAML Generation</p>
                            </div>
                        </div>
                        <button onClick={() => setActiveModal(null)} className="text-zinc-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                    </div>
                    
                    {/* Content */}
                    <div className="flex flex-1 min-h-0">
                        <div className="flex-1 p-4 bg-[#0d0d0f]">
                            <textarea 
                                value={localConfig.prometheusTemplate || ''}
                                onChange={(e) => updateConfigField({ prometheusTemplate: e.target.value })}
                                className="w-full h-full bg-transparent text-xs font-mono text-zinc-300 outline-none resize-none leading-relaxed custom-scrollbar"
                                placeholder="Enter scrape_config YAML template..."
                                spellCheck={false}
                            />
                        </div>
                        <div className="w-64 bg-zinc-900 border-l border-zinc-800 p-4 overflow-y-auto custom-scrollbar">
                            <h4 className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-4">Available Variables</h4>
                            <div className="space-y-3">
                                {[
                                    { var: '${job_name}', desc: 'Generated job name based on prober' },
                                    { var: '${prober_name}', desc: 'Name of the prober instance' },
                                    { var: '${prober_url}', desc: 'Address of the prober (host:port)' },
                                    { var: '${scrape_interval}', desc: 'Scrape interval (e.g. 60s)' },
                                    { var: '${http_sd_config}', desc: 'Auto-generated HTTP SD block' },
                                    { var: '${discovery_url}', desc: 'URL to this app\'s /targets endpoint' },
                                ].map((v) => (
                                    <div key={v.var} className="p-3 bg-zinc-950 border border-zinc-800 rounded-lg group hover:border-orange-500/30 transition-colors">
                                        <code className="text-xs text-orange-400 block mb-1 group-hover:text-orange-300">{v.var}</code>
                                        <span className="text-[10px] text-zinc-500 leading-tight block">{v.desc}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-6 p-3 bg-blue-500/5 border border-blue-500/10 rounded-lg">
                                <p className="text-[10px] text-blue-400 leading-relaxed">
                                    <Info className="w-3 h-3 inline mr-1" />
                                    This template is applied for each registered prober to generate the final <code className="bg-blue-900/30 px-1 rounded">scrape_configs</code> list.
                                </p>
                            </div>
                        </div>
                    </div>
                    
                    {/* Footer */}
                    <div className="px-6 py-4 bg-zinc-900 border-t border-white/5 flex justify-end shrink-0">
                        <button onClick={() => setActiveModal(null)} className="px-4 py-2 bg-white text-black font-bold rounded-lg text-sm hover:bg-gray-200 transition-colors">Done</button>
                    </div>
                </div>
            </div>,
            document.body
      )}

      {/* --- MODALS FOR SECURITY SETTINGS --- */}
      {activeModal === 'targets' && createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setActiveModal(null)}>
                <div className="bg-[#18181b] w-full max-w-lg rounded-xl border border-white/10 shadow-2xl overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="flex justify-between items-center px-6 py-5 border-b border-white/10 bg-[#18181b]">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400"><Globe className="w-5 h-5" /></div>
                            <div>
                                <h3 className="text-lg font-bold text-white">HTTP Service Discovery</h3>
                                <p className="text-xs text-zinc-500 font-mono">/targets</p>
                            </div>
                        </div>
                        <button onClick={() => setActiveModal(null)} className="text-zinc-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                    </div>
                    
                    {/* Content */}
                    <div className="p-6 space-y-6">
                        <p className="text-sm text-zinc-400 leading-relaxed">
                             Exposes configured targets formatted for Prometheus HTTP Service Discovery mechanism.
                        </p>

                        {/* Toggle */}
                        <div className="flex items-center justify-between p-4 bg-zinc-900/50 border border-white/5 rounded-lg">
                            <span className="text-sm font-medium text-zinc-300">Enable Endpoint</span>
                            <div className="relative inline-block w-10 h-5 transition duration-200 ease-in-out rounded-full cursor-pointer">
                                <input type="checkbox" id="modal-toggle-target" className="absolute w-0 h-0 opacity-0" checked={localConfig.targetsEndpoint.enabled} onChange={(e) => updateConfigField({ targetsEndpoint: { ...localConfig.targetsEndpoint, enabled: e.target.checked } })} />
                                <label htmlFor="modal-toggle-target" className={`block overflow-hidden h-5 rounded-full cursor-pointer ${localConfig.targetsEndpoint.enabled ? 'bg-blue-600' : 'bg-zinc-700'}`}>
                                    <span className={`block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out ${localConfig.targetsEndpoint.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                </label>
                            </div>
                        </div>

                        {localConfig.targetsEndpoint.enabled && (
                            <div className="space-y-6 animate-fade-in">
                                {/* URL */}
                                <div>
                                    <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Endpoint URL</label>
                                    <div className="flex bg-zinc-950 border border-zinc-800 rounded-lg p-1">
                                        <input readOnly value={getDiscoveryUrl()} className="flex-1 bg-transparent px-3 py-2 text-zinc-300 font-mono text-xs outline-none w-full" />
                                        <button onClick={() => navigator.clipboard.writeText(getDiscoveryUrl())} className="px-2 text-zinc-500 hover:text-white transition-colors" title="Copy URL"><Copy className="w-4 h-4" /></button>
                                    </div>
                                </div>

                                {/* Auth */}
                                <div className="pt-4 border-t border-white/5">
                                    <label className="flex items-center gap-2 cursor-pointer mb-4">
                                        <input type="checkbox" checked={localConfig.targetsEndpoint.authRequired} onChange={(e) => updateConfigField({ targetsEndpoint: { ...localConfig.targetsEndpoint, authRequired: e.target.checked } })} className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-blue-600 focus:ring-0" />
                                        <span className="text-sm text-zinc-300 font-medium">Require Authentication Token</span>
                                    </label>

                                    {localConfig.targetsEndpoint.authRequired && (
                                        <div className="space-y-2 pl-6 animate-slide-up">
                                            <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider">Secret Token</label>
                                            <input type="text" value={localConfig.targetsEndpoint.authToken || ''} onChange={(e) => updateConfigField({ targetsEndpoint: { ...localConfig.targetsEndpoint, authToken: e.target.value } })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-zinc-200 outline-none focus:border-blue-600 font-mono text-sm" placeholder="e.g. secret-token-123" />
                                            <p className="text-[10px] text-zinc-500">Clients must append <code className="text-blue-400 bg-blue-500/10 px-1 rounded">?token=...</code> to requests.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Footer */}
                    <div className="px-6 py-4 bg-zinc-900/50 border-t border-white/5 flex justify-end">
                        <button onClick={() => setActiveModal(null)} className="px-4 py-2 bg-white text-black font-bold rounded-lg text-sm hover:bg-gray-200 transition-colors">Done</button>
                    </div>
                </div>
            </div>,
            document.body
      )}

      {activeModal === 'prometheus' && createPortal(
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" onClick={() => setActiveModal(null)}>
                <div className="bg-[#18181b] w-full max-w-lg rounded-xl border border-white/10 shadow-2xl overflow-hidden animate-slide-up max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                    {/* Header */}
                    <div className="flex justify-between items-center px-6 py-5 border-b border-white/10 bg-[#18181b] shrink-0">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-500/10 rounded-lg text-orange-400"><Network className="w-5 h-5" /></div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Scrape Configuration</h3>
                                <p className="text-xs text-zinc-500 font-mono">/prometheus</p>
                            </div>
                        </div>
                        <button onClick={() => setActiveModal(null)} className="text-zinc-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                    </div>
                    
                    {/* Content */}
                    <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                        <p className="text-sm text-zinc-400 leading-relaxed">
                            Dynamically generates <code>scrape_configs</code> YAML for Prometheus based on active probers.
                        </p>

                        {/* Toggle */}
                        <div className="flex items-center justify-between p-4 bg-zinc-900/50 border border-white/5 rounded-lg">
                            <span className="text-sm font-medium text-zinc-300">Enable Endpoint</span>
                            <div className="relative inline-block w-10 h-5 transition duration-200 ease-in-out rounded-full cursor-pointer">
                                <input type="checkbox" id="modal-toggle-prom" className="absolute w-0 h-0 opacity-0" checked={localConfig.prometheusEndpoint.enabled} onChange={(e) => updateConfigField({ prometheusEndpoint: { ...localConfig.prometheusEndpoint, enabled: e.target.checked } })} />
                                <label htmlFor="modal-toggle-prom" className={`block overflow-hidden h-5 rounded-full cursor-pointer ${localConfig.prometheusEndpoint.enabled ? 'bg-blue-600' : 'bg-zinc-700'}`}>
                                    <span className={`block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out ${localConfig.prometheusEndpoint.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                </label>
                            </div>
                        </div>

                        {localConfig.prometheusEndpoint.enabled && (
                            <div className="space-y-6 animate-fade-in">
                                {/* URL */}
                                <div>
                                    <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider mb-2">Global Endpoint URL</label>
                                    <div className="flex bg-zinc-950 border border-zinc-800 rounded-lg p-1">
                                        <input readOnly value={getPrometheusConfigUrl()} className="flex-1 bg-transparent px-3 py-2 text-zinc-300 font-mono text-xs outline-none w-full" />
                                        <button onClick={() => navigator.clipboard.writeText(getPrometheusConfigUrl())} className="px-2 text-zinc-500 hover:text-white transition-colors" title="Copy URL"><Copy className="w-4 h-4" /></button>
                                    </div>
                                </div>

                                {/* Prober Overrides */}
                                <div className="pt-2 border-t border-zinc-800/50">
                                    <div className="flex justify-between items-center mb-3">
                                        <span className="text-[10px] uppercase font-bold text-zinc-500">Individual Prober Overrides</span>
                                    </div>
                                    <div className="space-y-3">
                                        {state.probers.length > 0 ? state.probers.map(p => (
                                            <div key={p.id} className="bg-zinc-950/50 border border-zinc-800/50 rounded-lg p-3">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-zinc-300 font-bold text-xs">{p.name}</span>
                                                    <button onClick={() => navigator.clipboard.writeText(getPrometheusConfigUrl(p.id))} className="text-zinc-500 hover:text-white transition-colors" title="Copy URL"><Copy className="w-3 h-3" /></button>
                                                </div>
                                                <div className="bg-zinc-900 border border-zinc-800 rounded px-2 py-1.5 mb-2">
                                                     <code className="block text-zinc-500 font-mono truncate text-[10px]">{getPrometheusConfigUrl(p.id)}</code>
                                                </div>
                                                {localConfig.prometheusEndpoint.authRequired && (
                                                    <div className="flex items-center gap-2">
                                                        <KeyRound className="w-3 h-3 text-zinc-600" />
                                                        <input 
                                                            type="text" 
                                                            placeholder="Override Token (Optional)"
                                                            value={localConfig.prometheusEndpoint.proberSpecificTokens?.[p.id] || ''}
                                                            onChange={(e) => updateSpecificToken(p.id, e.target.value)}
                                                            className="flex-1 bg-transparent border-b border-zinc-800 py-1 text-zinc-300 text-[10px] focus:border-blue-500 outline-none placeholder-zinc-700"
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        )) : <p className="text-[10px] text-zinc-600 italic p-2 border border-zinc-800 border-dashed rounded bg-zinc-900/30 text-center">No probers defined.</p>}
                                    </div>
                                </div>

                                {/* Auth */}
                                <div className="pt-4 border-t border-white/5">
                                    <label className="flex items-center gap-2 cursor-pointer mb-4">
                                        <input type="checkbox" checked={localConfig.prometheusEndpoint.authRequired} onChange={(e) => updateConfigField({ prometheusEndpoint: { ...localConfig.prometheusEndpoint, authRequired: e.target.checked } })} className="w-4 h-4 rounded bg-zinc-900 border-zinc-700 text-blue-600 focus:ring-0" />
                                        <span className="text-sm text-zinc-300 font-medium">Require Global Authentication Token</span>
                                    </label>

                                    {localConfig.prometheusEndpoint.authRequired && (
                                        <div className="space-y-2 pl-6 animate-slide-up">
                                            <label className="block text-xs font-medium text-zinc-500 uppercase tracking-wider">Global Secret Token</label>
                                            <input type="text" value={localConfig.prometheusEndpoint.authToken || ''} onChange={(e) => updateConfigField({ prometheusEndpoint: { ...localConfig.prometheusEndpoint, authToken: e.target.value } })} className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2 text-zinc-200 outline-none focus:border-blue-600 font-mono text-sm" placeholder="e.g. secret-token-123" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                    
                    {/* Footer */}
                    <div className="px-6 py-4 bg-zinc-900/50 border-t border-white/5 flex justify-end shrink-0">
                        <button onClick={() => setActiveModal(null)} className="px-4 py-2 bg-white text-black font-bold rounded-lg text-sm hover:bg-gray-200 transition-colors">Done</button>
                    </div>
                </div>
            </div>,
            document.body
      )}

    </div>
  );
};