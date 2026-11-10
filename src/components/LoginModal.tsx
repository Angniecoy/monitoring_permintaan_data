import React, { useState, useEffect } from 'react';
import { 
  Lock, User, KeyRound, AlertCircle, Eye, EyeOff, Check, 
  UserPlus, Users, Trash2, Edit3, Search, ShieldCheck, ChevronDown,
  Phone, RotateCcw, ArrowRight, CheckCircle2, X, LogIn, Activity,
  Cloud, RefreshCw, ExternalLink
} from 'lucide-react';
import { DepartmentName, Ticket, UserAccount, UserRole, UserSession } from '../types';
import {
  ROLE_LABELS,
  cleanWhatsAppNumber,
  getStoredTickets,
  getStoredUsers,
  pullAndMergeUsersFromDrive
} from '../data/mockData';
import {
  subscribeDriveAuth,
  googleSignIn,
  GOOGLE_DRIVE_FOLDER_ID,
  GOOGLE_DRIVE_FOLDER_URL,
  getDriveSyncState,
  DriveSyncState
} from '../services/googleDrive';
import { getStoredOnlineUsers, registerOnlineUser, OnlineUserSession } from '../data/onlineStore';

interface LoginModalProps {
  isOpen: boolean;
  users: UserAccount[];
  tickets?: Ticket[];
  onLoginSuccess: (session: UserSession) => void;
  onRegisterUser: (newUser: Omit<UserAccount, 'id' | 'createdAt'>) => UserAccount;
  onUpdateUser: (updatedUser: UserAccount) => void;
  onDeleteUser: (userId: string) => void;
  onResetUsers?: () => void;
  onClose?: () => void;
  canClose?: boolean;
  isAdmin?: boolean;
  initialTab?: 'login' | 'register' | 'manage';
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  users,
  tickets,
  onLoginSuccess,
  onRegisterUser,
  onUpdateUser,
  onDeleteUser,
  onResetUsers,
  onClose,
  canClose = false,
  isAdmin = false,
  initialTab = 'login'
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register' | 'manage'>(
    (!canClose || !isAdmin) && initialTab === 'manage' ? 'login' : initialTab
  );

  // Persistent Users State synced directly with Google Drive + localStorage + parent state
  const [persistedUsers, setPersistedUsers] = useState<UserAccount[]>(() => getStoredUsers());
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [driveSyncState, setDriveSyncState] = useState<DriveSyncState>(() => getDriveSyncState());
  const [isPullingDrive, setIsPullingDrive] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeDriveAuth((state) => {
      setIsDriveConnected(state.isConnected);
      setDriveSyncState(state.syncState);
      if (state.isConnected) {
        void pullAndMergeUsersFromDrive().then((merged) => {
          setPersistedUsers(merged);
        });
      }
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    setPersistedUsers(getStoredUsers());
    if (isDriveConnected && (activeTab === 'manage' || activeTab === 'login')) {
      void pullAndMergeUsersFromDrive().then((merged) => {
        setPersistedUsers(merged);
      });
    }
  }, [users, activeTab, isOpen, isDriveConnected]);

  const handleManualDriveSync = async () => {
    setIsPullingDrive(true);
    try {
      if (!isDriveConnected) {
        await googleSignIn();
      }
      const merged = await pullAndMergeUsersFromDrive();
      setPersistedUsers(merged);
      if (activeTab === 'manage') {
        setManageNotice(
          `Sinkronisasi Google Drive selesai (${merged.length} akun aktif dari folder ${GOOGLE_DRIVE_FOLDER_ID}).`
        );
        setTimeout(() => setManageNotice(''), 4000);
      }
    } catch (err) {
      console.warn('Drive sync warning:', err);
    } finally {
      setIsPullingDrive(false);
    }
  };

  useEffect(() => {
    const syncStoredUsers = () => {
      setPersistedUsers(getStoredUsers());
    };
    window.addEventListener('wbp_users_updated', syncStoredUsers);
    window.addEventListener('storage', syncStoredUsers);
    return () => {
      window.removeEventListener('wbp_users_updated', syncStoredUsers);
      window.removeEventListener('storage', syncStoredUsers);
    };
  }, []);

  // Merge persisted localStorage users with prop users to guarantee zero data loss
  const effectiveUsers = React.useMemo(() => {
    const map = new Map<string, UserAccount>();
    for (const u of persistedUsers) {
      map.set(u.username.toLowerCase(), u);
    }
    for (const u of users) {
      if (!map.has(u.username.toLowerCase())) {
        map.set(u.username.toLowerCase(), u);
      }
    }
    const merged = Array.from(map.values());
    const custom = merged.filter(u => !u.isDefault);
    const defaults = merged.filter(u => u.isDefault);
    return [...custom, ...defaults];
  }, [persistedUsers, users]);

  // Online Users State (Real-Time Active Sessions Tracker)
  const [onlineUsers, setOnlineUsers] = useState<OnlineUserSession[]>(() => getStoredOnlineUsers());
  const [showOnlineUsersModal, setShowOnlineUsersModal] = useState(false);

  useEffect(() => {
    const syncUsers = () => {
      setOnlineUsers(getStoredOnlineUsers());
    };
    window.addEventListener('wbp_online_users_updated', syncUsers);
    window.addEventListener('storage', syncUsers);
    const interval = setInterval(syncUsers, 4000);
    return () => {
      window.removeEventListener('wbp_online_users_updated', syncUsers);
      window.removeEventListener('storage', syncUsers);
      clearInterval(interval);
    };
  }, []);

  // Login State
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

  // Public role dropdown options (strictly 3 roles: Pemberi Tugas, Manager Engineering, Staff Engineering)
  const loginRoleConfigs = roleConfigs.filter(r => r.id !== 'dashboard');

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

    // 1. Check registered users in persistent localStorage + dynamic application state
    const matchingUsers = effectiveUsers.filter(
      u => u.username.toLowerCase() === trimmedUsername.toLowerCase()
    );

    if (matchingUsers.length > 0) {
      const matchedUser = matchingUsers.find(u => u.password === password);

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
          whatsapp: matchedUser.whatsapp,
          isAdmin:
            matchedUser.isAdmin === true ||
            matchedUser.username.toLowerCase() === 'admin' ||
            matchedUser.role === 'dashboard'
        });
        return;
      } else {
        setErrorMsg(`Password tidak sesuai untuk akun username "${trimmedUsername}"!`);
        return;
      }
    }

    // 2. Fallback support for legacy universal 'WBP' username matched by role password
    if (trimmedUsername.toUpperCase() === 'WBP') {
      const currentConfig = roleConfigs.find(r => r.pass === password);
      if (currentConfig) {
        onLoginSuccess({
          isLoggedIn: true,
          username: 'WBP',
          role: currentConfig.id,
          roleName: currentConfig.title,
          userName: `WBP ${currentConfig.badge}`,
          isAdmin: currentConfig.id === 'dashboard'
        });
        return;
      } else {
        setErrorMsg('Password tidak sesuai untuk kredensial akses resmi!');
        return;
      }
    }

    setErrorMsg(`Kredensial username "${trimmedUsername}" atau password tidak ditemukan.`);
  };

  const validateAndCreateAccount = async (autoLogin: boolean) => {
    setRegError('');

    const cleanName = regFullName.trim();
    const cleanUser = regUsername.trim();
    const cleanWa = regWhatsapp.trim();

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
    if (!cleanWa) {
      setRegError('Nomor WhatsApp wajib diisi.');
      return;
    }

    // Check username uniqueness against persisted localStorage & state
    const exists = effectiveUsers.some(
      u => u.username.toLowerCase() === cleanUser.toLowerCase()
    );
    if (exists) {
      setRegError(`Username "${cleanUser}" sudah digunakan. Silakan pilih username lain.`);
      return;
    }

    // Ensure Google Drive connection so WBP_USER_<username>.json and wbp_users_database.json are written directly to folder 1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF
    if (!isDriveConnected) {
      try {
        await googleSignIn();
      } catch {
        // Proceed with local persistence; will auto-sync to Drive folder as soon as connected
      }
    }

    const safeRole: UserRole = regRole === 'dashboard' ? 'pemberi_tugas' : regRole;
    const roleObj = loginRoleConfigs.find(r => r.id === safeRole);
    const roleTitle = roleObj ? roleObj.title : ROLE_LABELS[safeRole];
    const needsDept = safeRole === 'manager' || safeRole === 'staff';

    const createdUser = onRegisterUser({
      fullName: cleanName,
      username: cleanUser,
      password: regPassword,
      role: safeRole,
      roleName: roleTitle,
      department: needsDept ? regDept : undefined,
      whatsapp: cleanWhatsAppNumber(cleanWa)
    });

    // Immediately sync local persisted state from localStorage
    setPersistedUsers(getStoredUsers());

    // Reset registration form
    setRegFullName('');
    setRegUsername('');
    setRegPassword('');
    setRegWhatsapp('');

    if (autoLogin) {
      registerOnlineUser({
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
    } else if (canClose && isAdmin) {
      // Admin added a new user from Kelola User -> return directly to the real-time management table
      setFilterRole('ALL');
      setSearchUserQuery('');
      setManageNotice(
        `Akun baru "${createdUser.fullName}" (@${createdUser.username}) berhasil disimpan ke Google Drive (WBP_USER_${createdUser.username.toLowerCase()}.json) & basis data utama!`
      );
      setTimeout(() => setManageNotice(''), 5000);
      setActiveTab('manage');
    } else {
      // Pre-fill login form so user can immediately sign in
      setUsername(createdUser.username);
      setPassword(createdUser.password);
      setErrorMsg('');
      setSuccessMsg(
        `Akun "${createdUser.fullName}" (@${createdUser.username}) berhasil disimpan ke Google Drive (Folder ID: ${GOOGLE_DRIVE_FOLDER_ID}) sebagai ${createdUser.roleName}. Silakan masuk!`
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

    const duplicate = effectiveUsers.some(
      u => u.id !== editingUser.id && u.username.toLowerCase() === cleanUser.toLowerCase()
    );
    if (duplicate) {
      setEditError(`Username "${cleanUser}" sudah dipakai oleh pengguna lain.`);
      return;
    }

    const confirmed = window.confirm(
      `Simpan perubahan data akun "${cleanName}" (@${cleanUser}) dan perbarui catatan JSON di Google Drive?`
    );
    if (!confirmed) return;

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
    setPersistedUsers(getStoredUsers());
    setEditingUser(null);
    setManageNotice(`Data akun "${updated.fullName}" berhasil diperbarui di Google Drive & penyimpanan lokal.`);
    setTimeout(() => setManageNotice(''), 3500);
  };

  const filteredUsers = effectiveUsers.filter(u => {
    const matchesRole = filterRole === 'ALL' || u.role === filterRole;
    const q = searchUserQuery.toLowerCase();
    const matchesQuery =
      u.fullName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      (u.roleName || '').toLowerCase().includes(q) ||
      (u.whatsapp || '').toLowerCase().includes(q) ||
      (u.department && u.department.toLowerCase().includes(q));
    return matchesRole && matchesQuery;
  });

  const customUsersCount = effectiveUsers.filter(u => !u.isDefault).length;

  const allTickets = tickets || getStoredTickets();
  const activeTickets = allTickets.filter(
    t => t.Status_Pengerjaan === 'OPEN' || t.Status_Pengerjaan === 'PROSES'
  );
  const openTicketsCount = activeTickets.filter(t => t.Status_Pengerjaan === 'OPEN').length;
  const prosesTicketsCount = activeTickets.filter(t => t.Status_Pengerjaan === 'PROSES').length;

  return (
    <div 
      onClick={(e) => {
        if (e.target === e.currentTarget && canClose && onClose) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 w-screen h-[100dvh] flex items-start sm:items-center justify-center px-3 pt-2.5 pb-4 sm:p-6 lg:p-8 animate-in fade-in duration-200 overflow-y-auto"
    >
      {/* Full-Width Precast Plant Wallpaper Background */}
      <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
        <img
          src="/assets/aistudio/Background_Login_28eb3ddc.jpg"
          alt="Pabrik Precast PT. Waskita Beton Precast, Tbk"
          className="w-full h-full object-cover object-center scale-[1.01]"
        />
        {/* Subtle dark/brand contrast veil so the central translucent white card stands out sharply */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#282974]/50 via-slate-900/35 to-slate-950/55 backdrop-blur-[1.5px]" />
      </div>

      {/* Centered Translucent White Main Box with High-Contrast Shadow */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative z-10 w-full max-w-2xl bg-white/92 backdrop-blur-md border border-white/80 rounded-2xl shadow-[0_25px_70px_-12px_rgba(15,23,42,0.65)] ring-1 ring-slate-900/10 overflow-hidden mt-1.5 sm:my-auto"
      >
        {/* Brand Header */}
        <div className="px-4 pt-3.5 pb-3 sm:px-6 sm:pt-5 sm:pb-4 bg-gradient-to-b from-white/95 to-slate-50/90 border-b border-slate-200/90">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
              <div className="flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-white border border-slate-200/90 p-1 shadow-xs shrink-0 overflow-hidden">
                <img
                  src="/assets/aistudio/logo_perusahaan_91bab227.jfif"
                  alt="Logo PT. Waskita Beton Precast, Tbk"
                  className="w-full h-full object-contain"
                />
              </div>
              <div className="flex flex-col justify-center min-w-0">
                <div className="text-[10px] font-bold tracking-widest text-[#282974] uppercase leading-tight truncate">
                  PT. Waskita Beton Precast, Tbk
                </div>
                <h2 className="text-xs sm:text-[13px] font-extrabold text-[#282974] tracking-tight leading-snug mt-0.5 truncate">
                  ENGINEERING PORTAL
                </h2>
              </div>
            </div>

            {/* Top Right Header Controls: Mode Switcher & Daftar User Online Widget */}
            <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
              {activeTab === 'register' && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('login');
                    setRegError('');
                  }}
                  className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-white border border-slate-200 shadow-2xs transition-all cursor-pointer shrink-0"
                >
                  <Lock className="w-3.5 h-3.5 text-[#282974] shrink-0" />
                  <span>Form Masuk</span>
                </button>
              )}

              {canClose && isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setPersistedUsers(getStoredUsers());
                    setActiveTab(activeTab === 'manage' ? 'login' : 'manage');
                    setEditingUser(null);
                  }}
                  className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                    activeTab === 'manage'
                      ? 'bg-[#282974] text-white shadow-2xs'
                      : 'text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-white border border-slate-200'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 shrink-0" />
                  <span>Kelola User ({effectiveUsers.length})</span>
                </button>
              )}

              {/* Widget: Daftar User Online (Real-Time Live Status) */}
              <button
                type="button"
                onClick={() => setShowOnlineUsersModal(true)}
                className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-[11px] sm:text-xs font-semibold bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs transition-all active:scale-[0.98] cursor-pointer group shrink-0"
                title="Lihat siapa saja pengguna yang sedang aktif/masuk ke dalam sesi aplikasi"
              >
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <Users className="w-3.5 h-3.5 text-emerald-700 group-hover:scale-110 transition-transform shrink-0" />
                <span className="font-bold">Daftar User Online</span>
                <span className="px-1.5 py-0.2 rounded-full bg-emerald-600 text-white text-[10px] font-mono font-bold shrink-0">
                  {onlineUsers.length}
                </span>
              </button>
            </div>
          </div>
        </div>

        {/* ==================== TAB 1: MASUK (LOGIN) ==================== */}
        {activeTab === 'login' && (
          <div className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 max-h-[82dvh] sm:max-h-[78vh] overflow-y-auto">
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
              {/* Horizontal Running Ticker / Marquee for Active Tickets (OPEN & PROSES) */}
              <div className="p-3 rounded-xl bg-slate-50/95 border border-slate-200/90 space-y-2 shadow-2xs">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#282974] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#282974]"></span>
                    </span>
                    <Activity className="w-3.5 h-3.5 text-[#282974]" />
                    <span className="text-[11px] font-bold text-slate-800 tracking-tight">
                      Live Status Tiket Aktif (Belum Closed)
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-semibold">
                    <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200">
                      {openTicketsCount} OPEN
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-[#282974]/10 text-[#282974] border border-[#282974]/25">
                      {prosesTicketsCount} PROSES
                    </span>
                  </div>
                </div>

                {activeTickets.length > 0 ? (
                  <div className="relative overflow-hidden rounded-lg bg-white border border-slate-200 py-2">
                    {/* Edge gradient masks for smooth visual entry & exit */}
                    <div className="pointer-events-none absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-white to-transparent z-10" />
                    <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent z-10" />

                    <div className="animate-ticker-marquee items-center">
                      {[...activeTickets, ...activeTickets].map((t, idx) => {
                        const isOpen = t.Status_Pengerjaan === 'OPEN';
                        return (
                          <div
                            key={`${t.ID_Tiket}-${idx}`}
                            className="inline-flex items-center gap-2 px-3.5 border-r border-slate-200/80 whitespace-nowrap text-xs"
                          >
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${
                                isOpen
                                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                                  : 'bg-[#282974] text-white border-[#282974]'
                              }`}
                            >
                              {t.Status_Pengerjaan}
                            </span>
                            <span className="font-mono font-bold text-[#282974] text-[11px]">
                              {t.ID_Tiket}
                            </span>
                            <span className="text-slate-300">—</span>
                            <span className="font-semibold text-slate-800 text-[11px]">
                              {t.Proyek}
                            </span>
                            <span className="text-[10px] text-slate-500 font-medium">
                              ({t.Departemen_Tujuan.replace('Engineering ', 'Eng. ')} · Target: {t.Target_Selesai})
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="py-2 px-3 rounded-lg bg-white border border-slate-200 text-center text-[11px] text-emerald-700 font-medium">
                    Seluruh tiket saat ini telah berstatus CLOSED (Selesai).
                  </div>
                )}
              </div>

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
            <div className="p-3.5 rounded-xl bg-[#282974]/8 border border-[#282974]/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <UserPlus className="w-4 h-4 text-[#282974]" />
                  <span>Registrasi Akun Pengguna Baru (Tersimpan ke Google Drive)</span>
                </h3>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  Setiap pendaftaran menulis berkas JSON catatan akun ke Google Drive (Folder ID:{' '}
                  <a
                    href={GOOGLE_DRIVE_FOLDER_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono font-semibold text-[#282974] hover:underline"
                  >
                    {GOOGLE_DRIVE_FOLDER_ID}
                  </a>
                  ) sehingga langsung tampil di panel Kelola User Admin.
                </p>
              </div>
              <div className="shrink-0">
                {isDriveConnected ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-[10px] font-semibold">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Drive Terhubung</span>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void handleManualDriveSync()}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-300 text-slate-800 text-[11px] font-semibold shadow-2xs transition-all cursor-pointer"
                  >
                    <Cloud className="w-3.5 h-3.5 text-[#282974]" />
                    <span>Sign in with Google</span>
                  </button>
                )}
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
                void validateAndCreateAccount(false);
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
                    required
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
                      required
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
                      required
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

              {/* Pilih Peran / Role (Compact Dropdown) */}
              <div>
                <label htmlFor="register-role-select" className="block text-xs font-semibold text-slate-700 mb-1">
                  Pilih Peran (Role Akses) <span className="text-rose-600">*</span>
                </label>
                <div className="relative">
                  <ShieldCheck className="pointer-events-none absolute left-3 top-2.5 w-4 h-4 text-[#282974]" />
                  <select
                    id="register-role-select"
                    value={regRole === 'dashboard' ? 'pemberi_tugas' : regRole}
                    onChange={(e) => setRegRole(e.target.value as UserRole)}
                    className="w-full appearance-none pl-9 pr-9 py-2.5 text-xs font-semibold bg-white border border-slate-300 hover:border-[#282974]/60 rounded-xl text-slate-900 focus:outline-none focus:border-[#282974] focus:ring-2 focus:ring-[#282974]/15 transition-colors cursor-pointer shadow-2xs"
                  >
                    {loginRoleConfigs.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.title}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-2.5 w-4 h-4 text-slate-500" />
                </div>
                <p className="text-[11px] text-slate-500 mt-1 px-0.5 line-clamp-1">
                  {loginRoleConfigs.find(r => r.id === regRole)?.desc}
                </p>
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
                    Nomor WhatsApp <span className="text-rose-600">*</span>
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={regWhatsapp}
                      onChange={(e) => setRegWhatsapp(e.target.value)}
                      placeholder="Contoh: 081234567890"
                      className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#282974] focus:ring-2 focus:ring-[#282974]/15"
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
                  onClick={() => void validateAndCreateAccount(true)}
                  className="w-full sm:flex-1 py-2.5 px-4 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Daftar & Langsung Masuk</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ==================== TAB 3: MANAJEMEN DAFTAR USER (PROTECTED: ADMIN ONLY) ==================== */}
        {activeTab === 'manage' && canClose && isAdmin && (
          <div className="p-6 space-y-4 max-h-[78vh] overflow-y-auto">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
              <div>
                <h3 className="text-xs font-bold text-slate-900 flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-[#282974]" />
                    <span>Manajemen Daftar User ({effectiveUsers.length} Akun)</span>
                  </span>
                  {customUsersCount > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                      {customUsersCount} Pendaftaran Baru Tersimpan
                    </span>
                  )}
                </h3>
                <p className="text-[11px] text-slate-600 flex items-center gap-1.5 flex-wrap mt-0.5">
                  <span>Basis Data Google Drive Folder ID:</span>
                  <a
                    href={GOOGLE_DRIVE_FOLDER_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-mono font-semibold text-[#282974] hover:underline"
                  >
                    <span>{GOOGLE_DRIVE_FOLDER_ID}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  {driveSyncState.lastSyncedAt && (
                    <span className="text-[10px] text-emerald-700 font-semibold">
                      • Disinkronkan {driveSyncState.lastSyncedAt}
                    </span>
                  )}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void handleManualDriveSync()}
                  disabled={isPullingDrive || driveSyncState.isSyncing}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
                  title="Tarik catatan JSON user terbaru dari Google Drive Folder 1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 text-emerald-700 ${
                      isPullingDrive || driveSyncState.isSyncing ? 'animate-spin' : ''
                    }`}
                  />
                  <span>
                    {isDriveConnected ? 'Tarik Data Drive' : 'Hubungkan & Tarik Drive'}
                  </span>
                </button>

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
                      const confirmed = window.confirm(
                        'Apakah Anda yakin ingin mengembalikan daftar user ke pengaturan default dan memperbarui wbp_users_database.json di Google Drive?'
                      );
                      if (!confirmed) return;
                      onResetUsers();
                      setPersistedUsers(getStoredUsers());
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
                      value={editingUser.role === 'dashboard' ? 'pemberi_tugas' : editingUser.role}
                      onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as UserRole })}
                      className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900"
                    >
                      <option value="pemberi_tugas">Pemberi Tugas (Sales / Proyek)</option>
                      <option value="manager">Manager Engineering (Disposisi)</option>
                      <option value="staff">Staff Engineering (Eksekutor)</option>
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
                <option value="ALL">Semua Peran ({effectiveUsers.length})</option>
                <option value="pemberi_tugas">Pemberi Tugas / Sales</option>
                <option value="manager">Manager Engineering</option>
                <option value="staff">Staff Engineering</option>
                <option value="dashboard">Dashboard & Analitik</option>
              </select>
            </div>

            {/* Real-Time Registered Users Management Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden bg-white shadow-2xs">
              <div className="max-h-[340px] overflow-y-auto overflow-x-auto">
                {filteredUsers.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 text-xs text-slate-500">
                    Tidak ada akun pengguna yang sesuai dengan pencarian.
                  </div>
                ) : (
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 sticky top-0 z-10">
                      <tr>
                        <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Nama Lengkap</th>
                        <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Username</th>
                        <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Password</th>
                        <th className="px-3 py-2.5 font-semibold whitespace-nowrap">Peran (Role)</th>
                        <th className="px-3 py-2.5 font-semibold whitespace-nowrap">No. WhatsApp</th>
                        <th className="px-3 py-2.5 font-semibold text-right whitespace-nowrap">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {filteredUsers.map((u) => {
                        const roleMeta = roleConfigs.find(r => r.id === u.role);
                        const isPassShown = !!revealedPasswords[u.id];

                        return (
                          <tr
                            key={u.id}
                            className={`transition-colors ${
                              !u.isDefault
                                ? 'bg-emerald-50/35 hover:bg-emerald-50/70'
                                : 'hover:bg-slate-50/90'
                            }`}
                          >
                            <td className="px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-[#282974]/8 border border-[#282974]/25 text-[#282974] font-bold text-[10px] flex items-center justify-center shrink-0">
                                  {u.fullName.slice(0, 2).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                    <span className="truncate max-w-[140px]">{u.fullName}</span>
                                    {!u.isDefault && (
                                      <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 text-[9px] font-bold uppercase shrink-0">
                                        Baru
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-400 font-mono">
                                    {u.createdAt}
                                  </div>
                                </div>
                              </div>
                            </td>

                            <td className="px-3 py-2.5 font-mono font-semibold text-[#282974] whitespace-nowrap">
                              @{u.username}
                            </td>

                            <td className="px-3 py-2.5 font-mono whitespace-nowrap">
                              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 border border-slate-200">
                                <span className="text-slate-900 font-semibold text-[11px]">
                                  {isPassShown ? u.password : '••••••'}
                                </span>
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
                              </div>
                            </td>

                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <div className="flex flex-col gap-0.5">
                                <span className={`inline-flex w-fit px-2 py-0.5 rounded-md text-[10px] font-semibold border ${roleMeta?.badgeColor || 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                  {roleMeta?.shortTitle || u.roleName}
                                </span>
                                {u.department && (
                                  <span className="text-[10px] text-slate-500 font-medium">
                                    {u.department}
                                  </span>
                                )}
                              </div>
                            </td>

                            <td className="px-3 py-2.5 font-mono text-[11px] text-emerald-700 font-semibold whitespace-nowrap">
                              {u.whatsapp ? `+${u.whatsapp}` : '-'}
                            </td>

                            <td className="px-3 py-2.5 text-right whitespace-nowrap">
                              <div className="inline-flex items-center justify-end gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setUsername(u.username);
                                    setPassword(u.password);
                                    setErrorMsg('');
                                    setActiveTab('login');
                                  }}
                                  className="px-2 py-1 rounded-lg text-[10px] font-semibold text-[#282974] bg-[#282974]/8 hover:bg-[#282974] hover:text-white border border-[#282974]/25 transition-colors inline-flex items-center gap-1"
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

                                {effectiveUsers.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const confirmed = window.confirm(
                                        `Apakah Anda yakin ingin menghapus akun "${u.fullName}" (@${u.username}) dari aplikasi dan Google Drive?`
                                      );
                                      if (!confirmed) return;
                                      onDeleteUser(u.id);
                                      setPersistedUsers(getStoredUsers());
                                      setManageNotice(
                                        `Akun "${u.fullName}" telah dihapus secara permanen dari aplikasi & Google Drive.`
                                      );
                                      setTimeout(() => setManageNotice(''), 3000);
                                    }}
                                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-colors"
                                    title="Hapus User"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50/90 border-t border-slate-200/90 flex items-center justify-between text-[11px] text-slate-600 font-medium">
          <span>PT. Waskita Beton Precast, Tbk · 2026</span>
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

      {/* Modal / Dialog: Daftar User Online (Real-Time Live Active Sessions) */}
      {showOnlineUsersModal && (
        <div 
          onClick={() => setShowOnlineUsersModal(false)}
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-150"
        >
          <div 
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150"
          >
            {/* Header */}
            <div className="px-5 py-4 bg-gradient-to-r from-emerald-50/90 via-white to-slate-50 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                  <Users className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-900">Daftar User Online</h3>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                      <span>{onlineUsers.length} Sesi Aktif</span>
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Personel terdaftar yang saat ini sedang aktif atau masuk ke dalam sesi aplikasi
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOnlineUsersModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Online Users List */}
            <div className="p-5 space-y-2.5 max-h-[60vh] overflow-y-auto">
              {onlineUsers.length === 0 ? (
                <div className="py-8 text-center text-slate-500 text-xs bg-slate-50 rounded-xl border border-slate-200">
                  Belum ada sesi pengguna lain yang sedang aktif.
                </div>
              ) : (
                onlineUsers.map((user) => (
                  <div
                    key={user.id}
                    className="p-3 rounded-xl bg-slate-50/90 hover:bg-slate-50 border border-slate-200/90 flex items-center justify-between gap-3 transition-colors shadow-2xs"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <div className="w-9 h-9 rounded-xl bg-[#282974] text-white font-bold text-xs flex items-center justify-center">
                          {user.fullName.slice(0, 2).toUpperCase()}
                        </div>
                        <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-slate-900 truncate">
                            {user.fullName}
                          </span>
                          <span className="text-[10px] font-mono text-slate-400">
                            (@{user.username})
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-500 truncate">
                          <span className="font-medium text-[#282974]">
                            {user.roleName || user.role}
                          </span>
                          {user.department && (
                            <>
                              <span>•</span>
                              <span className="truncate">{user.department.replace('Engineering ', '')}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold text-[10px]">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span>{user.lastActiveText || 'Online'}</span>
                      </span>
                      <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                        {user.loginTime}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
              <span className="flex items-center gap-1.5 font-medium text-emerald-700">
                <Activity className="w-3.5 h-3.5 text-emerald-600" />
                <span>Terhubung & terpantau secara real-time</span>
              </span>
              <button
                type="button"
                onClick={() => setShowOnlineUsersModal(false)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
