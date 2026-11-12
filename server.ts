import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, getApps, getApp } from 'firebase/app';
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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GOOGLE_DRIVE_FOLDER_ID = '1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF';
const DRIVE_PERMINTAAN_FOLDER_ID = '1To0dQP0bco7s7czx48B9BlxLsT8FYXNY';
const DRIVE_JAWABAN_FOLDER_ID = '1PeQLFYkbwFMkXW_FVAIQIzNcGpalbvQy';
const DEFAULT_GAS_WEB_APP_URL =
  'https://script.google.com/macros/s/AKfycbwf11X_caQ9oCQmoPgJfnBpqM4w6uc02O-aMWC40qoRIdwgxZc5-V9LzQZxy3zAEDg3/exec';
const DEPRECATED_GAS_IDS = [
  'AKfycbz4q_EddMqXEnfNSDvuRbB-Ka3dlUPe1NNR7rD9gnllpHk8VaxiM8tvs6mSOLLfnj1a'
];

function normalizeServerGasUrl(rawUrl?: string | null): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed || !trimmed.startsWith('https://script.google.com/')) {
    return DEFAULT_GAS_WEB_APP_URL;
  }
  if (DEPRECATED_GAS_IDS.some((oldId) => trimmed.includes(oldId))) {
    return DEFAULT_GAS_WEB_APP_URL;
  }
  return trimmed;
}

const DRIVE_USERS_DB_FILENAME = 'wbp_users_database.json';
const DRIVE_USER_FILE_PREFIX = 'WBP_USER_';

function resolveServerUploadFolder(categoryOrFolder?: string): {
  folderId: string;
  categoryKey: 'permintaan' | 'jawaban_atas_permintaan';
  categoryLabel: 'Permintaan' | 'Jawaban Atas Permintaan';
} {
  const normalized = (categoryOrFolder || '').trim().toLowerCase();
  if (
    normalized === 'jawaban_atas_permintaan' ||
    normalized === 'jawaban atas permintaan' ||
    normalized === 'jawaban' ||
    normalized === 'hasil' ||
    normalized === DRIVE_JAWABAN_FOLDER_ID.toLowerCase()
  ) {
    return {
      folderId: DRIVE_JAWABAN_FOLDER_ID,
      categoryKey: 'jawaban_atas_permintaan',
      categoryLabel: 'Jawaban Atas Permintaan'
    };
  }
  return {
    folderId: DRIVE_PERMINTAAN_FOLDER_ID,
    categoryKey: 'permintaan',
    categoryLabel: 'Permintaan'
  };
}

const firebaseConfigRaw = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'firebase-applet-config.json'), 'utf-8')
);
const firebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfigRaw) : getApp();
const serverFirestoreDb = getFirestore(
  firebaseApp,
  firebaseConfigRaw.firestoreDatabaseId
);

interface ServerUserAccount {
  id: string;
  fullName: string;
  username: string;
  password: string;
  role: 'pemberi_tugas' | 'manager' | 'staff' | 'dashboard';
  roleName: string;
  department?: string;
  whatsapp?: string;
  createdAt: string;
  isDefault?: boolean;
  isAdmin?: boolean;
}

interface CentralizedCloudDB {
  folderId: string;
  updatedAt: string;
  users: ServerUserAccount[];
  deletedUsernames: string[];
  gasWebAppUrl?: string;
}

const ROLE_LABELS: Record<string, string> = {
  pemberi_tugas: 'Pemberi Tugas (Sales / Proyek)',
  manager: 'Manager Engineering (Disposisi)',
  staff: 'Staff Engineering (Eksekutor)',
  dashboard: 'Dashboard & Analitik'
};

const CLEAN_ZERO_EPOCH = 'v2_clean_zero';

const INITIAL_USERS: ServerUserAccount[] = [];

const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE_PATH = path.join(DATA_DIR, 'wbp_cloud_database.json');

// In-memory Google Drive access token (bridged from authenticated client session; never written to disk)
let activeDriveAccessToken: string | null = null;

function formatCurrentDateTime(): string {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, '0');
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const y = now.getFullYear();
  const h = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `${d}/${m}/${y} ${h}:${min}`;
}

function cleanWhatsAppNumber(phoneStr?: string): string {
  if (!phoneStr || phoneStr.trim() === '-' || phoneStr.trim() === '') return '';
  let clean = phoneStr.replace(/\D/g, '');
  if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1);
  } else if (!clean.startsWith('62') && clean !== '') {
    clean = '62' + clean;
  }
  return clean;
}

function normalizeUserAccount(u: Partial<ServerUserAccount>, index: number): ServerUserAccount {
  const safeRole =
    u.role === 'pemberi_tugas' ||
    u.role === 'manager' ||
    u.role === 'staff' ||
    u.role === 'dashboard'
      ? u.role
      : 'pemberi_tugas';
  const cleanUser = (u.username || `user_${index}`).trim();
  const isDefaultAccount =
    typeof u.isDefault === 'boolean'
      ? u.isDefault
      : INITIAL_USERS.some(
          (init) => init.id === u.id || init.username.toLowerCase() === cleanUser.toLowerCase()
        );

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
      u.isAdmin === true || cleanUser.toLowerCase() === 'admin' || safeRole === 'dashboard'
  };
}

function sortUsersCustomFirst(users: ServerUserAccount[]): ServerUserAccount[] {
  const normalized = users.map((u, idx) => normalizeUserAccount(u, idx));
  const hasAdmin = normalized.some(
    (u) => u.username.toLowerCase() === 'admin' || u.role === 'dashboard' || u.isAdmin
  );
  const defaultAdmin = INITIAL_USERS.find((u) => u.username.toLowerCase() === 'admin');
  const complete = !hasAdmin && defaultAdmin ? [...normalized, defaultAdmin] : normalized;

  const custom = complete.filter((u) => !u.isDefault);
  const defaults = complete.filter((u) => u.isDefault);
  return [...custom, ...defaults];
}

function readCloudDB(): CentralizedCloudDB {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE_PATH)) {
      const initial: CentralizedCloudDB = {
        folderId: GOOGLE_DRIVE_FOLDER_ID,
        updatedAt: new Date().toISOString(),
        users: INITIAL_USERS,
        deletedUsernames: [],
        gasWebAppUrl: DEFAULT_GAS_WEB_APP_URL
      };
      fs.writeFileSync(DB_FILE_PATH, JSON.stringify(initial, null, 2), 'utf-8');
      return initial;
    }
    const raw = fs.readFileSync(DB_FILE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<CentralizedCloudDB>;
    const users = Array.isArray(parsed.users)
      ? sortUsersCustomFirst(parsed.users)
      : INITIAL_USERS;
    return {
      folderId: GOOGLE_DRIVE_FOLDER_ID,
      updatedAt: parsed.updatedAt || new Date().toISOString(),
      users,
      deletedUsernames: Array.isArray(parsed.deletedUsernames) ? parsed.deletedUsernames : [],
      gasWebAppUrl: normalizeServerGasUrl(parsed.gasWebAppUrl)
    };
  } catch (err) {
    console.error('Error reading centralized cloud DB:', err);
    return {
      folderId: GOOGLE_DRIVE_FOLDER_ID,
      updatedAt: new Date().toISOString(),
      users: INITIAL_USERS,
      deletedUsernames: [],
      gasWebAppUrl: DEFAULT_GAS_WEB_APP_URL
    };
  }
}

function writeCloudDB(db: CentralizedCloudDB): CentralizedCloudDB {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const ordered: CentralizedCloudDB = {
      ...db,
      folderId: GOOGLE_DRIVE_FOLDER_ID,
      updatedAt: new Date().toISOString(),
      gasWebAppUrl: normalizeServerGasUrl(db.gasWebAppUrl),
      users: sortUsersCustomFirst(db.users)
    };
    fs.writeFileSync(DB_FILE_PATH, JSON.stringify(ordered, null, 2), 'utf-8');
    return ordered;
  } catch (err) {
    console.error('Error writing centralized cloud DB:', err);
    return db;
  }
}

function extractToken(req: express.Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token) {
      activeDriveAccessToken = token;
      return token;
    }
  }
  return activeDriveAccessToken;
}

/**
 * Google Drive REST API v3 Helper on Server:
 * Lists files in folder 1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF
 */
async function listDriveFilesServer(
  token: string
): Promise<Array<{ id: string; name: string }>> {
  const combined = new Map<string, { id: string; name: string }>();

  const folderQ = encodeURIComponent(
    `'${GOOGLE_DRIVE_FOLDER_ID}' in parents and trashed = false`
  );
  const nameQ = encodeURIComponent(
    `(name = '${DRIVE_USERS_DB_FILENAME}' or name contains '${DRIVE_USER_FILE_PREFIX}') and trashed = false`
  );

  for (const q of [folderQ, nameQ]) {
    try {
      const res = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${q}&supportsAllDrives=true&includeItemsFromAllDrives=true&fields=files(id,name)&orderBy=modifiedTime desc&pageSize=100`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        const data = (await res.json()) as { files?: Array<{ id: string; name: string }> };
        if (Array.isArray(data.files)) {
          for (const f of data.files) {
            if (!combined.has(f.id)) combined.set(f.id, f);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return Array.from(combined.values());
}

/**
 * Saves or updates a JSON file inside Google Drive folder 1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF from the server
 */
async function saveJsonToDriveServer(
  token: string,
  fileName: string,
  payload: unknown,
  existingFileId?: string
): Promise<boolean> {
  const boundary = '-------wbpDriveBoundary' + Date.now();
  const jsonContent = JSON.stringify(payload, null, 2);

  const buildMultipartBody = (includeParent: boolean) => {
    const metadata: Record<string, unknown> = {
      name: fileName,
      mimeType: 'application/json'
    };
    if (includeParent) {
      metadata.parents = [GOOGLE_DRIVE_FOLDER_ID];
    }
    return (
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${jsonContent}\r\n` +
      `--${boundary}--`
    );
  };

  try {
    if (existingFileId) {
      const patchRes = await fetch(
        `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart&supportsAllDrives=true`,
        {
          method: 'PATCH',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
          },
          body: buildMultipartBody(false)
        }
      );
      if (patchRes.ok) return true;
    }

    let createRes = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': `multipart/related; boundary=${boundary}`
        },
        body: buildMultipartBody(true)
      }
    );

    if (!createRes.ok && (createRes.status === 403 || createRes.status === 404)) {
      createRes = await fetch(
        'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': `multipart/related; boundary=${boundary}`
          },
          body: buildMultipartBody(false)
        }
      );
    }

    return createRes.ok;
  } catch {
    return false;
  }
}

function sanitizeServerUserForFirestore(
  u: ServerUserAccount
): Record<string, unknown> {
  const clean: Record<string, unknown> = {
    id: String(u.id || `usr-${Date.now()}`),
    fullName: String(u.fullName || u.username || 'User WBP'),
    username: String(u.username || '').trim(),
    password: String(u.password || 'WBP123'),
    role: u.role || 'pemberi_tugas',
    roleName: String(u.roleName || ROLE_LABELS[u.role || 'pemberi_tugas']),
    whatsapp: String(u.whatsapp || ''),
    createdAt: String(u.createdAt || formatCurrentDateTime()),
    isDefault: Boolean(u.isDefault),
    isAdmin: Boolean(u.isAdmin)
  };
  if (u.department) {
    clean.department = String(u.department);
  }
  return clean;
}

/**
 * Syncs with Cloud Firestore, Google Apps Script Web App URL (if configured), and Google Drive folder 1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF
 */
async function pushCloudDBToDriveAndGAS(
  db: CentralizedCloudDB,
  token: string | null,
  newOrUpdatedUser?: ServerUserAccount,
  deletedUsername?: string
): Promise<boolean> {
  let synced = false;

  // 0. Always push to shared Google Cloud Firestore so all computers & containers stay in sync
  try {
    const ops: Promise<unknown>[] = [];
    if (deletedUsername) {
      ops.push(
        deleteDoc(
          doc(serverFirestoreDb, 'wbp_users', deletedUsername.toLowerCase())
        )
      );
    }
    if (newOrUpdatedUser) {
      ops.push(
        setDoc(
          doc(
            serverFirestoreDb,
            'wbp_users',
            newOrUpdatedUser.username.toLowerCase()
          ),
          sanitizeServerUserForFirestore(newOrUpdatedUser)
        )
      );
    }
    ops.push(
      setDoc(
        doc(serverFirestoreDb, 'wbp_meta', 'users_db'),
        {
          folderId: GOOGLE_DRIVE_FOLDER_ID,
          cleanEpoch: CLEAN_ZERO_EPOCH,
          updatedAt: new Date().toISOString(),
          deletedUsernames: db.deletedUsernames,
          gasWebAppUrl: db.gasWebAppUrl || DEFAULT_GAS_WEB_APP_URL,
          usersJson: JSON.stringify(db.users)
        },
        { merge: true }
      )
    );
    await Promise.all(ops);
    synced = true;
  } catch (err) {
    console.warn('Server Firestore push warning:', err);
  }

  // 1. Forward to Google Apps Script Web App bridge
  const targetGasUrl = (db.gasWebAppUrl || DEFAULT_GAS_WEB_APP_URL).trim();
  if (targetGasUrl && targetGasUrl.startsWith('https://script.google.com/')) {
    try {
      const gasRes = await fetch(targetGasUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: deletedUsername
            ? 'deleteUser'
            : newOrUpdatedUser
            ? 'registerUser'
            : 'syncUsers',
          folderId: GOOGLE_DRIVE_FOLDER_ID,
          user: newOrUpdatedUser,
          deletedUsername,
          users: db.users,
          deletedUsernames: db.deletedUsernames,
          updatedAt: new Date().toISOString()
        })
      });
      if (gasRes.ok) synced = true;
    } catch (err) {
      console.warn('GAS webhook push warning:', err);
    }
  }

  // 2. Write directly to Google Drive folder 1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF if OAuth token is available
  if (token) {
    try {
      const files = await listDriveFilesServer(token);
      const existingDb = files.find((f) => f.name === DRIVE_USERS_DB_FILENAME);

      if (deletedUsername) {
        const singleName = `${DRIVE_USER_FILE_PREFIX}${deletedUsername.toLowerCase()}.json`;
        const matches = files.filter((f) => f.name.toLowerCase() === singleName);
        for (const m of matches) {
          await fetch(
            `https://www.googleapis.com/drive/v3/files/${m.id}?supportsAllDrives=true`,
            {
              method: 'DELETE',
              headers: { Authorization: `Bearer ${token}` }
            }
          );
        }
      }

      if (newOrUpdatedUser) {
        const singleName = `${DRIVE_USER_FILE_PREFIX}${newOrUpdatedUser.username.toLowerCase()}.json`;
        const existingSingle = files.find(
          (f) => f.name.toLowerCase() === singleName
        );
        await saveJsonToDriveServer(
          token,
          singleName,
          {
            type: 'WBP_USER_REGISTRATION_RECORD',
            folderId: GOOGLE_DRIVE_FOLDER_ID,
            registeredAt: new Date().toISOString(),
            user: newOrUpdatedUser
          },
          existingSingle?.id
        );
      }

      const dbSaved = await saveJsonToDriveServer(
        token,
        DRIVE_USERS_DB_FILENAME,
        {
          type: 'WBP_USERS_DATABASE',
          folderId: GOOGLE_DRIVE_FOLDER_ID,
          updatedAt: new Date().toISOString(),
          deletedUsernames: db.deletedUsernames,
          users: db.users
        },
        existingDb?.id
      );

      if (dbSaved) synced = true;
    } catch (err) {
      console.warn('Drive API server push warning:', err);
    }
  }

  return synced;
}

/**
 * Pulls and merges users from Cloud Firestore, Google Drive folder 1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF, and GAS Web App into the centralized server DB
 */
async function pullFromDriveAndGASIntoServerDB(
  token: string | null
): Promise<CentralizedCloudDB> {
  const currentDB = readCloudDB();
  const remoteUsers: ServerUserAccount[] = [];
  const remoteDeleted: string[] = [];

  // 0. Pull from shared Google Cloud Firestore
  try {
    const [metaSnap, colSnap] = await Promise.all([
      getDoc(doc(serverFirestoreDb, 'wbp_meta', 'users_db')),
      getDocs(collection(serverFirestoreDb, 'wbp_users'))
    ]);
    if (metaSnap.exists()) {
      const m = metaSnap.data() as {
        deletedUsernames?: string[];
        usersJson?: string;
        gasWebAppUrl?: string;
      };
      if (Array.isArray(m.deletedUsernames)) {
        remoteDeleted.push(...m.deletedUsernames);
      }
      if (typeof m.gasWebAppUrl === 'string' && m.gasWebAppUrl) {
        const normalizedGas = normalizeServerGasUrl(m.gasWebAppUrl);
        currentDB.gasWebAppUrl = normalizedGas;
        if (normalizedGas !== m.gasWebAppUrl) {
          void setDoc(
            doc(serverFirestoreDb, 'wbp_meta', 'users_db'),
            { gasWebAppUrl: normalizedGas, updatedAt: new Date().toISOString() },
            { merge: true }
          ).catch(() => {});
        }
      }
      if (typeof m.usersJson === 'string' && m.usersJson.trim()) {
        try {
          const parsed = JSON.parse(m.usersJson);
          if (Array.isArray(parsed)) remoteUsers.push(...parsed);
        } catch {
          // ignore
        }
      }
    }
    colSnap.forEach((d) => {
      const u = d.data() as unknown as ServerUserAccount;
      if (u && u.username) remoteUsers.unshift(u);
    });
  } catch (err) {
    console.warn('Server Firestore pull warning:', err);
  }

  // 1. Pull from Google Apps Script Web App
  const targetGasUrl = (currentDB.gasWebAppUrl || DEFAULT_GAS_WEB_APP_URL).trim();
  if (targetGasUrl && targetGasUrl.startsWith('https://script.google.com/')) {
    try {
      const url = `${targetGasUrl}${
        targetGasUrl.includes('?') ? '&' : '?'
      }action=getUsers&folderId=${GOOGLE_DRIVE_FOLDER_ID}`;
      const res = await fetch(url, { redirect: 'follow' });
      if (res.ok) {
        const text = (await res.text()).trim();
        if (text.startsWith('{') || text.startsWith('[')) {
          const data = JSON.parse(text) as
            | ServerUserAccount[]
            | {
                users?: ServerUserAccount[];
                deletedUsernames?: string[];
              };
          if (Array.isArray(data)) {
            remoteUsers.push(...data);
          } else if (data && Array.isArray(data.users)) {
            remoteUsers.push(...data.users);
            if (Array.isArray(data.deletedUsernames)) {
              remoteDeleted.push(...data.deletedUsernames);
            }
          }
        }
      }
    } catch {
      // ignore
    }
  }

  // 2. Pull from Google Drive folder 1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF if token available
  if (token) {
    try {
      const files = await listDriveFilesServer(token);
      const existingDb = files.find((f) => f.name === DRIVE_USERS_DB_FILENAME);
      const singleFiles = files.filter(
        (f) => f.name.startsWith(DRIVE_USER_FILE_PREFIX) && f.name.endsWith('.json')
      );

      if (existingDb) {
        const res = await fetch(
          `https://www.googleapis.com/drive/v3/files/${existingDb.id}?alt=media&supportsAllDrives=true`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const parsed = (await res.json()) as
            | ServerUserAccount[]
            | { users?: ServerUserAccount[]; deletedUsernames?: string[] };
          if (Array.isArray(parsed)) {
            remoteUsers.push(...parsed);
          } else if (parsed && Array.isArray(parsed.users)) {
            remoteUsers.push(...parsed.users);
            if (Array.isArray(parsed.deletedUsernames)) {
              remoteDeleted.push(...parsed.deletedUsernames);
            }
          }
        }
      }

      for (const sf of singleFiles) {
        const res = await fetch(
          `https://www.googleapis.com/drive/v3/files/${sf.id}?alt=media&supportsAllDrives=true`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const parsed = (await res.json()) as
            | ServerUserAccount
            | { user?: ServerUserAccount };
          if (parsed && 'user' in parsed && parsed.user) {
            remoteUsers.push(parsed.user);
          } else if (parsed && 'username' in parsed) {
            remoteUsers.push(parsed as ServerUserAccount);
          }
        }
      }
    } catch {
      // ignore
    }
  }

  if (remoteUsers.length === 0 && remoteDeleted.length === 0) {
    return currentDB;
  }

  const deletedSet = new Set(
    [...currentDB.deletedUsernames, ...remoteDeleted].map((u) => u.toLowerCase())
  );

  const map = new Map<string, ServerUserAccount>();
  // Remote users (Firestore / Drive / GAS) take priority, then local server users
  for (const u of [...remoteUsers, ...currentDB.users]) {
    if (!u || !u.username) continue;
    const key = u.username.toLowerCase();
    if (deletedSet.has(key)) continue;
    if (!map.has(key)) {
      map.set(key, normalizeUserAccount(u, 0));
    }
  }

  const mergedDB: CentralizedCloudDB = {
    ...currentDB,
    users: sortUsersCustomFirst(Array.from(map.values())),
    deletedUsernames: Array.from(deletedSet),
    updatedAt: new Date().toISOString()
  };

  return writeCloudDB(mergedDB);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Enable CORS so cross-origin requests from ais-pre / external browsers work seamlessly
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, OPTIONS'
    );
    res.header(
      'Access-Control-Allow-Headers',
      'Origin, X-Requested-With, Content-Type, Accept, Authorization'
    );
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use(express.json({ limit: '15mb' }));

  // Ensure Firestore & GAS start clean at 0 users if cleanEpoch is not yet set
  try {
    const [metaSnap, colSnap] = await Promise.all([
      getDoc(doc(serverFirestoreDb, 'wbp_meta', 'users_db')),
      getDocs(collection(serverFirestoreDb, 'wbp_users'))
    ]);
    const metaData = metaSnap.exists()
      ? (metaSnap.data() as { cleanEpoch?: string; gasWebAppUrl?: string })
      : null;
    if (!metaData || metaData.cleanEpoch !== CLEAN_ZERO_EPOCH) {
      const delOps: Promise<unknown>[] = [];
      colSnap.forEach((d) => {
        delOps.push(deleteDoc(doc(serverFirestoreDb, 'wbp_users', d.id)));
      });
      delOps.push(
        setDoc(
          doc(serverFirestoreDb, 'wbp_meta', 'users_db'),
          {
            folderId: GOOGLE_DRIVE_FOLDER_ID,
            cleanEpoch: CLEAN_ZERO_EPOCH,
            updatedAt: new Date().toISOString(),
            deletedUsernames: [],
            gasWebAppUrl: DEFAULT_GAS_WEB_APP_URL,
            usersJson: '[]'
          },
          { merge: true }
        )
      );
      await Promise.all(delOps);
      writeCloudDB({
        folderId: GOOGLE_DRIVE_FOLDER_ID,
        updatedAt: new Date().toISOString(),
        users: [],
        deletedUsernames: [],
        gasWebAppUrl: DEFAULT_GAS_WEB_APP_URL
      });
      void fetch(DEFAULT_GAS_WEB_APP_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          action: 'resetUsers',
          folderId: GOOGLE_DRIVE_FOLDER_ID,
          users: [],
          deletedUsernames: [],
          updatedAt: new Date().toISOString()
        })
      }).catch(() => {});
    }
  } catch (err) {
    console.warn('Server clean epoch init warning:', err);
  }

  // Background real-time Firestore listener on server: keeps /data/wbp_cloud_database.json & Google Drive folder 1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF in sync whenever any device registers a user
  const serverSyncedDriveUsers = new Set<string>();
  onSnapshot(
    collection(serverFirestoreDb, 'wbp_users'),
    (snap) => {
      const currentDB = readCloudDB();
      const deletedSet = new Set(
        currentDB.deletedUsernames.map((u) => u.toLowerCase())
      );
      const map = new Map<string, ServerUserAccount>();
      const newlyDiscoveredCustomUsers: ServerUserAccount[] = [];

      snap.forEach((d) => {
        const raw = d.data() as unknown as ServerUserAccount;
        if (raw && raw.username) {
          const norm = normalizeUserAccount(raw, 0);
          const key = norm.username.toLowerCase();
          if (!deletedSet.has(key)) {
            map.set(key, norm);
            if (!norm.isDefault && !serverSyncedDriveUsers.has(key)) {
              serverSyncedDriveUsers.add(key);
              newlyDiscoveredCustomUsers.push(norm);
            }
          }
        }
      });

      const updated = writeCloudDB({
        ...currentDB,
        users: Array.from(map.values())
      });

      if (
        newlyDiscoveredCustomUsers.length > 0 &&
        (activeDriveAccessToken || updated.gasWebAppUrl)
      ) {
        for (const nu of newlyDiscoveredCustomUsers) {
          void pushCloudDBToDriveAndGAS(updated, activeDriveAccessToken, nu);
        }
      }
    },
    () => {}
  );

  // ==================== CENTRALIZED CLOUD USER DATABASE API ====================

  // 1. Register / cache active Google Drive OAuth token in server memory so cross-device registrations automatically write to Drive
  app.post('/api/drive/token', async (req, res) => {
    const token = extractToken(req) || req.body?.accessToken;
    if (token && typeof token === 'string') {
      activeDriveAccessToken = token;
      const merged = await pullFromDriveAndGASIntoServerDB(token);
      await pushCloudDBToDriveAndGAS(merged, token);
      res.json({
        ok: true,
        folderId: GOOGLE_DRIVE_FOLDER_ID,
        usersCount: merged.users.length,
        users: merged.users
      });
      return;
    }
    res.json({ ok: false });
  });

  // 2. Get all users from centralized cloud JSON database (optionally pulling latest from Google Drive folder 1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF)
  app.get('/api/users', async (req, res) => {
    const token = extractToken(req);
    const shouldSyncDrive = req.query.syncDrive === 'true';
    const db = shouldSyncDrive
      ? await pullFromDriveAndGASIntoServerDB(token)
      : readCloudDB();

    res.json({
      folderId: GOOGLE_DRIVE_FOLDER_ID,
      updatedAt: db.updatedAt,
      users: db.users,
      deletedUsernames: db.deletedUsernames,
      gasWebAppUrl: db.gasWebAppUrl || '',
      hasServerDriveToken: Boolean(activeDriveAccessToken)
    });
  });

  // 3. Register a new user account from ANY device -> saves to centralized cloud JSON + writes WBP_USER_<username>.json to Google Drive folder 1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF
  app.post('/api/users/register', async (req, res) => {
    const token = extractToken(req);
    const body = req.body as Partial<ServerUserAccount>;

    if (!body || !body.username || !body.fullName || !body.password) {
      res.status(400).json({ error: 'Data pendaftaran tidak lengkap.' });
      return;
    }

    const db = readCloudDB();
    const created = normalizeUserAccount(
      {
        ...body,
        id: body.id || `usr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        createdAt: body.createdAt || formatCurrentDateTime(),
        isDefault: false
      },
      0
    );

    const withoutDuplicate = db.users.filter(
      (u) => u.username.toLowerCase() !== created.username.toLowerCase()
    );
    const updatedDeleted = db.deletedUsernames.filter(
      (uname) => uname.toLowerCase() !== created.username.toLowerCase()
    );

    const updatedDB = writeCloudDB({
      ...db,
      users: [created, ...withoutDuplicate],
      deletedUsernames: updatedDeleted
    });

    // Asynchronously push to Google Drive folder 1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF & GAS Web App
    const driveSynced = await pushCloudDBToDriveAndGAS(updatedDB, token, created);

    res.json({
      ok: true,
      folderId: GOOGLE_DRIVE_FOLDER_ID,
      driveSynced,
      created,
      users: updatedDB.users
    });
  });

  // 4. Update an existing user account
  app.put('/api/users/:id', async (req, res) => {
    const token = extractToken(req);
    const userId = req.params.id;
    const body = req.body as Partial<ServerUserAccount>;

    const db = readCloudDB();
    const normalizedTarget = normalizeUserAccount({ ...body, id: userId }, 0);
    const exists = db.users.some((u) => u.id === userId);
    const updatedUsers = exists
      ? db.users.map((u) => (u.id === userId ? normalizedTarget : u))
      : [normalizedTarget, ...db.users];

    const updatedDB = writeCloudDB({
      ...db,
      users: updatedUsers
    });

    const driveSynced = await pushCloudDBToDriveAndGAS(
      updatedDB,
      token,
      normalizedTarget
    );

    res.json({
      ok: true,
      folderId: GOOGLE_DRIVE_FOLDER_ID,
      driveSynced,
      users: updatedDB.users
    });
  });

  // 5. Delete a user account
  app.delete('/api/users/:id', async (req, res) => {
    const token = extractToken(req);
    const userId = req.params.id;

    const db = readCloudDB();
    const targetUser = db.users.find((u) => u.id === userId);
    const updatedUsers = db.users.filter((u) => u.id !== userId);
    const updatedDeleted = targetUser
      ? Array.from(
          new Set([...db.deletedUsernames, targetUser.username.toLowerCase()])
        )
      : db.deletedUsernames;

    const updatedDB = writeCloudDB({
      ...db,
      users: updatedUsers,
      deletedUsernames: updatedDeleted
    });

    const driveSynced = await pushCloudDBToDriveAndGAS(
      updatedDB,
      token,
      undefined,
      targetUser?.username
    );

    res.json({
      ok: true,
      folderId: GOOGLE_DRIVE_FOLDER_ID,
      driveSynced,
      users: updatedDB.users
    });
  });

  // 6. Reset user accounts to default
  app.post('/api/users/reset', async (req, res) => {
    const token = extractToken(req);
    const db = readCloudDB();
    const updatedDB = writeCloudDB({
      ...db,
      users: INITIAL_USERS,
      deletedUsernames: []
    });

    const driveSynced = await pushCloudDBToDriveAndGAS(updatedDB, token);
    res.json({
      ok: true,
      folderId: GOOGLE_DRIVE_FOLDER_ID,
      driveSynced,
      users: updatedDB.users
    });
  });

  // 7. Manual / Real-time full bidirectional sync with Google Drive folder 1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF & Google Apps Script
  app.post('/api/users/sync', async (req, res) => {
    const token = extractToken(req);
    const clientUsers = Array.isArray(req.body?.users)
      ? (req.body.users as ServerUserAccount[])
      : [];

    // First merge any custom users sent by client
    const currentDB = readCloudDB();
    const deletedSet = new Set(
      currentDB.deletedUsernames.map((u) => u.toLowerCase())
    );
    const mergedMap = new Map<string, ServerUserAccount>();
    for (const u of [...clientUsers, ...currentDB.users]) {
      if (!u || !u.username) continue;
      const key = u.username.toLowerCase();
      if (!deletedSet.has(key) && !mergedMap.has(key)) {
        mergedMap.set(key, normalizeUserAccount(u, 0));
      }
    }
    writeCloudDB({
      ...currentDB,
      users: Array.from(mergedMap.values())
    });

    // Pull from Google Drive folder 1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF & GAS
    const pulledDB = await pullFromDriveAndGASIntoServerDB(token);
    // Push unified list back to Google Drive folder 1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF & GAS
    const driveSynced = await pushCloudDBToDriveAndGAS(pulledDB, token);

    res.json({
      ok: true,
      folderId: GOOGLE_DRIVE_FOLDER_ID,
      driveSynced,
      users: pulledDB.users,
      deletedUsernames: pulledDB.deletedUsernames
    });
  });

  // 8. Configure optional Google Apps Script Web App URL bridge
  app.post('/api/gas/config', async (req, res) => {
    const token = extractToken(req);
    const gasWebAppUrl =
      typeof req.body?.gasWebAppUrl === 'string' ? req.body.gasWebAppUrl.trim() : '';
    const db = readCloudDB();
    const updatedDB = writeCloudDB({
      ...db,
      gasWebAppUrl
    });

    if (gasWebAppUrl) {
      await pullFromDriveAndGASIntoServerDB(token);
      await pushCloudDBToDriveAndGAS(readCloudDB(), token);
    }

    const finalDB = readCloudDB();
    res.json({
      ok: true,
      gasWebAppUrl: finalDB.gasWebAppUrl,
      users: finalDB.users
    });
  });

  // 9. Categorized File Upload Endpoint ('Permintaan' -> 1To0dQP0bco7s7czx48B9BlxLsT8FYXNY, 'Jawaban Atas Permintaan' -> 1PeQLFYkbwFMkXW_FVAIQIzNcGpalbvQy)
  app.post('/api/files/upload', async (req, res) => {
    const token = extractToken(req);
    const {
      fileName,
      mimeType,
      base64Data,
      category,
      categoryKey,
      folderId: requestedFolderId,
      ticketId
    } = (req.body || {}) as {
      fileName?: string;
      mimeType?: string;
      base64Data?: string;
      category?: string;
      categoryKey?: string;
      folderId?: string;
      ticketId?: string;
    };

    if (!fileName || !base64Data) {
      res.status(400).json({ ok: false, error: 'fileName dan base64Data wajib diisi.' });
      return;
    }

    const target = resolveServerUploadFolder(category || categoryKey || requestedFolderId);
    const cleanBase64 = base64Data.includes(',')
      ? base64Data.split(',')[1] || base64Data
      : base64Data;

    let uploadedFileId = '';
    let webViewLink = '';
    let downloadUrl = '';

    // 1. If server has an active Google Drive OAuth token, upload binary directly to the target folder (1To0dQP0bco7s7czx48B9BlxLsT8FYXNY or 1PeQLFYkbwFMkXW_FVAIQIzNcGpalbvQy)
    if (token) {
      try {
        const fileBuffer = Buffer.from(cleanBase64, 'base64');
        const boundary = '-------wbpFileBoundary' + Date.now();
        const metadata = {
          name: fileName,
          mimeType: mimeType || 'application/octet-stream',
          parents: [target.folderId],
          description: `Kategori: ${target.categoryLabel}${ticketId ? ` | Tiket: ${ticketId}` : ''}`
        };

        const multipartHead = Buffer.from(
          `--${boundary}\r\n` +
            `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
            `${JSON.stringify(metadata)}\r\n` +
            `--${boundary}\r\n` +
            `Content-Type: ${mimeType || 'application/octet-stream'}\r\n\r\n`,
          'utf-8'
        );
        const multipartTail = Buffer.from(`\r\n--${boundary}--`, 'utf-8');
        const multipartBody = Buffer.concat([multipartHead, fileBuffer, multipartTail]);

        const driveRes = await fetch(
          'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,webViewLink,webContentLink',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body: multipartBody
          }
        );

        if (driveRes.ok) {
          const driveData = (await driveRes.json()) as {
            id?: string;
            webViewLink?: string;
            webContentLink?: string;
          };
          if (driveData.id) {
            uploadedFileId = driveData.id;
            webViewLink =
              driveData.webViewLink ||
              `https://drive.google.com/file/d/${driveData.id}/view?usp=sharing`;
            downloadUrl =
              driveData.webContentLink ||
              `https://drive.google.com/uc?export=download&id=${driveData.id}`;
          }
        }
      } catch (err) {
        console.warn(`Server direct Drive upload warning (${target.categoryLabel}):`, err);
      }
    }

    // 2. Always forward categorized upload to Google Apps Script Web App endpoint (https://script.google.com/macros/s/AKfycbwf11X_caQ9oCQmoPgJfnBpqM4w6uc02O-aMWC40qoRIdwgxZc5-V9LzQZxy3zAEDg3/exec)
    const db = readCloudDB();
    const targetGasUrl = normalizeServerGasUrl(db.gasWebAppUrl);
    let gasForwarded = false;
    if (targetGasUrl && targetGasUrl.startsWith('https://script.google.com/')) {
      try {
        const sep = targetGasUrl.includes('?') ? '&' : '?';
        const gasUrlWithParams = `${targetGasUrl}${sep}action=uploadFile&category=${encodeURIComponent(
          target.categoryLabel
        )}&kategori=${encodeURIComponent(
          target.categoryLabel
        )}&categoryKey=${encodeURIComponent(
          target.categoryKey
        )}&folderId=${encodeURIComponent(target.folderId)}`;

        const gasRes = await fetch(gasUrlWithParams, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'uploadFile',
            category: target.categoryLabel,
            kategori: target.categoryLabel,
            categoryKey: target.categoryKey,
            jenis: target.categoryLabel,
            type: target.categoryKey,
            folderId: target.folderId,
            targetFolderId: target.folderId,
            ticketId: ticketId || '',
            fileName,
            name: fileName,
            mimeType: mimeType || 'application/octet-stream',
            base64Data: cleanBase64,
            data: cleanBase64,
            uploadedAt: new Date().toISOString()
          }),
          redirect: 'follow'
        });

        if (gasRes.ok) {
          gasForwarded = true;
          const text = (await gasRes.text()).trim();
          if (text.startsWith('{')) {
            const parsed = JSON.parse(text) as {
              id?: string;
              fileId?: string;
              webViewLink?: string;
              url?: string;
              downloadUrl?: string;
            };
            const gasFileId = parsed.id || parsed.fileId || '';
            if (gasFileId && !uploadedFileId) {
              uploadedFileId = gasFileId;
              webViewLink =
                parsed.webViewLink ||
                parsed.url ||
                `https://drive.google.com/file/d/${gasFileId}/view?usp=sharing`;
              downloadUrl =
                parsed.downloadUrl ||
                `https://drive.google.com/uc?export=download&id=${gasFileId}`;
            }
          }
        }
      } catch (err) {
        console.warn(`GAS upload forwarding warning (${target.categoryLabel}):`, err);
      }
    }

    res.json({
      ok: Boolean(uploadedFileId || gasForwarded),
      gasForwarded,
      id: uploadedFileId || undefined,
      name: fileName,
      category: target.categoryLabel,
      categoryKey: target.categoryKey,
      folderId: target.folderId,
      webViewLink:
        webViewLink ||
        `https://drive.google.com/drive/folders/${target.folderId}?usp=sharing`,
      downloadUrl:
        downloadUrl ||
        `https://drive.google.com/drive/folders/${target.folderId}?usp=sharing`
    });
  });

  // Vite middleware for development / static serving for production
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(
      `[WBP Cloud Server] Running on http://0.0.0.0:${PORT} (Google Drive Folder ID: ${GOOGLE_DRIVE_FOLDER_ID})`
    );
  });
}

startServer();
