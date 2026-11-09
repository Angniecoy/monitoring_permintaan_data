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

import { Ticket, UserAccount, UserRole, UserSession, WhatsAppNotificationPayload } from './types';
import { 
  getStoredTickets, saveStoredTickets, resetToDefaultTickets,
  getStoredUsers, saveStoredUsers, resetToDefaultUsers, formatCurrentDateTime
} from './data/mockData';
import { BarChart3, Database } from 'lucide-react';

export default function App() {
  // Global Tickets Data
  const [tickets, setTickets] = useState<Ticket[]>(() => getStoredTickets());

  // Global Registered Users Data (Dynamic Multi-User State)
  const [users, setUsers] = useState<UserAccount[]>(() => getStoredUsers());

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
  const [loginModalInitialTab, setLoginModalInitialTab] = useState<'login' | 'register' | 'manage'>('login');
  const [isGuideModalOpen, setIsGuideModalOpen] = useState(false);
  const [isQuickSearchOpen, setIsQuickSearchOpen] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedTicketDetail, setSelectedTicketDetail] = useState<Ticket | null>(null);
  const [whatsAppPayload, setWhatsAppPayload] = useState<WhatsAppNotificationPayload | null>(null);

  // Sync tickets with localStorage
  useEffect(() => {
    saveStoredTickets(tickets);
  }, [tickets]);

  // Sync registered users with localStorage
  useEffect(() => {
    saveStoredUsers(users);
  }, [users]);

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

  // Handlers for Dynamic User Registration & Management
  const handleRegisterUser = (newUser: Omit<UserAccount, 'id' | 'createdAt'>): UserAccount => {
    const created: UserAccount = {
      ...newUser,
      id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: formatCurrentDateTime()
    };
    setUsers(prev => [created, ...prev]);
    return created;
  };

  const handleUpdateUser = (updatedUser: UserAccount) => {
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    // If updating the currently logged-in user, sync their session details
    if (session.userId === updatedUser.id) {
      const updatedSession: UserSession = {
        ...session,
        username: updatedUser.username,
        userName: updatedUser.fullName,
        role: updatedUser.role,
        roleName: updatedUser.roleName,
        department: updatedUser.department,
        staffName: updatedUser.role === 'staff' ? updatedUser.fullName : undefined,
        whatsapp: updatedUser.whatsapp
      };
      setSession(updatedSession);
      setActiveRole(updatedSession.role);
      try {
        sessionStorage.setItem('wbp_sim_session', JSON.stringify(updatedSession));
      } catch {
        // ignore
      }
    }
  };

  const handleDeleteUser = (userId: string) => {
    setUsers(prev => prev.filter(u => u.id !== userId));
  };

  const handleResetUsers = () => {
    const defaults = resetToDefaultUsers();
    setUsers(defaults);
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

  // Mandatory Login Gate: If not logged in, render ONLY the Login & Registration screen
  if (!session.isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900 flex items-center justify-center font-sans selection:bg-blue-600 selection:text-white p-4">
        <LoginModal
          isOpen={true}
          users={users}
          onLoginSuccess={handleLoginSuccess}
          onRegisterUser={handleRegisterUser}
          onUpdateUser={handleUpdateUser}
          onDeleteUser={handleDeleteUser}
          onResetUsers={handleResetUsers}
          canClose={false}
          initialTab="login"
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Top Bar */}
      <Navbar
        session={session}
        onOpenLoginModal={handleLogout}
        onOpenUserManagement={() => {
          setLoginModalInitialTab('manage');
          setIsLoginModalOpen(true);
        }}
        onToggleSidebarMobile={() => setIsMobileSidebarOpen(prev => !prev)}
        onQuickSearchClick={() => setIsQuickSearchOpen(true)}
        totalUsersCount={users.length}
      />

      {/* Main Layout Area */}
      <div className="flex-1 flex max-w-[1600px] w-full mx-auto">
        {/* Sidebar Nav */}
        <Sidebar
          currentRole={session.role}
          userRole={session.role}
          session={session}
          onSelectRole={(role) => {
            if (role === session.role) {
              setActiveRole(role);
              if (role === 'dashboard') {
                setDashboardSubTab('analytics');
              }
            }
          }}
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          tickets={tickets}
        />

        {/* Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          {/* Dashboard Mode Selector - STRICTLY EXCLUSIVE to dashboard role */}
          {session.role === 'dashboard' && (
            <div className="flex items-center gap-2 mb-6 p-1 bg-white border border-slate-200 rounded-xl w-fit shadow-xs">
              <button
                type="button"
                onClick={() => setDashboardSubTab('analytics')}
                className={`flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                  dashboardSubTab === 'analytics'
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
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
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Database className={`w-3.5 h-3.5 ${dashboardSubTab === 'database' ? 'text-white' : 'text-emerald-600'}`} />
                <span>Basis Data & Rekapitulasi ({tickets.length})</span>
              </button>
            </div>
          )}

          {/* Module: Pemberi Tugas (Sales / Proyek) - STRICT RBAC */}
          {session.role === 'pemberi_tugas' && (
            <PemberiTugasView
              key={session.userId || session.userName}
              tickets={tickets}
              session={session}
              onAddTicket={handleAddTicket}
              onUpdateTicket={handleUpdateTicket}
              onOpenWhatsApp={setWhatsAppPayload}
              onSelectTicketDetail={setSelectedTicketDetail}
            />
          )}

          {/* Module: Manager Engineering (Disposisi) - STRICT RBAC */}
          {session.role === 'manager' && (
            <ManagerView
              key={session.userId || session.userName}
              tickets={tickets}
              session={session}
              users={users}
              onUpdateTicket={handleUpdateTicket}
              onOpenWhatsApp={setWhatsAppPayload}
              onSelectTicketDetail={setSelectedTicketDetail}
            />
          )}

          {/* Module: Staff Engineering (Eksekutor) - STRICT RBAC */}
          {session.role === 'staff' && (
            <StaffView
              key={session.userId || session.userName}
              tickets={tickets}
              session={session}
              users={users}
              onUpdateTicket={handleUpdateTicket}
              onOpenWhatsApp={setWhatsAppPayload}
              onSelectTicketDetail={setSelectedTicketDetail}
            />
          )}

          {/* Module: Dashboard Workload & Analitik - STRICT RBAC */}
          {session.role === 'dashboard' && dashboardSubTab === 'analytics' && (
            <DashboardView
              tickets={tickets}
              onSelectTicketDetail={setSelectedTicketDetail}
            />
          )}

          {/* Module: Database & Rekapitulasi - STRICT RBAC */}
          {session.role === 'dashboard' && dashboardSubTab === 'database' && (
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

      {/* Login, Registration & User Management Modal */}
      <LoginModal
        key={loginModalInitialTab + String(isLoginModalOpen)}
        isOpen={isLoginModalOpen}
        users={users}
        onLoginSuccess={handleLoginSuccess}
        onRegisterUser={handleRegisterUser}
        onUpdateUser={handleUpdateUser}
        onDeleteUser={handleDeleteUser}
        onResetUsers={handleResetUsers}
        onClose={() => setIsLoginModalOpen(false)}
        canClose={session.isLoggedIn}
        initialTab={loginModalInitialTab}
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

