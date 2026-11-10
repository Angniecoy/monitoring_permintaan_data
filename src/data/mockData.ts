import { DepartmentName, DepartmentStructure, Ticket, UserAccount, UserRole, UserSession } from '../types';

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
const USERS_STORAGE_KEY = 'wbp_sim_teknis_users_v1';

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
  return INITIAL_TICKETS;
}

export function getStoredUsers(): UserAccount[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(INITIAL_USERS));
      return INITIAL_USERS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_USERS;
  } catch (err) {
    console.error('Failed reading users from localStorage:', err);
    return INITIAL_USERS;
  }
}

export function saveStoredUsers(users: UserAccount[]): void {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    window.dispatchEvent(new Event('wbp_users_updated'));
  } catch (err) {
    console.error('Failed saving users to localStorage:', err);
  }
}

export function resetToDefaultUsers(): UserAccount[] {
  localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(INITIAL_USERS));
  window.dispatchEvent(new Event('wbp_users_updated'));
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

