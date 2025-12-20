import React from 'react';
import { AppState } from '../types';
import { Activity, Server, Layers, ScrollText, Clock, ShieldCheck, CheckCircle2, PauseCircle, Target } from 'lucide-react';

interface Props {
  state: AppState;
}

export const Dashboard: React.FC<Props> = ({ state }) => {
    const [previewEvents, setPreviewEvents] = React.useState(state.events.slice(0,25));

    const fetchPreviewEvents = async () => {
        try {
            const res = await fetch('/api/events');
            if (!res.ok) return;
            const data = await res.json();
            setPreviewEvents((data || []).slice(0,25));
        } catch (e) {
            console.warn('Failed to fetch preview events', e);
        }
    };

    // Auto-poll events so the dashboard live feed updates in near-real-time
    React.useEffect(() => {
        // initial fetch
        fetchPreviewEvents();
        const id = setInterval(fetchPreviewEvents, 3000);
        return () => clearInterval(id);
    }, []);
  const totalTargets = state.targets.length;
  const enabledTargets = state.targets.filter(t => t.enabled !== false).length;
  const disabledTargets = totalTargets - enabledTargets;
  
  const totalProbers = state.probers.length;
  const totalGroups = state.targetGroups?.length || 0;
  const eventCount = state.events.length;

  const StatCard = ({ title, value, icon: Icon, colorClass, borderClass }: any) => (
    <div className="bg-[#18181b] border border-white/5 p-4 rounded-xl hover:border-white/10 transition-all duration-300 relative overflow-hidden group">
      <div className={`absolute left-0 top-0 bottom-0 w-1 ${borderClass}`}></div>
      <div className="flex items-center gap-4">
        <div className={`p-2.5 rounded-lg bg-[#0f0f11] border border-white/5 ${colorClass} group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
           <Icon className="w-5 h-5" />
        </div>
        <div>
           <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-0.5">{title}</p>
           <p className="text-2xl font-bold text-white font-mono tracking-tight leading-none">{value}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in pb-6 h-full flex flex-col">
      <div className="flex items-end justify-between border-b border-white/10 pb-4 shrink-0">
        <div>
           <h2 className="text-2xl font-bold text-white tracking-tight">System Overview</h2>
           <p className="text-gray-500 text-sm mt-1">Configuration & Telemetry Dashboard</p>
        </div>
        <div className="flex gap-2">
            <span className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-bold tracking-wide">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                SYSTEM ACTIVE
            </span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 shrink-0">
        <StatCard 
            title="Total Targets" 
            value={totalTargets} 
            icon={Target} 
            colorClass="text-blue-500" 
            borderClass="bg-blue-500" 
        />
        <StatCard 
            title="Enabled" 
            value={enabledTargets} 
            icon={CheckCircle2} 
            colorClass="text-emerald-500" 
            borderClass="bg-emerald-500" 
        />
        <StatCard 
            title="Disabled" 
            value={disabledTargets} 
            icon={PauseCircle} 
            colorClass="text-zinc-500" 
            borderClass="bg-zinc-500" 
        />
        <StatCard 
            title="Prober Nodes" 
            value={totalProbers} 
            icon={Server} 
            colorClass="text-purple-500" 
            borderClass="bg-purple-500"
        />
        <StatCard 
            title="Groups" 
            value={totalGroups} 
            icon={Layers} 
            colorClass="text-amber-500" 
            borderClass="bg-amber-500"
        />
        <StatCard 
            title="Events" 
            value={eventCount} 
            icon={ScrollText} 
            colorClass="text-gray-400" 
            borderClass="bg-gray-500"
        />
      </div>

      <div className="bg-[#18181b] border border-white/5 rounded-xl p-6 flex flex-col shadow-2xl flex-1 min-h-0">
          <div className="flex items-center justify-between mb-6 shrink-0">
             <div className="flex items-center gap-3">
                <div className="p-2 bg-white/5 rounded-lg border border-white/5">
                    <Clock className="w-5 h-5 text-gray-400" />
                </div>
                <div>
                    <h3 className="text-base font-bold text-white">Recent System Activity</h3>
                    <p className="text-xs text-gray-500">Real-time audit log of configuration changes</p>
                </div>
             </div>
             <div className="flex gap-2">
                <span className="px-3 py-1 bg-white/5 rounded-lg text-[10px] font-mono text-gray-500 border border-white/5">
                    LIVE FEED
                </span>
                <button onClick={fetchPreviewEvents} className="px-3 py-1 bg-[#18181b] rounded-lg border border-white/10 text-xs text-gray-300">Refresh</button>
             </div>
          </div>
          
                <div className="space-y-1 flex-1 overflow-y-auto pr-2 custom-scrollbar">
            {previewEvents.length > 0 ? (
                previewEvents.map((event, i) => ( 
                <div key={event.id || i} className="group flex items-start gap-4 p-3 rounded-xl hover:bg-white/[0.02] border border-transparent hover:border-white/5 transition-all">
                    <div className="flex flex-col items-center pt-1.5">
                        <div className={`w-2 h-2 rounded-full ring-4 ring-[#18181b] transition-all ${
                            event.type === 'error' ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]' :
                            event.type === 'warning' ? 'bg-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.4)]' :
                            event.type === 'success' ? 'bg-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.4)]'
                        }`}></div>
                        {i !== previewEvents.length - 1 && <div className="w-px h-full bg-white/5 my-1 group-last:hidden min-h-[20px]"></div>}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start gap-4">
                             <p className="text-sm text-gray-200 font-medium leading-relaxed">
                                {event.message}
                            </p>
                            <span className="text-[11px] text-gray-500 font-mono whitespace-nowrap pt-0.5">
                                {new Date(event.timestamp).toLocaleTimeString()}
                            </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5">
                             <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider border ${
                                 event.type === 'error' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                 event.type === 'warning' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                                 event.type === 'success' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-blue-500/10 text-blue-500 border-blue-500/20'
                             }`}>
                                 {event.type}
                             </span>
                             <span className="text-[11px] text-gray-500 flex items-center gap-1.5">
                                <ShieldCheck className="w-3 h-3 text-gray-600" />
                                <span className="text-gray-400">{event.user}</span>
                             </span>
                        </div>
                    </div>
                </div>
                ))
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-gray-500">
                    <Activity className="w-8 h-8 mb-4 opacity-20" />
                    <p className="text-sm">No recent system events logged.</p>
                </div>
            )}
          </div>
        </div>
    </div>
  );
};