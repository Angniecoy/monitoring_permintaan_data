import { UserSession } from '../types';

export interface OnlineUserSession {
  id: string;
  fullName: string;
  username: string;
  role: string;
  roleName: string;
  department?: string;
  status: 'ONLINE' | 'ACTIVE';
  lastActiveText: string;
  loginTime: string;
  isSelf?: boolean;
}

const STORAGE_KEY = 'wbp_online_sessions';

const DEFAULT_ACTIVE_USERS: OnlineUserSession[] = [];

export function getStoredOnlineUsers(): OnlineUserSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    }
  } catch (err) {
    console.error('Failed to read online users:', err);
  }
  return DEFAULT_ACTIVE_USERS;
}

export function saveStoredOnlineUsers(users: OnlineUserSession[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(users));
    window.dispatchEvent(new CustomEvent('wbp_online_users_updated'));
  } catch (err) {
    console.error('Failed to save online users:', err);
  }
}

export function registerOnlineUser(session: UserSession): void {
  const current = getStoredOnlineUsers();
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')} WIB`;
  
  const existingIdx = current.findIndex(
    u => u.username.toLowerCase() === (session.username || '').toLowerCase()
  );

  const userEntry: OnlineUserSession = {
    id: session.userId || `usr-${session.username || 'active'}`,
    fullName: session.userName || session.username || 'User WBP',
    username: session.username || 'user',
    role: session.role,
    roleName: session.roleName,
    department: session.department,
    status: 'ONLINE',
    lastActiveText: 'Aktif sekarang',
    loginTime: timeStr,
    isSelf: true
  };

  let updated: OnlineUserSession[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = { ...updated[existingIdx], ...userEntry };
  } else {
    updated = [userEntry, ...current];
  }

  saveStoredOnlineUsers(updated);
}

export function unregisterOnlineUser(username?: string): void {
  if (!username) return;
  const current = getStoredOnlineUsers();
  const filtered = current.filter(
    u => u.username.toLowerCase() !== username.toLowerCase()
  );
  saveStoredOnlineUsers(filtered);
}
