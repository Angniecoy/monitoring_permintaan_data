import React, { useState } from 'react';
import { Lock, User, KeyRound, AlertCircle, Eye, EyeOff, Check } from 'lucide-react';
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
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const roleConfigs: {
    id: UserRole;
    title: string;
    desc: string;
    pass: string;
    badge: string;
  }[] = [
    {
      id: 'pemberi_tugas',
      title: 'Pemberi Tugas (Sales / Proyek)',
      desc: 'Buat permintaan baru, lampirkan TOR/spek, dan lacak status dokumen',
      pass: 'WBP456',
      badge: 'Sales & Project'
    },
    {
      id: 'manager',
      title: 'Manager Engineering (Disposisi)',
      desc: 'Disposisi tugas masuk ke staf teknis dan pantau antrean departemen',
      pass: 'WBPMGR',
      badge: 'Manager'
    },
    {
      id: 'staff',
      title: 'Staff Engineering (Eksekutor)',
      desc: 'Kerjakan dokumen (Analisis, SSP, Gambar), upload hasil & submit',
      pass: 'WBP123',
      badge: 'Technical Staff'
    },
    {
      id: 'dashboard',
      title: 'Dashboard Workload & Analitik',
      desc: 'Tinjau metrik beban kerja, tren harian/mingguan/bulanan & rekapitulasi',
      pass: 'WBPVIEW',
      badge: 'Executive / All'
    }
  ];

  const handleManualLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!username.trim()) {
      setErrorMsg('Silakan masukkan Username.');
      return;
    }

    if (!password) {
      setErrorMsg('Silakan masukkan Password.');
      return;
    }

    if (username.trim().toUpperCase() !== 'WBP') {
      setErrorMsg('Username atau Password tidak valid!');
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
      setErrorMsg('Username atau Password tidak sesuai untuk akses ini!');
    }
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
                PT. Waskita Beton Precast, Tbk
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
                      className={`flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-blue-600/15 border-blue-500/80 text-white shadow-sm'
                          : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <div className="pr-2">
                        <div className="text-xs font-semibold">{role.title}</div>
                        <div className="text-[11px] text-slate-400 mt-0.5 line-clamp-1">{role.desc}</div>
                      </div>
                      <div className="shrink-0">
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center">
                            <Check className="w-3 h-3" />
                          </div>
                        )}
                      </div>
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
                    placeholder="Masukkan username"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
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
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-9 pr-9 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-300 transition-colors p-0.5"
                    title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg shadow-blue-900/30 transition-all active:scale-[0.98] flex items-center justify-center gap-2 mt-2"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Masuk Aplikasi</span>
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
          <span>PT. Waskita Beton Precast, Tbk - 2026</span>
          {canClose && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white transition-colors"
            >
              Batal
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
