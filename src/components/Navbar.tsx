import React from 'react';
import { LogOut, Search, Menu } from 'lucide-react';
import { UserSession } from '../types';

interface NavbarProps {
  session: UserSession;
  onOpenLoginModal: () => void;
  onOpenGuideModal?: () => void;
  onToggleSidebarMobile: () => void;
  onQuickSearchClick: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  session,
  onOpenLoginModal,
  onToggleSidebarMobile,
  onQuickSearchClick
}) => {
  return (
    <header className="sticky top-0 z-40 flex items-center justify-between gap-6 px-4 sm:px-6 py-3.5 bg-slate-900/90 backdrop-blur-md border-b border-slate-800">
      {/* Zone 1: Mobile Hamburger + Brand Wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={onToggleSidebarMobile}
          className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <a href="/" className="flex items-center gap-2.5 whitespace-nowrap shrink-0 group">
          <div className="w-8 h-8 rounded-lg bg-blue-600 text-white font-black text-xs flex items-center justify-center tracking-tighter shadow-md shadow-blue-900/40 group-hover:bg-blue-500 transition-colors">
            WBP
          </div>
          <span className="text-base font-bold tracking-tight text-white whitespace-nowrap">
            ENGINEERING WBP
          </span>
        </a>
      </div>

      {/* Zone 2: Search Affordance & Status Indicators */}
      <div className="hidden md:flex items-center gap-4 flex-1 max-w-md mx-auto">
        <button
          type="button"
          onClick={onQuickSearchClick}
          className="w-full flex items-center justify-between px-3.5 py-1.5 text-xs text-slate-400 bg-slate-950/70 border border-slate-800 hover:border-slate-700 rounded-xl transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <Search className="w-3.5 h-3.5 text-slate-500" />
            <span>Pencarian cepat nomor tiket / proyek...</span>
          </div>
          <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-slate-500 bg-slate-900 border border-slate-800 rounded">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Zone 3: Active Role Badge + Auth Action */}
      <div className="flex items-center gap-3 shrink-0">
        <div className="hidden sm:flex items-center gap-2">
          <div className="text-right">
            <div className="text-[11px] font-semibold text-white leading-tight">
              {session.roleName}
            </div>
            <div className="text-[10px] text-slate-400 font-medium tracking-tight">
              PT. Waskita Beton Precast, Tbk
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenLoginModal}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-rose-300 bg-slate-800 hover:bg-slate-700/80 rounded-xl border border-slate-700/60 transition-colors whitespace-nowrap shrink-0"
          title="Keluar dari Aplikasi"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Keluar</span>
        </button>
      </div>
    </header>
  );
};
