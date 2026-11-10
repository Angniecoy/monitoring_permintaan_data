import React, { useState, useRef, useEffect } from 'react';
import { LogOut, Search, Menu, Users, ChevronDown, ShieldCheck } from 'lucide-react';
import { UserSession } from '../types';
import { isAdminSession } from '../data/mockData';

interface NavbarProps {
  session: UserSession;
  onOpenLoginModal: () => void;
  onOpenUserManagement?: () => void;
  onOpenGuideModal?: () => void;
  onToggleSidebarMobile: () => void;
  onQuickSearchClick: () => void;
  totalUsersCount?: number;
}

export const Navbar: React.FC<NavbarProps> = ({
  session,
  onOpenLoginModal,
  onOpenUserManagement,
  onToggleSidebarMobile,
  onQuickSearchClick,
  totalUsersCount
}) => {
  const [isMobileUserMenuOpen, setIsMobileUserMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isAdmin = isAdminSession(session);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsMobileUserMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="sticky top-0 z-40 w-full flex items-center justify-between gap-2 sm:gap-4 px-3 sm:px-6 py-2.5 sm:py-3.5 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
      {/* Zone 1: Mobile Hamburger + Brand Wordmark */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 sm:flex-initial">
        <button
          type="button"
          onClick={onToggleSidebarMobile}
          aria-label="Buka navigasi menu"
          className="lg:hidden p-2 -ml-1 text-slate-600 hover:text-slate-900 rounded-xl hover:bg-slate-100 transition-colors shrink-0"
        >
          <Menu className="w-5 h-5" />
        </button>

        <a href="/" className="flex items-center gap-2 sm:gap-2.5 min-w-0 group">
          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-white border border-slate-200 p-0.5 flex items-center justify-center shadow-2xs overflow-hidden shrink-0">
            <img
              src="/assets/aistudio/logo_perusahaan_91bab227.jfif"
              alt="Logo PT. Waskita Beton Precast, Tbk"
              className="w-full h-full object-contain"
            />
          </div>
          <div className="min-w-0">
            <span className="block text-xs sm:text-base font-extrabold tracking-tight text-slate-900 truncate">
              ENGINEERING WBP
            </span>
            <span className="block sm:hidden text-[10px] font-medium text-[#282974] truncate leading-tight">
              {session.userName || session.roleName}
            </span>
          </div>
        </a>
      </div>

      {/* Zone 2: Desktop Search Affordance */}
      <div className="hidden md:flex items-center gap-4 flex-1 max-w-md mx-auto">
        <button
          type="button"
          onClick={onQuickSearchClick}
          className="w-full flex items-center justify-between px-3.5 py-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-200 hover:border-[#282974]/40 hover:bg-slate-100/70 rounded-xl transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span className="truncate">Pencarian cepat nomor tiket / proyek...</span>
          </div>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-500 bg-white border border-slate-200 rounded shadow-2xs shrink-0">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Zone 3: Responsive Action Controls + User Profile + Logout */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0" ref={dropdownRef}>
        {/* Mobile Quick Search Trigger */}
        <button
          type="button"
          onClick={onQuickSearchClick}
          className="md:hidden p-2 text-slate-600 hover:text-[#282974] bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors shrink-0"
          title="Pencarian cepat nomor tiket / proyek"
          aria-label="Pencarian cepat"
        >
          <Search className="w-4 h-4" />
        </button>

        {/* Desktop User Profile Pill */}
        <div className="hidden sm:flex items-center gap-2.5 px-3 py-1 rounded-xl bg-slate-50 border border-slate-200 max-w-[230px] lg:max-w-xs">
          <div className="w-6 h-6 rounded-lg bg-[#282974] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
            {(session.userName || 'WBP').slice(0, 2).toUpperCase()}
          </div>
          <div className="text-left min-w-0">
            <div className="text-[11px] font-bold text-slate-900 leading-tight flex items-center gap-1 truncate">
              <span className="truncate">{session.userName || session.roleName}</span>
              {session.username && (
                <span className="text-[10px] font-mono text-slate-500 font-normal shrink-0">
                  (@{session.username})
                </span>
              )}
            </div>
            <div className="text-[10px] text-[#282974] font-semibold tracking-tight truncate">
              {session.roleName}
            </div>
          </div>
        </div>

        {/* Desktop Admin User Management Button */}
        {isAdmin && onOpenUserManagement && (
          <button
            type="button"
            onClick={onOpenUserManagement}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#282974] hover:text-white bg-[#282974]/8 hover:bg-[#282974] rounded-xl border border-[#282974]/25 hover:border-[#282974] transition-colors whitespace-nowrap shrink-0"
            title="Kelola Daftar User & Registrasi Akun (Khusus Administrator)"
          >
            <Users className="w-3.5 h-3.5" />
            <span>Kelola User</span>
            {totalUsersCount !== undefined && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#282974] text-white text-[10px] font-mono font-bold">
                {totalUsersCount}
              </span>
            )}
          </button>
        )}

        {/* Desktop Logout Button */}
        <button
          type="button"
          onClick={onOpenLoginModal}
          className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-rose-700 bg-slate-100 hover:bg-rose-50 rounded-xl border border-slate-200 hover:border-rose-200 transition-colors whitespace-nowrap shrink-0"
          title="Keluar dari Aplikasi"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Keluar</span>
        </button>

        {/* Mobile User & Action Dropdown Menu + Direct Logout Button */}
        <div className="flex sm:hidden items-center gap-1.5 relative">
          <button
            type="button"
            onClick={() => setIsMobileUserMenuOpen(prev => !prev)}
            className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-800 transition-colors"
            title="Menu Profil & Aksi"
            aria-expanded={isMobileUserMenuOpen}
          >
            <span className="w-6 h-6 rounded-lg bg-[#282974] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
              {(session.userName || 'WBP').slice(0, 2).toUpperCase()}
            </span>
            <ChevronDown className={`w-3.5 h-3.5 text-slate-500 transition-transform ${isMobileUserMenuOpen ? 'rotate-180' : ''}`} />
          </button>

          <button
            type="button"
            onClick={onOpenLoginModal}
            className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200 transition-colors shrink-0"
            title="Keluar dari Aplikasi"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span>Keluar</span>
          </button>

          {/* Mobile Dropdown Popover */}
          {isMobileUserMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-64 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 space-y-2.5 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#282974]">
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span>Sesi Pengguna Aktif</span>
                </div>
                <div className="text-xs font-bold text-slate-900 truncate">
                  {session.userName || session.roleName}
                </div>
                {session.username && (
                  <div className="text-[11px] font-mono text-slate-500 truncate">
                    @{session.username}
                  </div>
                )}
                <div className="text-[10px] font-semibold text-[#282974] truncate">
                  {session.roleName}
                </div>
              </div>

              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileUserMenuOpen(false);
                    onQuickSearchClick();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors text-left"
                >
                  <Search className="w-4 h-4 text-[#282974] shrink-0" />
                  <span>Pencarian Cepat Tiket</span>
                </button>

                {isAdmin && onOpenUserManagement && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMobileUserMenuOpen(false);
                      onOpenUserManagement();
                    }}
                    className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold text-[#282974] bg-[#282974]/8 hover:bg-[#282974]/15 rounded-xl transition-colors text-left"
                  >
                    <span className="flex items-center gap-2.5">
                      <Users className="w-4 h-4 shrink-0" />
                      <span>Kelola Daftar User</span>
                    </span>
                    {totalUsersCount !== undefined && (
                      <span className="px-1.5 py-0.5 rounded-full bg-[#282974] text-white text-[10px] font-mono font-bold">
                        {totalUsersCount}
                      </span>
                    )}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIsMobileUserMenuOpen(false);
                    onOpenLoginModal();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl border border-rose-200/80 transition-colors text-left"
                >
                  <LogOut className="w-4 h-4 shrink-0" />
                  <span>Keluar dari Aplikasi</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};


