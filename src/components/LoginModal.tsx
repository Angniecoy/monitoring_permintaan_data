import React, { useState } from 'react';
import { 
  Lock, User, KeyRound, AlertCircle, Eye, EyeOff, Check, 
  UserPlus, Users, Trash2, Edit3, Search, ShieldCheck, 
  Building2, Phone, RotateCcw, ArrowRight, CheckCircle2, X, LogIn
} from 'lucide-react';
import { DepartmentName, UserAccount, UserRole, UserSession } from '../types';
import { ROLE_LABELS, cleanWhatsAppNumber } from '../data/mockData';

interface LoginModalProps {
  isOpen: boolean;
  users: UserAccount[];
  onLoginSuccess: (session: UserSession) => void;
  onRegisterUser: (newUser: Omit<UserAccount, 'id' | 'createdAt'>) => UserAccount;
  onUpdateUser: (updatedUser: UserAccount) => void;
  onDeleteUser: (userId: string) => void;
  onResetUsers?: () => void;
  onClose?: () => void;
  canClose?: boolean;
  initialTab?: 'login' | 'register' | 'manage';
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  users,
  onLoginSuccess,
  onRegisterUser,
  onUpdateUser,
  onDeleteUser,
  onResetUsers,
  onClose,
  canClose = false,
  initialTab = 'login'
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'manage'>(initialTab);

  // Login State
  const [selectedRole, setSelectedRole] = useState<UserRole>('pemberi_tugas');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Registration State
  const [regFullName, setRegFullName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [regRole, setRegRole] = useState<UserRole>('pemberi_tugas');
  const [regDept, setRegDept] = useState<DepartmentName>('Engineering Precast');
  const [regWhatsapp, setRegWhatsapp] = useState('');
  const [regError, setRegError] = useState('');

  // User Management State
  const [searchUserQuery, setSearchUserQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'ALL' | UserRole>('ALL');
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [editError, setEditError] = useState('');
  const [manageNotice, setManageNotice] = useState('');

  if (!isOpen) return null;

  const roleConfigs: {
    id: UserRole;
    title: string;
    shortTitle: string;
    desc: string;
    pass: string;
    badge: string;
    badgeColor: string;
  }[] = [
    {
      id: 'pemberi_tugas',
      title: 'Pemberi Tugas (Sales / Proyek)',
      shortTitle: 'Pemberi Tugas / Sales',
      desc: 'Buat permintaan baru, lampirkan TOR/spek, dan lacak status dokumen',
      pass: 'WBP456',
      badge: 'Sales & Project',
      badgeColor: 'bg-[#282974]/10 text-[#282974] border-[#282974]/25'
    },
    {
      id: 'manager',
      title: 'Manager Engineering (Disposisi)',
      shortTitle: 'Manager Engineering',
      desc: 'Disposisi tugas masuk ke staf teknis dan pantau antrean departemen',
      pass: 'WBPMGR',
      badge: 'Manager',
      badgeColor: 'bg-[#282974]/10 text-[#282974] border-[#282974]/25'
    },
    {
      id: 'staff',
      title: 'Staff Engineering (Eksekutor)',
      shortTitle: 'Staff Engineering',
      desc: 'Kerjakan dokumen (Analisis, SSP, Gambar), upload hasil & submit',
      pass: 'WBP123',
      badge: 'Technical Staff',
      badgeColor: 'bg-[#282974]/10 text-[#282974] border-[#282974]/25'
    },
    {
      id: 'dashboard',
      title: 'Dashboard Workload & Analitik',
      shortTitle: 'Dashboard & Analitik',
      desc: 'Tinjau metrik beban kerja, tren harian/mingguan/bulanan & rekapitulasi',
      pass: 'WBPVIEW',
      badge: 'Executive / All',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    }
  ];

  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setErrorMsg('Silakan masukkan Username Anda.');
      return;
    }

    if (!password) {
      setErrorMsg('Silakan masukkan Password Anda.');
      return;
    }

    // 1. Check registered users in dynamic application state
    const matchingUsers = users.filter(
      u => u.username.toLowerCase() === trimmedUsername.toLowerCase()
    );

    if (matchingUsers.length > 0) {
      // Find user with matching password (prefer matching selectedRole if multiple exist)
      const exactRoleMatch = matchingUsers.find(
        u => u.password === password && u.role === selectedRole
      );
      const anyMatch = matchingUsers.find(u => u.password === password);
      const matchedUser = exactRoleMatch || anyMatch;

      if (matchedUser) {
        onLoginSuccess({
          isLoggedIn: true,
          userId: matchedUser.id,
          username: matchedUser.username,
          role: matchedUser.role,
          roleName: matchedUser.roleName || ROLE_LABELS[matchedUser.role],
          userName: matchedUser.fullName,
          department: matchedUser.department,
          staffName: matchedUser.role === 'staff' ? matchedUser.fullName : undefined,
          whatsapp: matchedUser.whatsapp
        });
        return;
      } else {
        setErrorMsg(`Password tidak sesuai untuk akun username "${trimmedUsername}"!`);
        return;
      }
    }

    // 2. Fallback support for legacy universal 'WBP' username per role
    if (trimmedUsername.toUpperCase() === 'WBP') {
      const currentConfig = roleConfigs.find(r => r.id === selectedRole);
      if (currentConfig && password === currentConfig.pass) {
        onLoginSuccess({
          isLoggedIn: true,
          username: 'WBP',
          role: selectedRole,
          roleName: currentConfig.title,
          userName: `WBP ${currentConfig.badge}`
        });
        return;
      } else {
        setErrorMsg('Password tidak sesuai untuk akses role yang dipilih!');
        return;
      }
    }

    setErrorMsg(`Akun dengan username "${trimmedUsername}" belum terdaftar. Silakan klik "Buat Akun Baru / Register" untuk mendaftar.`);
  };

  const validateAndCreateAccount = (autoLogin: boolean) => {
    setRegError('');

    const cleanName = regFullName.trim();
    const cleanUser = regUsername.trim();

    if (!cleanName) {
      setRegError('Nama Lengkap wajib diisi.');
      return;
    }
    if (!cleanUser) {
      setRegError('Username wajib diisi.');
      return;
    }
    if (/\s/.test(cleanUser)) {
      setRegError('Username tidak boleh mengandung spasi.');
      return;
    }
    if (!regPassword || regPassword.length < 3) {
      setRegError('Password wajib diisi (minimal 3 karakter).');
      return;
    }

    // Check username uniqueness
    const exists = users.some(
      u => u.username.toLowerCase() === cleanUser.toLowerCase()
    );
    if (exists) {
      setRegError(`Username "${cleanUser}" sudah digunakan. Silakan pilih username lain.`);
      return;
    }

    const roleObj = roleConfigs.find(r => r.id === regRole);
    const roleTitle = roleObj ? roleObj.title : ROLE_LABELS[regRole];
    const needsDept = regRole === 'manager' || regRole === 'staff';

    const createdUser = onRegisterUser({
      fullName: cleanName,
      username: cleanUser,
      password: regPassword,
      role: regRole,
      roleName: roleTitle,
      department: needsDept ? regDept : undefined,
      whatsapp: regWhatsapp.trim() ? cleanWhatsAppNumber(regWhatsapp.trim()) : undefined
    });

    // Reset registration form
    setRegFullName('');
    setRegUsername('');
    setRegPassword('');
    setRegWhatsapp('');

    if (autoLogin) {
      onLoginSuccess({
        isLoggedIn: true,
        userId: createdUser.id,
        username: createdUser.username,
        role: createdUser.role,
        roleName: createdUser.roleName,
        userName: createdUser.fullName,
        department: createdUser.department,
        staffName: createdUser.role === 'staff' ? createdUser.fullName : undefined,
        whatsapp: createdUser.whatsapp
      });
    } else {
      // Pre-fill login form so user can immediately sign in
      setSelectedRole(createdUser.role);
      setUsername(createdUser.username);
      setPassword(createdUser.password);
      setErrorMsg('');
      setSuccessMsg(
        `Akun "${createdUser.fullName}" (@${createdUser.username}) berhasil didaftarkan sebagai ${createdUser.roleName}. Silakan masuk!`
      );
      setActiveTab('login');
    }
  };

  const handleSaveEditUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setEditError('');

    const cleanName = editingUser.fullName.trim();
    const cleanUser = editingUser.username.trim();

    if (!cleanName || !cleanUser || !editingUser.password) {
      setEditError('Nama Lengkap, Username, dan Password tidak boleh kosong.');
      return;
    }

    const duplicate = users.some(
      u => u.id !== editingUser.id && u.username.toLowerCase() === cleanUser.toLowerCase()
    );
    if (duplicate) {
      setEditError(`Username "${cleanUser}" sudah dipakai oleh pengguna lain.`);
      return;
    }

    const needsDept = editingUser.role === 'manager' || editingUser.role === 'staff';
    const updated: UserAccount = {
      ...editingUser,
      fullName: cleanName,
      username: cleanUser,
      roleName: ROLE_LABELS[editingUser.role],
      department: needsDept ? (editingUser.department || 'Engineering Precast') : undefined,
      whatsapp: editingUser.whatsapp ? cleanWhatsAppNumber(editingUser.whatsapp) : undefined
    };

    onUpdateUser(updated);
    setEditingUser(null);
    setManageNotice(`Data akun "${updated.fullName}" berhasil diperbarui.`);
    setTimeout(() => setManageNotice(''), 3500);
  };

  const filteredUsers = users.filter(u => {
    const matchesRole = filterRole === 'ALL' || u.role === filterRole;
    const q = searchUserQuery.toLowerCase();
    const matchesQuery =
      u.fullName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.roleName.toLowerCase().includes(q) ||
      (u.department && u.department.toLowerCase().includes(q));
    return matchesRole && matchesQuery;
  });

  const usersForSelectedRole = users.filter(u => u.role === selectedRole);

  return (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget && canClose && onClose) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto"
    >
      <div className="relative w-full max-w-2xl bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden my-auto">
        {/* Brand Header */}
        <div className="px-6 pt-5 pb-4 bg-gradient-to-b from-slate-50 to-white border-b border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-[#282974] text-white font-black text-sm tracking-tighter shadow-sm shadow-[#282974]/25">
                WBP
              </div>
              <div>
                <div className="text-[10px] font-bold tracking-widest text-[#282974] uppercase">
                  PT. Waskita Beton Precast, Tbk
                </div>
                <h2 className="text-[12px] font-bold text-[#282974] tracking-tight">
                  ENGINEERING PORTAL
                </h2>
              </div>
            </div>

            {/* Mode Switcher Tabs */}
            <div className="flex items-center gap-1 p-1 bg-slate-100 border border-slate-200 rounded-xl self-start sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('login');
                  setErrorMsg('');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'login'
                    ? 'bg-[#282974] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Masuk</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('register');
                  setRegError('');
                  setSuccessMsg('');
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'register'
                    ? 'bg-[#282974] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
              >
                <UserPlus className="w-3.5 h-3.5" />
                <span>Buat Akun Baru / Register</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTab('manage');
                  setEditingUser(null);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === 'manage'
                    ? 'bg-[#282974] text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
              >
                <Users className="w-3.5 h-3.5" />
                <span>Daftar User ({users.length})</span>
              </button>
            </div>
          </div>
        </div>

        {/* ==================== TAB 1: MASUK (LOGIN) ==================== */}
        {activeTab === 'login' && (
          <div className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
            {successMsg && (
              <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                <span>{successMsg}</span>
              </div>
            )}

            {errorMsg && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleManualLogin} className="space-y-4">
              {/* Role Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Pilih Peran Akses (Role):
                  </label>
                  <span className="text-[11px] text-slate-500">
                    Otomatis menyesuaikan hak akses akun Anda
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {roleConfigs.map((role) => {
                    const isSelected = selectedRole === role.id;
                    const countInRole = users.filter(u => u.role === role.id).length;
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => {
                          setSelectedRole(role.id);
                          setErrorMsg('');
                        }}
                        className={`flex items-start justify-between p-3 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-[#282974]/8 border-[#282974] text-slate-900 shadow-2xs'
                            : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                      >
                        <div className="pr-2">
                          <div className={`text-xs font-semibold ${isSelected ? 'text-[#282974]' : 'text-slate-800'}`}>
                            {role.shortTitle}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                            {role.desc}
                          </div>
                          <div className="mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white border border-slate-200 text-[10px] font-medium text-slate-600">
                            <Users className="w-2.5 h-2.5 text-[#282974]" />
                            <span>{countInRole} Akun Terdaftar</span>
                          </div>
                        </div>
                        <div className="shrink-0">
                          {isSelected && (
                            <div className="w-5 h-5 rounded-full bg-[#282974] text-white flex items-center justify-center">
                              <Check className="w-3 h-3" />
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Quick Registered Account Picker for Selected Role */}
              {usersForSelectedRole.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-700">
                      Akun Terdaftar ({roleConfigs.find(r => r.id === selectedRole)?.shortTitle}) — Klik untuk isi cepat:
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveTab('manage')}
                      className="text-[11px] font-semibold text-[#282974] hover:text-[#1e1f5a]"
                    >
                      Kelola Semua User →
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {usersForSelectedRole.map(u => {
                      const isCurrentUsername = username.toLowerCase() === u.username.toLowerCase();
                      return (
                        <button
                          key={u.id}
                          type="button"
                          onClick={() => {
                            setUsername(u.username);
                            setPassword(u.password);
                            setErrorMsg('');
                          }}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all flex items-center gap-1.5 ${
                            isCurrentUsername
                              ? 'bg-[#282974] text-white border-[#282974] shadow-2xs'
                              : 'bg-white text-slate-700 border-slate-200 hover:border-[#282974]/50 hover:bg-[#282974]/5'
                          }`}
                        >
                          <User className="w-3 h-3 shrink-0" />
                          <span className="font-semibold">{u.fullName}</span>
                          <span className={`text-[10px] font-mono ${isCurrentUsername ? 'text-white/80' : 'text-slate-400'}`}>
                            (@{u.username})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Username & Password Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Username
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Masukkan username Anda"
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#282974] focus:ring-2 focus:ring-[#282974]/15 transition-colors"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Password
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan password"
                      className="w-full pl-9 pr-9 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#282974] focus:ring-2 focus:ring-[#282974]/15 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 transition-colors p-0.5"
                      title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                    >
                      {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-[#282974] hover:bg-[#1e1f5a] rounded-xl shadow-md shadow-[#282974]/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <Lock className="w-3.5 h-3.5" />
                <span>Masuk Aplikasi</span>
              </button>
            </form>

            {/* Call-to-Action for Registration & User Management */}
            <div className="pt-3 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2">
              <span className="text-xs text-slate-600">
                Pengguna baru atau belum memiliki akun personel?
              </span>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('register');
                    setRegError('');
                    setSuccessMsg('');
                  }}
                  className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-[#282974] bg-[#282974]/8 hover:bg-[#282974]/15 border border-[#282974]/25 transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Buat Akun Baru / Register</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== TAB 2: REGISTRASI AKUN BARU ==================== */}
        {activeTab === 'register' && (
          <div className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
            <div className="p-3.5 rounded-xl bg-[#282974]/8 border border-[#282974]/25 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-[#282974]" />
                  <span>Registrasi Akun Pengguna Baru</span>
                </h3>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Daftarkan Nama Lengkap, Username, Password, dan pilih peran kerja Anda. Akun akan langsung tersimpan di sistem dan siap digunakan.
                </p>
              </div>
            </div>

            {regError && (
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{regError}</span>
              </div>
            )}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                validateAndCreateAccount(false);
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {/* Nama Lengkap */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nama Lengkap <span className="text-rose-600">*</span>
                  </label>
                  <input
                    type="text"
                    value={regFullName}
                    onChange={(e) => setRegFullName(e.target.value)}
                    placeholder="Contoh: Ir. Andi Pratama (Sales Infrastruktur)"
                    className="w-full px-3.5 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#282974] focus:ring-2 focus:ring-[#282974]/15"
                  />
                </div>

                {/* Username */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Username <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={regUsername}
                      onChange={(e) => setRegUsername(e.target.value)}
                      placeholder="Contoh: andi_wbp"
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#282974] focus:ring-2 focus:ring-[#282974]/15"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Password <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type={showRegPassword ? 'text' : 'password'}
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Buat password akun"
                      className="w-full pl-9 pr-9 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#282974] focus:ring-2 focus:ring-[#282974]/15"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPassword(!showRegPassword)}
                      className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-700 p-0.5"
                    >
                      {showRegPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Pilih Peran / Role */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Pilih Peran (Role Akses) <span className="text-rose-600">*</span>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {roleConfigs.map((role) => {
                    const isSelected = regRole === role.id;
                    return (
                      <button
                        key={role.id}
                        type="button"
                        onClick={() => setRegRole(role.id)}
                        className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                          isSelected
                            ? 'bg-[#282974]/8 border-[#282974] text-slate-900 shadow-2xs'
                            : 'bg-slate-50/70 border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div className="pr-2">
                          <div className={`text-xs font-semibold ${isSelected ? 'text-[#282974]' : 'text-slate-800'}`}>
                            {role.title}
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5 line-clamp-1">
                            {role.desc}
                          </div>
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#282974] text-white flex items-center justify-center shrink-0">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Conditional Department & Optional WhatsApp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                {(regRole === 'manager' || regRole === 'staff') && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Departemen Engineering
                    </label>
                    <select
                      value={regDept}
                      onChange={(e) => setRegDept(e.target.value as DepartmentName)}
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-[#282974]"
                    >
                      <option value="Engineering Precast">Engineering Precast</option>
                      <option value="Engineering Readymix">Engineering Readymix</option>
                      <option value="Engineering Konstruksi">Engineering Konstruksi</option>
                    </select>
                  </div>
                )}

                <div className={(regRole === 'manager' || regRole === 'staff') ? '' : 'sm:col-span-2'}>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nomor WhatsApp (Opsional — untuk notifikasi tiket)
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      value={regWhatsapp}
                      onChange={(e) => setRegWhatsapp(e.target.value)}
                      placeholder="Contoh: 081234567890"
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#282974]"
                    />
                  </div>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-2">
                <button
                  type="submit"
                  className="w-full sm:flex-1 py-2.5 px-4 text-xs font-semibold text-white bg-[#282974] hover:bg-[#1e1f5a] rounded-xl shadow-md shadow-[#282974]/20 transition-all flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Simpan & Buat Akun</span>
                </button>

                <button
                  type="button"
                  onClick={() => validateAndCreateAccount(true)}
                  className="w-full sm:flex-1 py-2.5 px-4 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Daftar & Langsung Masuk</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ==================== TAB 3: MANAJEMEN DAFTAR USER ==================== */}
        {activeTab === 'manage' && (
          <div className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
              <div>
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-[#282974]" />
                  <span>Manajemen Daftar User ({users.length} Akun)</span>
                </h3>
                <p className="text-[11px] text-slate-600">
                  Kelola akun pengguna, ubah peran/password, hapus user, atau klik "Gunakan" untuk langsung login.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('register')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-white bg-[#282974] hover:bg-[#1e1f5a] shadow-2xs transition-colors"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ Tambah User</span>
                </button>
                {onResetUsers && (
                  <button
                    type="button"
                    onClick={() => {
                      onResetUsers();
                      setManageNotice('Daftar user dikembalikan ke pengaturan default.');
                      setTimeout(() => setManageNotice(''), 3000);
                    }}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 transition-colors"
                    title="Reset daftar user ke default"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Reset Default</span>
                  </button>
                )}
              </div>
            </div>

            {manageNotice && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{manageNotice}</span>
              </div>
            )}

            {/* Inline Edit User Form */}
            {editingUser && (
              <form
                onSubmit={handleSaveEditUser}
                className="p-4 rounded-xl bg-[#282974]/6 border border-[#282974]/25 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#282974] flex items-center gap-1.5">
                    <Edit3 className="w-3.5 h-3.5 text-[#282974]" />
                    <span>Edit Akun: {editingUser.fullName}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingUser(null);
                      setEditError('');
                    }}
                    className="text-slate-400 hover:text-slate-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {editError && (
                  <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-medium">
                    {editError}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Nama Lengkap</label>
                    <input
                      type="text"
                      value={editingUser.fullName}
                      onChange={(e) => setEditingUser({ ...editingUser, fullName: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Username</label>
                    <input
                      type="text"
                      value={editingUser.username}
                      onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Password</label>
                    <input
                      type="text"
                      value={editingUser.password}
                      onChange={(e) => setEditingUser({ ...editingUser, password: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">Peran / Role</label>
                    <select
                      value={editingUser.role}
                      onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as UserRole })}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
                    >
                      <option value="pemberi_tugas">Pemberi Tugas (Sales / Proyek)</option>
                      <option value="manager">Manager Engineering (Disposisi)</option>
                      <option value="staff">Staff Engineering (Eksekutor)</option>
                      <option value="dashboard">Dashboard Workload & Analitik</option>
                    </select>
                  </div>

                  {(editingUser.role === 'manager' || editingUser.role === 'staff') && (
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">Departemen</label>
                      <select
                        value={editingUser.department || 'Engineering Precast'}
                        onChange={(e) =>
                          setEditingUser({ ...editingUser, department: e.target.value as DepartmentName })
                        }
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
                      >
                        <option value="Engineering Precast">Engineering Precast</option>
                        <option value="Engineering Readymix">Engineering Readymix</option>
                        <option value="Engineering Konstruksi">Engineering Konstruksi</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-700 mb-1">No. WhatsApp</label>
                    <input
                      type="text"
                      value={editingUser.whatsapp || ''}
                      onChange={(e) => setEditingUser({ ...editingUser, whatsapp: e.target.value })}
                      placeholder="62812..."
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 font-mono"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setEditingUser(null)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-200/60"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-[#282974] hover:bg-[#1e1f5a]"
                  >
                    Simpan Perubahan
                  </button>
                </div>
              </form>
            )}

            {/* Filter & Search Bar */}
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchUserQuery}
                  onChange={(e) => setSearchUserQuery(e.target.value)}
                  placeholder="Cari nama lengkap, username, atau departemen..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#282974] focus:bg-white"
                />
              </div>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value as 'ALL' | UserRole)}
                className="px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-800 font-medium focus:outline-none focus:border-[#282974]"
              >
                <option value="ALL">Semua Peran ({users.length})</option>
                <option value="pemberi_tugas">Pemberi Tugas / Sales</option>
                <option value="manager">Manager Engineering</option>
                <option value="staff">Staff Engineering</option>
                <option value="dashboard">Dashboard & Analitik</option>
              </select>
            </div>

            {/* User List */}
            <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
              {filteredUsers.length === 0 ? (
                <div className="p-8 text-center bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
                  Tidak ada akun pengguna yang sesuai dengan pencarian.
                </div>
              ) : (
                filteredUsers.map((u) => {
                  const roleMeta = roleConfigs.find(r => r.id === u.role);
                  const isPassShown = !!revealedPasswords[u.id];

                  return (
                    <div
                      key={u.id}
                      className="p-3 rounded-xl bg-white border border-slate-200 hover:border-slate-300 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-[#282974]/8 border border-[#282974]/25 text-[#282974] font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                          {u.fullName.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs font-bold text-slate-900 truncate">
                              {u.fullName}
                            </span>
                            <span className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border ${roleMeta?.badgeColor || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                              {roleMeta?.shortTitle || u.roleName}
                            </span>
                            {u.department && (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                {u.department.replace('Engineering ', '')}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 font-mono">
                            <span>
                              user: <strong className="text-slate-900">@{u.username}</strong>
                            </span>
                            <span className="flex items-center gap-1">
                              pass:{' '}
                              <strong className="text-slate-900">
                                {isPassShown ? u.password : '••••••'}
                              </strong>
                              <button
                                type="button"
                                onClick={() =>
                                  setRevealedPasswords(prev => ({ ...prev, [u.id]: !prev[u.id] }))
                                }
                                className="text-slate-400 hover:text-slate-700"
                                title={isPassShown ? 'Sembunyikan' : 'Tampilkan password'}
                              >
                                {isPassShown ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                              </button>
                            </span>
                            {u.whatsapp && (
                              <span className="text-emerald-700">WA: +{u.whatsapp}</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRole(u.role);
                            setUsername(u.username);
                            setPassword(u.password);
                            setErrorMsg('');
                            setActiveTab('login');
                          }}
                          className="px-2.5 py-1.5 rounded-lg text-[11px] font-semibold text-[#282974] bg-[#282974]/8 hover:bg-[#282974]/15 border border-[#282974]/25 transition-colors flex items-center gap-1"
                          title="Isi ke form login"
                        >
                          <LogIn className="w-3 h-3" />
                          <span>Gunakan</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setEditingUser({ ...u });
                            setEditError('');
                          }}
                          className="p-1.5 rounded-lg text-slate-600 hover:text-[#282974] hover:bg-slate-100 border border-slate-200 transition-colors"
                          title="Edit User"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        {users.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              onDeleteUser(u.id);
                              setManageNotice(`Akun "${u.fullName}" telah dihapus.`);
                              setTimeout(() => setManageNotice(''), 3000);
                            }}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-colors"
                            title="Hapus User"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <span>PT. Waskita Beton Precast, Tbk · Sistem Multi-User Dinamis</span>
          {canClose && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100 font-semibold transition-colors"
            >
              Tutup
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
