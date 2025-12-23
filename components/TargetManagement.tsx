import React, { useState, useMemo, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Target, Prober, Label, TargetGroup } from '../types';
import { 
  Plus, X, Search, Trash2, Monitor, Tag, Globe, Type,
  ArrowUpDown, ArrowUp, ArrowDown, Copy, Play, Pause, AlertTriangle, Layers,
  Folder, FolderPlus, FolderOpen, ArrowLeft, MoreHorizontal, CheckSquare,
  LayoutGrid, LayoutList, Edit, ShieldAlert, Download, Upload, AlignJustify, AlignLeft
} from 'lucide-react';
import { CustomSelect } from './CustomSelect';
import { uuid } from '../utils/uuid';

interface Props {
  targets: Target[];
  targetGroups: TargetGroup[];
  probers: Prober[];
  onAdd: (t: Target) => void;
  onBatchAdd?: (t: Target[]) => void;
  onUpdate: (t: Target) => void;
  onDelete: (id: string) => void;
  onBatchUpdate?: (targets: Target[]) => void;
  onBatchDelete?: (ids: string[]) => void;
  onAddGroup: (g: TargetGroup) => void;
  onUpdateGroup: (g: TargetGroup) => void;
  onDeleteGroup: (id: string) => void;
  userRole: 'admin' | 'editor' | 'viewer';
}

// Extracted GroupCard to prevent re-mounting and fix event delegation issues
const GroupCard: React.FC<{
  group: TargetGroup | 'ungrouped';
  count: number;
  viewMode: 'grid' | 'list';
  isReadOnly: boolean;
  onSelect: (id: string) => void;
  onEdit: (g: TargetGroup) => void;
  onDelete: (g: TargetGroup) => void;
}> = ({ group, count, viewMode, isReadOnly, onSelect, onEdit, onDelete }) => {
  const isUngrouped = group === 'ungrouped';
  const id = isUngrouped ? 'ungrouped' : group.id;
  const name = isUngrouped ? 'Ungrouped Targets' : group.name;
  const desc = isUngrouped ? 'Targets not assigned to any folder' : group.description;
  const color = isUngrouped ? '#52525b' : group.color || '#3b82f6';

  if (viewMode === 'list') {
     return (
         <div 
            onClick={() => onSelect(id)} 
            className="flex items-center gap-4 p-4 bg-[#18181b] border border-white/5 hover:border-white/10 rounded-xl cursor-pointer transition-colors group select-none relative"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') onSelect(id); }}
         >
             <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/5 text-gray-400 group-hover:text-white group-hover:bg-blue-600/20 transition-colors shrink-0">
                 {isUngrouped ? <Layers className="w-5 h-5" /> : <Folder className="w-5 h-5" />}
             </div>
             <div className="flex-1 min-w-0">
                 <div className="flex items-center gap-2">
                     <h3 className="text-sm font-bold text-white truncate">{name}</h3>
                     {!isUngrouped && <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }}></span>}
                 </div>
                 <p className="text-xs text-gray-500 truncate">{desc || 'No description'}</p>
             </div>
             
             <div className="flex items-center gap-3 shrink-0">
                <div className="px-4 py-1.5 bg-black/20 rounded-lg text-xs font-mono text-gray-400 border border-white/5 whitespace-nowrap">
                    {count} targets
                </div>
                {!isUngrouped && !isReadOnly && (
                    <div className="flex items-center gap-1 max-w-0 overflow-hidden opacity-0 group-hover:max-w-[80px] group-hover:opacity-100 transition-all duration-300 ease-out">
                        <button onClick={(e) => { e.stopPropagation(); onEdit(group as TargetGroup); }} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-blue-400 shrink-0">
                            <Edit className="w-4 h-4" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); onDelete(group as TargetGroup); }} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-red-400 shrink-0">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                )}
                <div className="text-gray-600 group-hover:text-white transition-colors shrink-0"><ArrowLeft className="w-4 h-4 rotate-180" /></div>
             </div>
         </div>
     );
  }

  return (
    <div 
        onClick={() => onSelect(id)}
        className="group/card relative bg-[#18181b] border border-white/5 hover:border-white/10 p-6 rounded-xl cursor-pointer transition-all hover:translate-y-[-2px] hover:shadow-xl select-none"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => { if(e.key === 'Enter' || e.key === ' ') onSelect(id); }}
    >
         <div className="absolute top-0 left-0 w-1 h-full rounded-l-xl" style={{ backgroundColor: color }}></div>
         <div className="flex justify-between items-start mb-4">
             <div className="p-3 rounded-lg bg-white/5 text-gray-300 group-hover/card:text-white transition-colors">
                 {isUngrouped ? <Layers className="w-6 h-6" /> : <Folder className="w-6 h-6" />}
             </div>
             {!isUngrouped && !isReadOnly && (
                 <div className="flex gap-1 opacity-0 group-hover/card:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); onEdit(group as TargetGroup); }} className="text-gray-600 hover:text-blue-400 p-1 rounded hover:bg-white/5">
                         <Edit className="w-4 h-4" />
                     </button>
                     <button onClick={(e) => { e.stopPropagation(); onDelete(group as TargetGroup); }} className="text-gray-600 hover:text-red-400 p-1 rounded hover:bg-white/5">
                         <Trash2 className="w-4 h-4" />
                     </button>
                 </div>
             )}
         </div>
         <h3 className="text-lg font-bold text-white mb-1">{name}</h3>
         <p className="text-sm text-gray-500 line-clamp-2 h-10">{desc || 'No description'}</p>
         <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center">
             <span className="text-xs font-mono text-gray-400">{count} targets</span>
             <div className="w-6 h-6 rounded-full bg-white/5 flex items-center justify-center text-gray-500 group-hover/card:bg-blue-600 group-hover/card:text-white transition-colors">
                 <ArrowLeft className="w-3 h-3 rotate-180" />
             </div>
         </div>
    </div>
  );
};

const DensityToggle: React.FC<{
  viewDensity: 'comfortable' | 'compact';
  onSetViewDensity: (density: 'comfortable' | 'compact') => void;
}> = ({ viewDensity, onSetViewDensity }) => (
    <div className="flex bg-[#18181b] p-1 rounded-lg border border-white/10 mr-2">
      <button
          onClick={() => onSetViewDensity('comfortable')}
          className={`p-1.5 rounded transition-all ${viewDensity === 'comfortable' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
          title="Comfortable View"
      >
          <AlignJustify className="w-4 h-4" />
      </button>
      <button
          onClick={() => onSetViewDensity('compact')}
          className={`p-1.5 rounded transition-all ${viewDensity === 'compact' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
          title="Compact View"
      >
          <AlignLeft className="w-4 h-4" />
      </button>
    </div>
);

export const TargetManagement: React.FC<Props> = ({ 
  targets, targetGroups, probers, 
  onAdd, onBatchAdd, onUpdate, onDelete, 
  onBatchUpdate, onBatchDelete,
  onAddGroup, onUpdateGroup, onDeleteGroup,
  userRole 
}) => {
  const [activeTab, setActiveTab] = useState<'all' | 'folders'>('all');
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [folderViewMode, setFolderViewMode] = useState<'grid' | 'list'>('list');
  const [viewDensity, setViewDensity] = useState<'comfortable' | 'compact'>('compact');

  const [isAdding, setIsAdding] = useState(false);
  const [viewingTarget, setViewingTarget] = useState<Target | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirmationId, setDeleteConfirmationId] = useState<string | null>(null);
  const [bulkDeleteConfirmText, setBulkDeleteConfirmText] = useState('');

  // Import / Export State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importContent, setImportContent] = useState('');
  const [isBulkDeleteModalOpen, setIsBulkDeleteModalOpen] = useState(false);

  // Bulk Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

    // Prevent text selection when doing Shift+click range selection
    const disableTextSelection = () => {
        try { document.body.style.userSelect = 'none'; } catch (e) {}
    };
    const enableTextSelection = () => {
        try { document.body.style.userSelect = ''; } catch (e) {}
    };

    useEffect(() => {
        const onMouseUp = () => enableTextSelection();
        window.addEventListener('mouseup', onMouseUp);
        return () => window.removeEventListener('mouseup', onMouseUp);
    }, []);
  const [isBulkMoveOpen, setIsBulkMoveOpen] = useState(false);
  const [bulkMoveGroupId, setBulkMoveGroupId] = useState('none');
    const [isBulkAssignOpen, setIsBulkAssignOpen] = useState(false);
    const [bulkAssignProberIds, setBulkAssignProberIds] = useState<string[]>([]);

  // Group Management
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<TargetGroup | null>(null);
  const [groupName, setGroupName] = useState('');
  const [groupDesc, setGroupDesc] = useState('');
  const [groupColor, setGroupColor] = useState('#3b82f6');
  
  // Folder Deletion State
  const [folderToDelete, setFolderToDelete] = useState<TargetGroup | null>(null);
  const [folderDeleteConfirmText, setFolderDeleteConfirmText] = useState('');

  // Refs for click outside detection
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const bulkBarRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sorting & Filtering
  const [sortConfig, setSortConfig] = useState<{ key: keyof Target; direction: 'asc' | 'desc' } | null>({ key: 'name', direction: 'asc' });
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [groupBy, setGroupBy] = useState<string>('none');
  const [localSearch, setLocalSearch] = useState('');
  const [folderSearch, setFolderSearch] = useState('');
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);
  
  // Form State
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [module, setModule] = useState('http_2xx');
  const [selectedProbers, setSelectedProbers] = useState<string[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('none');
  const [labelKeyInput, setLabelKeyInput] = useState('');
  const [labelValueInput, setLabelValueInput] = useState('');

  const isReadOnly = userRole === 'viewer';

  // --- Click Outside to Clear Selection ---
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectedIds.size === 0) return;
      const target = event.target as Node;

      // Do NOT clear selection if click is inside the main table, the bulk actions bar,
      // the custom select dropdown portal, or any modal.
      if (
        (tableContainerRef.current && tableContainerRef.current.contains(target)) ||
        (bulkBarRef.current && bulkBarRef.current.contains(target)) ||
        (target as HTMLElement).closest('[data-custom-select-portal]') ||
        (target as HTMLElement).closest('#modal-root')
      ) {
        return;
      }

      // If the click is anywhere else, clear the selection.
      setSelectedIds(new Set());
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [selectedIds]);

  // --- Grouping Options (Dynamic) ---
  const dynamicGroupOptions = useMemo(() => {
     const options = [
         { value: 'none', label: 'No Grouping' },
         { value: 'status', label: 'Group by State' },
         { value: 'prober', label: 'Group by Prober' },
     ];
     const labelCounts = new Map<string, number>();
     targets.forEach(t => t.labels.forEach(l => labelCounts.set(l.key, (labelCounts.get(l.key) || 0) + 1)));
     const topLabels = Array.from(labelCounts.entries()).sort((a,b) => b[1] - a[1]).slice(0, 3)
        .map(([key]) => ({ value: `label:${key}`, label: `Label: ${key}` }));
     return [...options, ...topLabels];
  }, [targets]);

  const getGroupValue = (t: Target, groupKey: string) => {
      if (groupKey === 'status') return t.enabled === false ? 'Disabled' : 'Enabled';
      if (groupKey === 'prober') return t.proberIds.length === 0 ? 'No Probers Assigned' : t.proberIds.map(id => probers.find(p => p.id === id)?.name || 'Unknown').sort().join(' + ');
      if (groupKey.startsWith('label:')) {
          const key = groupKey.split(':')[1];
          const label = t.labels.find(l => l.key === key);
          return label ? `${key}=${label.value}` : `No ${key}`;
      }
      return 'Other';
  };

  const filteredGroups = useMemo(() => {
      if (!folderSearch) return targetGroups;
      return targetGroups.filter(g => g.name.toLowerCase().includes(folderSearch.toLowerCase()));
  }, [targetGroups, folderSearch]);

  // --- Filtering Logic ---
  const filteredTargets = useMemo(() => {
    let result = targets;
    
    // Filter by Folder/Group if in Folder view and drilled down
    if (activeTab === 'folders' && activeFolderId) {
        if (activeFolderId === 'ungrouped') {
            result = result.filter(t => !t.groupId);
        } else {
            result = result.filter(t => t.groupId === activeFolderId);
        }
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'disabled') result = result.filter(t => t.enabled === false);
      else if (statusFilter === 'enabled') result = result.filter(t => t.enabled !== false);
    }
    
    if (localSearch) {
      const q = localSearch.toLowerCase();
      result = result.filter(t => 
        t.name.toLowerCase().includes(q) || 
        t.url.toLowerCase().includes(q) ||
        t.module.toLowerCase().includes(q) ||
        t.labels.some(l => `${l.key}=${l.value}`.toLowerCase().includes(q) || l.key.includes(q) || l.value.includes(q))
      );
    }
    return result;
  }, [targets, statusFilter, localSearch, activeTab, activeFolderId]);

  // --- Ctrl + A Selection ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        // Only if we are viewing a list of targets (activeTab === 'all' or drilled down folder)
        if (activeTab === 'all' || activeFolderId) {
             if (selectedIds.size === filteredTargets.length && filteredTargets.length > 0) {
                 setSelectedIds(new Set());
             } else {
                 setSelectedIds(new Set(filteredTargets.map(t => t.id)));
             }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, activeFolderId, filteredTargets, selectedIds]);

  const sortedTargets = useMemo(() => {
    let sortableItems = [...filteredTargets];
    // Apply dynamic grouping sort if applicable (only in All Targets view generally)
    if (activeTab === 'all' && groupBy !== 'none') {
        sortableItems.sort((a, b) => {
            const groupA = getGroupValue(a, groupBy);
            const groupB = getGroupValue(b, groupBy);
            if (groupA !== groupB) return groupA.localeCompare(groupB);
            return 0; // fallback to secondary sort below
        });
    }

    if (sortConfig) {
      sortableItems.sort((a, b) => {
        if (activeTab === 'all' && groupBy !== 'none') {
             const groupA = getGroupValue(a, groupBy);
             const groupB = getGroupValue(b, groupBy);
             if (groupA !== groupB) return groupA.localeCompare(groupB);
        }

        const aValue = String(a[sortConfig.key] || '').toLowerCase();
        const bValue = String(b[sortConfig.key] || '').toLowerCase();
        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }
    return sortableItems;
  }, [filteredTargets, sortConfig, groupBy, activeTab, probers]);

  const paginatedTargets = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedTargets.slice(start, start + itemsPerPage);
  }, [sortedTargets, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredTargets.length / itemsPerPage);

  useEffect(() => { setCurrentPage(1); setSelectedIds(new Set()); }, [statusFilter, localSearch, itemsPerPage, groupBy, activeTab, activeFolderId]);

  // --- Bulk Selection Handlers ---
  const toggleSelectAll = () => {
      if (selectedIds.size === filteredTargets.length && filteredTargets.length > 0) {
          setSelectedIds(new Set());
      } else {
          setSelectedIds(new Set(filteredTargets.map(t => t.id)));
      }
  };

  const toggleSelectOne = (id: string) => {
      const newSet = new Set(selectedIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      setSelectedIds(newSet);
  };

  const selectRange = (fromIndex: number, toIndex: number) => {
      const start = Math.min(fromIndex, toIndex);
      const end = Math.max(fromIndex, toIndex);
      const ids = paginatedTargets.slice(start, end + 1).map(t => t.id);
      const newSet = new Set(selectedIds);
      ids.forEach(id => newSet.add(id));
      setSelectedIds(newSet);
  };

  const handleRowClick = (e: React.MouseEvent, id: string, index: number) => {
      if (e.shiftKey && lastSelectedIndex !== null) {
          e.stopPropagation();
          selectRange(lastSelectedIndex, index);
      } else if (e.ctrlKey || e.metaKey) {
          e.stopPropagation();
          toggleSelectOne(id);
      } else {
          // regular click -> open detail
          const t = targets.find(x => x.id === id);
          if (t) setViewingTarget(t);
      }
      setLastSelectedIndex(index);
  };

  const handleRowMouseDown = (e: React.MouseEvent) => {
      if (e.shiftKey) {
          e.preventDefault();
          disableTextSelection();
      }
  };

  const handleCheckboxClick = (e: React.MouseEvent, id: string, index: number) => {
      // checkbox click: support shift+click selection
      if (e.shiftKey && lastSelectedIndex !== null) {
          e.stopPropagation();
          selectRange(lastSelectedIndex, index);
      } else {
          // toggle single
          e.stopPropagation();
          toggleSelectOne(id);
      }
      setLastSelectedIndex(index);
  };

  const handleBulkDelete = (e?: React.MouseEvent) => {
      e?.stopPropagation(); // Prevent bubbling
      if (!onBatchDelete) return;
      setIsBulkDeleteModalOpen(true);
  };

  const confirmBulkDelete = () => {
    if (!onBatchDelete) return;
    onBatchDelete(Array.from(selectedIds));
    setSelectedIds(new Set());
    setIsBulkDeleteModalOpen(false);
    setBulkDeleteConfirmText('');
  };

  const handleBulkEnableDisable = (enable: boolean) => {
      if (!onBatchUpdate) return;
      const targetsToUpdate = targets
        .filter(t => selectedIds.has(t.id))
        .map(t => ({ ...t, enabled: enable }));
      onBatchUpdate(targetsToUpdate);
      setSelectedIds(new Set());
  };

  const handleBulkMove = () => {
            if (selectedIds.size === 0) return;
            if (bulkMoveGroupId === 'none' && !confirm('Remove from folder?')) return;

            const targetsToUpdate = targets
                .filter(t => selectedIds.has(t.id))
                .map(t => ({ ...t, groupId: bulkMoveGroupId === 'none' ? undefined : bulkMoveGroupId }));

            try {
                if (onBatchUpdate) {
                    onBatchUpdate(targetsToUpdate);
                } else {
                    // Fallback: if parent didn't provide batch handler, update individually
                    targetsToUpdate.forEach(t => onUpdate && onUpdate(t));
                }
                window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: `Moved ${targetsToUpdate.length} targets.`, type: 'success' } }));
            } catch (err) {
                window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: `Failed to move targets: ${err?.message || 'unknown'}`, type: 'error' } }));
            } finally {
                setIsBulkMoveOpen(false);
                setSelectedIds(new Set());
            }
  };

  // --- Import / Export ---
  const handleExport = () => {
      const targetsToExport = selectedIds.size > 0 
        ? targets.filter(t => selectedIds.has(t.id))
        : filteredTargets;
      
      const dataStr = JSON.stringify(targetsToExport, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `targets_export_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleImport = () => {
      try {
          const parsed = JSON.parse(importContent);
          const targetsToImport = Array.isArray(parsed) ? parsed : [parsed];
          
          // Basic validation
          const now = new Date().toISOString();
          const incoming = targetsToImport.filter((t: any) => t && t.name && t.url);
          if (incoming.length === 0) {
              window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: 'No valid targets found in JSON. Each target must include at least a name and url.', type: 'warning' } }));
              return;
          }

          const toCreate: Target[] = [];
          const toUpdate: Target[] = [];

          const isValidLabel = (l: any): l is Label => {
            return l && typeof l.key === 'string' && l.key && typeof l.value === 'string';
          };

          incoming.forEach((t: any) => {
              const importedLabels = Array.isArray(t.labels) ? t.labels.filter(isValidLabel) : undefined;
              const existing = t.id ? targets.find(x => x.id === t.id) : null;

              if (existing) {
                  const updated: Target = {
                      ...existing,
                      name: t.name || existing.name,
                      url: t.url || existing.url,
                      module: t.module !== undefined ? t.module : existing.module,
                      // Overwrite labels only if the key is present in the import, otherwise keep existing
                      labels: importedLabels !== undefined ? importedLabels : (existing.labels || []),
                      // Preserve existing probers and group
                      proberIds: existing.proberIds || [],
                      groupId: existing.groupId,
                      updatedAt: now
                  };
                  toUpdate.push(updated);
              } else {
                  const created: Target = {
                      id: uuid(),
                      name: t.name,
                      url: t.url,
                      module: t.module || 'http_2xx',
                      proberIds: [], // Do not import probers for new targets
                      labels: importedLabels || [],
                      groupId: undefined, // Do not import group for new targets
                      enabled: t.enabled ?? false, // Default to disabled if not specified
                      createdAt: now,
                      updatedAt: now
                  };
                  toCreate.push(created);
              }
          });

          if (toUpdate.length > 0 && onBatchUpdate) onBatchUpdate(toUpdate);
          else if (toUpdate.length > 0) toUpdate.forEach(t => onUpdate(t));

          if (toCreate.length > 0 && onBatchAdd) onBatchAdd(toCreate);
          else if (toCreate.length > 0) toCreate.forEach(t => onAdd(t));
          
          setIsImportModalOpen(false);
          setImportContent('');
      } catch (e) {
          window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: 'Invalid JSON format', type: 'error' } }));
      }
  };

  // --- Action Handlers ---
  const resetForm = () => {
    setName(''); setUrl(''); setModule('http_2xx'); setSelectedProbers([]); setLabels([]);
    setSelectedGroupId('none');
    setIsAdding(false); setEditingId(null); setLabelKeyInput(''); setLabelValueInput('');
  };

    const isValidTargetUrl = (value: string) => {
        if (!value) return false;
        // Try full URL parse first
        try { new URL(value); return true; } catch (e) {}
        // If no scheme, allow domain or ip
        const ipRegex = /^(?:\d{1,3}\.){3}\d{1,3}$/;
        const domainRegex = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/i;
        if (ipRegex.test(value)) return true;
        if (domainRegex.test(value)) return true;
        return false;
    };

    const getTargetType = (value: string) => {
        const ipRegex = /^(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?$/;
        if (ipRegex.test(value)) return 'IP Address';
        if (/^https?:\/\//i.test(value)) return 'Website';
        return 'Domain';
    };

  const startEdit = (t: Target, e: React.MouseEvent) => {
    e.stopPropagation();
    setName(t.name); setUrl(t.url); setModule(t.module); setSelectedProbers(t.proberIds); setLabels(t.labels);
    setSelectedGroupId(t.groupId || 'none');
    setEditingId(t.id); setIsAdding(true);
  };

  const startDuplicate = (t: Target, e: React.MouseEvent) => {
    e.stopPropagation();
    setName(`${t.name} (Copy)`);
    setUrl(t.url);
    setModule(t.module);
    setSelectedProbers(t.proberIds);
    setLabels(t.labels);
    setSelectedGroupId(t.groupId || 'none');
    setEditingId(null); 
    setIsAdding(true);
  };

  const saveTarget = () => {
        if (!name || !url) return;
        if (!isValidTargetUrl(url)) {
            window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: 'Invalid target URL or host. Enter a valid IP, domain, or http(s) URL.', type: 'warning' } }));
            return;
        }
        if (selectedProbers.length === 0) { window.dispatchEvent(new CustomEvent('app-toast', { detail: { message: 'Please assign at least one prober.', type: 'warning' } })); return; }
        const newTarget: Target = {
            id: editingId || uuid(),
      name, url, module, proberIds: selectedProbers, labels, enabled: true,
      groupId: selectedGroupId === 'none' ? undefined : selectedGroupId
    };
    if (editingId) onUpdate({ ...newTarget, enabled: targets.find(t => t.id === editingId)?.enabled ?? true }); 
    else onAdd(newTarget);
    resetForm();
  };

            const handleBulkAssign = () => {
                if (!onBatchUpdate) return;
                // If no probers selected, confirm removal of all probers from targets
                if (!bulkAssignProberIds || bulkAssignProberIds.length === 0) {
                if (!confirm(`Remove all probers from ${selectedIds.size} targets? This will unassign every prober.`)) return;
                }

                const selectedSet = new Set(bulkAssignProberIds || []);
                const targetsToUpdate = targets
                .filter(t => selectedIds.has(t.id))
                .map(t => {
                    // New prober list = selected probers only (unchecked are removed)
                    const next = Array.from(new Set([...(bulkAssignProberIds || [])]));
                    return { ...t, proberIds: next };
                });
                onBatchUpdate(targetsToUpdate);
                setIsBulkAssignOpen(false);
                setSelectedIds(new Set());
                setBulkAssignProberIds([]);
            };

  const openGroupModal = (group?: TargetGroup) => {
      if (group) {
          setEditingGroup(group);
          setGroupName(group.name);
          setGroupDesc(group.description || '');
          setGroupColor(group.color || '#3b82f6');
      } else {
          setEditingGroup(null);
          setGroupName('');
          setGroupDesc('');
          setGroupColor('#3b82f6');
      }
      setIsGroupModalOpen(true);
  };

  const saveGroup = () => {
    if (!groupName) return;
    
    if (editingGroup) {
        onUpdateGroup({
            ...editingGroup,
            name: groupName,
            description: groupDesc,
            color: groupColor
        });
    } else {
        onAddGroup({
            id: uuid(),
            name: groupName,
            description: groupDesc,
            color: groupColor
        });
    }

    setGroupName(''); setGroupDesc(''); setGroupColor('#3b82f6');
    setEditingGroup(null);
    setIsGroupModalOpen(false);
  };

  const initiateFolderDelete = (group: TargetGroup) => {
      setFolderToDelete(group);
      setFolderDeleteConfirmText('');
  };

  const executeFolderDelete = (mode: 'keep' | 'cascade') => {
      if (!folderToDelete) return;

      if (mode === 'cascade' && onBatchDelete) {
          const targetsInGroup = targets.filter(t => t.groupId === folderToDelete.id).map(t => t.id);
          if (targetsInGroup.length > 0) {
              onBatchDelete(targetsInGroup);
          }
      }
      onDeleteGroup(folderToDelete.id);
      
      setFolderToDelete(null);
      setFolderDeleteConfirmText('');
  };

  const addLabel = () => {
    if (!labelKeyInput || !labelValueInput) return;
    if (labels.some(l => l.key === labelKeyInput)) return; 
    setLabels([...labels, { key: labelKeyInput, value: labelValueInput }]);
    setLabelKeyInput(''); setLabelValueInput('');
  };

  return (
    <div className="space-y-6 relative h-full flex flex-col animate-fade-in">
      
      {/* Header & Tabs */}
      <div className="flex flex-col gap-6 border-b border-white/10 pb-4">
          <div className="flex justify-between items-end">
             <div>
                <h2 className="text-2xl font-bold text-white mb-1">Targets</h2>
                <p className="text-gray-400 text-sm">Probe endpoints configuration</p>
             </div>
             <div className="flex gap-3">
                 <button onClick={handleExport} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg border border-white/10 transition-colors" title="Export Targets">
                     <Download className="w-4 h-4" />
                 </button>
                 {!isReadOnly && (
                    <>
                        <button onClick={() => setIsImportModalOpen(true)} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg border border-white/10 transition-colors" title="Import Targets">
                            <Upload className="w-4 h-4" />
                        </button>
                        <button onClick={() => setIsAdding(true)} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-900/20">
                            <Plus className="w-4 h-4" /> New Target
                        </button>
                    </>
                 )}
             </div>
          </div>
          
          <div className="flex items-center gap-6">
              <button 
                onClick={() => { setActiveTab('all'); setActiveFolderId(null); setSelectedIds(new Set()); }}
                className={`pb-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'all' ? 'text-white border-blue-500' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
              >
                  All Targets
              </button>
              <button 
                onClick={() => { setActiveTab('folders'); setActiveFolderId(null); setSelectedIds(new Set()); }}
                className={`pb-2 text-sm font-medium transition-colors border-b-2 ${activeTab === 'folders' ? 'text-white border-blue-500' : 'text-gray-500 border-transparent hover:text-gray-300'}`}
              >
                  Folders
              </button>
          </div>
      </div>

      {/* --- FOLDER VIEW --- */}
      {activeTab === 'folders' && !activeFolderId && (
          <div className="animate-fade-in">
              <div className="flex justify-between items-center mb-6">
                  <div className="relative w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input 
                            type="text" 
                            placeholder="Search folders..." 
                            value={folderSearch} 
                            onChange={e => setFolderSearch(e.target.value)}
                            className="w-full bg-[#18181b] border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-200 focus:border-blue-500"
                        />
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex bg-[#18181b] p-1 rounded-lg border border-white/10">
                        <button title="Grid View" onClick={() => setFolderViewMode('grid')} className={`p-1.5 rounded transition-all ${folderViewMode === 'grid' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>
                            <LayoutGrid className="w-4 h-4" />
                        </button>
                        <button title="List View" onClick={() => setFolderViewMode('list')} className={`p-1.5 rounded transition-all ${folderViewMode === 'list' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}>
                            <LayoutList className="w-4 h-4" />
                        </button>
                    </div>
                    {!isReadOnly && (
                        <button onClick={() => openGroupModal()} className="flex items-center gap-2 text-sm text-gray-400 hover:text-white border border-white/10 hover:border-white/20 bg-[#18181b] px-3 py-2 rounded-lg transition-colors">
                            <FolderPlus className="w-4 h-4" /> New Folder
                        </button>
                    )}
                  </div>
              </div>
              
              <div className={folderViewMode === 'grid' ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6" : "flex flex-col gap-3"}>
                   {filteredGroups.map(g => (
                       <GroupCard 
                          key={g.id} 
                          group={g} 
                          count={targets.filter(t => t.groupId === g.id).length} 
                          viewMode={folderViewMode}
                          isReadOnly={isReadOnly}
                          onSelect={setActiveFolderId}
                          onEdit={openGroupModal}
                          onDelete={initiateFolderDelete}
                       />
                   ))}
                   <GroupCard 
                      group="ungrouped" 
                      count={targets.filter(t => !t.groupId).length} 
                      viewMode={folderViewMode}
                      isReadOnly={isReadOnly}
                      onSelect={setActiveFolderId}
                      onEdit={() => {}}
                      onDelete={() => {}}
                   />
              </div>
          </div>
      )}

      {/* --- TABLE VIEW (All Targets OR Folder Drilldown) --- */}
      {(activeTab === 'all' || activeFolderId) && (
          <div className="flex flex-col h-full animate-fade-in relative">
              {/* Folder Drilldown Header */}
              {activeFolderId && (
                  <div className="flex items-center gap-4 mb-4">
                      <button onClick={() => { setActiveFolderId(null); setSelectedIds(new Set()); }} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors">
                          <ArrowLeft className="w-5 h-5" />
                      </button>
                      <div>
                          <h3 className="text-xl font-bold text-white flex items-center gap-2">
                              {activeFolderId === 'ungrouped' ? 'Ungrouped Targets' : targetGroups.find(g => g.id === activeFolderId)?.name}
                              {activeFolderId !== 'ungrouped' && <span className="w-3 h-3 rounded-full" style={{ backgroundColor: targetGroups.find(g => g.id === activeFolderId)?.color }}></span>}
                          </h3>
                      </div>
                  </div>
              )}

              {/* Toolbar */}
              <div className="flex flex-wrap items-center gap-4 mb-2 z-10">
                <div className="flex-1 relative min-w-[280px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                    <input 
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search by name, url, module, or label..."
                    value={localSearch}
                    onChange={(e) => { setLocalSearch(e.target.value); setCurrentPage(1); }}
                    className="w-full bg-[#18181b] border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-sm text-gray-200 focus:border-blue-500 transition-colors"
                    />
                </div>
                <DensityToggle viewDensity={viewDensity} onSetViewDensity={setViewDensity} />
                <div className="w-40">
                    <CustomSelect 
                        options={[
                            { value: 'all', label: 'All States' },
                            { value: 'enabled', label: 'Enabled' },
                            { value: 'disabled', label: 'Disabled' },
                        ]}
                        value={statusFilter}
                        onChange={(v) => setStatusFilter(v as any)}
                    />
                </div>
                {activeTab === 'all' && (
                    <div className="w-48">
                        <CustomSelect 
                            options={dynamicGroupOptions}
                            value={groupBy}
                            onChange={setGroupBy}
                            placeholder="Group By..."
                        />
                    </div>
                )}
              </div>

              {/* Table */}
              <div ref={tableContainerRef} className="glass-panel rounded-xl overflow-hidden flex flex-col flex-1 mt-4 min-h-0">
                <div className="overflow-auto flex-1 custom-scrollbar">
                <table className="w-full text-left border-collapse">
                    <thead className="sticky top-0 z-10 bg-[#18181b] border-b border-white/10">
                    <tr>
                        <th className="px-6 py-4 w-10">
                           <input 
                             type="checkbox" 
                             checked={selectedIds.size > 0 && selectedIds.size === filteredTargets.length}
                             onChange={toggleSelectAll}
                             className="appearance-none w-4 h-4 border border-gray-600 rounded checked:bg-blue-500 checked:border-blue-500 transition-colors cursor-pointer"
                           />
                        </th>
                        <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-white/5 transition-colors group select-none" onClick={() => { setSortConfig({ key: 'name', direction: sortConfig?.direction === 'asc' ? 'desc' : 'asc' }); }}>Name / Endpoint</th>
                        <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">State</th>
                        <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Folder</th>
                        <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Probers</th>
                        <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Module</th>
                        <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Labels</th>
                        <th className="px-6 py-4 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">Action</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                    {paginatedTargets.map((t, index) => {
                        const prevT = paginatedTargets[index - 1];
                        const currentGroup = (activeTab === 'all' && groupBy !== 'none') ? getGroupValue(t, groupBy) : null;
                        const prevGroup = (activeTab === 'all' && groupBy !== 'none' && prevT) ? getGroupValue(prevT, groupBy) : null;
                        const showHeader = (activeTab === 'all' && groupBy !== 'none') && (index === 0 || currentGroup !== prevGroup);
                        const isSelected = selectedIds.has(t.id);
                        const rowPadding = viewDensity === 'compact' ? 'py-2' : 'py-4';

                        const groupName = targetGroups.find(g => g.id === t.groupId)?.name || 'Ungrouped';

                        return (
                        <React.Fragment key={t.id}>
                        {showHeader && (
                            <tr>
                                <td colSpan={7} className="bg-white/5 px-6 py-2.5 text-xs font-bold text-blue-400 uppercase tracking-wider border-y border-white/5 flex items-center gap-2">
                                <Layers className="w-3.5 h-3.5" /> 
                                {currentGroup}
                                <span className="ml-auto text-gray-500 text-[10px] bg-black/20 px-2 py-0.5 rounded">GROUP</span>
                                </td>
                            </tr>
                        )}
                        <tr 
                                        onMouseDown={handleRowMouseDown}
                                        onClick={(e) => handleRowClick(e, t.id, index)}
                            className={`group hover:bg-white/5 transition-colors cursor-pointer ${t.enabled === false ? 'opacity-60' : ''} ${isSelected ? 'bg-blue-500/5 hover:bg-blue-500/10' : ''}`}
                        >
                            <td className={`px-6 w-10 ${rowPadding}`}>
                                <input 
                                    type="checkbox" 
                                    checked={isSelected}
                                    onChange={() => toggleSelectOne(t.id)}
                                    onMouseDown={(e) => { if (e.shiftKey) { e.preventDefault(); disableTextSelection(); } }}
                                    onClick={(e) => handleCheckboxClick(e as any, t.id, index)}
                                    className="appearance-none w-4 h-4 border border-gray-600 rounded checked:bg-blue-500 checked:border-blue-500 transition-colors cursor-pointer"
                                />
                            </td>
                            <td className={`px-6 ${rowPadding}`}>
                            <div className="flex flex-col">
                                <span className="font-bold text-gray-200 text-sm flex items-center gap-2">
                                    {t.name}
                                </span>
                                <span className="text-xs text-gray-500 font-mono truncate max-w-[240px] mt-0.5">{t.url}</span>
                            </div>
                            </td>
                            <td className={`px-6 ${rowPadding}`}>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                                    t.enabled === false ? 'bg-zinc-800 text-zinc-500 border-zinc-700' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                                }`}>
                                    {t.enabled === false ? 'Disabled' : 'Enabled'}
                                </span>
                            </td>
                            <td className={`px-6 ${rowPadding}`}>
                                <span className="text-sm text-gray-300 flex items-center gap-2">
                                    <Folder className="w-3.5 h-3.5 text-gray-500" />
                                    {groupName}
                                </span>
                            </td>
                            <td className={`px-6 ${rowPadding}`}>
                            <div className="flex -space-x-1">
                                {t.proberIds.map((pid) => {
                                const prob = probers.find(p => p.id === pid);
                                return <div key={pid} className="w-6 h-6 rounded bg-[#18181b] border border-white/10 flex items-center justify-center text-[10px] font-bold text-gray-400 ring-2 ring-[#050507]" title={prob?.name}>{prob?.name.charAt(0)}</div>;
                                })}
                            </div>
                            </td>
                            <td className={`px-6 ${rowPadding}`}>
                                <span className="px-2 py-0.5 bg-[#111] border border-white/10 rounded text-[10px] text-gray-400 font-mono">{t.module}</span>
                            </td>
                            <td className={`px-6 ${rowPadding}`}>
                            <div className="flex flex-wrap gap-1">
                                {t.labels.slice(0, 2).map(l => <span key={l.key} className="px-2 py-0.5 bg-[#111] border border-white/10 rounded text-[10px] text-gray-400 font-mono">{l.key}={l.value}</span>)}
                                {t.labels.length > 2 && <span className="text-[10px] text-gray-600 px-1">+{t.labels.length - 2}</span>}
                            </div>
                            </td>
                            <td className={`px-6 ${rowPadding} text-right`}>
                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                {!isReadOnly ? (
                                    <>
                                        <button onClick={(e) => { e.stopPropagation(); onUpdate({ ...t, enabled: !t.enabled }); }} className="p-2 rounded hover:bg-white/10 text-gray-400">{t.enabled === false ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}</button>
                                        <button onClick={(e) => startDuplicate(t, e)} className="p-2 rounded hover:bg-white/10 text-gray-400"><Copy className="w-3.5 h-3.5" /></button>
                                        <div className="w-px h-3 bg-white/10 mx-1"></div>
                                        <button onClick={(e) => startEdit(t, e)} className="text-gray-400 hover:text-blue-400 text-xs font-medium px-2 py-1 hover:bg-white/5 rounded">Edit</button>
                                        <button onClick={() => setDeleteConfirmationId(t.id)} className="text-gray-400 hover:text-red-400 text-xs font-medium px-2 py-1 hover:bg-white/5 rounded">Delete</button>
                                    </>
                                ) : (
                                    <button onClick={() => setViewingTarget(t)} className="text-gray-400 hover:text-blue-400 text-xs font-medium px-2 py-1 hover:bg-white/5 rounded">Info</button>
                                )}
                                </div>
                            </td>
                        </tr>
                        </React.Fragment>
                        );
                    })}
                    {paginatedTargets.length === 0 && (
                        <tr><td colSpan={7} className="p-12 text-center text-gray-500 text-sm">No matching targets found</td></tr>
                    )}
                    </tbody>
                </table>
                </div>

                {/* Pagination Footer */}
                <div className="px-6 py-4 border-t border-white/10 bg-[#18181b] flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-4">
                        <div className="text-xs text-gray-500">
                            Showing <span className="text-white font-mono">{paginatedTargets.length > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0}</span> to <span className="text-white font-mono">{Math.min(currentPage * itemsPerPage, filteredTargets.length)}</span> of <span className="text-white font-mono">{filteredTargets.length}</span>
                        </div>
                        <div className="h-4 w-px bg-white/10"></div>
                        <select 
                            value={itemsPerPage}
                            onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                            className="bg-[#0f0f11] border border-white/10 rounded text-xs text-gray-300 py-1 px-2 focus:border-blue-500 outline-none"
                        >
                            <option value={10}>10 per page</option>
                            <option value={25}>25 per page</option>
                            <option value={50}>50 per page</option>
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

              {/* Bulk Actions Floating Bar */}
              {selectedIds.size >= 1 && !isReadOnly && (
                  <div ref={bulkBarRef} className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-40 bg-[#18181b] border border-white/10 rounded-full px-6 py-3 shadow-2xl flex items-center gap-6 animate-slide-up">
                      <div className="flex items-center gap-2 pr-4 border-r border-white/10">
                          <CheckSquare className="w-4 h-4 text-blue-500" />
                          <span className="text-sm font-bold text-white">{selectedIds.size} Selected</span>
                      </div>
                      <div className="flex items-center gap-2">
                          <button onClick={() => setIsBulkAssignOpen(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white text-xs font-bold transition-colors">
                              Assign Prober
                          </button>
                          <button onClick={() => setIsBulkMoveOpen(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white text-xs font-bold transition-colors">
                              <Folder className="w-3.5 h-3.5" /> Move
                          </button>
                          <button onClick={() => handleBulkEnableDisable(true)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-emerald-500/10 text-gray-300 hover:text-emerald-400 text-xs font-bold transition-colors">
                              <Play className="w-3.5 h-3.5" /> Enable
                          </button>
                          <button onClick={() => handleBulkEnableDisable(false)} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-yellow-500/10 text-gray-300 hover:text-yellow-400 text-xs font-bold transition-colors">
                              <Pause className="w-3.5 h-3.5" /> Disable
                          </button>
                          <div className="w-px h-4 bg-white/10 mx-2"></div>
                          <button onClick={handleBulkDelete} className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-red-500/10 text-red-400 hover:text-red-300 text-xs font-bold transition-colors">
                              <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                      </div>
                  </div>
              )}
          </div>
      )}

      {/* Bulk Move Modal */}
      {isBulkMoveOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" id="modal-root">
              <div className="bg-[#18181b] w-full max-w-sm rounded-xl border border-white/10 shadow-2xl p-6 animate-slide-up">
                  <h3 className="text-lg font-bold text-white mb-4">Move {selectedIds.size} items to...</h3>
                  <div className="mb-6">
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Select Folder</label>
                    <CustomSelect 
                        options={[{ value: 'none', label: 'No Folder (Ungrouped)' }, ...targetGroups.map(g => ({ value: g.id, label: g.name }))]}
                        value={bulkMoveGroupId}
                        onChange={setBulkMoveGroupId}
                    />
                  </div>
                  <div className="flex justify-end gap-3">
                      <button onClick={() => setIsBulkMoveOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm font-medium">Cancel</button>
                      <button onClick={handleBulkMove} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold">Move Targets</button>
                  </div>
              </div>
          </div>
      )}

      {/* Bulk Assign Modal */}
      {isBulkAssignOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" id="modal-root">
              <div className="bg-[#18181b] w-full max-w-sm rounded-xl border border-white/10 shadow-2xl p-6 animate-slide-up">
                  <h3 className="text-lg font-bold text-white mb-4">Assign Prober to {selectedIds.size} targets</h3>
                  <div className="mb-6">
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Select Probers (multiple)</label>
                    <div className="grid grid-cols-1 gap-2 max-h-48 overflow-y-auto p-2 bg-[#0f0f11] border border-white/10 rounded">
                        {probers.map(p => (
                            <label key={p.id} className="flex items-center gap-3 text-sm text-gray-200 px-2 py-1 rounded hover:bg-white/5 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={bulkAssignProberIds.includes(p.id)}
                                    onChange={(e) => {
                                        if (e.target.checked) setBulkAssignProberIds(prev => [...prev, p.id]);
                                        else setBulkAssignProberIds(prev => prev.filter(id => id !== p.id));
                                    }}
                                />
                                <span>{p.name}</span>
                            </label>
                        ))}
                        {probers.length === 0 && <div className="text-gray-500 text-sm p-2">No probers available</div>}
                    </div>
                  </div>
                  <div className="flex justify-end gap-3">
                      <button onClick={() => setIsBulkAssignOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm font-medium">Cancel</button>
                      <button onClick={handleBulkAssign} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold">Assign</button>
                  </div>
              </div>
          </div>
      )}

      {/* Import Modal */}
      {isImportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" id="modal-root">
              <div className="bg-[#18181b] w-full max-w-2xl rounded-xl border border-white/10 shadow-2xl p-6 animate-slide-up flex flex-col max-h-[90vh]">
                  <div className="flex justify-between items-center mb-6">
                      <div>
                        <h3 className="text-lg font-bold text-white">Import Targets</h3>
                        <p className="text-sm text-gray-400">Paste JSON content containing an array of target objects.</p>
                      </div>
                      <button onClick={() => setIsImportModalOpen(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5"/></button>
                  </div>
                  <textarea 
                    value={importContent}
                    onChange={(e) => setImportContent(e.target.value)}
                    className="flex-1 w-full bg-[#0f0f11] border border-white/10 rounded-lg p-4 text-xs font-mono text-gray-300 focus:border-blue-500 min-h-[300px] resize-none"
                    placeholder={`[\n  {\n    "name": "Example Target",\n    "url": "https://example.com",\n    "module": "http_2xx"\n  }\n]`}
                  />
                  <div className="flex justify-end gap-3 mt-6">
                      <button onClick={() => setIsImportModalOpen(false)} className="px-4 py-2 text-gray-400 hover:text-white text-sm font-medium">Cancel</button>
                      <button onClick={handleImport} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg shadow-blue-900/20">Import Targets</button>
                  </div>
              </div>
          </div>
      )}

      {/* --- Add/Edit Modal (Updated with Group Selection) --- */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" id="modal-root">
          <div className="bg-[#0f0f11] w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 shadow-2xl relative animate-slide-up">
             <div className="sticky top-0 z-20 flex justify-between items-center px-6 py-5 border-b border-white/10 bg-[#18181b]">
                <h3 className="text-lg font-bold text-white">{editingId ? "Edit Target" : "New Target"}</h3>
                <button onClick={resetForm} className="text-gray-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
             </div>
             <div className="p-8 space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Name</label>
                    <input value={name} onChange={e => setName(e.target.value)} className="w-full bg-[#18181b] border border-white/10 rounded-lg px-4 py-2.5 text-gray-200 text-sm focus:border-blue-600" placeholder="e.g. Production API" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Target Folder (Group)</label>
                    <CustomSelect 
                        options={[{ value: 'none', label: 'No Folder' }, ...targetGroups.map(g => ({ value: g.id, label: g.name }))]}
                        value={selectedGroupId}
                        onChange={setSelectedGroupId}
                    />
                  </div>
                </div>
                
                {/* ... (Rest of Form: URL, Probers, Modules, Labels) ... */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Target URL</label>
                        <div className="flex gap-2">
                            <input value={url} onChange={e => setUrl(e.target.value)} className="flex-1 bg-[#18181b] border border-white/10 rounded-lg px-4 py-2.5 text-gray-200 font-mono text-sm focus:border-blue-600" placeholder="https://example.com" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Assigned Probers</label>
                        <div className="grid grid-cols-3 gap-2 p-2.5 bg-[#18181b] border border-white/10 rounded-lg max-h-32 overflow-y-auto">
                            {probers.map(p => (
                            <label key={p.id} className={`flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer border transition-all ${selectedProbers.includes(p.id) ? 'bg-blue-600/10 border-blue-500/50 text-blue-100' : 'bg-transparent border-white/10 text-gray-400 hover:border-white/20'}`}>
                                <input type="checkbox" checked={selectedProbers.includes(p.id)} onChange={(e) => { if (e.target.checked) setSelectedProbers([...selectedProbers, p.id]); else setSelectedProbers(selectedProbers.filter(id => id !== p.id)); }} className="appearance-none w-3.5 h-3.5 border border-gray-600 rounded checked:bg-blue-500 checked:border-blue-500" />
                                <span className="text-xs font-medium">{p.name}</span>
                            </label>
                            ))}
                        </div>
                    </div>
                </div>
                
                <div>
                    <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Module</label>
                    <div className="flex flex-wrap gap-2 p-2 bg-[#18181b] border border-white/10 rounded-lg min-h-[42px]">
                         {selectedProbers.length === 0 ? <span className="text-gray-500 text-sm px-2">Select a prober first...</span> : 
                           Array.from(new Set(probers.filter(p => selectedProbers.includes(p.id)).flatMap(p => p.modules))).map(m => (
                               <button 
                                key={m} 
                                onClick={() => setModule(m)}
                                className={`px-3 py-1 rounded text-xs font-mono border transition-colors ${module === m ? 'bg-blue-600 text-white border-blue-500' : 'bg-[#111] text-gray-400 border-white/10 hover:border-white/20'}`}
                               >
                                   {m}
                               </button>
                           ))
                         }
                    </div>
                </div>

                <div className="border-t border-white/10 pt-6">
                  <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Labels</label>
                  <div className="flex gap-3 mb-4">
                      <input value={labelKeyInput} onChange={e => setLabelKeyInput(e.target.value)} className="flex-1 bg-[#18181b] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-200 focus:border-blue-600" placeholder="Key" />
                      <input value={labelValueInput} onChange={e => setLabelValueInput(e.target.value)} className="flex-1 bg-[#18181b] border border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-200 focus:border-blue-600" placeholder="Value" />
                      <button onClick={addLabel} className="bg-white/10 hover:bg-white/20 border border-white/10 text-white px-4 rounded-lg"><Plus className="w-5 h-5" /></button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                      {labels.map(l => (
                          <span key={l.key} className="inline-flex items-center gap-1.5 bg-[#111] border border-white/10 text-gray-300 px-3 py-1.5 rounded-full text-xs font-mono">
                          {l.key}={l.value} <button onClick={() => setLabels(labels.filter(lb => lb.key !== l.key))} className="hover:text-white"><X className="w-3 h-3" /></button>
                          </span>
                      ))}
                  </div>
                </div>
             </div>
             <div className="sticky bottom-0 z-20 px-6 py-5 border-t border-white/10 bg-[#18181b] flex justify-end gap-3">
                  <button onClick={resetForm} className="px-4 py-2 text-gray-400 hover:text-white text-sm font-medium">Cancel</button>
                  <button onClick={saveTarget} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg text-sm font-bold shadow-lg shadow-blue-900/20">{editingId ? 'Save Changes' : 'Create Target'}</button>
             </div>
          </div>
        </div>
      )}

      {/* --- Details Modal (Reused) --- */}
      {viewingTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" id="modal-root" onClick={() => setViewingTarget(null)}>
           <div className="bg-[#0f0f11] w-full max-w-2xl rounded-2xl border border-white/10 shadow-2xl relative animate-slide-up overflow-hidden" onClick={e => e.stopPropagation()}>
               <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 px-8 py-6 border-b border-white/10">
                   <div className="flex justify-between items-start">
                       <div>
                           <div className="flex items-center gap-3 mb-2">
                               <h3 className="text-2xl font-bold text-white">{viewingTarget.name}</h3>
                               {viewingTarget.enabled === false && <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border bg-zinc-800 text-zinc-500 border-zinc-700">Disabled</span>}
                           </div>
                              <div className="flex items-center gap-3">
                                  <span className="text-sm text-gray-400 font-mono">{getTargetType(viewingTarget.url)} · {viewingTarget.url}</span>
                              </div>
                       </div>
                       <button onClick={() => setViewingTarget(null)} className="text-gray-500 hover:text-white"><X className="w-6 h-6"/></button>
                   </div>
               </div>
               <div className="p-8 space-y-6">
                   <div className="grid grid-cols-2 gap-6">
                       <div><p className="text-xs font-bold text-gray-500 uppercase">Folder</p><p className="text-white mt-1">{targetGroups.find(g => g.id === viewingTarget.groupId)?.name || 'None'}</p></div>
                       <div><p className="text-xs font-bold text-gray-500 uppercase">Module</p><p className="text-white font-mono mt-1">{viewingTarget.module}</p></div>
                   </div>
                  <div className="grid grid-cols-2 gap-6">
                      <div>
                          <p className="text-xs font-bold text-gray-500 uppercase">Type</p>
                          <p className="text-white mt-1">{getTargetType(viewingTarget.url)}</p>
                      </div>
                      <div>
                          <p className="text-xs font-bold text-gray-500 uppercase">Created / Modified</p>
                          <p className="text-white mt-1 text-sm font-mono">{viewingTarget.createdAt ? new Date(viewingTarget.createdAt).toLocaleString() : 'N/A'}{viewingTarget.updatedAt ? ` • ${new Date(viewingTarget.updatedAt).toLocaleString()}` : ''}</p>
                      </div>
                  </div>
                   <div className="grid grid-cols-2 gap-6">
                        <div>
                             <p className="text-xs font-bold text-gray-500 uppercase mb-2">Probers</p>
                             <div className="flex flex-wrap gap-2">
                                 {viewingTarget.proberIds.map(pid => {
                                     const p = probers.find(prob => prob.id === pid);
                                     return <span key={pid} className="px-2 py-1 bg-zinc-800 rounded text-xs text-zinc-300 border border-zinc-700">{p?.name || pid}</span>
                                 })}
                             </div>
                        </div>
                        <div>
                             <p className="text-xs font-bold text-gray-500 uppercase mb-2">Labels</p>
                             <div className="flex flex-wrap gap-2">
                                 {viewingTarget.labels.map(l => (
                                     <span key={l.key} className="px-2 py-1 bg-[#111] rounded text-xs text-zinc-400 font-mono border border-white/10">{l.key}={l.value}</span>
                                 ))}
                             </div>
                        </div>
                   </div>
               </div>
           </div>
        </div>
      )}
      
      {/* Delete Confirmation Modal (Reused) */}
      {deleteConfirmationId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" id="modal-root">
          <div className="bg-[#18181b] w-full max-w-sm p-6 rounded-xl border border-white/10 shadow-2xl">
             <div className="mb-4 text-red-500 bg-red-500/10 p-3 rounded-full w-fit"><Trash2 className="w-6 h-6" /></div>
             <h3 className="text-lg font-bold text-white mb-2">Delete Target</h3>
             <p className="text-gray-400 text-sm mb-6">Are you sure? This action is irreversible.</p>
             <div className="flex gap-3 justify-end">
                <button onClick={() => setDeleteConfirmationId(null)} className="px-4 py-2 rounded-lg text-gray-300 hover:bg-white/5 text-sm font-medium">Cancel</button>
                <button onClick={() => { if(deleteConfirmationId) onDelete(deleteConfirmationId); setDeleteConfirmationId(null); }} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold">Confirm</button>
             </div>
          </div>
        </div>
      )}

      {/* New/Edit Folder Modal - PORTALLED for robustness */}
      {isGroupModalOpen && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" id="modal-root">
           <div className="bg-[#18181b] w-full max-w-sm p-6 rounded-xl border border-white/10 shadow-2xl animate-slide-up">
                <h3 className="text-lg font-bold text-white mb-4">{editingGroup ? 'Edit Folder' : 'Create Folder'}</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Folder Name</label>
                        <input value={groupName} onChange={e => setGroupName(e.target.value)} className="w-full bg-[#0f0f11] border border-white/10 rounded-lg px-4 py-2 text-white text-sm" placeholder="e.g. Production" autoFocus />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Description</label>
                        <input value={groupDesc} onChange={e => setGroupDesc(e.target.value)} className="w-full bg-[#0f0f11] border border-white/10 rounded-lg px-4 py-2 text-white text-sm" placeholder="Optional" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Color Tag</label>
                        <div className="flex gap-2">
                            {['#3b82f6', '#10b981', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899'].map(c => (
                                <button key={c} onClick={() => setGroupColor(c)} className={`w-6 h-6 rounded-full border-2 ${groupColor === c ? 'border-white' : 'border-transparent'}`} style={{ backgroundColor: c }} />
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex justify-end gap-3 mt-6">
                    <button onClick={() => { setIsGroupModalOpen(false); setEditingGroup(null); }} className="px-4 py-2 text-gray-400 hover:text-white text-sm">Cancel</button>
                    <button onClick={saveGroup} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-bold">{editingGroup ? 'Save Changes' : 'Create'}</button>
                </div>
           </div>
        </div>,
        document.body
      )}

      {/* --- Folder Deletion Modal - PORTALLED for robustness --- */}
      {folderToDelete && createPortal(
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" id="modal-root">
              <div className="bg-[#18181b] w-full max-w-md p-6 rounded-xl border border-white/10 shadow-2xl animate-slide-up">
                  <div className="flex items-center gap-3 mb-4 text-red-500">
                      <div className="p-2 bg-red-500/10 rounded-lg"><ShieldAlert className="w-6 h-6" /></div>
                      <h3 className="text-xl font-bold text-white">Delete Folder?</h3>
                  </div>
                  <p className="text-gray-400 text-sm mb-4 leading-relaxed">
                      You are about to delete <span className="font-bold text-white">"{folderToDelete.name}"</span>. 
                      This folder contains <span className="text-white font-mono">{targets.filter(t => t.groupId === folderToDelete.id).length} targets</span>.
                  </p>
                  
                  <div className="mb-6">
                      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                          Type <span className="text-red-400 select-none">delete</span> to confirm
                      </label>
                      <input 
                          value={folderDeleteConfirmText}
                          onChange={(e) => setFolderDeleteConfirmText(e.target.value)}
                          className="w-full bg-[#0f0f11] border border-white/10 rounded-lg px-4 py-2 text-white text-sm placeholder-gray-700"
                          placeholder="delete"
                      />
                  </div>

                  <div className="flex flex-col gap-3">
                      <button 
                        onClick={() => executeFolderDelete('keep')}
                        disabled={folderDeleteConfirmText !== 'delete'}
                        className="w-full py-2.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors"
                      >
                          Delete Folder Only <span className="text-zinc-500 text-xs font-normal">(Keep targets ungrouped)</span>
                      </button>
                      <button 
                        onClick={() => executeFolderDelete('cascade')}
                        disabled={folderDeleteConfirmText !== 'delete'}
                        className="w-full py-2.5 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors shadow-lg shadow-red-900/20"
                      >
                          Delete Folder & Targets
                      </button>
                      <button 
                          onClick={() => { setFolderToDelete(null); setFolderDeleteConfirmText(''); }}
                          className="mt-2 text-xs text-gray-500 hover:text-white"
                      >
                          Cancel Operation
                      </button>
                  </div>
              </div>
          </div>,
          document.body
      )}

      {/* Bulk Delete Confirmation Modal */}
      {isBulkDeleteModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" id="modal-root">
          <div className="bg-[#18181b] w-full max-w-sm p-6 rounded-xl border border-white/10 shadow-2xl">
             <div className="mb-4 text-red-500 bg-red-500/10 p-3 rounded-full w-fit"><Trash2 className="w-6 h-6" /></div>
             <h3 className="text-lg font-bold text-white mb-2">Delete {selectedIds.size} Target(s)</h3>
             <p className="text-gray-400 text-sm mb-4">This action is irreversible. To confirm, please type <strong className="text-red-400 select-none">delete</strong> below.</p>
             <div className="mb-6">
                <input
                  type="text"
                  value={bulkDeleteConfirmText}
                  onChange={(e) => setBulkDeleteConfirmText(e.target.value)}
                  className="w-full bg-[#0f0f11] border border-white/10 rounded-lg px-4 py-2 text-white text-sm placeholder-gray-700"
                  placeholder="delete"
                  autoFocus
                />
             </div>
             <div className="flex gap-3 justify-end">
                <button onClick={() => setIsBulkDeleteModalOpen(false)} className="px-4 py-2 rounded-lg text-gray-300 hover:bg-white/5 text-sm font-medium">Cancel</button>
                <button onClick={confirmBulkDelete} disabled={bulkDeleteConfirmText !== 'delete'} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed">Delete Targets</button>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};