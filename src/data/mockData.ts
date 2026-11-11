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
  pullUsersFromGasEndpoint
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

export const INITIAL_USERS: UserAccount[] = [
  {
    id: 'usr-default-sales',
    fullName: 'Budi Santoso (Sales Tol)',
    username: 'sales',
    password: 'WBP456',
    role: 'pemberi_tugas',
    roleName: ROLE_LABELS.pemberi_tugas,
    whatsapp: '6281234567890',
    createdAt: '20/10/2026 08:00',
    isDefault: true
  },
  {
    id: 'usr-default-mgr-precast',
    fullName: 'Aryo BK',
    username: 'aryo',
    password: 'WBPMGR',
    role: 'manager',
    roleName: ROLE_LABELS.manager,
    department: 'Engineering Precast',
    whatsapp: '628562568659',
    createdAt: '20/10/2026 08:05',
    isDefault: true
  },
  {
    id: 'usr-default-mgr-readymix',
    fullName: 'Choerul SB',
    username: 'choerul',
    password: 'WBPMGR',
    role: 'manager',
    roleName: ROLE_LABELS.manager,
    department: 'Engineering Readymix',
    whatsapp: '628562568659',
    createdAt: '20/10/2026 08:10',
    isDefault: true
  },
  {
    id: 'usr-default-mgr-konstruksi',
    fullName: 'Simon',
    username: 'simon',
    password: 'WBPMGR',
    role: 'manager',
    roleName: ROLE_LABELS.manager,
    department: 'Engineering Konstruksi',
    whatsapp: '628562568659',
    createdAt: '20/10/2026 08:15',
    isDefault: true
  },
  {
    id: 'usr-default-staff-fikri',
    fullName: 'Fikri R',
    username: 'fikri',
    password: 'WBP123',
    role: 'staff',
    roleName: ROLE_LABELS.staff,
    department: 'Engineering Precast',
    whatsapp: '6281267044965',
    createdAt: '20/10/2026 08:20',
    isDefault: true
  },
  {
    id: 'usr-default-staff-ikhsan',
    fullName: 'Ikhsan',
    username: 'ikhsan',
    password: 'WBP123',
    role: 'staff',
    roleName: ROLE_LABELS.staff,
    department: 'Engineering Precast',
    whatsapp: '6282285299441',
    createdAt: '20/10/2026 08:25',
    isDefault: true
  },
  {
    id: 'usr-default-staff-nisa',
    fullName: 'Nisa',
    username: 'nisa',
    password: 'WBP123',
    role: 'staff',
    roleName: ROLE_LABELS.staff,
    department: 'Engineering Precast',
    whatsapp: '6281267670706',
    createdAt: '20/10/2026 08:30',
    isDefault: true
  },
  {
    id: 'usr-default-staff-fani',
    fullName: 'Fani',
    username: 'fani',
    password: 'WBP123',
    role: 'staff',
    roleName: ROLE_LABELS.staff,
    department: 'Engineering Readymix',
    whatsapp: '6281321804321',
    createdAt: '20/10/2026 08:35',
    isDefault: true
  },
  {
    id: 'usr-default-staff-ricky',
    fullName: 'Ricky',
    username: 'ricky',
    password: 'WBP123',
    role: 'staff',
    roleName: ROLE_LABELS.staff,
    department: 'Engineering Konstruksi',
    whatsapp: '6282233669400',
    createdAt: '20/10/2026 08:40',
    isDefault: true
  },
  {
    id: 'usr-default-dashboard',
    fullName: 'Administrator & Direksi WBP',
    username: 'admin',
    password: 'WBPVIEW',
    role: 'dashboard',
    roleName: ROLE_LABELS.dashboard,
    whatsapp: '628111000222',
    createdAt: '20/10/2026 08:45',
    isDefault: true,
    isAdmin: true
  }
];

export const STRUKTUR_ORG: Record<DepartmentName, DepartmentStructure> = {
  "Engineering Precast": {
    Manager: "Aryo BK",
    WA_Manager: "628562568659",
    Staff: {
      "Fikri R": "6281267044965",
      "Ikhsan": "6282285299441",
      "Nisa": "6281267670706"
    }
  },
  "Engineering Readymix": {
    Manager: "Choerul SB",
    WA_Manager: "628562568659",
    Staff: {
      "Fani": "6281321804321",
      "Rafi": "6281259666040",
      "Enuh": "6281586000110"
    }
  },
  "Engineering Konstruksi": {
    Manager: "Simon",
    WA_Manager: "628562568659",
    Staff: {
      "Ricky": "6282233669400",
      "Edu": "6287788783536",
      "Nova": "6285277700763"
    }
  }
};

export const INITIAL_TICKETS: Ticket[] = [
  {
    ID_Tiket: "REQ-20261025-083015",
    Waktu_Request: "25/10/2026 08:30",
    Peminta: "Budi Santoso (Sales Tol)",
    WA_Peminta: "6281234567890",
    SO: "SO-WBP/2026/X/0491",
    Pemasukan_Penawaran: "30/10/2026",
    Tujuan_Permintaan: "Penawaran Tender Proyek Tol Trans Jawa",
    Kode_Proyek: "PRJ-TJ-042",
    Proyek: "Pembangunan Jalan Tol Probolinggo - Banyuwangi Paket II",
    Lokasi: "Kraksaan, Jawa Timur",
    Jenis_Produk: "PC-I Girder H-210 L-40.8m",
    Dimensi: "Tinggi 2100mm, Panjang 40.8m, Flange 800mm",
    Dokumen: "Analisis, SSP, Gambar",
    Departemen_Tujuan: "Engineering Precast",
    Manager_Tujuan: "Aryo BK",
    WA_Manager: "628562568659",
    Staff_Tujuan: "Fikri R",
    WA_Staff: "6281267044965",
    Target_Selesai: "28/10/2026",
    Status_Pengerjaan: "PROSES",
    Keterangan_Penerima: "Kalkulasi momen lentur dan prategang sedang diselesaikan, target shop drawing esok hari.",
    File_Pendukung: "Kriteria_Desain_BinaMarga_2026.pdf || Layout_Jembatan_Pekalen.dwg",
    File_Hasil: "-",
    Aktual_Selesai: "-"
  },
  {
    ID_Tiket: "REQ-20261026-112004",
    Waktu_Request: "26/10/2026 11:20",
    Peminta: "Dewi Lestari (Proyek IKN)",
    WA_Peminta: "6281398765432",
    SO: "SO-IKN/ENG/2026/088",
    Pemasukan_Penawaran: "02/11/2026",
    Tujuan_Permintaan: "Verifikasi Mix Design Beton K-400 Slump 12±2",
    Kode_Proyek: "IKN-GOV-03A",
    Proyek: "Pembangunan Gedung Kemenko 1 IKN Nusantara",
    Lokasi: "KIPP Sepaku, Penajam Paser Utara",
    Jenis_Produk: "Readymix Mutu Khusus Fc 35 MPa Silika Fume",
    Dimensi: "Volume Cor 1.850 m3",
    Dokumen: "Analisis, SSP",
    Departemen_Tujuan: "Engineering Readymix",
    Manager_Tujuan: "Choerul SB",
    WA_Manager: "628562568659",
    Staff_Tujuan: "Fani",
    WA_Staff: "6281321804321",
    Target_Selesai: "29/10/2026",
    Status_Pengerjaan: "PROSES",
    Keterangan_Penerima: "Trial mix selesai di Batching Plant Balikpapan, menunggu uji tekan 3 hari.",
    File_Pendukung: "Spek_Teknis_PUPR_IKN_Beton.pdf",
    File_Hasil: "-",
    Aktual_Selesai: "-"
  },
  {
    ID_Tiket: "REQ-20261027-091530",
    Waktu_Request: "27/10/2026 09:15",
    Peminta: "Hendra Wijaya (Sales Infrastruktur)",
    WA_Peminta: "6281700112233",
    SO: "SO-WBP/JKT/2026/1105",
    Pemasukan_Penawaran: "04/11/2026",
    Tujuan_Permintaan: "Metode Kerja Erection Box Girder Elevated",
    Kode_Proyek: "LRT-VELO-01B",
    Proyek: "LRT Jakarta Fase 1B Velodrome - Manggarai",
    Lokasi: "Matraman - Manggarai, DKI Jakarta",
    Jenis_Produk: "U-Girder Precast & Launching Gantry",
    Dimensi: "Span 30.5m x Width 4.8m",
    Dokumen: "Analisis, Gambar, Others (Metode Erection Launching)",
    Departemen_Tujuan: "Engineering Konstruksi",
    Manager_Tujuan: "Simon",
    WA_Manager: "628562568659",
    Staff_Tujuan: "-",
    WA_Staff: "-",
    Target_Selesai: "31/10/2026",
    Status_Pengerjaan: "OPEN",
    Keterangan_Penerima: "-",
    File_Pendukung: "Alignment_Trase_LRT_Matraman.pdf || Batasan_Ruang_Bebas_DKI.pdf",
    File_Hasil: "-",
    Aktual_Selesai: "-"
  },
  {
    ID_Tiket: "REQ-20261027-144022",
    Waktu_Request: "27/10/2026 14:40",
    Peminta: "Rian Pratama (Marketing Precast)",
    WA_Peminta: "6281223344556",
    SO: "SO-WBP/SW/2026/0312",
    Pemasukan_Penawaran: "05/11/2026",
    Tujuan_Permintaan: "Desain Spun Pile Diameter 600mm Kelas C",
    Kode_Proyek: "PRJ-PEL-07",
    Proyek: "Dermaga Pelabuhan Peti Kemas Kalibaru Tahap 2",
    Lokasi: "Tanjung Priok, Jakarta Utara",
    Jenis_Produk: "Spun Pile Dia. 600mm Tebal 100mm L-24m",
    Dimensi: "D=600mm, t=100mm, L=24m Segmented",
    Dokumen: "SSP, Gambar",
    Departemen_Tujuan: "Engineering Precast",
    Manager_Tujuan: "Aryo BK",
    WA_Manager: "628562568659",
    Staff_Tujuan: "-",
    WA_Staff: "-",
    Target_Selesai: "01/11/2026",
    Status_Pengerjaan: "OPEN",
    Keterangan_Penerima: "-",
    File_Pendukung: "Data_Sondir_Borehole_TanjungPriok.pdf",
    File_Hasil: "-",
    Aktual_Selesai: "-"
  },
  {
    ID_Tiket: "REQ-20261024-100512",
    Waktu_Request: "24/10/2026 10:05",
    Peminta: "Arif Kurniawan (Sales Regional Barat)",
    WA_Peminta: "6281987654321",
    SO: "SO-WBP/SUM/2026/077",
    Pemasukan_Penawaran: "28/10/2026",
    Tujuan_Permintaan: "Perhitungan Daya Dukung CCSP W-450",
    Kode_Proyek: "PRJ-TALUD-02",
    Proyek: "Perkuatan Tebing Sungai Musi Paket Palembang",
    Lokasi: "Palembang, Sumatera Selatan",
    Jenis_Produk: "Corrugated Concrete Sheet Pile W-450 1000",
    Dimensi: "W=450mm, Tebal=120mm, Panjang=14m",
    Dokumen: "Analisis, SSP, Gambar",
    Departemen_Tujuan: "Engineering Precast",
    Manager_Tujuan: "Aryo BK",
    WA_Manager: "628562568659",
    Staff_Tujuan: "Ikhsan",
    WA_Staff: "6282285299441",
    Target_Selesai: "27/10/2026",
    Status_Pengerjaan: "CLOSED (Selesai)",
    Keterangan_Penerima: "Analisis stabilitas guling dan geser telah diverifikasi. Dokumen gambar dan SSP terlampir.",
    File_Pendukung: "Profil_Melintang_Sungai_Musi.pdf",
    File_Hasil: "HASIL_CCSP_W450_SUNGAI_MUSI_REV01.pdf || GAMBAR_SHOP_DRAWING_CCSP_SIGNED.pdf",
    Aktual_Selesai: "27/10/2026 16:30"
  },
  {
    ID_Tiket: "REQ-20261026-151018",
    Waktu_Request: "26/10/2026 15:10",
    Peminta: "Siti Rahma (Sales Industri)",
    WA_Peminta: "6285712349876",
    SO: "SO-WBP/IND/2026/0204",
    Pemasukan_Penawaran: "03/11/2026",
    Tujuan_Permintaan: "Desain Sloof & Kolom Precast Pabrik Baterai",
    Kode_Proyek: "PRJ-BAT-09",
    Proyek: "Fasilitas Industri Gigafactory Sel Baterai Karawang",
    Lokasi: "Kawasan Industri KNIC, Karawang",
    Jenis_Produk: "Kolom Precast 600x600 & Balok Pracetak",
    Dimensi: "Kolom H=9.5m dengan Corbel 4 Sisi",
    Dokumen: "Analisis, Gambar",
    Departemen_Tujuan: "Engineering Precast",
    Manager_Tujuan: "Aryo BK",
    WA_Manager: "628562568659",
    Staff_Tujuan: "Nisa",
    WA_Staff: "6281267670706",
    Target_Selesai: "30/10/2026",
    Status_Pengerjaan: "DISPOSISI",
    Keterangan_Penerima: "Catatan Manager: Prioritaskan detail corbel beban crane 15 ton.",
    File_Pendukung: "Layout_Kolom_Crane_Karawang.dwg",
    File_Hasil: "-",
    Aktual_Selesai: "-"
  },
  {
    ID_Tiket: "REQ-20261023-094520",
    Waktu_Request: "23/10/2026 09:45",
    Peminta: "Fajar Nugraha (Proyek Bendungan)",
    WA_Peminta: "6281311223344",
    SO: "SO-WBP/WTR/2026/0119",
    Pemasukan_Penawaran: "27/10/2026",
    Tujuan_Permintaan: "Formwork & Shoring Analisis Terowongan Pengelak",
    Kode_Proyek: "BDG-JRG-04",
    Proyek: "Pembangunan Bendungan Jragung Paket III",
    Lokasi: "Semarang, Jawa Tengah",
    Jenis_Produk: "Struktur Konstruksi Temporary Shoring",
    Dimensi: "Tunnel Horseshoe Dia 5.2m",
    Dokumen: "Analisis, Gambar",
    Departemen_Tujuan: "Engineering Konstruksi",
    Manager_Tujuan: "Simon",
    WA_Manager: "628562568659",
    Staff_Tujuan: "Ricky",
    WA_Staff: "6282233669400",
    Target_Selesai: "26/10/2026",
    Status_Pengerjaan: "CLOSED (Selesai)",
    Keterangan_Penerima: "Kalkulasi safety factor perancah 2.15 memenuhi kriteria SNI.",
    File_Pendukung: "Geometri_Terowongan_Bendungan.pdf",
    File_Hasil: "PERHITUNGAN_SHORING_JTL_JRAGUNG_OK.pdf || SHOP_DRAWING_FORMWORK.dwg",
    Aktual_Selesai: "26/10/2026 14:15"
  }
];

const STORAGE_KEY = 'wbp_sim_teknis_tickets_v1';
export const USERS_STORAGE_KEY = 'wbp_cloud_users_sync_event';

// Clean up any legacy browser localStorage user cache so all user accounts come strictly from the centralized cloud database & Google Drive
try {
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem('wbp_sim_teknis_users_v1');
    window.localStorage.removeItem('wbp_sim_teknis_deleted_users_v1');
  }
} catch {
  // ignore
}

// In-memory runtime cache synchronized with Cloud Firestore + Google Apps Script + Centralized Backend (/api/users) + Google Drive folder 1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF
let cloudUsersMemoryStore: UserAccount[] = [...INITIAL_USERS];
let cloudDeletedUsernamesStore: string[] = [];
let cloudGasWebAppUrlStore = DEFAULT_GAS_WEB_APP_URL;

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

export function getStoredTickets(): Ticket[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_TICKETS));
      return INITIAL_TICKETS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_TICKETS;
  } catch (err) {
    console.error('Failed reading tickets from localStorage:', err);
    return INITIAL_TICKETS;
  }
}

export function saveStoredTickets(tickets: Ticket[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tickets));
  } catch (err) {
    console.error('Failed saving tickets to localStorage:', err);
  }
}

export function resetToDefaultTickets(): Ticket[] {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_TICKETS));
  void syncTicketsWithDriveFolder(INITIAL_TICKETS, true);
  return INITIAL_TICKETS;
}

export async function pullAndMergeTicketsFromDrive(): Promise<Ticket[]> {
  const local = getStoredTickets();
  const merged = await syncTicketsWithDriveFolder(local, false);
  if (merged && merged.length > 0) {
    saveStoredTickets(merged);
    return merged;
  }
  return local;
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

export function getStoredUsers(): UserAccount[] {
  return cloudUsersMemoryStore;
}

export function saveStoredUsers(users: UserAccount[]): void {
  cloudUsersMemoryStore = orderUsersList(users);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('wbp_users_updated'));
  }
}

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
    saveDeletedUsernames(payload.deletedUsernames);
    const merged = mergeWithDefaultsAndRecentMutations(
      payload.users,
      payload.deletedUsernames
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
            payload.deletedUsernames,
            token
          );
        }
      }
    });
  });
}

/**
 * Fetches the authoritative centralized user database from Google Cloud Firestore,
 * Google Apps Script Web App (https://script.google.com/macros/s/AKfycbz4q_EddMqXEnfNSDvuRbB-Ka3dlUPe1NNR7rD9gnllpHk8VaxiM8tvs6mSOLLfnj1a/exec),
 * AND the backend server (/api/users) connected to Google Drive folder 1WQPOsBNh4fW_K3j4vHM2BvOqn-QxAcoF.
 */
export async function fetchCloudUsers(syncDrive = false): Promise<UserAccount[]> {
  let firestoreUsers: UserAccount[] = [];
  let firestoreDeleted: string[] = [];
  let gasUsers: UserAccount[] = [];
  let gasDeleted: string[] = [];
  let serverUsers: UserAccount[] = [];
  let serverDeleted: string[] = [];

  // 1. Fetch from shared Google Cloud Firestore (works across ALL computers, ais-dev & ais-pre)
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

  // 2. Pull from Google Apps Script Web App endpoint
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

  // Merge Firestore users + GAS Web App users + Server users + Defaults
  const merged = mergeWithDefaultsAndRecentMutations(
    [...firestoreUsers, ...gasUsers, ...serverUsers],
    combinedDeleted
  );

  // If Firestore was empty on first boot, seed default users to Firestore
  if (firestoreUsers.length === 0 && merged.length > 0) {
    const firstUser = merged[0];
    if (firstUser) {
      void upsertUserToCloudFirestore(firstUser, merged, combinedDeleted);
    }
  }

  if (JSON.stringify(merged) !== JSON.stringify(cloudUsersMemoryStore)) {
    saveStoredUsers(merged);
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

  // 1. Immediately send to Google Apps Script Web App endpoint (https://script.google.com/macros/s/AKfycbz4q_EddMqXEnfNSDvuRbB-Ka3dlUPe1NNR7rD9gnllpHk8VaxiM8tvs6mSOLLfnj1a/exec)
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

