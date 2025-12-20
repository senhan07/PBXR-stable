import React, { useState } from 'react';
import { uuid } from '../utils/uuid';
import { createPortal } from 'react-dom';
import { User, PasswordPolicy } from '../types';
import { Plus, Trash2, Shield, User as UserIcon, X, Search, Key, Monitor, Smartphone, AlertTriangle, LogOut, Laptop, Globe } from 'lucide-react';
import { CustomSelect } from './CustomSelect';

interface Props {
  users: User[];
  onAdd: (u: User) => void;
  onUpdate: (u: User) => void;
  onDelete: (id: string) => void;
  currentUserId?: string;
  passwordPolicy?: PasswordPolicy;
    onLogout?: () => void;
}

export const UserManagement: React.FC<Props> = ({ users, onAdd, onUpdate, onDelete, currentUserId, passwordPolicy, onLogout }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [formData, setFormData] = useState<Partial<User>>({ role: 'viewer' });
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  
  // Password Reset State
  const [resettingUserId, setResettingUserId] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');

  // Delete User State
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const roleOptions = [
    { value: 'admin', label: 'Administrator', description: 'Full system access' },
    { value: 'editor', label: 'Editor', description: 'Can manage targets & probers' },
    { value: 'viewer', label: 'Viewer', description: 'Read-only access' },
  ];

    // Debug info to help trace empty session cases
    console.debug('UserManagement props:', { users, currentUserId });

    const allSessions = (() => {
        // normalize helper
        const normalizeIp = (ip: any) => (typeof ip === 'string' ? ip.replace(/^::ffff:/, '') : ip);
        const normalizeUa = (ua: any) => (typeof ua === 'string' ? ua : '');

        // gather sessions and normalize
        const rawList: any[] = users.flatMap(u => (u.sessions || []).map((s, idx) => ({
            ...s,
            ip: normalizeIp(s.ip),
            userAgent: normalizeUa(s.userAgent),
            userId: u.id,
            username: u.username,
            role: u.role,
            sessionIndex: idx
        })));

        // If the current user is logged in, always consider a synthetic current session
        if (currentUserId) {
            const current = users.find(u => u.id === currentUserId);
            if (current) {
                const syntheticSession = {
                    ip: (typeof window !== 'undefined' && window.location) ? (window.location.hostname || '127.0.0.1') : '127.0.0.1',
                    userAgent: (typeof navigator !== 'undefined' && navigator.userAgent) ? navigator.userAgent : 'browser',
                    lastActive: new Date().toISOString(),
                    userId: current.id,
                    username: current.username,
                    role: current.role,
                    sessionIndex: -1,
                    synthetic: true
                };
                syntheticSession.ip = normalizeIp(syntheticSession.ip);
                syntheticSession.userAgent = normalizeUa(syntheticSession.userAgent);
                rawList.unshift(syntheticSession);
            }
        }

        // Deduplicate: keep latest session by userId + ip + userAgent
        const map = new Map();
        for (const s of rawList) {
            const key = `${s.userId}||${s.ip}||${s.userAgent}`;
            const existing = map.get(key);
            if (!existing) map.set(key, s);
            else {
                // keep the one with later lastActive
                if (new Date(s.lastActive) > new Date(existing.lastActive)) map.set(key, s);
            }
        }

        // return array sorted by lastActive desc
        return Array.from(map.values()).sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime());
    })();

  const validatePassword = (pwd: string): string | null => {
      if (!passwordPolicy) return null;
      if (pwd.length < passwordPolicy.minLength) return `Password must be at least ${passwordPolicy.minLength} characters.`;
      if (passwordPolicy.requireNumber && !/\d/.test(pwd)) return "Password must contain a number.";
      if (passwordPolicy.requireSpecialChar && !/[!@#$%^&*]/.test(pwd)) return "Password must contain a special character.";
      return null;
  };

  const handleSave = () => {
    setError('');
    if (!formData.username || !formData.password) { setError('All fields are required.'); return; }
    if (formData.password !== confirmPassword) { setError('Passwords do not match.'); return; }
    
    const policyError = validatePassword(formData.password);
    if (policyError) { setError(policyError); return; }

        const newUser: User = {
            id: uuid(),
      username: formData.username,
      password: formData.password,
      role: formData.role as any || 'viewer',
      sessions: []
    };
    onAdd(newUser);
    setFormData({ role: 'viewer' });
    setConfirmPassword('');
    setIsAdding(false);
  };

  const handlePasswordReset = () => {
    setError('');
    if (!resettingUserId || !newPassword) return;
    if (newPassword !== confirmResetPassword) { setError('Passwords do not match.'); return; }

    // If changing own password, verify current password
    if (resettingUserId === currentUserId) {
        const currentUser = users.find(u => u.id === currentUserId);
        if (!currentPassword) { setError('Current password is required.'); return; }
        if (currentUser && currentUser.password !== currentPassword) { setError('Incorrect current password.'); return; }
    }

    const policyError = validatePassword(newPassword);
    if (policyError) { setError(policyError); return; }

    const userToUpdate = users.find(u => u.id === resettingUserId);
    if (userToUpdate) {
        onUpdate({ ...userToUpdate, password: newPassword });
    }
    closeResetModal();
  };

  const closeResetModal = () => {
    setResettingUserId(null);
    setNewPassword('');
    setConfirmResetPassword('');
    setCurrentPassword('');
    setError('');
  };

  const initiateDelete = (user: User) => {
    setUserToDelete(user);
    setDeleteConfirmText('');
  };

  const executeDelete = () => {
      if (userToDelete && deleteConfirmText === 'delete') {
          onDelete(userToDelete.id);
          // If the deleted user is the currently logged-in user, force logout immediately
          if (userToDelete.id === currentUserId && typeof onLogout === 'function') onLogout();
          setUserToDelete(null);
          setDeleteConfirmText('');
      }
  };

  const handleRevokeSession = (userId: string, sessionIdx: number) => {
    const user = users.find(u => u.id === userId);
    if(user && user.sessions) {
        // Ask server to revoke this particular session index for the user
        // Prefer revoking by session id when available for reliable targeting
        const target = (user.sessions || [])[sessionIdx];
        const body: any = { actorId: currentUserId };
        if (target && target.id) body.sessionId = target.id;
        else if (target) body.fingerprint = { ip: target.ip, userAgent: target.userAgent, lastActive: target.lastActive };

        fetch(`/api/users/${userId}/sessions/revoke`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }).then(() => {
            // update local view
            const newSessions = [...user.sessions];
            newSessions.splice(sessionIdx, 1);
            onUpdate({...user, sessions: newSessions});
            if (userId === currentUserId && newSessions.length === 0 && typeof onLogout === 'function') onLogout();
        }).catch(e => console.error('Failed to revoke session', e));
    }
  };

  const handleRevokeAll = () => {
    if(!window.confirm("Are you sure you want to terminate all active sessions across all users?")) return;
    // Revoke sessions server-side per-user so the server becomes authoritative immediately.
    users.forEach(u => {
        if (u.sessions?.length) {
            fetch(`/api/users/${u.id}/sessions/revoke`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ actorId: currentUserId })
            }).then(() => {
                onUpdate({...u, sessions: []});
            }).catch(e => console.error('Failed to revoke sessions for user', u.id, e));
        }
    });
    // If the current user was among those, force logout immediately
    if (currentUserId && typeof onLogout === 'function') onLogout();
  };

  return (
    <div className="space-y-10 pb-10 animate-fade-in">
      
      {/* --- User Accounts Section --- */}
      <section>
        <div className="flex justify-between items-end border-b border-white/10 pb-4 mb-6">
            <div>
            <h2 className="text-2xl font-bold text-white mb-1">User Accounts</h2>
            <p className="text-gray-400 text-sm">Manage access and roles</p>
            </div>
            <button 
                onClick={() => { setIsAdding(true); setError(''); }} 
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-900/20"
            >
                <Plus className="w-4 h-4" /> Add User
            </button>
        </div>

        {/* Add User Form */}
        {isAdding && (
            <div className="glass-panel p-6 rounded-xl border-l-4 border-blue-500 animate-slide-up mb-6">
                <div className="flex justify-between items-start mb-4">
                    <h3 className="text-lg font-bold text-white">New User Registration</h3>
                    <button onClick={() => setIsAdding(false)} className="text-gray-500 hover:text-white"><X className="w-5 h-5"/></button>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div>
                        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Username</label>
                        <input type="text" value={formData.username || ''} onChange={e => setFormData({...formData, username: e.target.value})} className="w-full bg-[#18181b] border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-blue-500" placeholder="jdoe" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Password</label>
                        <input type="password" value={formData.password || ''} onChange={e => setFormData({...formData, password: e.target.value})} className="w-full bg-[#18181b] border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-blue-500" placeholder="••••••••" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Confirm Password</label>
                        <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full bg-[#18181b] border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-blue-500" placeholder="••••••••" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Role</label>
                        <CustomSelect 
                            options={roleOptions} 
                            value={formData.role || 'viewer'} 
                            onChange={(v) => setFormData({...formData, role: v as any})} 
                        />
                    </div>
                </div>
                {error && <div className="mt-4 text-red-400 text-sm flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> {error}</div>}
                <div className="mt-6 flex justify-end">
                    <button onClick={handleSave} className="px-6 py-2 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-colors">Create User</button>
                </div>
            </div>
        )}

        {/* Password Reset Modal */}
        {resettingUserId && createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={closeResetModal}>
                <div className="bg-[#0f0f11] w-full max-w-sm rounded-xl border border-white/10 shadow-2xl overflow-hidden animate-slide-up" onClick={e => e.stopPropagation()}>
                    <div className="flex justify-between items-center px-6 py-5 border-b border-white/10 bg-[#18181b]">
                        <h3 className="text-lg font-bold text-white">
                            {resettingUserId === currentUserId ? 'Change Password' : 'Reset Password'}
                        </h3>
                        <button onClick={closeResetModal} className="text-gray-500 hover:text-white transition-colors"><X className="w-5 h-5" /></button>
                    </div>
                    <div className="p-6 space-y-4">
                        <p className="text-sm text-gray-400">
                            {resettingUserId === currentUserId 
                                ? 'Update your account password.' 
                                : <span>Enter a new password for <span className="text-white font-bold">{users.find(u => u.id === resettingUserId)?.username}</span>.</span>
                            }
                        </p>
                        
                        {/* Current Password Field - Only for self */}
                        {resettingUserId === currentUserId && (
                             <div>
                                <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Current Password</label>
                                <input 
                                    type="password" 
                                    value={currentPassword} 
                                    onChange={e => setCurrentPassword(e.target.value)} 
                                    className="w-full bg-[#18181b] border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-blue-500 text-sm" 
                                    placeholder="Enter current password" 
                                    autoFocus
                                />
                            </div>
                        )}

                        <div>
                            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">New Password</label>
                            <input 
                                type="password" 
                                value={newPassword} 
                                onChange={e => setNewPassword(e.target.value)} 
                                className="w-full bg-[#18181b] border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-blue-500 text-sm" 
                                placeholder="New Password" 
                                autoFocus={resettingUserId !== currentUserId}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-1.5">Confirm Password</label>
                            <input 
                                type="password" 
                                value={confirmResetPassword} 
                                onChange={e => setConfirmResetPassword(e.target.value)} 
                                className="w-full bg-[#18181b] border border-white/10 rounded-lg px-4 py-2.5 text-white focus:border-blue-500 text-sm" 
                                placeholder="Confirm New Password" 
                            />
                        </div>
                        {error && <div className="text-red-400 text-xs flex items-center gap-2"><AlertTriangle className="w-3 h-3" /> {error}</div>}
                    </div>
                    <div className="px-6 py-5 border-t border-white/10 bg-[#18181b] flex justify-end gap-3">
                        <button onClick={closeResetModal} className="px-4 py-2 text-gray-400 hover:text-white text-sm font-medium">Cancel</button>
                        <button onClick={handlePasswordReset} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-lg shadow-blue-900/20">Update Password</button>
                    </div>
                </div>
            </div>,
            document.body
        )}

        {/* Delete Confirmation Modal */}
        {userToDelete && createPortal(
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md" onClick={() => setUserToDelete(null)}>
                <div className="bg-[#18181b] w-full max-w-md p-6 rounded-xl border border-white/10 shadow-2xl animate-slide-up" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-3 mb-4 text-red-500">
                        <div className="p-2 bg-red-500/10 rounded-lg"><AlertTriangle className="w-6 h-6" /></div>
                        <h3 className="text-xl font-bold text-white">Delete User?</h3>
                    </div>
                    <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                        You are about to delete the user account <span className="font-bold text-white">"{userToDelete.username}"</span>. 
                        This action cannot be undone and will terminate all active sessions for this user.
                    </p>
                    
                    <div className="mb-6">
                        <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                            Type <span className="text-red-400 select-none font-bold">delete</span> to confirm
                        </label>
                        <input 
                            value={deleteConfirmText}
                            onChange={(e) => setDeleteConfirmText(e.target.value)}
                            className="w-full bg-[#0f0f11] border border-white/10 rounded-lg px-4 py-2.5 text-white text-sm placeholder-gray-700 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none"
                            placeholder="delete"
                            autoFocus
                        />
                    </div>

                    <div className="flex justify-end gap-3">
                        <button 
                            onClick={() => { setUserToDelete(null); setDeleteConfirmText(''); }}
                            className="px-4 py-2 text-gray-400 hover:text-white text-sm font-medium"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={executeDelete}
                            disabled={deleteConfirmText !== 'delete'}
                            className="px-6 py-2 rounded-lg bg-red-600 hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold transition-colors shadow-lg shadow-red-900/20"
                        >
                            Confirm Delete
                        </button>
                    </div>
                </div>
            </div>,
            document.body
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {users.map(user => (
                <div key={user.id} className="glass-panel p-5 rounded-xl hover:border-blue-500/30 transition-all group relative overflow-hidden flex flex-col justify-between gap-4">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg font-bold shrink-0 ${user.role === 'admin' ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30' : 'bg-gray-800 text-gray-400 border border-gray-700'}`}>
                                {user.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h4 className="text-white font-bold">{user.username}</h4>
                                <div className="flex items-center gap-1.5">
                                    <Shield className="w-3 h-3 text-gray-500" />
                                    <span className="text-xs text-gray-400 uppercase tracking-wide">{user.role}</span>
                                </div>
                            </div>
                        </div>
                        {user.id === currentUserId && (
                             <span className="px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 text-[10px] font-bold">YOU</span>
                        )}
                    </div>
                    
                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                         <div className="text-xs text-gray-500 flex items-center gap-1.5">
                             <Monitor className="w-3 h-3" />
                             {user.sessions?.length || 0} active sessions
                         </div>
                         <div className="flex items-center gap-1">
                            <button 
                                onClick={() => { setResettingUserId(user.id); setError(''); }} 
                                className="p-2 rounded-lg hover:bg-white/10 text-gray-600 hover:text-blue-400 transition-colors"
                                title="Change/Reset Password"
                            >
                                <Key className="w-4 h-4" />
                            </button>
                            {user.id !== currentUserId && (
                                <button onClick={() => initiateDelete(user)} className="p-2 rounded-lg hover:bg-red-500/20 text-gray-600 hover:text-red-400 transition-colors" title="Delete User">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            ))}
        </div>
      </section>

      {/* --- Active Sessions Section --- */}
      <section className="bg-[#0f0f11] border border-white/5 rounded-xl overflow-hidden shadow-2xl">
         <div className="px-6 py-5 border-b border-white/5 flex flex-col md:flex-row md:justify-between md:items-center gap-4 bg-white/[0.02]">
             <div>
                <h3 className="text-lg font-bold text-white">Active Sessions</h3>
                <p className="text-sm text-gray-500 mt-1">Monitor and revoke current access tokens</p>
             </div>
             {allSessions.length > 0 && (
                 <button onClick={handleRevokeAll} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-lg text-xs font-bold transition-colors">
                    <LogOut className="w-3.5 h-3.5" /> Terminate All Sessions
                 </button>
             )}
         </div>
         <div className="divide-y divide-white/5">
             {allSessions.length > 0 ? allSessions.map((session, i) => (
                 <div key={`${session.userId}-${i}`} className="p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors group">
                     <div className="flex items-center gap-4">
                         <div className="w-10 h-10 rounded-full bg-black border border-white/10 flex items-center justify-center text-gray-400 shrink-0">
                             {session.userAgent.toLowerCase().includes('mobile') ? <Smartphone className="w-5 h-5"/> : <Laptop className="w-5 h-5"/>}
                         </div>
                         <div className="min-w-0">
                             <div className="flex items-center gap-2 mb-0.5">
                                 <span className="font-bold text-gray-200 text-sm">{session.username}</span>
                                 <span className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 text-[10px] font-mono border border-gray-700">{session.ip}</span>
                                 {session.userId === currentUserId && <span className="text-[10px] text-blue-400 font-bold">CURRENT</span>}
                             </div>
                             <p className="text-xs text-gray-500 truncate max-w-md" title={session.userAgent}>{session.userAgent}</p>
                         </div>
                     </div>
                     <div className="flex items-center gap-6">
                         <div className="text-right hidden sm:block">
                             <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">Last Active</p>
                             <p className="text-xs text-gray-300 font-mono">{new Date(session.lastActive).toLocaleString()}</p>
                         </div>
                         <button 
                            onClick={() => handleRevokeSession(session.userId, session.sessionIndex)}
                            className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title="Revoke Session"
                         >
                             <X className="w-4 h-4" />
                         </button>
                     </div>
                 </div>
             )) : (
                 <div className="p-12 text-center flex flex-col items-center gap-3">
                     <div className="w-12 h-12 rounded-full bg-gray-800/50 flex items-center justify-center text-gray-600"><Globe className="w-6 h-6" /></div>
                     <p className="text-gray-500 text-sm">No active sessions detected.</p>
                 </div>
             )}
         </div>
      </section>
    </div>
  );
};