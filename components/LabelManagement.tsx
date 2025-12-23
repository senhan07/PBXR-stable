import React, { useState, useMemo } from 'react';
import { Target } from '../types';
import { Tag, Tags, Edit, Trash2, X, Save, AlertTriangle, Layers, Type, ArrowRight, Search, Lock } from 'lucide-react';

interface Props {
  targets: Target[];
  onBatchUpdate: (updatedTargets: Target[]) => void;
  userRole: 'admin' | 'editor' | 'viewer';
}

export const LabelManagement: React.FC<Props> = ({ targets, onBatchUpdate, userRole }) => {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [newKeyName, setNewKeyName] = useState('');
  
  // Value Editing
  const [editingValue, setEditingValue] = useState<{key: string, oldVal: string} | null>(null);
  const [newValueName, setNewValueName] = useState('');
  const [deleteConfirmation, setDeleteConfirmation] = useState<{type: 'key' | 'value', data: any} | null>(null);

  const [search, setSearch] = useState('');

  const isReadOnly = userRole === 'viewer';

  // Stats Calculation
  const stats = useMemo(() => {
    const data: Record<string, { count: number; values: Record<string, number> }> = {};
    
    targets.forEach(t => {
      t.labels.forEach(l => {
        if (!data[l.key]) {
          data[l.key] = { count: 0, values: {} };
        }
        data[l.key].count++;
        data[l.key].values[l.value] = (data[l.key].values[l.value] || 0) + 1;
      });
    });

    return Object.entries(data)
      .map(([key, stat]) => ({
        key,
        count: stat.count,
        values: Object.entries(stat.values).map(([v, c]) => ({ value: v, count: c }))
      }))
      .sort((a, b) => b.count - a.count);
  }, [targets]);

  const filteredStats = useMemo(() => {
    if (!search) return stats;
    return stats.filter(s => s.key.toLowerCase().includes(search.toLowerCase()));
  }, [stats, search]);

  const selectedKeyData = useMemo(() => {
    return stats.find(s => s.key === selectedKey);
  }, [stats, selectedKey]);

  // Actions
  const handleRenameKey = () => {
    if (isReadOnly || !editingKey || !newKeyName || editingKey === newKeyName) return;
    
    const updated = targets.map(t => ({
      ...t,
      labels: t.labels.map(l => l.key === editingKey ? { ...l, key: newKeyName } : l)
    }));
    
    onBatchUpdate(updated);
    setEditingKey(null);
    setNewKeyName('');
    if (selectedKey === editingKey) setSelectedKey(newKeyName);
  };

  const handleDeleteKey = (key: string) => {
    if (isReadOnly) return;
    const targetsAffected = targets.filter(t => t.labels.some(l => l.key === key)).length;
    setDeleteConfirmation({ type: 'key', data: { key, targetsAffected } });
  };

  const handleRenameValue = () => {
    if (isReadOnly || !editingValue || !newValueName || editingValue.oldVal === newValueName) return;

    const updated = targets.map(t => ({
      ...t,
      labels: t.labels.map(l => (l.key === editingValue.key && l.value === editingValue.oldVal) ? { ...l, value: newValueName } : l)
    }));

    onBatchUpdate(updated);
    setEditingValue(null);
    setNewValueName('');
  };

  const handleDeleteValue = (key: string, value: string) => {
    if (isReadOnly) return;
    setDeleteConfirmation({ type: 'value', data: { key, value } });
  };

  const confirmDeletion = () => {
    if (!deleteConfirmation) return;

    let updated: Target[];

    if (deleteConfirmation.type === 'key') {
        const { key } = deleteConfirmation.data;
        updated = targets.map(t => ({
            ...t,
            labels: t.labels.filter(l => l.key !== key)
        }));
        if (selectedKey === key) setSelectedKey(null);
    } else {
        const { key, value } = deleteConfirmation.data;
        updated = targets.map(t => ({
            ...t,
            labels: t.labels.filter(l => !(l.key === key && l.value === value))
        }));
    }

    onBatchUpdate(updated);
    setDeleteConfirmation(null);
  };

  return (
    <div className="space-y-6 animate-fade-in h-full flex flex-col">
      <div className="flex justify-between items-end border-b border-white/10 pb-4">
          <div>
            <h2 className="text-2xl font-bold text-white mb-1">Label Management</h2>
            <p className="text-gray-400 text-sm">Batch rename and organize labels across all targets</p>
          </div>
          {isReadOnly && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/5">
                <Lock className="w-3.5 h-3.5 text-gray-400" />
                <span className="text-xs font-medium text-gray-400">Read Only Mode</span>
            </div>
          )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 flex-1 min-h-0">
        
        {/* Left Column: Label Keys */}
        <div className="bg-[#18181b] border border-white/10 rounded-xl overflow-hidden flex flex-col">
          <div className="p-4 border-b border-white/10 bg-[#18181b]">
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input 
                    type="text" 
                    placeholder="Search keys..." 
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    className="w-full bg-[#0f0f11] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-200 focus:border-blue-600"
                />
            </div>
          </div>
          <div className="overflow-y-auto flex-1 p-2 space-y-1">
            {filteredStats.map(stat => (
                <div 
                    key={stat.key}
                    onClick={() => setSelectedKey(stat.key)}
                    className={`flex items-center justify-between px-3 py-3 rounded-lg cursor-pointer transition-colors group ${selectedKey === stat.key ? 'bg-blue-600/10 border border-blue-500/30' : 'hover:bg-white/5 border border-transparent'}`}
                >
                    <div className="flex items-center gap-3">
                        <Tag className={`w-4 h-4 ${selectedKey === stat.key ? 'text-blue-400' : 'text-gray-500'}`} />
                        <div>
                            <p className={`text-sm font-medium ${selectedKey === stat.key ? 'text-blue-100' : 'text-gray-300'}`}>{stat.key}</p>
                            <p className="text-[10px] text-gray-500">{stat.values.length} unique values</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                         <span className="text-xs font-mono text-gray-500 bg-[#0f0f11] px-1.5 py-0.5 rounded border border-white/5">{stat.count}</span>
                    </div>
                </div>
            ))}
            {filteredStats.length === 0 && (
                <div className="p-8 text-center text-gray-500 text-xs">No labels found.</div>
            )}
          </div>
        </div>

        {/* Right Column: Key Details & Values */}
        <div className="md:col-span-2 bg-[#0f0f11] border border-white/10 rounded-xl overflow-hidden flex flex-col">
            {selectedKey && selectedKeyData ? (
                <>
                    <div className="p-6 border-b border-white/10 bg-[#18181b] flex justify-between items-start">
                        <div>
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Selected Label Key</p>
                            <h3 className="text-2xl font-bold text-white font-mono">{selectedKey}</h3>
                            <p className="text-sm text-gray-400 mt-1">Used in {selectedKeyData.count} targets with {selectedKeyData.values.length} unique values.</p>
                        </div>
                        {!isReadOnly && (
                            <div className="flex gap-2">
                                <button 
                                    onClick={() => { setEditingKey(selectedKey); setNewKeyName(selectedKey); }}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 border border-blue-500/20 rounded-lg text-xs font-bold transition-colors"
                                >
                                    <Edit className="w-3.5 h-3.5" /> Rename Key
                                </button>
                                <button 
                                    onClick={() => handleDeleteKey(selectedKey)}
                                    className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-xs font-bold transition-colors"
                                >
                                    <Trash2 className="w-3.5 h-3.5" /> Delete Key
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-6">
                        <h4 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                            <Layers className="w-4 h-4 text-purple-400" /> Values Distribution
                        </h4>
                        <div className="space-y-2">
                            {selectedKeyData.values.map(val => (
                                <div key={val.value} className="bg-[#18181b] border border-white/5 rounded-lg p-3 flex items-center justify-between group hover:border-white/10 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="px-2 py-1 bg-[#0f0f11] border border-white/10 rounded text-xs font-mono text-gray-300">
                                            {val.value}
                                        </div>
                                        <ArrowRight className="w-3 h-3 text-gray-600" />
                                        <div className="text-xs text-gray-500">
                                            {val.count} occurrence{val.count !== 1 ? 's' : ''}
                                        </div>
                                    </div>
                                    {!isReadOnly && (
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => { setEditingValue({ key: selectedKey, oldVal: val.value }); setNewValueName(val.value); }}
                                                className="p-1.5 text-gray-500 hover:text-blue-400 hover:bg-white/5 rounded transition-colors"
                                                title="Rename Value"
                                            >
                                                <Edit className="w-3.5 h-3.5" />
                                            </button>
                                            <button 
                                                onClick={() => handleDeleteValue(selectedKey, val.value)}
                                                className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-white/5 rounded transition-colors"
                                                title="Delete Value from Targets"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-500 p-8">
                    <Tags className="w-12 h-12 mb-4 opacity-20" />
                    <p className="text-sm">Select a label key to manage its values and distribution.</p>
                </div>
            )}
        </div>
      </div>

      {/* Rename Key Modal */}
      {!isReadOnly && editingKey && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="bg-[#18181b] w-full max-w-md rounded-xl border border-white/10 shadow-2xl p-6 animate-slide-up">
                  <h3 className="text-lg font-bold text-white mb-4">Rename Label Key</h3>
                  <div className="bg-yellow-500/10 border border-yellow-500/20 p-3 rounded-lg flex gap-3 mb-6">
                      <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />
                      <p className="text-xs text-yellow-200/80 leading-relaxed">
                          This will rename <strong>{editingKey}</strong> to your new input across all targets.
                          This action cannot be easily undone.
                      </p>
                  </div>
                  <div className="mb-6">
                      <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">New Key Name</label>
                      <input 
                        type="text" 
                        value={newKeyName} 
                        onChange={e => setNewKeyName(e.target.value)} 
                        className="w-full bg-[#0f0f11] border border-white/10 rounded-lg px-4 py-2 text-white focus:border-blue-500"
                        autoFocus
                      />
                  </div>
                  <div className="flex justify-end gap-3">
                      <button onClick={() => setEditingKey(null)} className="px-4 py-2 text-gray-400 hover:text-white text-sm font-medium">Cancel</button>
                      <button onClick={handleRenameKey} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold">Confirm Rename</button>
                  </div>
              </div>
          </div>
      )}

      {/* Rename Value Modal */}
      {!isReadOnly && editingValue && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="bg-[#18181b] w-full max-w-md rounded-xl border border-white/10 shadow-2xl p-6 animate-slide-up">
                  <h3 className="text-lg font-bold text-white mb-4">Rename Label Value</h3>
                  <p className="text-sm text-gray-400 mb-6">
                      Changing value for key <span className="text-blue-400 font-mono">{editingValue.key}</span> from <span className="text-white font-mono bg-[#0f0f11] px-1.5 py-0.5 rounded">{editingValue.oldVal}</span> to:
                  </p>
                  <div className="mb-6">
                      <input 
                        type="text" 
                        value={newValueName} 
                        onChange={e => setNewValueName(e.target.value)} 
                        className="w-full bg-[#0f0f11] border border-white/10 rounded-lg px-4 py-2 text-white focus:border-blue-500"
                        autoFocus
                      />
                  </div>
                  <div className="flex justify-end gap-3">
                      <button onClick={() => setEditingValue(null)} className="px-4 py-2 text-gray-400 hover:text-white text-sm font-medium">Cancel</button>
                      <button onClick={handleRenameValue} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold">Update Values</button>
                  </div>
              </div>
          </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmation && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="bg-[#18181b] w-full max-w-md rounded-xl border border-white/10 shadow-2xl p-6 animate-slide-up">
                  <h3 className="text-lg font-bold text-white mb-4">Confirm Deletion</h3>
                    <p className="text-sm text-gray-400 mb-6">
                        {deleteConfirmation.type === 'key'
                            ? `Delete the label key "${deleteConfirmation.data.key}" from all ${deleteConfirmation.data.targetsAffected} targets?`
                            : `Remove label "${deleteConfirmation.data.key}=${deleteConfirmation.data.value}" from all matching targets?`
                        }
                    </p>
                  <div className="flex justify-end gap-3">
                      <button onClick={() => setDeleteConfirmation(null)} className="px-4 py-2 text-gray-400 hover:text-white text-sm font-medium">Cancel</button>
                      <button onClick={confirmDeletion} className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-bold">Confirm Delete</button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};