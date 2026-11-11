import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  collection,
  getDocs,
  onSnapshot
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import type { Ticket, UserAccount } from '../types';

export const SCOPES = ['https://www.googleapis.com/auth/drive'];

export const GOOGLE_DRIVE_FOLDER_ID = '1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF';
export const GOOGLE_DRIVE_FOLDER_URL =
  'https://drive.google.com/drive/folders/1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF?usp=sharing';

// Dedicated Google Drive Folder for 'Permintaan' attachments (Sales / Proyek)
export const DRIVE_PERMINTAAN_FOLDER_ID = '1To0dQP0bco7s7czx48B9BlxLsT8FYXNY';
export const DRIVE_PERMINTAAN_FOLDER_URL =
  'https://drive.google.com/drive/folders/1To0dQP0bco7s7czx48B9BlxLsT8FYXNY?usp=sharing';

// Dedicated Google Drive Folder for 'Jawaban Atas Permintaan' attachments (Hasil Engineering)
export const DRIVE_JAWABAN_FOLDER_ID = '1PeQLFYkbwFMkXW_FVAIQIzNcGpalbvQy';
export const DRIVE_JAWABAN_FOLDER_URL =
  'https://drive.google.com/drive/folders/1PeQLFYkbwFMkXW_FVAIQIzNcGpalbvQy?usp=sharing';

export type DriveUploadCategory = 'permintaan' | 'jawaban_atas_permintaan';

export function resolveDriveFolderByCategory(
  categoryOrFolderId?: DriveUploadCategory | string
): {
  categoryKey: DriveUploadCategory;
  categoryLabel: 'Permintaan' | 'Jawaban Atas Permintaan';
  folderId: string;
  folderUrl: string;
} {
  const normalized = (categoryOrFolderId || 'permintaan').trim().toLowerCase();
  if (
    normalized === 'jawaban_atas_permintaan' ||
    normalized === 'jawaban atas permintaan' ||
    normalized === 'jawaban' ||
    normalized === 'hasil' ||
    normalized === 'response' ||
    categoryOrFolderId === DRIVE_JAWABAN_FOLDER_ID
  ) {
    return {
      categoryKey: 'jawaban_atas_permintaan',
      categoryLabel: 'Jawaban Atas Permintaan',
      folderId: DRIVE_JAWABAN_FOLDER_ID,
      folderUrl: DRIVE_JAWABAN_FOLDER_URL
    };
  }
  return {
    categoryKey: 'permintaan',
    categoryLabel: 'Permintaan',
    folderId: DRIVE_PERMINTAAN_FOLDER_ID,
    folderUrl: DRIVE_PERMINTAAN_FOLDER_URL
  };
}

export const DEFAULT_GAS_WEB_APP_URL =
  import.meta.env.VITE_GAS_WEB_APP_URL ||
  'https://script.google.com/macros/s/AKfycbz4q_EddMqXEnfNSDvuRbB-Ka3dlUPe1NNR7rD9gnllpHk8VaxiM8tvs6mSOLLfnj1a/exec';

export const DRIVE_USERS_DB_FILENAME = 'wbp_users_database.json';
export const DRIVE_TICKETS_DB_FILENAME = 'wbp_tickets_database.json';
export const DRIVE_USER_FILE_PREFIX = 'WBP_USER_';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
export const firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);

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
 * Uploads a File attachment directly to the target Google Drive folder based on category:
 * - 'Permintaan' -> 1To0dQP0bco7s7czx48B9BlxLsT8FYXNY
 * - 'Jawaban Atas Permintaan' -> 1PeQLFYkbwFMkXW_FVAIQIzNcGpalbvQy
 */
export async function uploadFileToDriveFolder(
  file: File,
  accessToken?: string | null,
  categoryOrFolderId: DriveUploadCategory | string = 'permintaan'
): Promise<DriveUploadedFile> {
  const token = accessToken || cachedAccessToken;
  if (!token) {
    throw new Error('Silakan hubungkan akun Google Drive terlebih dahulu.');
  }

  const resolved = resolveDriveFolderByCategory(categoryOrFolderId);
  const targetFolderId = resolved.folderId;

  const buildMultipartBody = (parents?: string[]) => {
    const metadata: Record<string, unknown> = {
      name: file.name,
      mimeType: file.type || 'application/octet-stream',
      description: `Kategori: ${resolved.categoryLabel} | Folder ID: ${targetFolderId}`
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

  // First try uploading directly into the target category folder (Permintaan or Jawaban Atas Permintaan)
  let response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: buildMultipartBody([targetFolderId])
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
    folderId: targetFolderId
  };
}

/**
 * Uploads a file via the backend server (/api/files/upload) and Google Apps Script Web App
 * into the separated category folder:
 * - 'Permintaan' -> 1To0dQP0bco7s7czx48B9BlxLsT8FYXNY
 * - 'Jawaban Atas Permintaan' -> 1PeQLFYkbwFMkXW_FVAIQIzNcGpalbvQy
 */
export async function uploadFileViaGasAndBackend(params: {
  file: File;
  dataUrl: string;
  category: DriveUploadCategory | string;
  ticketId?: string;
  gasWebAppUrl?: string;
}): Promise<{
  id?: string;
  webViewLink?: string;
  downloadUrl?: string;
  folderId: string;
  categoryLabel: string;
}> {
  const resolved = resolveDriveFolderByCategory(params.category);
  const base64Clean = params.dataUrl.includes(',')
    ? params.dataUrl.split(',')[1]
    : params.dataUrl;

  const payload = {
    action: 'uploadFile',
    category: resolved.categoryLabel,
    categoryKey: resolved.categoryKey,
    folderId: resolved.folderId,
    ticketId: params.ticketId || '',
    fileName: params.file.name,
    mimeType: params.file.type || 'application/octet-stream',
    size: params.file.size,
    base64Data: base64Clean,
    uploadedAt: new Date().toISOString()
  };

  let uploadedId: string | undefined;
  let webViewLink: string | undefined;
  let downloadUrl: string | undefined;

  // 1. Try backend server endpoint (/api/files/upload) which bridges both Drive API and GAS Web App
  try {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (cachedAccessToken) {
      headers.Authorization = `Bearer ${cachedAccessToken}`;
    }
    const serverRes = await fetch('/api/files/upload', {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    });
    const ct = serverRes.headers.get('content-type') || '';
    if (serverRes.ok && ct.includes('application/json')) {
      const data = await serverRes.json();
      if (data && typeof data.id === 'string' && data.id) {
        uploadedId = data.id;
        webViewLink =
          data.webViewLink ||
          `https://drive.google.com/file/d/${data.id}/view?usp=sharing`;
        downloadUrl =
          data.downloadUrl ||
          `https://drive.google.com/uc?export=download&id=${data.id}`;
      }
    }
  } catch {
    // ignore if static preview
  }

  // 2. Also send directly to Google Apps Script Web App endpoint (using text/plain to bypass CORS preflight)
  if (!uploadedId) {
    const endpoint = (params.gasWebAppUrl || DEFAULT_GAS_WEB_APP_URL).trim();
    if (endpoint && endpoint.startsWith('https://script.google.com/')) {
      try {
        const gasRes = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'text/plain;charset=utf-8'
          },
          body: JSON.stringify(payload)
        });
        if (gasRes.ok) {
          const text = (await gasRes.text()).trim();
          if (text.startsWith('{')) {
            const parsed = JSON.parse(text) as {
              id?: string;
              fileId?: string;
              webViewLink?: string;
              downloadUrl?: string;
            };
            const fid = parsed.id || parsed.fileId;
            if (fid) {
              uploadedId = fid;
              webViewLink =
                parsed.webViewLink ||
                `https://drive.google.com/file/d/${fid}/view?usp=sharing`;
              downloadUrl =
                parsed.downloadUrl ||
                `https://drive.google.com/uc?export=download&id=${fid}`;
            }
          }
        }
      } catch {
        // ignore
      }
    }
  }

  return {
    id: uploadedId,
    webViewLink,
    downloadUrl,
    folderId: resolved.folderId,
    categoryLabel: resolved.categoryLabel
  };
}

// ==================== REAL-TIME CROSS-COMPUTER CLOUD FIRESTORE SYNC ====================

function sanitizeUserForFirestore(u: UserAccount): Record<string, unknown> {
  const clean: Record<string, unknown> = {
    id: String(u.id || `usr-${Date.now()}`),
    fullName: String(u.fullName || u.username || 'User WBP'),
    username: String(u.username || '').trim(),
    password: String(u.password || 'WBP123'),
    role: u.role || 'pemberi_tugas',
    roleName: String(u.roleName || 'Pemberi Tugas (Sales / Proyek)'),
    whatsapp: String(u.whatsapp || ''),
    createdAt: String(u.createdAt || new Date().toLocaleDateString('id-ID')),
    isDefault: Boolean(u.isDefault),
    isAdmin: Boolean(u.isAdmin)
  };
  if (u.department) {
    clean.department = String(u.department);
  }
  return clean;
}

/**
 * Atomically saves a newly registered or updated user to Google Cloud Firestore
 * (both individual document in /wbp_users/{username} and unified metadata in /wbp_meta/users_db)
 * so that ANY computer/browser (ais-dev, ais-pre, mobile, desktop) receives it in real time (< 300ms).
 */
export async function upsertUserToCloudFirestore(
  user: UserAccount,
  allUsers: UserAccount[],
  deletedUsernames: string[] = []
): Promise<boolean> {
  try {
    const docKey = user.username.trim().toLowerCase();
    await Promise.all([
      setDoc(doc(firestoreDb, 'wbp_users', docKey), sanitizeUserForFirestore(user)),
      setDoc(
        doc(firestoreDb, 'wbp_meta', 'users_db'),
        {
          folderId: GOOGLE_DRIVE_FOLDER_ID,
          updatedAt: new Date().toISOString(),
          deletedUsernames,
          usersJson: JSON.stringify(allUsers)
        },
        { merge: true }
      )
    ]);
    const nowStr = new Date().toLocaleTimeString('id-ID', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    updateSyncState({
      isSyncing: false,
      lastSyncedAt: nowStr,
      lastError: null
    });
    return true;
  } catch (err) {
    console.warn('Cloud Firestore upsert user warning:', err);
    return false;
  }
}

/**
 * Deletes a user account from Google Cloud Firestore across all computers.
 */
export async function deleteUserFromCloudFirestore(
  username: string,
  allUsers: UserAccount[],
  deletedUsernames: string[]
): Promise<boolean> {
  try {
    const docKey = username.trim().toLowerCase();
    await Promise.all([
      deleteDoc(doc(firestoreDb, 'wbp_users', docKey)),
      setDoc(
        doc(firestoreDb, 'wbp_meta', 'users_db'),
        {
          folderId: GOOGLE_DRIVE_FOLDER_ID,
          updatedAt: new Date().toISOString(),
          deletedUsernames,
          usersJson: JSON.stringify(allUsers)
        },
        { merge: true }
      )
    ]);
    return true;
  } catch (err) {
    console.warn('Cloud Firestore delete user warning:', err);
    return false;
  }
}

/**
 * Resets the Cloud Firestore user database back to default users across all computers.
 */
export async function resetUsersInCloudFirestore(
  defaultUsers: UserAccount[]
): Promise<boolean> {
  try {
    const colSnap = await getDocs(collection(firestoreDb, 'wbp_users'));
    const defaultKeys = new Set(defaultUsers.map((u) => u.username.toLowerCase()));
    const ops: Promise<unknown>[] = [];

    colSnap.forEach((docSnap) => {
      if (!defaultKeys.has(docSnap.id.toLowerCase())) {
        ops.push(deleteDoc(doc(firestoreDb, 'wbp_users', docSnap.id)));
      }
    });

    for (const du of defaultUsers) {
      ops.push(
        setDoc(
          doc(firestoreDb, 'wbp_users', du.username.toLowerCase()),
          sanitizeUserForFirestore(du)
        )
      );
    }

    ops.push(
      setDoc(
        doc(firestoreDb, 'wbp_meta', 'users_db'),
        {
          folderId: GOOGLE_DRIVE_FOLDER_ID,
          updatedAt: new Date().toISOString(),
          deletedUsernames: [],
          usersJson: JSON.stringify(defaultUsers)
        },
        { merge: true }
      )
    );

    await Promise.all(ops);
    return true;
  } catch (err) {
    console.warn('Cloud Firestore reset users warning:', err);
    return false;
  }
}

/**
 * Saves optional Google Apps Script Web App URL to Cloud Firestore metadata.
 */
export async function saveGasConfigToCloudFirestore(
  gasWebAppUrl: string
): Promise<boolean> {
  try {
    await setDoc(
      doc(firestoreDb, 'wbp_meta', 'users_db'),
      {
        folderId: GOOGLE_DRIVE_FOLDER_ID,
        updatedAt: new Date().toISOString(),
        gasWebAppUrl
      },
      { merge: true }
    );
    return true;
  } catch {
    return false;
  }
}

/**
 * Pulls and merges all user accounts from Cloud Firestore (/wbp_users collection + /wbp_meta/users_db).
 */
export async function fetchUsersFromCloudFirestore(): Promise<{
  users: UserAccount[];
  deletedUsernames: string[];
  gasWebAppUrl?: string;
} | null> {
  try {
    const [metaSnap, colSnap] = await Promise.all([
      getDoc(doc(firestoreDb, 'wbp_meta', 'users_db')),
      getDocs(collection(firestoreDb, 'wbp_users'))
    ]);

    let deletedUsernames: string[] = [];
    let metaUsers: UserAccount[] = [];
    let gasWebAppUrl = '';

    if (metaSnap.exists()) {
      const metaData = metaSnap.data() as {
        deletedUsernames?: string[];
        usersJson?: string;
        gasWebAppUrl?: string;
      };
      if (Array.isArray(metaData.deletedUsernames)) {
        deletedUsernames = metaData.deletedUsernames;
      }
      if (typeof metaData.gasWebAppUrl === 'string') {
        gasWebAppUrl = metaData.gasWebAppUrl;
      }
      if (typeof metaData.usersJson === 'string' && metaData.usersJson.trim()) {
        try {
          const parsed = JSON.parse(metaData.usersJson);
          if (Array.isArray(parsed)) metaUsers = parsed;
        } catch {
          // ignore
        }
      }
    }

    const colUsers: UserAccount[] = [];
    colSnap.forEach((docSnap) => {
      const data = docSnap.data() as unknown as UserAccount;
      if (data && data.username) {
        colUsers.push(data);
      }
    });

    if (colUsers.length === 0 && metaUsers.length === 0) {
      return null;
    }

    const deletedSet = new Set(deletedUsernames.map((u) => u.toLowerCase()));
    const mergedMap = new Map<string, UserAccount>();

    // Individual collection documents take priority (most granular cross-PC writes)
    for (const u of [...colUsers, ...metaUsers]) {
      if (!u || !u.username) continue;
      const key = u.username.toLowerCase();
      if (deletedSet.has(key)) continue;
      if (!mergedMap.has(key)) {
        mergedMap.set(key, u);
      }
    }

    return {
      users: Array.from(mergedMap.values()),
      deletedUsernames: Array.from(deletedSet),
      gasWebAppUrl
    };
  } catch (err) {
    console.warn('Cloud Firestore fetch warning:', err);
    return null;
  }
}

/**
 * Subscribes to real-time changes in Cloud Firestore (/wbp_users and /wbp_meta/users_db)
 * so that when a user registers on Computer B, Computer A (Admin Kelola User) updates instantaneously.
 */
export function subscribeCloudFirestoreUsers(
  onUpdate: (payload: {
    users: UserAccount[];
    deletedUsernames: string[];
    gasWebAppUrl?: string;
  }) => void
): () => void {
  let latestMetaUsers: UserAccount[] = [];
  let latestDeleted: string[] = [];
  let latestGasUrl = '';
  let latestColUsers: UserAccount[] = [];
  let initializedMeta = false;
  let initializedCol = false;

  const emitCombined = () => {
    if (!initializedMeta && !initializedCol) return;
    if (latestColUsers.length === 0 && latestMetaUsers.length === 0) return;

    const deletedSet = new Set(latestDeleted.map((u) => u.toLowerCase()));
    const map = new Map<string, UserAccount>();
    for (const u of [...latestColUsers, ...latestMetaUsers]) {
      if (!u || !u.username) continue;
      const key = u.username.toLowerCase();
      if (deletedSet.has(key)) continue;
      if (!map.has(key)) {
        map.set(key, u);
      }
    }

    onUpdate({
      users: Array.from(map.values()),
      deletedUsernames: Array.from(deletedSet),
      gasWebAppUrl: latestGasUrl
    });
  };

  const unsubMeta = onSnapshot(
    doc(firestoreDb, 'wbp_meta', 'users_db'),
    (snap) => {
      initializedMeta = true;
      if (snap.exists()) {
        const data = snap.data() as {
          deletedUsernames?: string[];
          usersJson?: string;
          gasWebAppUrl?: string;
        };
        latestDeleted = Array.isArray(data.deletedUsernames)
          ? data.deletedUsernames
          : [];
        if (typeof data.gasWebAppUrl === 'string') {
          latestGasUrl = data.gasWebAppUrl;
        }
        if (typeof data.usersJson === 'string' && data.usersJson.trim()) {
          try {
            const parsed = JSON.parse(data.usersJson);
            if (Array.isArray(parsed)) latestMetaUsers = parsed;
          } catch {
            // ignore
          }
        }
      }
      emitCombined();
    },
    (err) => {
      console.warn('Firestore meta snapshot warning:', err);
    }
  );

  const unsubCol = onSnapshot(
    collection(firestoreDb, 'wbp_users'),
    (snap) => {
      initializedCol = true;
      const list: UserAccount[] = [];
      snap.forEach((d) => {
        const u = d.data() as unknown as UserAccount;
        if (u && u.username) list.push(u);
      });
      latestColUsers = list;
      emitCombined();
    },
    (err) => {
      console.warn('Firestore users collection snapshot warning:', err);
    }
  );

  return () => {
    unsubMeta();
    unsubCol();
  };
}

/**
 * Directly sends user registration / update / deletion / sync payload to the configured
 * Google Apps Script Web App endpoint (using text/plain;charset=utf-8 to avoid browser CORS preflight).
 */
export async function pushUsersToGasEndpoint(params: {
  gasWebAppUrl?: string;
  action: 'registerUser' | 'updateUser' | 'deleteUser' | 'resetUsers' | 'syncUsers';
  user?: UserAccount;
  deletedUsername?: string;
  users: UserAccount[];
  deletedUsernames: string[];
}): Promise<boolean> {
  const endpoint = (params.gasWebAppUrl || DEFAULT_GAS_WEB_APP_URL).trim();
  if (!endpoint || !endpoint.startsWith('https://script.google.com/')) {
    return false;
  }

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: JSON.stringify({
        action: params.action,
        folderId: GOOGLE_DRIVE_FOLDER_ID,
        user: params.user,
        deletedUsername: params.deletedUsername,
        users: params.users,
        deletedUsernames: params.deletedUsernames,
        updatedAt: new Date().toISOString()
      })
    });
    return res.ok;
  } catch (err) {
    console.warn('Direct GAS endpoint push warning:', err);
    return false;
  }
}

/**
 * Pulls registered users from the configured Google Apps Script Web App endpoint.
 */
export async function pullUsersFromGasEndpoint(
  gasWebAppUrl?: string
): Promise<{
  users: UserAccount[];
  deletedUsernames: string[];
} | null> {
  const endpoint = (gasWebAppUrl || DEFAULT_GAS_WEB_APP_URL).trim();
  if (!endpoint || !endpoint.startsWith('https://script.google.com/')) {
    return null;
  }

  try {
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${endpoint}${separator}action=getUsers&folderId=${GOOGLE_DRIVE_FOLDER_ID}&t=${Date.now()}`;
    const res = await fetch(url, {
      method: 'GET',
      redirect: 'follow'
    });
    if (!res.ok) return null;

    const text = (await res.text()).trim();
    if (!text.startsWith('{') && !text.startsWith('[')) {
      return null;
    }

    const parsed = JSON.parse(text) as
      | UserAccount[]
      | { users?: UserAccount[]; deletedUsernames?: string[] };

    if (Array.isArray(parsed)) {
      return { users: parsed, deletedUsernames: [] };
    }
    if (parsed && Array.isArray(parsed.users)) {
      return {
        users: parsed.users,
        deletedUsernames: Array.isArray(parsed.deletedUsernames)
          ? parsed.deletedUsernames
          : []
      };
    }
    return null;
  } catch {
    return null;
  }
}


