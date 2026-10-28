import React from 'react';
import { 
  FileEdit, Briefcase, Wrench, BarChart3, Database, 
  HelpCircle, ChevronRight, X, Building, CheckCircle2, Clock
} from 'lucide-react';
import { Ticket, UserRole } from '../types';

interface SidebarProps {
  currentRole: UserRole;
  onSelectRole: (role: UserRole) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  tickets: Ticket[];
  onOpenGuideModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentRole,
  onSelectRole,
  isOpenMobile,
  onCloseMobile,
  tickets,
  onOpenGuideModal
}) => {
  const openCount = tickets.filter(t => t.Status_Pengerjaan === 'OPEN').length;
  const inProgressCount = tickets.filter(t => ['DISPOSISI', 'PROSES'].includes(t.Status_Pengerjaan)).length;
  const closedCount = tickets.filter(t => t.Status_Pengerjaan === 'CLOSED (Selesai)').length;

  const navItems: {
    id: UserRole;
    label: string;
    sublabel: string;
    icon: React.ElementType;
    badgeCount?: number;
    badgeColor?: string;
  }[] = [
    {
      id: 'pemberi_tugas',
      label: 'Pemberi Tugas',
      sublabel: 'Sales & Tim Proyek',
      icon: FileEdit,
    },
    {
      id: 'manager',
      label: 'Manager Disposisi',
      sublabel: 'Delegasi & Penugasan',
      icon: Briefcase,
      badgeCount: openCount,
      badgeColor: 'bg-amber-500 text-slate-950',
    },
    {
      id: 'staff',
      label: 'Staff Eksekutor',
      sublabel: 'Kalkulasi & Drawing',
      icon: Wrench,
      badgeCount: inProgressCount,
      badgeColor: 'bg-sky-500 text-slate-950',
    },
    {
      id: 'dashboard',
      label: 'Dashboard Analitik',
      sublabel: 'Tren & Workload Tim',
      icon: BarChart3,
    },
  ];

  const handleNavClick = (role: UserRole) => {
    onSelectRole(role);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:sticky top-0 lg:top-[57px] left-0 z-40 w-64 h-screen lg:h-[calc(100vh-57px)] bg-slate-900 border-r border-slate-800 flex flex-col justify-between transition-transform duration-200 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        }`}
      >
        <div className="p-4 space-y-5 overflow-y-auto">
          {/* Mobile Header with close button */}
          <div className="flex items-center justify-between pb-2 border-b border-slate-800 lg:hidden">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded bg-blue-600 text-white font-black text-xs flex items-center justify-center">
                WBP
              </div>
              <span className="font-bold text-xs text-white">SIM-Teknis</span>
            </div>
            <button
              onClick={onCloseMobile}
              className="p-1 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Items */}
          <div className="space-y-1">
            <div className="text-[10px] font-bold tracking-widest text-slate-500 uppercase px-3 mb-2">
              Modul Alur Kerja
            </div>
            {navItems.map(item => {
              const isActive = currentRole === item.id;
              const Icon = item.icon;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all group ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/40'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-400'}`} />
                    <div className="truncate">
                      <div className="text-xs font-semibold truncate leading-tight">
                        {item.label}
                      </div>
                      <div className={`text-[10px] truncate ${isActive ? 'text-blue-200' : 'text-slate-500'}`}>
                        {item.sublabel}
                      </div>
                    </div>
                  </div>

                  {item.badgeCount !== undefined && item.badgeCount > 0 && (
                    <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono font-bold shrink-0 ${item.badgeColor}`}>
                      {item.badgeCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Database & Archive Navigation Item */}
          <div className="pt-2 border-t border-slate-800">
            <div className="text-[10px] font-bold tracking-widest text-slate-500 uppercase px-3 mb-2">
              Sistem Basis Data
            </div>
            {/* Custom role trigger or link */}
            <button
              type="button"
              onClick={() => handleNavClick('dashboard')}
              className="w-full flex items-center justify-between px-3 py-2 text-xs text-slate-400 hover:text-white hover:bg-slate-800/60 rounded-xl transition-colors"
            >
              <div className="flex items-center gap-3">
                <Database className="w-4 h-4 text-emerald-400" />
                <span>Basis Data & Rekap</span>
              </div>
              <span className="text-[10px] font-mono text-slate-500">
                {tickets.length} Data
              </span>
            </button>
          </div>

          {/* Quick Metrics Badge Widget */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
              <span>Ringkasan Tiket</span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>

            <div className="grid grid-cols-3 gap-1.5 text-center pt-1">
              <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-xs font-mono font-bold text-amber-300">{openCount}</div>
                <div className="text-[9px] text-slate-400">OPEN</div>
              </div>
              <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-xs font-mono font-bold text-sky-400">{inProgressCount}</div>
                <div className="text-[9px] text-slate-400">PROSES</div>
              </div>
              <div className="p-1.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-xs font-mono font-bold text-emerald-400">{closedCount}</div>
                <div className="text-[9px] text-slate-400">CLOSED</div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer info in sidebar */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-950/60 rounded-b-2xl text-[11px]">
          <div className="flex items-center gap-2 mb-1">
            <Building className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span className="text-xs font-semibold text-white tracking-wide">Dept. Engineering</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-snug">
            PT Waskita Beton Precast, Tbk · ISO 9001, 14001 & 45001
          </p>
        </div>
      </aside>
    </>
  );
};
