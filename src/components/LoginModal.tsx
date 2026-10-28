import React, { useState } from 'react';
import { Lock, User, KeyRound, Building2, ChevronRight, ShieldCheck, AlertCircle } from 'lucide-react';
import { UserRole, UserSession } from '../types';

interface LoginModalProps {
  isOpen: boolean;
  onLoginSuccess: (session: UserSession) => void;
  onClose?: () => void;
  canClose?: boolean;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen,
  onLoginSuccess,
  onClose,
  canClose = false
}) => {
  const [selectedRole, setSelectedRole] = useState<UserRole>('pemberi_tugas');
  const [username, setUsername] = useState('WBP');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const roleConfigs: {
    id: UserRole;
    title: string;
    code: string;
    desc: string;
    pass: string;
    badge: string;
  }[] = [
    {
      id: 'pemberi_tugas',
      title: '1. Pemberi Tugas (Sales / Proyek)',
      code: 'WBP456',
      desc: 'Buat permintaan baru, lampirkan TOR/spek, dan lacak status dokumen',
      pass: 'WBP456',
      badge: 'Sales & Project'
    },
    {
      id: 'manager',
      title: '2. Manager Engineering (Disposisi)',
      code: 'WBPMGR',
      desc: 'Disposisi tugas masuk ke staf teknis dan pantau antrean departemen',
      pass: 'WBPMGR',
      badge: 'Manager'
    },
    {
      id: 'staff',
      title: '3. Staff Engineering (Eksekutor)',
      code: 'WBP123',
      desc: 'Kerjakan dokumen (Analisis, SSP, Gambar), upload hasil & submit',
      pass: 'WBP123',
      badge: 'Technical Staff'
    },
    {
      id: 'dashboard',
      title: '4. Dashboard Workload & Analitik',
      code: 'WBPVIEW',
      desc: 'Tinjau metrik beban kerja, tren harian/mingguan/bulanan & rekapitulasi',
      pass: 'WBPVIEW',
      badge: 'Executive / All'
    }
  ];

  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (username.trim().toUpperCase() !== 'WBP') {
      setErrorMsg('Username harus "WBP"');
      return;
    }

    const currentConfig = roleConfigs.find(r => r.id === selectedRole);
    if (!currentConfig) return;

    if (password === currentConfig.pass) {
      onLoginSuccess({
        isLoggedIn: true,
        role: selectedRole,
        roleName: currentConfig.title,
        userName: `WBP ${currentConfig.badge}`
      });
    } else {
      setErrorMsg(`Password salah untuk ${currentConfig.title}. Hint: ${currentConfig.pass}`);
    }
  };

  const handleQuickLogin = (role: UserRole) => {
    const config = roleConfigs.find(r => r.id === role)!;
    onLoginSuccess({
      isLoggedIn: true,
      role: role,
      roleName: config.title,
      userName: `WBP ${config.badge}`
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Brand header */}
        <div className="px-6 pt-6 pb-4 bg-gradient-to-b from-slate-800/80 to-slate-900/40 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-blue-600 text-white font-black text-sm tracking-tighter shadow-md shadow-blue-900/40">
              WBP
            </div>
            <div>
              <div className="text-[10px] font-bold tracking-widest text-blue-400 uppercase">
                PT Waskita Beton Precast, Tbk
              </div>
              <h2 className="text-base font-bold text-white tracking-tight">
                Sistem Manajemen Dokumen Teknis
              </h2>
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Silakan pilih peran dan masukkan kredensial resmi untuk mengakses sistem.
          </p>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5">
          {errorMsg && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleManualLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Masuk Sebagai (Pilih Akses Role):
              </label>
              <div className="grid grid-cols-1 gap-2">
                {roleConfigs.map((role) => {
                  const isSelected = selectedRole === role.id;
                  return (
                    <button
                      key={role.id}
                      type="button"
                      onClick={() => {
                        setSelectedRole(role.id);
                        setErrorMsg('');
                      }}
                      className={`flex items-center justify-between p-2.5 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-blue-600/15 border-blue-500/80 text-white shadow-sm'
                          : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <div>
                        <div className="text-xs font-semibold">{role.title}</div>
                        <div className="text-[11px] text-slate-400 line-clamp-1">{role.desc}</div>
                      </div>
                      <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                        isSelected ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'bg-slate-800 text-slate-500'
                      }`}>
                        {role.code}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="WBP"
                    className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1">
                  Password
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-2.5 w-4 h-4 text-slate-500" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={`e.g. ${roleConfigs.find(r => r.id === selectedRole)?.pass}`}
                    className="w-full pl-9 pr-3 py-2 text-xs font-mono bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg shadow-blue-900/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Masuk Aplikasi</span>
            </button>
          </form>

          {/* Quick Demo Access Bar */}
          <div className="pt-3 border-t border-slate-800">
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>Akses Cepat Pengujian (1-Klik)</span>
              <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('pemberi_tugas')}
                className="p-2 text-[11px] bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/60 rounded-lg text-slate-200 text-left transition-colors"
              >
                📝 Sales / Proyek
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('manager')}
                className="p-2 text-[11px] bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/60 rounded-lg text-slate-200 text-left transition-colors"
              >
                💼 Manager Disposisi
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('staff')}
                className="p-2 text-[11px] bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/60 rounded-lg text-slate-200 text-left transition-colors"
              >
                🛠️ Staff Eksekutor
              </button>
              <button
                type="button"
                onClick={() => handleQuickLogin('dashboard')}
                className="p-2 text-[11px] bg-slate-800/60 hover:bg-slate-700/80 border border-slate-700/60 rounded-lg text-slate-200 text-left transition-colors"
              >
                📊 Dashboard Analitik
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <span>PT. Waskita Beton Precast, Tbk - 2026</span>
          {canClose && onClose && (
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white"
            >
              Batal
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
