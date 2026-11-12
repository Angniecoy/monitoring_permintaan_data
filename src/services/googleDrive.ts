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
  'https://script.google.com/macros/s/AKfycbwf11X_caQ9oCQmoPgJfnBpqM4w6uc02O-aMWC40qoRIdwgxZc5-V9LzQZxy3zAEDg3/exec';

const DEPRECATED_GAS_IDS = [
  'AKfycbz4q_EddMqXEnfNSDvuRbB-Ka3dlUPe1NNR7rD9gnllpHk8VaxiM8tvs6mSOLLfnj1a'
];

export function normalizeGasWebAppUrl(rawUrl?: string | null): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed || !trimmed.startsWith('https://script.google.com/')) {
    return DEFAULT_GAS_WEB_APP_URL;
  }
  if (DEPRECATED_GAS_IDS.some((oldId) => trimmed.includes(oldId))) {
    return DEFAULT_GAS_WEB_APP_URL;
  }
  return trimmed;
}

export const DRIVE_USERS_DB_FILENAME = 'wbp_users_database.json';
export const DRIVE_TICKETS_DB_FILENAME = 'wbp_tickets_database.json';
export const DRIVE_USER_FILE_PREFIX = 'WBP_USER_';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
export const firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

let isSigningIn = false;
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

    void fetch('https://monitoring-permintaan-data.onrender.com/api/drive/token', {
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

export async function listDriveFolderFiles(
  accessToken?: string | null
): Promise<DriveFileMeta[]> {
  const token = accessToken || cachedAccessToken;
  if (!token) return [];

  const folderQuery = encodeURIComponent(
    `'${GOOGLE_DRIVE_FOLDER_ID}' in parents and trashed = false`
  );
  const folderUrl = `https://www.googleapis.com/drive/v3/files?q=${folderQuery}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name,mimeType,modifiedTime,webViewLink,webContentLink)&orderBy=modifiedTime desc&pageSize=100`;

  try {
    const resFolder = await fetch(folderUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (resFolder.ok) {
      const data = await resFolder.json();
      if (Array.isArray(data.files)) {
        return data.files;
      }
    }
  } catch (err) {
    console.warn('Could not list Drive folder directly:', err);
  }
  return [];
}

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
          webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view?usp=sharing`,
          webContentLink: data.webContentLink || `https://drive.google.com/uc?export=download&id=${data.id}`,
          downloadUrl: data.webContentLink || `https://drive.google.com/uc?export=download&id=${data.id}`,
          folderId: GOOGLE_DRIVE_FOLDER_ID
        };
      }
    }

    const createUrl =
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,size,webViewLink,webContentLink';
    const createRes = await fetch(createUrl, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: buildMultipart(true)
    });

    if (!createRes.ok) return null;
    const data = await createRes.json();
    return {
      id: data.id,
      name: data.name || fileName,
      mimeType: 'application/json',
      size: data.size,
      webViewLink: data.webViewLink || `https://drive.google.com/file/d/${data.id}/view?usp=sharing`,
      webContentLink: data.webContentLink || `https://drive.google.com/uc?export=download&id=${data.id}`,
      downloadUrl: data.webContentLink || `https://drive.google.com/uc?export=download&id=${data.id}`,
      folderId: GOOGLE_DRIVE_FOLDER_ID
    };
  } catch (err) {
    return null;
  }
}

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

export async function uploadFileToDriveFolder(
  file: File,
  accessToken?: string | null,
  categoryOrFolderId: DriveUploadCategory | string = 'permintaan'
): Promise<DriveUploadedFile> {
  const resolved = resolveDriveFolderByCategory(categoryOrFolderId);
  const targetFolderId = resolved.folderId;

  // Fallback to GAS endpoint for public server-side upload if direct token is not present
  const reader = new FileReader();
  const base64Data = await new Promise<string>((resolve, reject) => {
    reader.onload = () => {
      const res = reader.result as string;
      const clean = res.includes(',') ? res.split(',')[1] : res;
      resolve(clean);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const res = await uploadFileViaGasAndBackend({
    file,
    dataUrl: base64Data,
    category: resolved.categoryKey
  });

  return {
    id: res.id || `file-${Date.now()}`,
    name: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: String(file.size),
    webViewLink: res.webViewLink || resolved.folderUrl,
    webContentLink: res.downloadUrl || resolved.folderUrl,
    downloadUrl: res.downloadUrl || resolved.folderUrl,
    folderId: targetFolderId
  };
}

/**
 * Uploads a file via Google Apps Script Web App endpoint directly (using text/plain to bypass CORS preflight)
 * ensuring public users can upload files into the separated category folders without needing Google Drive login.
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
  gasSynced: boolean;
}> {
  const resolved = resolveDriveFolderByCategory(params.category);
  const base64Clean = params.dataUrl.includes(',')
    ? params.dataUrl.split(',')[1]
    : params.dataUrl;

  const payload = {
    action: 'uploadFile',
    category: resolved.categoryLabel,
    kategori: resolved.categoryLabel,
    categoryKey: resolved.categoryKey,
    jenis: resolved.categoryLabel,
    type: resolved.categoryKey,
    folderId: resolved.folderId,
    targetFolderId: resolved.folderId,
    ticketId: params.ticketId || '',
    fileName: params.file.name,
    name: params.file.name,
    mimeType: params.file.type || 'application/octet-stream',
    size: params.file.size,
    base64Data: base64Clean,
    data: base64Clean,
    uploadedAt: new Date().toISOString()
  };

  let uploadedId: string | undefined;
  let webViewLink: string | undefined;
  let downloadUrl: string | undefined;
  let gasSynced = false;

  const endpoint = normalizeGasWebAppUrl(params.gasWebAppUrl);
  if (endpoint && endpoint.startsWith('https://script.google.com/')) {
    try {
      const sep = endpoint.includes('?') ? '&' : '?';
      const gasUrlWithParams = `${endpoint}${sep}action=uploadFile&category=${encodeURIComponent(
        resolved.categoryLabel
      )}&kategori=${encodeURIComponent(
        resolved.categoryLabel
      )}&categoryKey=${encodeURIComponent(
        resolved.categoryKey
      )}&folderId=${encodeURIComponent(resolved.folderId)}`;

      const gasRes = await fetch(gasUrlWithParams, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8'
        },
        body: JSON.stringify(payload)
      });

      if (gasRes.ok) {
        gasSynced = true;
        const text = (await gasRes.text()).trim();
        if (text.startsWith('{')) {
          const parsed = JSON.parse(text) as {
            id?: string;
            fileId?: string;
            webViewLink?: string;
            url?: string;
            downloadUrl?: string;
          };
          const fid = parsed.id || parsed.fileId;
          if (fid) {
            uploadedId = fid;
            webViewLink =
              parsed.webViewLink ||
              parsed.url ||
              `https://drive.google.com/file/d/${fid}/view?usp=sharing`;
            downloadUrl =
              parsed.downloadUrl ||
              `https://drive.google.com/uc?export=download&id=${fid}`;
          }
        }
      }
    } catch (err) {
      console.warn('GAS direct upload warning:', err);
    }
  }

  // Fallback direct link if GAS ID wasn't explicitly returned in JSON text
  if (!webViewLink) {
    webViewLink = resolved.folderUrl;
  }
  if (!downloadUrl) {
    downloadUrl = resolved.folderUrl;
  }

  return {
    id: uploadedId || `drive-file-${Date.now()}`,
    webViewLink,
    downloadUrl,
    folderId: resolved.folderId,
    categoryLabel: resolved.categoryLabel,
    gasSynced: Boolean(uploadedId || gasSynced)
  };
}

function sanitizeUserForFirestore(u: UserAccount): Record<string, unknown> {
  return {
    id: String(u.id || `usr-${Date.now()}`),
    fullName: String(u.fullName || u.username || 'User WBP'),
    username: String(u.username || '').trim(),
    password: String(u.password || 'WBP123'),
    role: u.role || 'pemberi_tugas',
    roleName: String(u.roleName || 'Pemberi Tugas (Sales / Proyek)'),
    whatsapp: String(u.whatsapp || ''),
    createdAt: String(u.createdAt || new Date().toLocaleDateString('id-ID')),
    isDefault: Boolean(u.isDefault),
    isAdmin: Boolean(u.isAdmin),
    ...(u.department ? { department: String(u.department) } : {})
  };
}

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
    return true;
  } catch {
    return false;
  }
}

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
  } catch {
    return false;
  }
}

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
  } catch {
    return false;
  }
}

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
      if (typeof metaData.gasWebAppUrl === 'string' && metaData.gasWebAppUrl) {
        gasWebAppUrl = normalizeGasWebAppUrl(metaData.gasWebAppUrl);
      } else {
        gasWebAppUrl = DEFAULT_GAS_WEB_APP_URL;
      }
      if (typeof metaData.usersJson === 'string' && metaData.usersJson.trim()) {
        try {
          const parsed = JSON.parse(metaData.usersJson);
          if (Array.isArray(parsed)) metaUsers = parsed;
        } catch {}
      }
    } else {
      gasWebAppUrl = DEFAULT_GAS_WEB_APP_URL;
    }

    const colUsers: UserAccount[] = [];
    colSnap.forEach((docSnap) => {
      const data = docSnap.data() as unknown as UserAccount;
      if (data && data.username) colUsers.push(data);
    });

    if (colUsers.length === 0 && metaUsers.length === 0) return null;

    const deletedSet = new Set(deletedUsernames.map((u) => u.toLowerCase()));
    const mergedMap = new Map<string, UserAccount>();

    for (const u of [...colUsers, ...metaUsers]) {
      if (!u || !u.username) continue;
      const key = u.username.toLowerCase();
      if (!deletedSet.has(key) && !mergedMap.has(key)) {
        mergedMap.set(key, u);
      }
    }

    return {
      users: Array.from(mergedMap.values()),
      deletedUsernames: Array.from(deletedSet),
      gasWebAppUrl
    };
  } catch {
    return null;
  }
}

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
    const deletedSet = new Set(latestDeleted.map((u) => u.toLowerCase()));
    const map = new Map<string, UserAccount>();
    for (const u of [...latestColUsers, ...latestMetaUsers]) {
      if (!u || !u.username) continue;
      const key = u.username.toLowerCase();
      if (!deletedSet.has(key) && !map.has(key)) {
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
        latestDeleted = Array.isArray(data.deletedUsernames) ? data.deletedUsernames : [];
        if (data.gasWebAppUrl) latestGasUrl = normalizeGasWebAppUrl(data.gasWebAppUrl);
        if (data.usersJson) {
          try {
            const parsed = JSON.parse(data.usersJson);
            if (Array.isArray(parsed)) latestMetaUsers = parsed;
          } catch {}
        }
      }
      emitCombined();
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
    }
  );

  return () => {
    unsubMeta();
    unsubCol();
  };
}

export async function pushUsersToGasEndpoint(params: {
  gasWebAppUrl?: string;
  action: 'registerUser' | 'updateUser' | 'deleteUser' | 'resetUsers' | 'syncUsers';
  user?: UserAccount;
  deletedUsername?: string;
  users: UserAccount[];
  deletedUsernames: string[];
}): Promise<boolean> {
  const endpoint = normalizeGasWebAppUrl(params.gasWebAppUrl);
  if (!endpoint) return false;

  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action: params.action,
        folderId: GOOGLE_DRIVE_FOLDER_ID,
        permintaanFolderId: DRIVE_PERMINTAAN_FOLDER_ID,
        jawabanFolderId: DRIVE_JAWABAN_FOLDER_ID,
        user: params.user,
        deletedUsername: params.deletedUsername,
        users: params.users,
        deletedUsernames: params.deletedUsernames,
        updatedAt: new Date().toISOString()
      })
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function pullUsersFromGasEndpoint(
  gasWebAppUrl?: string
): Promise<{
  users: UserAccount[];
  deletedUsernames: string[];
} | null> {
  const endpoint = normalizeGasWebAppUrl(gasWebAppUrl);
  if (!endpoint) return null;

  try {
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${endpoint}${separator}action=getUsers&folderId=${GOOGLE_DRIVE_FOLDER_ID}&t=${Date.now()}`;
    const res = await fetch(url, { method: 'GET', redirect: 'follow' });
    if (!res.ok) return null;

    const text = (await res.text()).trim();
    if (!text.startsWith('{') && !text.startsWith('[')) return null;

    const parsed = JSON.parse(text) as
      | UserAccount[]
      | { users?: UserAccount[]; deletedUsernames?: string[] };

    if (Array.isArray(parsed)) return { users: parsed, deletedUsernames: [] };
    if (parsed && Array.isArray(parsed.users)) {
      return {
        users: parsed.users,
        deletedUsernames: Array.isArray(parsed.deletedUsernames) ? parsed.deletedUsernames : []
      };
    }
    return null;
  } catch {
    return null;
  }
}
