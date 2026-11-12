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
  addStoredTicket, updateStoredTicket, deleteStoredTicket,
  fetchCloudTickets, TICKETS_STORAGE_KEY, TICKETS_SYNC_EVENT,
  getStoredUsers, addStoredUser, updateStoredUser, deleteStoredUser,
  resetToDefaultUsers, USERS_STORAGE_KEY, USERS_LOCAL_STORAGE_KEY, isAdminSession,
  pullAndMergeUsersFromDrive, pullAndMergeTicketsFromDrive, fetchCloudUsers
} from './data/mockData';
import { subscribeDriveAuth } from './services/googleDrive';
import { registerOnlineUser, unregisterOnlineUser } from './data/onlineStore';
import { clearAllStoredFiles } from './data/fileStore';
import { BarChart3, Database } from 'lucide-react';

export default function App() {
  // Global Tickets Data
  const [tickets, setTickets] = useState<Ticket[]>(() => getStoredTickets());

  // Global Registered Users Data (Centralized Cloud JSON + Google Drive 1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF)
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

  // Sync tickets with localStorage without recursive event loop
  useEffect(() => {
    saveStoredTickets(tickets, false);
  }, [tickets]);

  // Continuously pull centralized cloud users and tickets across all tabs/sessions/devices
  useEffect(() => {
    void fetchCloudUsers(false).then((cloudList) => {
      setUsers(cloudList);
    });
    void fetchCloudTickets().then((cloudTickets) => {
      setTickets((prev) =>
        JSON.stringify(prev) === JSON.stringify(cloudTickets) ? prev : cloudTickets
      );
    });
    const interval = setInterval(() => {
      void fetchCloudUsers(false).then((cloudList) => {
        setUsers((prev) =>
          JSON.stringify(prev) === JSON.stringify(cloudList) ? prev : cloudList
        );
      });
      void fetchCloudTickets().then((cloudTickets) => {
        setTickets((prev) =>
          JSON.stringify(prev) === JSON.stringify(cloudTickets) ? prev : cloudTickets
        );
      });
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  // Automatically pull & merge users and tickets from Google Drive folder 1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF when Drive is connected
  useEffect(() => {
    let wasConnected = false;
    const unsubscribe = subscribeDriveAuth((state) => {
      if (state.isConnected && !wasConnected) {
        wasConnected = true;
        void pullAndMergeUsersFromDrive().then((mergedUsers) => {
          setUsers(mergedUsers);
        });
        void pullAndMergeTicketsFromDrive().then((mergedTickets) => {
          setTickets(mergedTickets);
        });
      } else if (!state.isConnected) {
        wasConnected = false;
      }
    });
    return unsubscribe;
  }, []);

  // Listen for real-time user and ticket updates from cloud store & cross-tab storage events
  useEffect(() => {
    const syncUsersFromCloudStore = (e?: Event) => {
      if (e && 'key' in e) {
        const storageEvent = e as StorageEvent;
        if (
          storageEvent.key &&
          storageEvent.key !== USERS_STORAGE_KEY &&
          storageEvent.key !== USERS_LOCAL_STORAGE_KEY
        ) {
          return;
        }
      }
      const latest = getStoredUsers();
      setUsers(prev => {
        if (JSON.stringify(prev) === JSON.stringify(latest)) return prev;
        return latest;
      });
    };

    const syncTicketsFromStore = (e?: Event) => {
      if (e && 'key' in e) {
        const storageEvent = e as StorageEvent;
        if (storageEvent.key && storageEvent.key !== TICKETS_STORAGE_KEY) return;
      }
      const latestTickets = getStoredTickets();
      setTickets(prev => {
        if (JSON.stringify(prev) === JSON.stringify(latestTickets)) return prev;
        return latestTickets;
      });
    };

    window.addEventListener('wbp_users_updated', syncUsersFromCloudStore);
    window.addEventListener('storage', syncUsersFromCloudStore);
    window.addEventListener(TICKETS_SYNC_EVENT, syncTicketsFromStore);
    window.addEventListener('storage', syncTicketsFromStore);
    return () => {
      window.removeEventListener('wbp_users_updated', syncUsersFromCloudStore);
      window.removeEventListener('storage', syncUsersFromCloudStore);
      window.removeEventListener(TICKETS_SYNC_EVENT, syncTicketsFromStore);
      window.removeEventListener('storage', syncTicketsFromStore);
    };
  }, []);

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

  // Handlers for Ticket updates (persists to localStorage + Cloud Firestore + /api/tickets + Google Drive)
  const handleAddTicket = (newTicket: Ticket) => {
    const updated = addStoredTicket(newTicket);
    setTickets(updated);
  };

  const handleUpdateTicket = (updatedTicket: Ticket) => {
    const updated = updateStoredTicket(updatedTicket);
    setTickets(updated);
    if (selectedTicketDetail?.ID_Tiket === updatedTicket.ID_Tiket) {
      setSelectedTicketDetail(updatedTicket);
    }
  };

  // Strictly Admin-authorized Ticket Deletion handler
  const handleDeleteTicket = (ticketId: string) => {
    if (!isAdminSession(session)) return;
    const updated = deleteStoredTicket(ticketId);
    setTickets(updated);
    if (selectedTicketDetail?.ID_Tiket === ticketId) {
      setSelectedTicketDetail(null);
    }
  };

  const handleResetData = () => {
    try {
      clearAllStoredFiles();
      localStorage.clear();
    } catch {
      // ignore storage errors
    }
    const resetTickets = resetToDefaultTickets();
    const resetUsers = resetToDefaultUsers();
    setTickets(resetTickets);
    setUsers(resetUsers);
    setSelectedTicketDetail(null);
    setWhatsAppPayload(null);
    window.location.reload();
  };

  // Handlers for Dynamic User Registration & Management (Google Drive + localStorage Persistence)
  const handleRegisterUser = (newUser: Omit<UserAccount, 'id' | 'createdAt'>): UserAccount => {
    const { created, users: updatedList } = addStoredUser(newUser);
    setUsers(updatedList);
    return created;
  };

  const handleUpdateUser = (updatedUser: UserAccount) => {
    const updatedList = updateStoredUser(updatedUser);
    setUsers(updatedList);
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
    const updatedList = deleteStoredUser(userId);
    setUsers(updatedList);
  };

  const handleResetUsers = () => {
    const defaults = resetToDefaultUsers();
    setUsers(defaults);
  };

  const handleLoginSuccess = (newSession: UserSession) => {
    setUsers(getStoredUsers());
    setTickets(getStoredTickets());
    void pullAndMergeUsersFromDrive().then((merged) => {
      setUsers(merged);
    });
    void fetchCloudTickets().then((cloudTickets) => {
      setTickets(cloudTickets);
    });
    setSession(newSession);
    setActiveRole(newSession.role);
    setIsLoginModalOpen(false);
    registerOnlineUser(newSession);
    try {
      sessionStorage.setItem('wbp_sim_session', JSON.stringify(newSession));
    } catch {
      // ignore
    }
  };

  const handleLogout = () => {
    unregisterOnlineUser(session.username);
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

  // Sync active online status and ensure session userName + whatsapp + department stay enriched from users list
  useEffect(() => {
    if (session.isLoggedIn && session.username) {
      registerOnlineUser(session);
    }
    if (session.isLoggedIn && users.length > 0) {
      const matched = users.find(
        u =>
          (session.userId && u.id === session.userId) ||
          (session.username && u.username.toLowerCase() === session.username.toLowerCase()) ||
          (session.userName && u.fullName.toLowerCase() === session.userName.toLowerCase())
      );
      if (
        matched &&
        ((matched.fullName && session.userName !== matched.fullName) ||
          (matched.whatsapp && session.whatsapp !== matched.whatsapp) ||
          (matched.department && session.department !== matched.department))
      ) {
        const enrichedSession: UserSession = {
          ...session,
          userId: matched.id,
          username: matched.username,
          userName: matched.fullName || session.userName,
          whatsapp: matched.whatsapp || session.whatsapp,
          department: matched.department || session.department
        };
        setSession(enrichedSession);
        try {
          sessionStorage.setItem('wbp_sim_session', JSON.stringify(enrichedSession));
        } catch {
          // ignore
        }
      }
    }
  }, [session, users]);

  // Mandatory Login Gate: If not logged in, render ONLY the Full-Screen Login & Registration view
  if (!session.isLoggedIn) {
    return (
      <div className="min-h-screen w-full bg-slate-900 text-slate-900 font-sans selection:bg-[#282974] selection:text-white">
        <LoginModal
          isOpen={true}
          users={users}
          tickets={tickets}
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
    <div className="h-[100dvh] w-full max-w-full overflow-hidden bg-slate-50 text-slate-900 flex flex-col font-sans selection:bg-[#282974] selection:text-white">
      {/* Top Bar (Fixed at Top of App Shell) */}
      <Navbar
        session={session}
        onOpenLoginModal={handleLogout}
        onOpenUserManagement={
          isAdminSession(session)
            ? () => {
                setUsers(getStoredUsers());
                void pullAndMergeUsersFromDrive().then((merged) => {
                  setUsers(merged);
                });
                setLoginModalInitialTab('manage');
                setIsLoginModalOpen(true);
              }
            : undefined
        }
        onToggleSidebarMobile={() => setIsMobileSidebarOpen(prev => !prev)}
        onQuickSearchClick={() => setIsQuickSearchOpen(true)}
        totalUsersCount={users.length}
      />

      {/* Main Layout Area (Fixed Sidebar + Independently Scrollable Right Content Panel) */}
      <div className="flex-1 flex min-h-0 min-w-0 overflow-hidden max-w-[1600px] w-full mx-auto relative">
        {/* Fixed Left Sidebar Nav */}
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
          onLogout={handleLogout}
          onOpenUserManagement={
            isAdminSession(session)
              ? () => {
                  setUsers(getStoredUsers());
                  void pullAndMergeUsersFromDrive().then((merged) => {
                    setUsers(merged);
                  });
                  setLoginModalInitialTab('manage');
                  setIsLoginModalOpen(true);
                }
              : undefined
          }
        />

        {/* Independently Scrollable Right Content Viewport */}
        <main className="flex-1 min-w-0 w-full max-w-full h-full overflow-y-auto overflow-x-hidden p-3 sm:p-6 lg:p-8">
          {/* Dashboard Mode Selector - STRICTLY EXCLUSIVE to dashboard role */}
          {session.role === 'dashboard' && (
            <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-1.5 sm:gap-2 mb-4 sm:mb-6 p-1.5 bg-white border border-slate-200 rounded-xl w-full sm:w-fit shadow-xs">
              <button
                type="button"
                onClick={() => setDashboardSubTab('analytics')}
                className={`flex items-center justify-center sm:justify-start gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all truncate ${
                  dashboardSubTab === 'analytics'
                    ? 'bg-[#282974] text-white shadow-sm shadow-[#282974]/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">Analitik & Grafik KPI</span>
              </button>

              <button
                type="button"
                onClick={() => setDashboardSubTab('database')}
                className={`flex items-center justify-center sm:justify-start gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all truncate ${
                  dashboardSubTab === 'database'
                    ? 'bg-[#282974] text-white shadow-sm shadow-[#282974]/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Database className={`w-3.5 h-3.5 shrink-0 ${dashboardSubTab === 'database' ? 'text-white' : 'text-emerald-600'}`} />
                <span className="truncate">Basis Data & Rekapitulasi ({tickets.length})</span>
              </button>
            </div>
          )}

          {/* Module: Pemberi Tugas (Sales / Proyek) - STRICT RBAC */}
          {session.role === 'pemberi_tugas' && (
            <PemberiTugasView
              key={session.userId || session.userName}
              tickets={tickets}
              session={session}
              users={users}
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
              isAdmin={isAdminSession(session)}
              onDeleteTicket={isAdminSession(session) ? handleDeleteTicket : undefined}
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
        tickets={tickets}
        onLoginSuccess={handleLoginSuccess}
        onRegisterUser={handleRegisterUser}
        onUpdateUser={handleUpdateUser}
        onDeleteUser={handleDeleteUser}
        onResetUsers={handleResetUsers}
        onClose={() => setIsLoginModalOpen(false)}
        canClose={session.isLoggedIn}
        isAdmin={isAdminSession(session)}
        initialTab={isAdminSession(session) ? loginModalInitialTab : 'login'}
      />

      {/* Ticket Details Inspector Modal */}
      <TicketDetailModal
        ticket={selectedTicketDetail}
        onClose={() => setSelectedTicketDetail(null)}
        onOpenWhatsApp={setWhatsAppPayload}
        isAdmin={isAdminSession(session)}
        onDeleteTicket={isAdminSession(session) ? handleDeleteTicket : undefined}
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

