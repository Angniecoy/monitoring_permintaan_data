import React from 'react';
import { LogOut, Search, Menu, Users } from 'lucide-react';
import { UserSession } from '../types';
import { isAdminSession } from '../data/mockData';
import { GoogleDriveStatusBanner } from './GoogleDriveStatusBanner';

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
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-4 px-4 sm:px-6 py-3.5 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-2xs">
      {/* Zone 1: Mobile Hamburger + Brand Wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onToggleSidebarMobile}
          className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <a href="/" className="flex items-center gap-2.5 whitespace-nowrap shrink-0 group">
          <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 p-0.5 flex items-center justify-center shadow-2xs overflow-hidden shrink-0">
            <img
              src="/assets/aistudio/logo_perusahaan_91bab227.jfif"
              alt="Logo PT. Waskita Beton Precast, Tbk"
              className="w-full h-full object-contain"
            />
          </div>
          <span className="text-base font-bold tracking-tight text-slate-900 whitespace-nowrap">
            ENGINEERING WBP
          </span>
        </a>
      </div>

      {/* Zone 2: Search Affordance & Status Indicators */}
      <div className="hidden md:flex items-center gap-4 flex-1 max-w-md mx-auto">
        <button
          type="button"
          onClick={onQuickSearchClick}
          className="w-full flex items-center justify-between px-3.5 py-1.5 text-xs text-slate-500 bg-slate-50 border border-slate-200 hover:border-[#282974]/40 hover:bg-slate-100/70 rounded-xl transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-400" />
            <span>Pencarian cepat nomor tiket / proyek...</span>
          </div>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-500 bg-white border border-slate-200 rounded shadow-2xs">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Zone 3: Google Drive Status + Active User Profile + User Management + Logout */}
      <div className="flex items-center gap-2.5 shrink-0">
        <GoogleDriveStatusBanner compact />
        <div className="hidden sm:flex items-center gap-2.5 px-3 py-1 rounded-xl bg-slate-50 border border-slate-200">
          <div className="w-6 h-6 rounded-lg bg-[#282974] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
            {(session.userName || 'WBP').slice(0, 2).toUpperCase()}
          </div>
          <div className="text-left">
            <div className="text-[11px] font-bold text-slate-900 leading-tight flex items-center gap-1">
              <span>{session.userName || session.roleName}</span>
              {session.username && (
                <span className="text-[10px] font-mono text-slate-500 font-normal">
                  (@{session.username})
                </span>
              )}
            </div>
            <div className="text-[10px] text-[#282974] font-semibold tracking-tight">
              {session.roleName}
            </div>
          </div>
        </div>

        {isAdminSession(session) && onOpenUserManagement && (
          <button
            type="button"
            onClick={onOpenUserManagement}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#282974] hover:text-white bg-[#282974]/8 hover:bg-[#282974] rounded-xl border border-[#282974]/25 hover:border-[#282974] transition-colors whitespace-nowrap shrink-0"
            title="Kelola Daftar User & Registrasi Akun (Khusus Administrator)"
          >
            <Users className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Kelola User</span>
            {totalUsersCount !== undefined && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#282974] text-white text-[10px] font-mono font-bold">
                {totalUsersCount}
              </span>
            )}
          </button>
        )}

        <button
          type="button"
          onClick={onOpenLoginModal}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-rose-700 bg-slate-100 hover:bg-rose-50 rounded-xl border border-slate-200 hover:border-rose-200 transition-colors whitespace-nowrap shrink-0"
          title="Keluar dari Aplikasi"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Keluar</span>
        </button>
      </div>
    </header>
  );
};

