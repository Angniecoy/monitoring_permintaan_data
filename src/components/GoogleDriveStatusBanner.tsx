import React, { useState, useEffect } from 'react';
import { ExternalLink, CheckCircle2, Cloud, LogOut, AlertCircle } from 'lucide-react';
import {
  subscribeDriveAuth,
  googleSignIn,
  logoutDrive,
  resolveDriveFolderByCategory,
  GOOGLE_DRIVE_FOLDER_ID,
  GOOGLE_DRIVE_FOLDER_URL,
  type DriveUploadCategory
} from '../services/googleDrive';
import type { User } from 'firebase/auth';

interface GoogleDriveStatusBannerProps {
  compact?: boolean;
  category?: DriveUploadCategory;
}

export const GoogleDriveStatusBanner: React.FC<GoogleDriveStatusBannerProps> = ({
  compact = false,
  category
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [driveUser, setDriveUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [authError, setAuthError] = useState('');

  const resolvedCategory = category ? resolveDriveFolderByCategory(category) : null;
  const activeFolderId = resolvedCategory ? resolvedCategory.folderId : GOOGLE_DRIVE_FOLDER_ID;
  const activeFolderUrl = resolvedCategory ? resolvedCategory.folderUrl : GOOGLE_DRIVE_FOLDER_URL;
  const directoryTitle = resolvedCategory
    ? `Direktori ${resolvedCategory.categoryLabel}:`
    : 'Direktori Utama:';

  useEffect(() => {
    const unsubscribe = subscribeDriveAuth((state) => {
      setIsConnected(state.isConnected);
      setDriveUser(state.user);
    });
    return unsubscribe;
  }, []);

  const handleConnectDrive = async () => {
    setIsLoggingIn(true);
    setAuthError('');
    try {
      await googleSignIn();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menghubungkan Google Drive';
      setAuthError(msg);
    } finally {
      setIsLoggingIn(false);
    }
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {isConnected ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] text-emerald-800 font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
            <span className="hidden xl:inline">Google Drive Aktif</span>
            <a
              href={activeFolderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[#282974] hover:underline font-mono text-[10px] ml-1"
              title="Buka Folder Penyimpanan Google Drive"
            >
              <span>Folder Drive</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
        ) : (
          <button
            type="button"
            onClick={handleConnectDrive}
            disabled={isLoggingIn}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-300 shadow-2xs text-xs font-semibold text-slate-700 transition-all cursor-pointer disabled:opacity-60"
            title="Hubungkan Google Drive untuk menyimpan & mengunduh lampiran"
          >
            <svg
              version="1.1"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 48 48"
              className="w-3.5 h-3.5 shrink-0 block"
            >
              <path
                fill="#EA4335"
                d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
              />
              <path
                fill="#4285F4"
                d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
              />
              <path
                fill="#FBBC05"
                d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
              />
              <path
                fill="#34A853"
                d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
              />
              <path fill="none" d="M0 0h48v48H0z" />
            </svg>
            <span className="hidden lg:inline">
              {isLoggingIn ? 'Menghubungkan...' : 'Sign in with Google'}
            </span>
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-[#282974]/10 border border-[#282974]/25 flex items-center justify-center text-[#282974] shrink-0 mt-0.5">
          <Cloud className="w-4 h-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-900">
              Integrasi Penyimpanan Google Drive {resolvedCategory ? `(${resolvedCategory.categoryLabel})` : ''}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-semibold">
              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
              <span>
                {isConnected
                  ? `Terhubung (${driveUser?.email || driveUser?.displayName || 'Aktif'})`
                  : 'Sinkronisasi Cloud Aktif'}
              </span>
            </span>
          </div>
          <div className="text-[11px] text-slate-600 mt-0.5 flex flex-wrap items-center gap-1.5">
            <span>{directoryTitle}</span>
            <span className="font-mono text-[11px] font-semibold text-[#282974]">
              Folder ID: {activeFolderId}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
