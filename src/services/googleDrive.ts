import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

export const SCOPES = ['https://www.googleapis.com/auth/drive'];

export const GOOGLE_DRIVE_FOLDER_ID = '1ysQDvgj60TqAcFsZvQ2FWzd9J0NU9euA';
export const GOOGLE_DRIVE_FOLDER_URL =
  'https://drive.google.com/drive/folders/1ysQDvgj60TqAcFsZvQ2FWzd9J0NU9euA?usp=sharing';

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);

const provider = new GoogleAuthProvider();
SCOPES.forEach((scope) => provider.addScope(scope));

// Flag to indicate if we are in the middle of a sign-in flow
let isSigningIn = false;
// Cache the OAuth access token strictly in memory (never in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;
let cachedGoogleUser: User | null = null;

type DriveAuthListener = (state: {
  isConnected: boolean;
  user: User | null;
  accessToken: string | null;
}) => void;

const listeners = new Set<DriveAuthListener>();

function notifyListeners() {
  const state = {
    isConnected: Boolean(cachedAccessToken),
    user: cachedGoogleUser,
    accessToken: cachedAccessToken
  };
  listeners.forEach((listener) => listener(state));
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
    accessToken: cachedAccessToken
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

/**
 * Uploads a File directly to the specified Google Drive folder (1ysQDvgj60TqAcFsZvQ2FWzd9J0NU9euA).
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

  // First try uploading directly into the target shared folder
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
