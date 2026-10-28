/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { Sidebar } from './components/Sidebar';
import { WhatsAppModal } from './components/WhatsAppModal';
import { LayoutGuideModal } from './components/LayoutGuideModal';
import { LoginModal } from './components/LoginModal';
import { QuickSearchModal } from './components/QuickSearchModal';
import { TicketDetailModal } from './views/TicketDetailModal';

import { PemberiTugasView } from './views/PemberiTugasView';
import { ManagerView } from './views/ManagerView';
import { StaffView } from './views/StaffView';
import { DashboardView } from './views/DashboardView';
import { DatabaseView } from './views/DatabaseView';

import { Ticket, UserRole, UserSession, WhatsAppNotificationPayload } from './types';
import { getStoredTickets, saveStoredTickets, resetToDefaultTickets } from './data/mockData';
import { BarChart3, Database } from 'lucide-react';

export default function App() {
  // Global Tickets Data
  const [tickets, setTickets] = useState<Ticket[]>(() => getStoredTickets());

  // User Session & Role - Mandatory Protected Login Gate
  const [session, setSession] = useState<UserSession>(() => {
    try {
      const saved = sessionStorage.getItem('wbp_sim_session');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.isLoggedIn) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return {
      isLoggedIn: false,
      role: 'pemberi_tugas',
      roleName: 'Pemberi Tugas (Sales / Proyek)',
      userName: ''
    };
  });

  // Navigation State
  const [activeRole, setActiveRole] = useState<UserRole>('pemberi_tugas');
  const [dashboardSubTab, setDashboardSubTab] = useState<'analytics' | 'database'>('analytics');

  // UI Modals State
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedTicketDetail, setSelectedTicketDetail] = useState<Ticket | null>(null);
  const [whatsAppPayload, setWhatsAppPayload] = useState<WhatsAppNotificationPayload | null>(null);

  // Sync tickets with localStorage
  useEffect(() => {
    saveStoredTickets(tickets);
  }, [tickets]);

  // Keyboard shortcut: Ctrl + K / Cmd + K for Quick Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsQuickSearchOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Handlers for Ticket updates
  const handleAddTicket = (newTicket: Ticket) => {
    setTickets(prev => [newTicket, ...prev]);
  };

  const handleUpdateTicket = (updatedTicket: Ticket) => {
    setTickets(prev => prev.map(t => t.ID_Tiket === updatedTicket.ID_Tiket ? updatedTicket : t));
    if (selectedTicketDetail?.ID_Tiket === updatedTicket.ID_Tiket) {
      setSelectedTicketDetail(updatedTicket);
    }
  };

  const handleResetData = () => {
    if (window.confirm('Apakah Anda yakin ingin mereset seluruh data kembali ke tiket demo awal?')) {
      const reset = resetToDefaultTickets();
      setTickets(reset);
    }
  };

  const handleLoginSuccess = (newSession: UserSession) => {
    setSession(newSession);
    setActiveRole(newSession.role);
    setIsLoginModalOpen(false);
    try {
      sessionStorage.setItem('wbp_sim_session', JSON.stringify(newSession));
    } catch {
      // ignore
    }
  };

  const handleLogout = () => {
    try {
      sessionStorage.removeItem('wbp_sim_session');
    } catch {
      // ignore
    }
    setSession({
      isLoggedIn: false,
      role: 'pemberi_tugas',
      roleName: 'Pemberi Tugas (Sales / Proyek)',
      userName: ''
    });
  };

  // Mandatory Login Gate: If not logged in, render ONLY the Login screen
  if (!session.isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center font-sans selection:bg-blue-600 selection:text-white p-4">
        <LoginModal
          isOpen={true}
          onLoginSuccess={handleLoginSuccess}
          canClose={false}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Bar */}
      <Navbar
        session={session}
        onOpenLoginModal={handleLogout}
        onToggleSidebarMobile={() => setIsMobileSidebarOpen(prev => !prev)}
        onQuickSearchClick={() => setIsQuickSearchOpen(true)}
      />

      {/* Main Layout Area */}
      <div className="flex-1 flex max-w-[1600px] w-full mx-auto">
        {/* Sidebar Nav */}
        <Sidebar
          currentRole={activeRole}
          onSelectRole={(role) => {
            setActiveRole(role);
            if (role === 'dashboard') {
              setDashboardSubTab('analytics');
            }
          }}
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          tickets={tickets}
          onOpenGuideModal={() => setIsGuideModalOpen(true)}
        />

        {/* Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          {/* Dashboard Mode Selector */}
          {activeRole === 'dashboard' && (
            <div className="flex items-center gap-2 mb-6 p-1 bg-slate-900 border border-slate-800 rounded-xl w-fit">
              <button
                type="button"
                onClick={() => setDashboardSubTab('analytics')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                  dashboardSubTab === 'analytics'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Analitik & Grafik KPI</span>
              </button>

              <button
                type="button"
                onClick={() => setDashboardSubTab('database')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                  dashboardSubTab === 'database'
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Database className="w-3.5 h-3.5 text-emerald-400" />
                <span>Basis Data & Rekapitulasi ({tickets.length})</span>
              </button>
            </div>
          )}

          {/* Module 1: Pemberi Tugas (Sales / Proyek) */}
          {activeRole === 'pemberi_tugas' && (
            <PemberiTugasView
              tickets={tickets}
              onAddTicket={handleAddTicket}
              onUpdateTicket={handleUpdateTicket}
              onOpenWhatsApp={setWhatsAppPayload}
              onSelectTicketDetail={setSelectedTicketDetail}
            />
          )}

          {/* Module 2: Manager Engineering (Disposisi) */}
          {activeRole === 'manager' && (
            <ManagerView
              tickets={tickets}
              onUpdateTicket={handleUpdateTicket}
              onOpenWhatsApp={setWhatsAppPayload}
              onSelectTicketDetail={setSelectedTicketDetail}
            />
          )}

          {/* Module 3: Staff Engineering (Eksekutor) */}
          {activeRole === 'staff' && (
            <StaffView
              tickets={tickets}
              onUpdateTicket={handleUpdateTicket}
              onOpenWhatsApp={setWhatsAppPayload}
              onSelectTicketDetail={setSelectedTicketDetail}
            />
          )}

          {/* Module 4: Dashboard Workload & Analitik */}
          {activeRole === 'dashboard' && dashboardSubTab === 'analytics' && (
            <DashboardView
              tickets={tickets}
              onSelectTicketDetail={setSelectedTicketDetail}
            />
          )}

          {/* Module 5: Database & Rekapitulasi */}
          {activeRole === 'dashboard' && dashboardSubTab === 'database' && (
            <DatabaseView
              tickets={tickets}
              onResetData={handleResetData}
              onSelectTicketDetail={setSelectedTicketDetail}
            />
          )}
        </main>
      </div>

      {/* WhatsApp Notification Dispatcher Modal */}
      <WhatsAppModal
        payload={whatsAppPayload}
        onClose={() => setWhatsAppPayload(null)}
      />

      {/* Layout & Architecture Recommendations Modal */}
      <LayoutGuideModal
        isOpen={isGuideModalOpen}
        onClose={() => setIsGuideModalOpen(false)}
      />

      {/* Login & Role Switcher Modal */}
      <LoginModal
        isOpen={isLoginModalOpen}
        onLoginSuccess={handleLoginSuccess}
        onClose={() => setIsLoginModalOpen(false)}
        canClose={session.isLoggedIn}
      />

      {/* Ticket Details Inspector Modal */}
      <TicketDetailModal
        ticket={selectedTicketDetail}
        onClose={() => setSelectedTicketDetail(null)}
        onOpenWhatsApp={setWhatsAppPayload}
      />

      {/* Quick Search Modal (Ctrl + K) */}
      <QuickSearchModal
        isOpen={isQuickSearchOpen}
        onClose={() => setIsQuickSearchOpen(false)}
        tickets={tickets}
        onSelectTicket={setSelectedTicketDetail}
      />
    </div>
  );
}
