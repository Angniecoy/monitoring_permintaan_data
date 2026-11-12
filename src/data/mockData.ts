import { DepartmentName, DepartmentStructure, Ticket, UserAccount, UserRole, UserSession } from '../types';
import {
  getAccessToken,
  writeUserRegistrationToDrive,
  pushUsersDatabaseToDrive,
  syncUsersFromDriveFolder,
  syncTicketsWithDriveFolder,
  GOOGLE_DRIVE_FOLDER_ID,
  DRIVE_PERMINTAAN_FOLDER_ID,
  DRIVE_JAWABAN_FOLDER_ID,
  DEFAULT_GAS_WEB_APP_URL,
  normalizeGasWebAppUrl,
  upsertUserToCloudFirestore,
  deleteUserFromCloudFirestore,
  resetUsersInCloudFirestore,
  saveGasConfigToCloudFirestore,
  fetchUsersFromCloudFirestore,
  subscribeCloudFirestoreUsers,
  pushUsersToGasEndpoint,
  pullUsersFromGasEndpoint,
  upsertTicketToCloudFirestore,
  deleteTicketFromCloudFirestore,
  resetTicketsInCloudFirestore,
  fetchTicketsFromCloudFirestore,
  subscribeCloudFirestoreTickets
} from '../services/googleDrive';

export const ROLE_LABELS: Record<UserRole, string> = {
  pemberi_tugas: 'Pemberi Tugas (Sales / Proyek)',
  manager: 'Manager Engineering (Disposisi)',
  staff: 'Staff Engineering (Eksekutor)',
  dashboard: 'Administrator / Dashboard & Analitik'
};

export function getRoleDisplayName(role: UserRole): string {
  return ROLE_LABELS[role] || 'Pemberi Tugas (Sales / Proyek)';
}

/**
 * Checks whether the currently active session has full Administrator privileges.
 * Non-admin roles (Staff Engineering, Manager Engineering, Pemberi Tugas / Sales) return false.
 */
export function isAdminSession(session?: UserSession | null): boolean {
  if (!session || !session.isLoggedIn) return false;
  if (session.isAdmin === true) return true;
  const uname = (session.username || '').trim().toLowerCase();
  if (uname === 'admin' || uname === 'administrator') return true;
  if (session.role === 'dashboard' || (session.role as string) === 'admin') return true;
  return false;
}

export const INITIAL_USERS: UserAccount[] = [];

export const STRUKTUR_ORG: Record<DepartmentName, DepartmentStructure> = {
  "Engineering Precast": {
    Manager: "",
    WA_Manager: "",
    Staff: {}
  },
  "Engineering Readymix": {
    Manager: "",
    WA_Manager: "",
    Staff: {}
  },
  "Engineering Konstruksi": {
    Manager: "",
    WA_Manager: "",
    Staff: {}
  }
};

export const INITIAL_TICKETS: Ticket[] = [];

const STORAGE_KEY = 'wbp_sim_teknis_tickets_v2_zero';
export const TICKETS_STORAGE_KEY = STORAGE_KEY;
export const TICKETS_SYNC_EVENT = 'wbp_tickets_updated';
export const USERS_STORAGE_KEY = 'wbp_cloud_users_sync_event';
export const USERS_LOCAL_STORAGE_KEY = 'wbp_sim_teknis_users_v3_permanent';
export const DELETED_USERS_LOCAL_STORAGE_KEY = 'wbp_sim_teknis_deleted_users_v3_permanent';

function readInitialUsersFromLocalStorage(): UserAccount[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(USERS_LOCAL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    }
  } catch {
    // ignore
  }
  return [...INITIAL_USERS];
}

function readInitialDeletedUsersFromLocalStorage(): string[] {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(DELETED_USERS_LOCAL_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((u) => String(u).toLowerCase());
        }
      }
    }
  } catch {
    // ignore
  }
  return [];
}

// In-memory runtime cache synchronized with localStorage + Cloud Firestore + Google Apps Script + Centralized Backend (/api/users) + Google Drive folder 1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF
let cloudUsersMemoryStore: UserAccount[] = readInitialUsersFromLocalStorage();
let cloudDeletedUsernamesStore: string[] = readInitialDeletedUsersFromLocalStorage();
let cloudGasWebAppUrlStore = DEFAULT_GAS_WEB_APP_URL;

// In-memory runtime cache for tickets synchronized with localStorage + Cloud Firestore + /api/tickets
let cloudDeletedTicketIdsStore: string[] = [];
const recentLocalTicketMutations = new Map<string, { ticket: Ticket; expiresAt: number }>();

// Protects newly registered/updated users against stale in-flight poll overwrites for 45 seconds
const recentLocalUserMutations = new Map<string, { user: UserAccount; expiresAt: number }>();
// Tracks which custom usernames have already been mirrored to Google Drive in this session
const mirroredToDriveUsernames = new Set<string>();

export function getDeletedUsernames(): string[] {
  return [...cloudDeletedUsernamesStore];
}

export function saveDeletedUsernames(usernames: string[]): void {
  cloudDeletedUsernamesStore = Array.from(
    new Set(usernames.map((u) => u.toLowerCase()))
  );
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(
        DELETED_USERS_LOCAL_STORAGE_KEY,
        JSON.stringify(cloudDeletedUsernamesStore)
      );
    }
  } catch {
    // ignore
  }
}

export function getGasWebAppUrl(): string {
  return normalizeGasWebAppUrl(cloudGasWebAppUrlStore);
}

export const GAS_BACKEND_SCRIPT_TEMPLATE = `/**
 * GOOGLE APPS SCRIPT BACKEND - PT. WASKITA BETON PRECAST TBK
 * Endpoint Web App Aktif: ${DEFAULT_GAS_WEB_APP_URL}
 * Pemisahan Direktori Permanen Google Drive:
 * 1. Database Akun & User         : ${GOOGLE_DRIVE_FOLDER_ID}
 * 2. Lampiran 'Permintaan'        : ${DRIVE_PERMINTAAN_FOLDER_ID}
 * 3. Lampiran 'Jawaban Atas Permintaan' : ${DRIVE_JAWABAN_FOLDER_ID}
 * Cara Pakai: Buka script.google.com -> Proyek Baru -> Tempel kode ini -> Deploy sebagai Web App (Who has access: Anyone)
 */
const FOLDER_ID = '${GOOGLE_DRIVE_FOLDER_ID}';
const PERMINTAAN_FOLDER_ID = '${DRIVE_PERMINTAAN_FOLDER_ID}';
const JAWABAN_FOLDER_ID = '${DRIVE_JAWABAN_FOLDER_ID}';
const DB_FILENAME = 'wbp_users_database.json';

function resolveUploadFolderId(category, explicitFolderId) {
  const normalized = String(category || explicitFolderId || '').trim().toLowerCase();
  if (
    normalized === 'jawaban_atas_permintaan' ||
    normalized === 'jawaban atas permintaan' ||
    normalized === 'jawaban' ||
    normalized === 'hasil' ||
    normalized === JAWABAN_FOLDER_ID.toLowerCase()
  ) {
    return {
      folderId: JAWABAN_FOLDER_ID,
      category: 'Jawaban Atas Permintaan'
    };
  }
  return {
    folderId: PERMINTAAN_FOLDER_ID,
    category: 'Permintaan'
  };
}

function doGet(e) {
  const folder = DriveApp.getFolderById(FOLDER_ID);
  const files = folder.getFilesByName(DB_FILENAME);
  let db = {
    folderId: FOLDER_ID,
    permintaanFolderId: PERMINTAAN_FOLDER_ID,
    jawabanFolderId: JAWABAN_FOLDER_ID,
    users: [],
    deletedUsernames: []
  };
  if (files.hasNext()) {
    db = JSON.parse(files.next().getBlob().getDataAsString());
  }
  return ContentService.createTextOutput(JSON.stringify(db))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
  const params = (e && e.parameter) || {};

  // 1. Handler Upload File Terpisah ('Permintaan' vs 'Jawaban Atas Permintaan')
  const fileName = payload.fileName || payload.name || params.fileName;
  const base64Data = payload.base64Data || payload.data;
  if ((payload.action === 'uploadFile' || params.action === 'uploadFile' || base64Data) && fileName && base64Data) {
    const rawCategory =
      payload.category ||
      payload.kategori ||
      payload.categoryKey ||
      payload.jenis ||
      params.category ||
      params.kategori ||
      params.categoryKey;
    const rawFolderId = payload.folderId || payload.targetFolderId || params.folderId;
    const target = resolveUploadFolderId(rawCategory, rawFolderId);
    const uploadFolder = DriveApp.getFolderById(target.folderId);
    const decodedBytes = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(
      decodedBytes,
      payload.mimeType || 'application/octet-stream',
      fileName
    );
    const createdFile = uploadFolder.createFile(blob);
    createdFile.setDescription(
      'Kategori: ' + target.category + (payload.ticketId ? ' | Tiket: ' + payload.ticketId : '')
    );
    const fileId = createdFile.getId();
    return ContentService.createTextOutput(JSON.stringify({
      ok: true,
      id: fileId,
      fileId: fileId,
      name: createdFile.getName(),
      category: target.category,
      folderId: target.folderId,
      webViewLink: 'https://drive.google.com/file/d/' + fileId + '/view?usp=sharing',
      downloadUrl: 'https://drive.google.com/uc?export=download&id=' + fileId
    })).setMimeType(ContentService.MimeType.JSON);
  }

  const folder = DriveApp.getFolderById(FOLDER_ID);

  // 2. Simpan berkas catatan JSON individu untuk user baru (WBP_USER_<username>.json)
  if (payload.user && payload.user.username) {
    const singleName = 'WBP_USER_' + payload.user.username.toLowerCase() + '.json';
    const existingSingle = folder.getFilesByName(singleName);
    const singleContent = JSON.stringify({
      type: 'WBP_USER_REGISTRATION_RECORD',
      folderId: FOLDER_ID,
      registeredAt: new Date().toISOString(),
      user: payload.user
    }, null, 2);
    if (existingSingle.hasNext()) {
      existingSingle.next().setContent(singleContent);
    } else {
      folder.createFile(singleName, singleContent, MimeType.PLAIN_TEXT);
    }
  }

  // 3. Simpan basis data utama (wbp_users_database.json)
  if (Array.isArray(payload.users)) {
    const dbFiles = folder.getFilesByName(DB_FILENAME);
    const dbContent = JSON.stringify({
      type: 'WBP_USERS_DATABASE',
      folderId: FOLDER_ID,
      updatedAt: new Date().toISOString(),
      deletedUsernames: payload.deletedUsernames || [],
      users: payload.users
    }, null, 2);
    if (dbFiles.hasNext()) {
      dbFiles.next().setContent(dbContent);
    } else {
      folder.createFile(DB_FILENAME, dbContent, MimeType.PLAIN_TEXT);
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    ok: true,
    folderId: FOLDER_ID,
    permintaanFolderId: PERMINTAAN_FOLDER_ID,
    jawabanFolderId: JAWABAN_FOLDER_ID
  })).setMimeType(ContentService.MimeType.JSON);
}`;

export function getDeletedTicketIds(): string[] {
  return [...cloudDeletedTicketIdsStore];
}

export function saveDeletedTicketIds(ticketIds: string[]): void {
  cloudDeletedTicketIdsStore = Array.from(new Set(ticketIds.filter(Boolean)));
}

function mergeTicketsWithRecentMutations(
  incomingTickets: Ticket[],
  deletedIds: string[] = []
): Ticket[] {
  const now = Date.now();
  for (const [k, v] of recentLocalTicketMutations.entries()) {
    if (v.expiresAt <= now) {
      recentLocalTicketMutations.delete(k);
    }
  }

  const deletedSet = new Set(deletedIds);
  const map = new Map<string, Ticket>();

  // 1. Recent local ticket creations/updates take highest priority
  for (const [k, v] of recentLocalTicketMutations.entries()) {
    if (!deletedSet.has(k)) {
      map.set(k, v.ticket);
    }
  }

  // 2. Incoming cloud / storage tickets
  for (const t of incomingTickets) {
    if (!t || !t.ID_Tiket) continue;
    if (deletedSet.has(t.ID_Tiket)) continue;
    if (!map.has(t.ID_Tiket)) {
      map.set(t.ID_Tiket, t);
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    b.ID_Tiket.localeCompare(a.ID_Tiket)
  );
}

export function getStoredTickets(): Ticket[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_TICKETS));
      return INITIAL_TICKETS;
    }
    const parsed = JSON.parse(raw);
    const list: Ticket[] = Array.isArray(parsed) ? parsed : INITIAL_TICKETS;
    return mergeTicketsWithRecentMutations(list, getDeletedTicketIds());
  } catch (err) {
    console.error('Failed reading tickets from localStorage:', err);
    return INITIAL_TICKETS;
  }
}

export function saveStoredTickets(tickets: Ticket[], notifyEvent = true): void {
  try {
    const ordered = mergeTicketsWithRecentMutations(tickets, getDeletedTicketIds());
    const prevRaw = localStorage.getItem(STORAGE_KEY);
    const nextRaw = JSON.stringify(ordered);
    if (prevRaw !== nextRaw) {
      localStorage.setItem(STORAGE_KEY, nextRaw);
    }
    if (notifyEvent && typeof window !== 'undefined') {
      window.dispatchEvent(new Event(TICKETS_SYNC_EVENT));
    }
  } catch (err) {
    console.error('Failed saving tickets to localStorage:', err);
  }
}

export function addStoredTicket(newTicket: Ticket): Ticket[] {
  const current = getStoredTickets();
  recentLocalTicketMutations.set(newTicket.ID_Tiket, {
    ticket: newTicket,
    expiresAt: Date.now() + 45000
  });
  const withoutDup = current.filter((t) => t.ID_Tiket !== newTicket.ID_Tiket);
  const updatedDeleted = getDeletedTicketIds().filter((id) => id !== newTicket.ID_Tiket);
  saveDeletedTicketIds(updatedDeleted);

  const updatedList = [newTicket, ...withoutDup];
  saveStoredTickets(updatedList, true);

  // 1. Persist immediately to Cloud Firestore so Manager view on any tab/browser/device receives it in real time
  void upsertTicketToCloudFirestore(newTicket, updatedList, updatedDeleted);

  // 2. Persist to Express backend (/api/tickets)
  void buildAuthHeaders().then((headers) =>
    fetch('/api/tickets', {
      method: 'POST',
      headers,
      body: JSON.stringify({ ticket: newTicket, tickets: updatedList, deletedTicketIds: updatedDeleted })
    }).catch(() => {})
  );

  // 3. Sync with Google Drive if connected
  void syncTicketsWithDriveFolder(updatedList, false);

  return updatedList;
}

export function updateStoredTicket(updatedTicket: Ticket): Ticket[] {
  const current = getStoredTickets();
  recentLocalTicketMutations.set(updatedTicket.ID_Tiket, {
    ticket: updatedTicket,
    expiresAt: Date.now() + 45000
  });
  const exists = current.some((t) => t.ID_Tiket === updatedTicket.ID_Tiket);
  const updatedList = exists
    ? current.map((t) => (t.ID_Tiket === updatedTicket.ID_Tiket ? updatedTicket : t))
    : [updatedTicket, ...current];
  saveStoredTickets(updatedList, true);

  const currentDeleted = getDeletedTicketIds();

  // 1. Persist update to Cloud Firestore
  void upsertTicketToCloudFirestore(updatedTicket, updatedList, currentDeleted);

  // 2. Persist update to Express backend (/api/tickets)
  void buildAuthHeaders().then((headers) =>
    fetch('/api/tickets', {
      method: 'POST',
      headers,
      body: JSON.stringify({ ticket: updatedTicket, tickets: updatedList, deletedTicketIds: currentDeleted })
    }).catch(() => {})
  );

  // 3. Sync with Google Drive if connected
  void syncTicketsWithDriveFolder(updatedList, false);

  return updatedList;
}

export function deleteStoredTicket(ticketId: string): Ticket[] {
  const current = getStoredTickets();
  recentLocalTicketMutations.delete(ticketId);
  const updatedList = current.filter((t) => t.ID_Tiket !== ticketId);
  const updatedDeleted = Array.from(new Set([...getDeletedTicketIds(), ticketId]));
  saveDeletedTicketIds(updatedDeleted);
  saveStoredTickets(updatedList, true);

  // 1. Delete from Cloud Firestore
  void deleteTicketFromCloudFirestore(ticketId, updatedList, updatedDeleted);

  // 2. Delete from Express backend
  void buildAuthHeaders().then((headers) =>
    fetch(`/api/tickets/${encodeURIComponent(ticketId)}`, {
      method: 'DELETE',
      headers
    }).catch(() => {})
  );

  // 3. Overwrite in Google Drive if connected
  void syncTicketsWithDriveFolder(updatedList, true);

  return updatedList;
}

export async function fetchCloudTickets(): Promise<Ticket[]> {
  let firestoreTickets: Ticket[] = [];
  let firestoreDeleted: string[] = [];
  let serverTickets: Ticket[] = [];
  let serverDeleted: string[] = [];

  // 1. Fetch from shared Cloud Firestore
  try {
    const fsData = await fetchTicketsFromCloudFirestore();
    if (fsData) {
      firestoreTickets = fsData.tickets;
      firestoreDeleted = fsData.deletedTicketIds;
    }
  } catch {
    // ignore
  }

  // 2. Fetch from Express backend (/api/tickets)
  try {
    const headers = await buildAuthHeaders();
    const res = await fetch('/api/tickets', { method: 'GET', headers });
    const ct = res.headers.get('content-type') || '';
    if (res.ok && ct.includes('application/json')) {
      const data = await res.json();
      if (Array.isArray(data.tickets)) serverTickets = data.tickets;
      if (Array.isArray(data.deletedTicketIds)) serverDeleted = data.deletedTicketIds;
    }
  } catch {
    // ignore
  }

  const localTickets = getStoredTickets();
  const combinedDeleted = Array.from(
    new Set([...getDeletedTicketIds(), ...firestoreDeleted, ...serverDeleted])
  );
  saveDeletedTicketIds(combinedDeleted);

  const merged = mergeTicketsWithRecentMutations(
    [...firestoreTickets, ...serverTickets, ...localTickets],
    combinedDeleted
  );

  if (JSON.stringify(merged) !== JSON.stringify(localTickets)) {
    saveStoredTickets(merged, true);
  }
  return merged;
}

export function resetToDefaultTickets(): Ticket[] {
  try {
    localStorage.clear();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_TICKETS));
    localStorage.setItem(USERS_LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_USERS));
    localStorage.setItem(DELETED_USERS_LOCAL_STORAGE_KEY, JSON.stringify([]));
  } catch (err) {
    console.error('Failed resetting localStorage:', err);
  }
  recentLocalUserMutations.clear();
  recentLocalTicketMutations.clear();
  mirroredToDriveUsernames.clear();
  saveDeletedUsernames([]);
  saveDeletedTicketIds([]);
  saveStoredUsers(INITIAL_USERS);
  saveStoredTickets(INITIAL_TICKETS, true);

  void resetTicketsInCloudFirestore(INITIAL_TICKETS);
  void buildAuthHeaders().then((headers) =>
    fetch('/api/tickets/reset', { method: 'POST', headers }).catch(() => {})
  );
  return INITIAL_TICKETS;
}

export async function pullAndMergeTicketsFromDrive(): Promise<Ticket[]> {
  const cloud = await fetchCloudTickets();
  const merged = await syncTicketsWithDriveFolder(cloud, false);
  if (merged && merged.length > 0) {
    const finalMerged = mergeTicketsWithRecentMutations(merged, getDeletedTicketIds());
    saveStoredTickets(finalMerged, true);
    for (const t of finalMerged) {
      void upsertTicketToCloudFirestore(t, finalMerged, getDeletedTicketIds());
    }
    return finalMerged;
  }
  return cloud;
}

function normalizeUserAccount(u: Partial<UserAccount>, index: number): UserAccount {
  const safeRole: UserRole =
    u.role === 'pemberi_tugas' || u.role === 'manager' || u.role === 'staff' || u.role === 'dashboard'
      ? u.role
      : 'pemberi_tugas';
  const cleanUser = (u.username || `user_${index}`).trim();
  const isDefaultAccount =
    typeof u.isDefault === 'boolean'
      ? u.isDefault
      : INITIAL_USERS.some(init => init.id === u.id || init.username.toLowerCase() === cleanUser.toLowerCase());

  return {
    id: u.id || `usr-${Date.now()}-${index}`,
    fullName: (u.fullName || cleanUser).trim(),
    username: cleanUser,
    password: u.password || 'WBP123',
    role: safeRole,
    roleName: u.roleName || ROLE_LABELS[safeRole],
    department: u.department,
    whatsapp: u.whatsapp ? cleanWhatsAppNumber(u.whatsapp) : '',
    createdAt: u.createdAt || formatCurrentDateTime(),
    isDefault: isDefaultAccount,
    isAdmin:
      u.isAdmin === true ||
      cleanUser.toLowerCase() === 'admin' ||
      safeRole === 'dashboard'
  };
}

function orderUsersList(list: Partial<UserAccount>[]): UserAccount[] {
  const normalized = list
    .filter((item): item is Partial<UserAccount> => Boolean(item && typeof item === 'object'))
    .map((item, idx) => normalizeUserAccount(item, idx));

  const hasAdmin = normalized.some(
    u => u.username.toLowerCase() === 'admin' || u.role === 'dashboard' || u.isAdmin
  );
  const defaultAdmin = INITIAL_USERS.find(u => u.username.toLowerCase() === 'admin');
  const completeList = !hasAdmin && defaultAdmin ? [...normalized, defaultAdmin] : normalized;

  const customUsers = completeList.filter(u => !u.isDefault);
  const defaultUsers = completeList.filter(u => u.isDefault);
  return [...customUsers, ...defaultUsers];
}

function mergeWithDefaultsAndRecentMutations(
  incomingUsers: Partial<UserAccount>[],
  deletedUsernames: string[]
): UserAccount[] {
  const now = Date.now();
  for (const [k, v] of recentLocalUserMutations.entries()) {
    if (v.expiresAt <= now) {
      recentLocalUserMutations.delete(k);
    }
  }

  const deletedSet = new Set(deletedUsernames.map((u) => u.toLowerCase()));
  const map = new Map<string, UserAccount>();

  // 1. Recent local mutations take highest precedence to prevent race conditions
  for (const [k, v] of recentLocalUserMutations.entries()) {
    if (!deletedSet.has(k)) {
      map.set(k, normalizeUserAccount(v.user, 0));
    }
  }

  // 2. Incoming cloud users (Firestore / Backend API / Google Drive)
  for (const raw of incomingUsers) {
    if (!raw || !raw.username) continue;
    const key = raw.username.trim().toLowerCase();
    if (deletedSet.has(key)) continue;
    if (!map.has(key)) {
      map.set(key, normalizeUserAccount(raw, 0));
    }
  }

  // 3. Default system accounts (unless explicitly deleted by Admin)
  for (const def of INITIAL_USERS) {
    const key = def.username.toLowerCase();
    if (!deletedSet.has(key) && !map.has(key)) {
      map.set(key, def);
    }
  }

  return orderUsersList(Array.from(map.values()));
}

function syncStrukturOrgFromUsers(usersList: UserAccount[]): void {
  const depts: DepartmentName[] = [
    'Engineering Precast',
    'Engineering Readymix',
    'Engineering Konstruksi'
  ];
  for (const dept of depts) {
    const mgr = usersList.find(
      (u) => u.role === 'manager' && (u.department || 'Engineering Precast') === dept
    );
    const staffMap: Record<string, string> = {};
    usersList
      .filter((u) => u.role === 'staff' && (u.department || 'Engineering Precast') === dept)
      .forEach((u) => {
        if (u.fullName) {
          staffMap[u.fullName] = u.whatsapp || '';
        }
      });
    STRUKTUR_ORG[dept] = {
      Manager: mgr?.fullName || '',
      WA_Manager: mgr?.whatsapp || '',
      Staff: staffMap
    };
  }
}

export function getStoredUsers(): UserAccount[] {
  if (cloudUsersMemoryStore.length === 0) {
    const fromStorage = readInitialUsersFromLocalStorage();
    if (fromStorage.length > 0) {
      cloudUsersMemoryStore = orderUsersList(fromStorage);
      syncStrukturOrgFromUsers(cloudUsersMemoryStore);
    }
  }
  return cloudUsersMemoryStore;
}

export function saveStoredUsers(users: UserAccount[]): void {
  cloudUsersMemoryStore = orderUsersList(users);
  syncStrukturOrgFromUsers(cloudUsersMemoryStore);
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(
        USERS_LOCAL_STORAGE_KEY,
        JSON.stringify(cloudUsersMemoryStore)
      );
      window.localStorage.setItem(
        USERS_STORAGE_KEY,
        String(Date.now())
      );
    }
  } catch {
    // ignore
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('wbp_users_updated'));
  }
}

// Synchronize initial STRUKTUR_ORG immediately from any persisted users in localStorage
syncStrukturOrgFromUsers(cloudUsersMemoryStore);

async function buildAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  };
  const token = await getAccessToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

// Start real-time Cloud Firestore listener in browser so registrations from ANY computer appear immediately
if (typeof window !== 'undefined') {
  subscribeCloudFirestoreUsers((payload) => {
    if (typeof payload.gasWebAppUrl === 'string' && payload.gasWebAppUrl) {
      cloudGasWebAppUrlStore = payload.gasWebAppUrl;
    }
    const combinedDeleted = Array.from(
      new Set([...getDeletedUsernames(), ...payload.deletedUsernames].map((u) => u.toLowerCase()))
    );
    saveDeletedUsernames(combinedDeleted);
    const merged = mergeWithDefaultsAndRecentMutations(
      [...payload.users, ...cloudUsersMemoryStore],
      combinedDeleted
    );
    if (JSON.stringify(merged) !== JSON.stringify(cloudUsersMemoryStore)) {
      saveStoredUsers(merged);
    }

    // If this computer has an active Google Drive OAuth connection, automatically mirror any new cross-PC registrations into Google Drive folder 1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF
    void getAccessToken().then((token) => {
      if (!token) return;
      const customUsers = merged.filter((u) => !u.isDefault);
      for (const cu of customUsers) {
        const key = cu.username.toLowerCase();
        if (!mirroredToDriveUsernames.has(key)) {
          mirroredToDriveUsernames.add(key);
          void writeUserRegistrationToDrive(
            cu,
            merged,
            combinedDeleted,
            token
          );
        }
      }
    });
  });

  // Real-time Cloud Firestore listener for Tickets so new OPEN tickets from Pemberi Tugas immediately appear in Manager view
  subscribeCloudFirestoreTickets((payload) => {
    saveDeletedTicketIds(payload.deletedTicketIds);
    const localCurrent = getStoredTickets();
    const merged = mergeTicketsWithRecentMutations(
      [...payload.tickets, ...localCurrent],
      payload.deletedTicketIds
    );
    if (JSON.stringify(merged) !== JSON.stringify(localCurrent)) {
      saveStoredTickets(merged, true);
    }
  });
}

/**
 * Fetches the authoritative centralized user database from Google Cloud Firestore,
 * Google Apps Script Web App (https://script.google.com/macros/s/AKfycbwf11X_caQ9oCQmoPgJfnBpqM4w6uc02O-aMWC40qoRIdwgxZc5-V9LzQZxy3zAEDg3/exec),
 * AND the backend server (/api/users) connected to Google Drive folder 1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF.
 */
export async function fetchCloudUsers(syncDrive = false): Promise<UserAccount[]> {
  let firestoreUsers: UserAccount[] = [];
  let firestoreDeleted: string[] = [];
  let gasUsers: UserAccount[] = [];
  let gasDeleted: string[] = [];
  let serverUsers: UserAccount[] = [];
  let serverDeleted: string[] = [];

  // 1. Fetch from shared Google Cloud Firestore (works across ALL computers, ais-dev & ais-pre & Vercel)
  try {
    const fsData = await fetchUsersFromCloudFirestore();
    if (fsData) {
      firestoreUsers = fsData.users;
      firestoreDeleted = fsData.deletedUsernames;
      if (fsData.gasWebAppUrl) {
        cloudGasWebAppUrlStore = fsData.gasWebAppUrl;
      }
    }
  } catch (err) {
    console.warn('Firestore user fetch warning:', err);
  }

  // 2. Always pull from Google Apps Script Web App endpoint (wbp_users_database.json in Google Drive) so permanent Drive users are never lost after redeploy
  try {
    const gasData = await pullUsersFromGasEndpoint(getGasWebAppUrl());
    if (gasData) {
      gasUsers = gasData.users;
      gasDeleted = gasData.deletedUsernames;
    }
  } catch {
    // ignore
  }

  // 3. Also fetch from local/container Express API (/api/users)
  try {
    const headers = await buildAuthHeaders();
    const res = await fetch(`/api/users${syncDrive ? '?syncDrive=true' : ''}`, {
      method: 'GET',
      headers
    });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (typeof data.gasWebAppUrl === 'string' && data.gasWebAppUrl) {
        cloudGasWebAppUrlStore = data.gasWebAppUrl;
      }
      if (Array.isArray(data.deletedUsernames)) {
        serverDeleted = data.deletedUsernames;
      }
      if (Array.isArray(data.users)) {
        serverUsers = data.users;
      }
    }
  } catch {
    // ignore if static preview
  }

  const combinedDeleted = Array.from(
    new Set(
      [
        ...getDeletedUsernames(),
        ...firestoreDeleted,
        ...gasDeleted,
        ...serverDeleted
      ].map((u) => u.toLowerCase())
    )
  );
  saveDeletedUsernames(combinedDeleted);

  const localPersistedUsers = getStoredUsers();

  // Merge Firestore users + GAS Web App (Google Drive JSON) users + Server users + LocalStorage users
  const merged = mergeWithDefaultsAndRecentMutations(
    [...firestoreUsers, ...gasUsers, ...serverUsers, ...localPersistedUsers],
    combinedDeleted
  );

  if (JSON.stringify(merged) !== JSON.stringify(cloudUsersMemoryStore)) {
    saveStoredUsers(merged);
  }

  // Auto-heal / backfill: if any user exists in merged (e.g. from Google Drive GAS or localStorage) but is missing from Firestore, persist to Firestore & GAS
  if (merged.length > 0) {
    const fsUserSet = new Set(firestoreUsers.map((u) => u.username.toLowerCase()));
    const missingInFirestore = merged.filter(
      (u) => !fsUserSet.has(u.username.toLowerCase())
    );
    if (missingInFirestore.length > 0) {
      for (const mu of missingInFirestore) {
        void upsertUserToCloudFirestore(mu, merged, combinedDeleted);
      }
    }

    const gasUserSet = new Set(gasUsers.map((u) => u.username.toLowerCase()));
    const missingInGas = merged.filter(
      (u) => !gasUserSet.has(u.username.toLowerCase())
    );
    if (missingInGas.length > 0) {
      void pushUsersToGasEndpoint({
        gasWebAppUrl: getGasWebAppUrl(),
        action: 'syncUsers',
        users: merged,
        deletedUsernames: combinedDeleted
      });
    }
  }

  return merged;
}

export async function saveGasWebAppUrl(gasWebAppUrl: string): Promise<UserAccount[]> {
  cloudGasWebAppUrlStore = normalizeGasWebAppUrl(gasWebAppUrl);
  await saveGasConfigToCloudFirestore(cloudGasWebAppUrlStore);
  try {
    const headers = await buildAuthHeaders();
    const res = await fetch('/api/gas/config', {
      method: 'POST',
      headers,
      body: JSON.stringify({ gasWebAppUrl: cloudGasWebAppUrlStore })
    });
    const contentType = res.headers.get('content-type') || '';
    if (res.ok && contentType.includes('application/json')) {
      const data = await res.json();
      if (Array.isArray(data.users) && data.users.length > 0) {
        const ordered = mergeWithDefaultsAndRecentMutations(
          data.users,
          getDeletedUsernames()
        );
        saveStoredUsers(ordered);
        return ordered;
      }
    }
  } catch (err) {
    console.warn('Failed saving GAS Web App URL:', err);
  }
  return cloudUsersMemoryStore;
}

/**
 * Pulls all registered users from Cloud Firestore, Google Apps Script endpoint, the centralized server, AND Google Drive folder 1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF
 * (reading both wbp_users_database.json and WBP_USER_*.json files) so Admin sees all registrations from any device in real time.
 */
export async function pullAndMergeUsersFromDrive(): Promise<UserAccount[]> {
  // 1. First pull latest from Cloud Firestore + GAS Web App + Backend Server
  const cloudMerged = await fetchCloudUsers(true);

  // 2. Sync full merged user list to Google Apps Script Web App endpoint
  const currentDeleted = getDeletedUsernames();
  void pushUsersToGasEndpoint({
    gasWebAppUrl: getGasWebAppUrl(),
    action: 'syncUsers',
    users: cloudMerged,
    deletedUsernames: currentDeleted
  });

  // 3. Run direct Google Drive folder 1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF sync if client OAuth token is active
  const res = await syncUsersFromDriveFolder(cloudMerged, currentDeleted);
  if (res && res.users.length > 0) {
    const ordered = mergeWithDefaultsAndRecentMutations(
      res.users,
      res.deletedUsernames
    );
    saveDeletedUsernames(res.deletedUsernames);
    saveStoredUsers(ordered);

    // Push any custom users found in Google Drive into Cloud Firestore, GAS endpoint & Backend Server so all computers share them
    const customUsers = ordered.filter((u) => !u.isDefault);
    for (const cu of customUsers) {
      void upsertUserToCloudFirestore(cu, ordered, res.deletedUsernames);
    }
    if (customUsers.length === 0 && ordered[0]) {
      void upsertUserToCloudFirestore(ordered[0], ordered, res.deletedUsernames);
    }

    void pushUsersToGasEndpoint({
      gasWebAppUrl: getGasWebAppUrl(),
      action: 'syncUsers',
      users: ordered,
      deletedUsernames: res.deletedUsernames
    });

    void buildAuthHeaders().then((headers) =>
      fetch('/api/users/sync', {
        method: 'POST',
        headers,
        body: JSON.stringify({ users: ordered })
      }).catch(() => {})
    );

    return ordered;
  }

  // Also ensure any custom users from Cloud Firestore are pushed to Google Drive if connected
  const customFromCloud = cloudMerged.filter((u) => !u.isDefault);
  for (const cu of customFromCloud) {
    void writeUserRegistrationToDrive(cu, cloudMerged, currentDeleted);
  }

  return cloudMerged;
}

export function addStoredUser(
  newUser: Omit<UserAccount, 'id' | 'createdAt'>
): { created: UserAccount; users: UserAccount[] } {
  const current = getStoredUsers();
  const created: UserAccount = normalizeUserAccount(
    {
      ...newUser,
      id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      createdAt: formatCurrentDateTime(),
      isDefault: false
    },
    0
  );

  const key = created.username.toLowerCase();
  recentLocalUserMutations.set(key, {
    user: created,
    expiresAt: Date.now() + 45000
  });

  const withoutDuplicate = current.filter(
    u => u.username.toLowerCase() !== key
  );
  const updatedList = orderUsersList([created, ...withoutDuplicate]);
  const updatedDeleted = getDeletedUsernames().filter(
    uname => uname.toLowerCase() !== key
  );
  saveDeletedUsernames(updatedDeleted);
  saveStoredUsers(updatedList);

  // 1. Immediately send to Google Apps Script Web App endpoint (https://script.google.com/macros/s/AKfycbwf11X_caQ9oCQmoPgJfnBpqM4w6uc02O-aMWC40qoRIdwgxZc5-V9LzQZxy3zAEDg3/exec)
  void pushUsersToGasEndpoint({
    gasWebAppUrl: getGasWebAppUrl(),
    action: 'registerUser',
    user: created,
    users: updatedList,
    deletedUsernames: updatedDeleted
  });

  // 2. Immediately persist to shared Google Cloud Firestore so ANY computer (ais-dev, ais-pre, mobile, PC) sees it in < 300ms
  void upsertUserToCloudFirestore(created, updatedList, updatedDeleted);

  // 3. Persist to Express backend (/api/users/register)
  void buildAuthHeaders().then((headers) =>
    fetch('/api/users/register', {
      method: 'POST',
      headers,
      body: JSON.stringify(created)
    })
      .then((r) => {
        const ct = r.headers.get('content-type') || '';
        return r.ok && ct.includes('application/json') ? r.json() : null;
      })
      .then((data) => {
        if (data && Array.isArray(data.users)) {
          const merged = mergeWithDefaultsAndRecentMutations(
            data.users,
            updatedDeleted
          );
          saveStoredUsers(merged);
        }
      })
      .catch(() => {})
  );

  // 4. Write WBP_USER_<username>.json and wbp_users_database.json directly to Google Drive folder 1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF
  mirroredToDriveUsernames.add(key);
  void writeUserRegistrationToDrive(created, updatedList, updatedDeleted);

  return { created, users: updatedList };
}

export function updateStoredUser(updatedUser: UserAccount): UserAccount[] {
  const current = getStoredUsers();
  const normalizedTarget = normalizeUserAccount(updatedUser, 0);
  const key = normalizedTarget.username.toLowerCase();

  recentLocalUserMutations.set(key, {
    user: normalizedTarget,
    expiresAt: Date.now() + 45000
  });

  const exists = current.some(u => u.id === normalizedTarget.id);
  const updatedList = orderUsersList(
    exists
      ? current.map(u => (u.id === normalizedTarget.id ? normalizedTarget : u))
      : [normalizedTarget, ...current]
  );
  saveStoredUsers(updatedList);

  const currentDeleted = getDeletedUsernames();

  // 1. Send update to Google Apps Script Web App endpoint
  void pushUsersToGasEndpoint({
    gasWebAppUrl: getGasWebAppUrl(),
    action: 'updateUser',
    user: normalizedTarget,
    users: updatedList,
    deletedUsernames: currentDeleted
  });

  // 2. Update in shared Google Cloud Firestore across all computers
  void upsertUserToCloudFirestore(
    normalizedTarget,
    updatedList,
    currentDeleted
  );

  // 3. Update in Express backend
  void buildAuthHeaders().then((headers) =>
    fetch(`/api/users/${encodeURIComponent(normalizedTarget.id)}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(normalizedTarget)
    })
      .then((r) => {
        const ct = r.headers.get('content-type') || '';
        return r.ok && ct.includes('application/json') ? r.json() : null;
      })
      .then((data) => {
        if (data && Array.isArray(data.users)) {
          saveStoredUsers(
            mergeWithDefaultsAndRecentMutations(data.users, currentDeleted)
          );
        }
      })
      .catch(() => {})
  );

  // 4. Sync updated user record and database JSON to Google Drive folder 1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF
  void writeUserRegistrationToDrive(normalizedTarget, updatedList, currentDeleted);

  return updatedList;
}

export function deleteStoredUser(userId: string): UserAccount[] {
  const current = getStoredUsers();
  const targetUser = current.find(u => u.id === userId);
  if (targetUser) {
    recentLocalUserMutations.delete(targetUser.username.toLowerCase());
  }
  const updatedList = current.filter(u => u.id !== userId);
  const updatedDeleted = targetUser
    ? Array.from(new Set([...getDeletedUsernames(), targetUser.username.toLowerCase()]))
    : getDeletedUsernames();
  saveDeletedUsernames(updatedDeleted);
  saveStoredUsers(updatedList);

  // 1. Send deletion to Google Apps Script Web App endpoint
  void pushUsersToGasEndpoint({
    gasWebAppUrl: getGasWebAppUrl(),
    action: 'deleteUser',
    deletedUsername: targetUser?.username,
    users: updatedList,
    deletedUsernames: updatedDeleted
  });

  // 2. Delete from shared Google Cloud Firestore across all computers
  if (targetUser) {
    void deleteUserFromCloudFirestore(
      targetUser.username,
      updatedList,
      updatedDeleted
    );
  }

  // 3. Delete from Express backend
  void buildAuthHeaders().then((headers) =>
    fetch(`/api/users/${encodeURIComponent(userId)}`, {
      method: 'DELETE',
      headers
    })
      .then((r) => {
        const ct = r.headers.get('content-type') || '';
        return r.ok && ct.includes('application/json') ? r.json() : null;
      })
      .then((data) => {
        if (data && Array.isArray(data.users)) {
          saveStoredUsers(
            mergeWithDefaultsAndRecentMutations(data.users, updatedDeleted)
          );
        }
      })
      .catch(() => {})
  );

  // 4. Sync deletion to Google Drive folder 1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF
  void pushUsersDatabaseToDrive(updatedList, updatedDeleted, targetUser?.username);

  return updatedList;
}

export function resetToDefaultUsers(): UserAccount[] {
  recentLocalUserMutations.clear();
  mirroredToDriveUsernames.clear();
  saveDeletedUsernames([]);
  saveStoredUsers(INITIAL_USERS);

  // 1. Reset via Google Apps Script Web App endpoint
  void pushUsersToGasEndpoint({
    gasWebAppUrl: getGasWebAppUrl(),
    action: 'resetUsers',
    users: INITIAL_USERS,
    deletedUsernames: []
  });

  // 2. Reset in shared Google Cloud Firestore
  void resetUsersInCloudFirestore(INITIAL_USERS);

  // 3. Reset in Express backend
  void buildAuthHeaders().then((headers) =>
    fetch('/api/users/reset', {
      method: 'POST',
      headers
    })
      .then((r) => {
        const ct = r.headers.get('content-type') || '';
        return r.ok && ct.includes('application/json') ? r.json() : null;
      })
      .then((data) => {
        if (data && Array.isArray(data.users)) {
          saveStoredUsers(data.users);
        }
      })
      .catch(() => {})
  );

  // 4. Reset in Google Drive folder 1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF
  void pushUsersDatabaseToDrive(INITIAL_USERS, []);
  return INITIAL_USERS;
}

export function cleanWhatsAppNumber(phoneStr: string): string {
  if (!phoneStr || phoneStr.trim() === '-' || phoneStr.trim() === '') return '';
  let clean = phoneStr.replace(/\D/g, '');
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  } else if (!clean.startsWith('62') && clean !== '') {
    clean = '62' + clean;
  }
  return clean;
}

export function generateTicketId(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return `REQ-${y}${m}${d}-${h}${min}${s}`;
}

export function formatCurrentDateTime(): string {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${d}/${m}/${y} ${h}:${min}`;
}

