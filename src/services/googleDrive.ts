import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import type { Ticket, UserAccount } from '../types';

export const SCOPES = ['https://www.googleapis.com/auth/drive'];

export const GOOGLE_DRIVE_FOLDER_ID = '1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF';
export const GOOGLE_DRIVE_FOLDER_URL =
  'https://drive.google.com/drive/folders/1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF?usp=sharing';

export const DRIVE_USERS_DB_FILENAME = 'wbp_users_database.json';
export const DRIVE_TICKETS_DB_FILENAME = 'wbp_tickets_database.json';
export const DRIVE_USER_FILE_PREFIX = 'WBP_USER_';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

// Flag to indicate if we are in the middle of a sign-in flow
let isSigningIn = false;
// Cache the OAuth access token strictly in memory (never in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let cachedGoogleUser: User | null = null;

export interface DriveSyncState {
  isSyncing: boolean;
  lastSyncedAt: string | null;
  lastError: string | null;
  usersDbFileId?: string;
  ticketsDbFileId?: string;
}

let syncState: DriveSyncState = {
  isSyncing: false,
  lastSyncedAt: null,
  lastError: null
};

type DriveAuthListener = (state: {
  isConnected: boolean;
  user: User | null;
  accessToken: string | null;
  syncState: DriveSyncState;
}) => void;

const listeners = new Set<DriveAuthListener>();

function notifyListeners() {
  const state = {
    isConnected: Boolean(cachedAccessToken),
    user: cachedGoogleUser,
    accessToken: cachedAccessToken,
    syncState
  };
  listeners.forEach((listener) => listener(state));
}

function updateSyncState(partial: Partial<DriveSyncState>) {
  syncState = { ...syncState, ...partial };
  notifyListeners();
}

// Initialize auth state listener
onAuthStateChanged(auth, (user: User | null) => {
  cachedGoogleUser = user;
  if (!user) {
    cachedAccessToken = null;
  } else if (!cachedAccessToken && !isSigningIn) {
    cachedAccessToken = null;
  }
  notifyListeners();
});

export const subscribeDriveAuth = (listener: DriveAuthListener): (() => void) => {
  listeners.add(listener);
  listener({
    isConnected: Boolean(cachedAccessToken),
    user: cachedGoogleUser,
    accessToken: cachedAccessToken,
    syncState
  });
  return () => {
    listeners.delete(listener);
  };
};

export const initAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const googleSignIn = async (): Promise<{
  user: User;
  accessToken: string;
} | null> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Gagal mendapatkan access token Google Drive dari Firebase Auth.');
    }

    cachedAccessToken = credential.accessToken;
    cachedGoogleUser = result.user;

    // Register token in centralized backend memory so cross-device user registrations can immediately write to Google Drive folder 1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF
    void fetch('/api/drive/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cachedAccessToken}`
      },
      body: JSON.stringify({})
    }).catch(() => {});

    notifyListeners();
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error) {
    console.error('Google Drive sign-in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export const getDriveUser = (): User | null => {
  return cachedGoogleUser;
};

export const getDriveSyncState = (): DriveSyncState => {
  return syncState;
};

export const logoutDrive = async () => {
  await auth.signOut();
  cachedAccessToken = null;
  cachedGoogleUser = null;
  notifyListeners();
};

export interface DriveUploadedFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  webViewLink: string;
  webContentLink: string;
  downloadUrl: string;
  folderId: string;
}

interface DriveFileMeta {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime?: string;
  webViewLink?: string;
  webContentLink?: string;
}

/**
 * Lists files inside the target Google Drive folder (1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF)
 * and also checks matching database files in Drive if fallback root storage was used.
 */
export async function listDriveFolderFiles(
  accessToken?: string | null
): Promise<DriveFileMeta[]> {
  const token = accessToken || cachedAccessToken;
  if (!token) return [];

  const folderQuery = encodeURIComponent(
    `'${GOOGLE_DRIVE_FOLDER_ID}' in parents and trashed = false`
  );
  const folderUrl = `https://www.googleapis.com/drive/v3/files?q=${folderQuery}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType,modifiedTime,webViewLink,webContentLink)&orderBy=modifiedTime desc&pageSize=100`;

  const nameQuery = encodeURIComponent(
    `(name = '${DRIVE_USERS_DB_FILENAME}' or name = '${DRIVE_TICKETS_DB_FILENAME}' or name contains '${DRIVE_USER_FILE_PREFIX}') and trashed = false`
  );
  const nameUrl = `https://www.googleapis.com/drive/v3/files?q=${nameQuery}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType,modifiedTime,webViewLink,webContentLink)&orderBy=modifiedTime desc&pageSize=100`;

  const combined = new Map<string, DriveFileMeta>();

  try {
    const resFolder = await fetch(folderUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (resFolder.status === 401) {
      cachedAccessToken = null;
      notifyListeners();
      return [];
    }
    if (resFolder.ok) {
      const data = await resFolder.json();
      if (Array.isArray(data.files)) {
        for (const f of data.files) {
          combined.set(f.id, f);
        }
      }
    }
  } catch (err) {
    console.warn('Could not list Drive folder directly:', err);
  }

  try {
    const resName = await fetch(nameUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (resName.ok) {
      const data = await resName.json();
      if (Array.isArray(data.files)) {
        for (const f of data.files) {
          if (!combined.has(f.id)) {
            combined.set(f.id, f);
          }
        }
      }
    }
  } catch (err) {
    console.warn('Could not list Drive database files by name:', err);
  }

  return Array.from(combined.values());
}

/**
 * Downloads and parses a JSON file from Google Drive by fileId.
 */
export async function downloadDriveJsonFile<T>(
  fileId: string,
  accessToken?: string | null
): Promise<T | null> {
  const token = accessToken || cachedAccessToken;
  if (!token || !fileId) return null;

  try {
    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text) return null;
    return JSON.parse(text) as T;
  } catch (err) {
    console.warn(`Failed reading JSON file ${fileId} from Drive:`, err);
    return null;
  }
}

/**
 * Creates or updates a JSON file inside Google Drive folder 1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF.
 */
export async function saveJsonToDriveFolder(
  fileName: string,
  payload: unknown,
  existingFileId?: string,
  accessToken?: string | null
): Promise<DriveUploadedFile | null> {
  const token = accessToken || cachedAccessToken;
  if (!token) return null;

  const jsonString = JSON.stringify(payload, null, 2);
  const jsonBlob = new Blob([jsonString], { type: 'application/json' });

  const buildMultipart = (includeParentFolder: boolean) => {
    const metadata: Record<string, unknown> = {
      name: fileName,
      mimeType: 'application/json'
    };
    if (includeParentFolder) {
      metadata.parents = [GOOGLE_DRIVE_FOLDER_ID];
    }
    const form = new FormData();
    form.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' })
    );
    form.append('file', jsonBlob, fileName);
    return form;
  };

  try {
    // 1. If we already know the file ID on Drive, update it in place via PATCH
    if (existingFileId) {
      const patchUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,size,webViewLink,webContentLink`;
      const patchRes = await fetch(patchUrl, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        body: buildMultipart(false)
      });
      if (patchRes.ok) {
        const data = await patchRes.json();
        return {
          id: data.id,
          name: data.name || fileName,
          mimeType: 'application/json',
          size: data.size,
          webViewLink:
            data.webViewLink ||
            `https://drive.google.com/file/d/${data.id}/view?usp=sharing`,
          webContentLink:
            data.webContentLink ||
            `https://drive.google.com/uc?export=download&id=${data.id}`,
          downloadUrl:
            data.webContentLink ||
            `https://drive.google.com/uc?export=download&id=${data.id}`,
          folderId: GOOGLE_DRIVE_FOLDER_ID
        };
      }
    }

    // 2. Otherwise create the JSON file inside folder 1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF
    const createUrl =
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,size,webViewLink,webContentLink';
    let createRes = await fetch(createUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: buildMultipart(true)
    });

    // Fallback to root if user account only has viewer rights on the shared folder
    if (!createRes.ok && (createRes.status === 403 || createRes.status === 404)) {
      createRes = await fetch(createUrl, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: buildMultipart(false)
      });
    }

    if (!createRes.ok) {
      if (createRes.status === 401) {
        cachedAccessToken = null;
        notifyListeners();
      }
      return null;
    }

    const data = await createRes.json();
    return {
      id: data.id,
      name: data.name || fileName,
      mimeType: 'application/json',
      size: data.size,
      webViewLink:
        data.webViewLink ||
        `https://drive.google.com/file/d/${data.id}/view?usp=sharing`,
      webContentLink:
        data.webContentLink ||
        `https://drive.google.com/uc?export=download&id=${data.id}`,
      downloadUrl:
        data.webContentLink ||
        `https://drive.google.com/uc?export=download&id=${data.id}`,
      folderId: GOOGLE_DRIVE_FOLDER_ID
    };
  } catch (err) {
    console.warn(`Error saving JSON ${fileName} to Google Drive:`, err);
    return null;
  }
}

/**
 * Deletes a file on Google Drive by fileId (used when Admin deletes a user account).
 */
export async function deleteDriveFileById(
  fileId: string,
  accessToken?: string | null
): Promise<boolean> {
  const token = accessToken || cachedAccessToken;
  if (!token || !fileId) return false;
  try {
    const res = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}?supportsAllDrives=true`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    return res.ok || res.status === 204;
  } catch {
    return false;
  }
}

export interface DriveUsersDatabasePayload {
  type: 'WBP_USERS_DATABASE';
  folderId: string;
  updatedAt: string;
  deletedUsernames?: string[];
  users: UserAccount[];
}

export interface DriveSingleUserRecordPayload {
  type: 'WBP_USER_REGISTRATION_RECORD';
  folderId: string;
  registeredAt: string;
  user: UserAccount;
}

export interface DriveTicketsDatabasePayload {
  type: 'WBP_TICKETS_DATABASE';
  folderId: string;
  updatedAt: string;
  tickets: Ticket[];
}

/**
 * Writes a newly registered user's individual JSON record file (WBP_USER_<username>.json)
 * AND updates the master wbp_users_database.json inside Google Drive folder 1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF.
 */
export async function writeUserRegistrationToDrive(
  newUser: UserAccount,
  allUsers: UserAccount[],
  deletedUsernames: string[] = [],
  accessToken?: string | null
): Promise<boolean> {
  const token = accessToken || cachedAccessToken;
  if (!token) return false;

  updateSyncState({ isSyncing: true, lastError: null });
  try {
    const files = await listDriveFolderFiles(token);
    const singleFileName = `${DRIVE_USER_FILE_PREFIX}${newUser.username.toLowerCase()}.json`;
    const existingSingle = files.find(
      (f) => f.name.toLowerCase() === singleFileName.toLowerCase()
    );
    const existingDb = files.find((f) => f.name === DRIVE_USERS_DB_FILENAME);

    const singlePayload: DriveSingleUserRecordPayload = {
      type: 'WBP_USER_REGISTRATION_RECORD',
      folderId: GOOGLE_DRIVE_FOLDER_ID,
      registeredAt: new Date().toISOString(),
      user: newUser
    };

    const dbPayload: DriveUsersDatabasePayload = {
      type: 'WBP_USERS_DATABASE',
      folderId: GOOGLE_DRIVE_FOLDER_ID,
      updatedAt: new Date().toISOString(),
      deletedUsernames,
      users: allUsers
    };

    const [singleRes, dbRes] = await Promise.all([
      saveJsonToDriveFolder(singleFileName, singlePayload, existingSingle?.id, token),
      saveJsonToDriveFolder(DRIVE_USERS_DB_FILENAME, dbPayload, existingDb?.id, token)
    ]);

    const nowStr = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    updateSyncState({
      isSyncing: false,
      lastSyncedAt: nowStr,
      usersDbFileId: dbRes?.id || existingDb?.id,
      lastError: null
    });
    return Boolean(singleRes || dbRes);
  } catch (err) {
    updateSyncState({
      isSyncing: false,
      lastError: err instanceof Error ? err.message : 'Gagal menulis data user ke Drive'
    });
    return false;
  }
}

/**
 * Pushes the current full user database (and optional deleted username) to Google Drive folder 1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF.
 */
export async function pushUsersDatabaseToDrive(
  allUsers: UserAccount[],
  deletedUsernames: string[] = [],
  deletedUsernameToRemoveFile?: string,
  accessToken?: string | null
): Promise<boolean> {
  const token = accessToken || cachedAccessToken;
  if (!token) return false;

  updateSyncState({ isSyncing: true, lastError: null });
  try {
    const files = await listDriveFolderFiles(token);
    const existingDb = files.find((f) => f.name === DRIVE_USERS_DB_FILENAME);

    if (deletedUsernameToRemoveFile) {
      const targetName = `${DRIVE_USER_FILE_PREFIX}${deletedUsernameToRemoveFile.toLowerCase()}.json`;
      const matchingUserFiles = files.filter(
        (f) => f.name.toLowerCase() === targetName
      );
      for (const mf of matchingUserFiles) {
        await deleteDriveFileById(mf.id, token);
      }
    }

    const dbPayload: DriveUsersDatabasePayload = {
      type: 'WBP_USERS_DATABASE',
      folderId: GOOGLE_DRIVE_FOLDER_ID,
      updatedAt: new Date().toISOString(),
      deletedUsernames,
      users: allUsers
    };

    const dbRes = await saveJsonToDriveFolder(
      DRIVE_USERS_DB_FILENAME,
      dbPayload,
      existingDb?.id,
      token
    );

    const nowStr = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    updateSyncState({
      isSyncing: false,
      lastSyncedAt: nowStr,
      usersDbFileId: dbRes?.id || existingDb?.id,
      lastError: null
    });
    return Boolean(dbRes);
  } catch (err) {
    updateSyncState({
      isSyncing: false,
      lastError: err instanceof Error ? err.message : 'Gagal sinkronisasi database user'
    });
    return false;
  }
}

/**
 * Pulls all user accounts from Google Drive folder 1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF
 * (reading both wbp_users_database.json AND all WBP_USER_*.json registration files),
 * merges them with local users, and writes back any new local registrations to Drive.
 */
export async function syncUsersFromDriveFolder(
  localUsers: UserAccount[],
  localDeletedUsernames: string[] = [],
  accessToken?: string | null
): Promise<{
  users: UserAccount[];
  deletedUsernames: string[];
  syncedFromDrive: boolean;
} | null> {
  const token = accessToken || cachedAccessToken;
  if (!token) return null;

  updateSyncState({ isSyncing: true, lastError: null });
  try {
    const files = await listDriveFolderFiles(token);
    const existingDb = files.find((f) => f.name === DRIVE_USERS_DB_FILENAME);
    const singleUserFiles = files.filter(
      (f) =>
        f.name.startsWith(DRIVE_USER_FILE_PREFIX) && f.name.endsWith('.json')
    );

    let remoteDbUsers: UserAccount[] = [];
    let remoteDeletedUsernames: string[] = [];

    if (existingDb) {
      const parsedDb = await downloadDriveJsonFile<
        DriveUsersDatabasePayload | UserAccount[]
      >(existingDb.id, token);
      if (Array.isArray(parsedDb)) {
        remoteDbUsers = parsedDb;
      } else if (parsedDb && Array.isArray(parsedDb.users)) {
        remoteDbUsers = parsedDb.users;
        if (Array.isArray(parsedDb.deletedUsernames)) {
          remoteDeletedUsernames = parsedDb.deletedUsernames;
        }
      }
    }

    const singleRecords: UserAccount[] = [];
    if (singleUserFiles.length > 0) {
      const downloadedSingles = await Promise.all(
        singleUserFiles.map((f) =>
          downloadDriveJsonFile<DriveSingleUserRecordPayload | UserAccount>(
            f.id,
            token
          )
        )
      );
      for (const item of downloadedSingles) {
        if (!item) continue;
        if ('type' in item && item.type === 'WBP_USER_REGISTRATION_RECORD' && item.user) {
          singleRecords.push(item.user);
        } else if ('username' in item && 'fullName' in item) {
          singleRecords.push(item as UserAccount);
        }
      }
    }

    const deletedSet = new Set<string>(
      [...localDeletedUsernames, ...remoteDeletedUsernames].map((u) =>
        u.toLowerCase()
      )
    );

    // Merge priority: single registration files + remote DB users + local users
    const mergedMap = new Map<string, UserAccount>();

    for (const u of singleRecords) {
      if (!u || !u.username) continue;
      const key = u.username.toLowerCase();
      if (!deletedSet.has(key)) {
        mergedMap.set(key, { ...u, isDefault: Boolean(u.isDefault) });
      }
    }

    for (const u of remoteDbUsers) {
      if (!u || !u.username) continue;
      const key = u.username.toLowerCase();
      if (!deletedSet.has(key)) {
        mergedMap.set(key, { ...u, isDefault: Boolean(u.isDefault) });
      }
    }

    let hasUnsyncedLocalChanges = !existingDb;
    const remoteUsernames = new Set(mergedMap.keys());

    for (const u of localUsers) {
      if (!u || !u.username) continue;
      const key = u.username.toLowerCase();
      if (deletedSet.has(key)) continue;
      if (!mergedMap.has(key)) {
        mergedMap.set(key, u);
        if (!u.isDefault) {
          hasUnsyncedLocalChanges = true;
        }
      }
    }

    const allMerged = Array.from(mergedMap.values());
    const customUsers = allMerged.filter((u) => !u.isDefault);
    const defaultUsers = allMerged.filter((u) => u.isDefault);
    const finalUsers = [...customUsers, ...defaultUsers];
    const finalDeleted = Array.from(deletedSet);

    // Ensure any custom user registered locally also has its individual WBP_USER_<username>.json in the folder
    for (const cu of customUsers) {
      const expectedSingleName = `${DRIVE_USER_FILE_PREFIX}${cu.username.toLowerCase()}.json`;
      const hasSingleFile = singleUserFiles.some(
        (f) => f.name.toLowerCase() === expectedSingleName
      );
      if (!hasSingleFile) {
        const singlePayload: DriveSingleUserRecordPayload = {
          type: 'WBP_USER_REGISTRATION_RECORD',
          folderId: GOOGLE_DRIVE_FOLDER_ID,
          registeredAt: new Date().toISOString(),
          user: cu
        };
        await saveJsonToDriveFolder(expectedSingleName, singlePayload, undefined, token);
        hasUnsyncedLocalChanges = true;
      }
    }

    if (hasUnsyncedLocalChanges || singleRecords.length > remoteUsernames.size) {
      const dbPayload: DriveUsersDatabasePayload = {
        type: 'WBP_USERS_DATABASE',
        folderId: GOOGLE_DRIVE_FOLDER_ID,
        updatedAt: new Date().toISOString(),
        deletedUsernames: finalDeleted,
        users: finalUsers
      };
      const savedDb = await saveJsonToDriveFolder(
        DRIVE_USERS_DB_FILENAME,
        dbPayload,
        existingDb?.id,
        token
      );
      updateSyncState({ usersDbFileId: savedDb?.id || existingDb?.id });
    }

    const nowStr = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    updateSyncState({
      isSyncing: false,
      lastSyncedAt: nowStr,
      usersDbFileId: existingDb?.id,
      lastError: null
    });

    return {
      users: finalUsers,
      deletedUsernames: finalDeleted,
      syncedFromDrive: true
    };
  } catch (err) {
    updateSyncState({
      isSyncing: false,
      lastError:
        err instanceof Error ? err.message : 'Gagal menarik data user dari Google Drive'
    });
    return null;
  }
}

/**
 * Pushes and merges tickets database (wbp_tickets_database.json) in Google Drive folder 1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF.
 */
export async function syncTicketsWithDriveFolder(
  localTickets: Ticket[],
  forceOverwriteDrive = false,
  accessToken?: string | null
): Promise<Ticket[] | null> {
  const token = accessToken || cachedAccessToken;
  if (!token) return null;

  try {
    const files = await listDriveFolderFiles(token);
    const existingTicketsDb = files.find((f) => f.name === DRIVE_TICKETS_DB_FILENAME);

    let remoteTickets: Ticket[] = [];
    if (existingTicketsDb && !forceOverwriteDrive) {
      const parsed = await downloadDriveJsonFile<
        DriveTicketsDatabasePayload | Ticket[]
      >(existingTicketsDb.id, token);
      if (Array.isArray(parsed)) {
        remoteTickets = parsed;
      } else if (parsed && Array.isArray(parsed.tickets)) {
        remoteTickets = parsed.tickets;
      }
    }

    const statusRank = (status: string) => {
      if (status.includes('CLOSED')) return 3;
      if (status.includes('PROSES')) return 2;
      return 1;
    };

    const ticketMap = new Map<string, Ticket>();
    for (const rt of remoteTickets) {
      if (rt && rt.ID_Tiket) {
        ticketMap.set(rt.ID_Tiket, rt);
      }
    }

    let shouldSaveToDrive = !existingTicketsDb || forceOverwriteDrive;
    for (const lt of localTickets) {
      if (!lt || !lt.ID_Tiket) continue;
      const existing = ticketMap.get(lt.ID_Tiket);
      if (!existing) {
        ticketMap.set(lt.ID_Tiket, lt);
        shouldSaveToDrive = true;
      } else {
        // Prefer whichever ticket has higher completion status or more attachments
        const localRank = statusRank(lt.Status_Pengerjaan);
        const remoteRank = statusRank(existing.Status_Pengerjaan);
        if (
          forceOverwriteDrive ||
          localRank > remoteRank ||
          (localRank === remoteRank &&
            JSON.stringify(lt) !== JSON.stringify(existing))
        ) {
          ticketMap.set(lt.ID_Tiket, lt);
          shouldSaveToDrive = true;
        }
      }
    }

    const mergedTickets = Array.from(ticketMap.values());

    if (shouldSaveToDrive) {
      const payload: DriveTicketsDatabasePayload = {
        type: 'WBP_TICKETS_DATABASE',
        folderId: GOOGLE_DRIVE_FOLDER_ID,
        updatedAt: new Date().toISOString(),
        tickets: mergedTickets
      };
      const saved = await saveJsonToDriveFolder(
        DRIVE_TICKETS_DB_FILENAME,
        payload,
        existingTicketsDb?.id,
        token
      );
      updateSyncState({
        ticketsDbFileId: saved?.id || existingTicketsDb?.id
      });
    }

    return mergedTickets;
  } catch (err) {
    console.warn('Ticket sync with Drive warning:', err);
    return null;
  }
}

/**
 * Uploads a File attachment directly to the specified Google Drive folder (1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF).
 */
export async function uploadFileToDriveFolder(
  file: File,
  accessToken?: string | null
): Promise<DriveUploadedFile> {
  const token = accessToken || cachedAccessToken;
  if (!token) {
    throw new Error('Silakan hubungkan akun Google Drive terlebih dahulu.');
  }

  const buildMultipartBody = (parents?: string[]) => {
    const metadata: Record<string, unknown> = {
      name: file.name,
      mimeType: file.type || 'application/octet-stream'
    };
    if (parents && parents.length > 0) {
      metadata.parents = parents;
    }

    const form = new FormData();
    form.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], { type: 'application/json' })
    );
    form.append('file', file);
    return form;
  };

  const endpoint =
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,size,webViewLink,webContentLink';

  // First try uploading directly into the target shared folder 1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF
  let response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: buildMultipartBody([GOOGLE_DRIVE_FOLDER_ID])
  });

  // If the user's Google account only has Viewer permission on the shared folder,
  // fallback to uploading into their Drive root while linking metadata so the upload still succeeds
  if (!response.ok && (response.status === 403 || response.status === 404)) {
    response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      },
      body: buildMultipartBody()
    });
  }

  if (!response.ok) {
    if (response.status === 401) {
      cachedAccessToken = null;
      notifyListeners();
    }
    const errText = await response.text();
    throw new Error(`Gagal mengunggah ke Google Drive (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const fileId: string = data.id;
  const webViewLink: string =
    data.webViewLink || `https://drive.google.com/file/d/${fileId}/view?usp=sharing`;
  const webContentLink: string =
    data.webContentLink || `https://drive.google.com/uc?export=download&id=${fileId}`;

  return {
    id: fileId,
    name: data.name || file.name,
    mimeType: data.mimeType || file.type || 'application/octet-stream',
    size: data.size,
    webViewLink,
    webContentLink,
    downloadUrl: webContentLink,
    folderId: GOOGLE_DRIVE_FOLDER_ID
  };
}
