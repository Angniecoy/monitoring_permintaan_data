export type DepartmentName = 'Engineering Precast' | 'Engineering Readymix' | 'Engineering Konstruksi';

export type TicketStatus = 'OPEN' | 'DISPOSISI' | 'PROSES' | 'CLOSED (Selesai)';

export interface StaffInfo {
  name: string;
  phone: string;
  department: DepartmentName;
}

export interface ManagerInfo {
  name: string;
  phone: string;
  department: DepartmentName;
}

export interface DepartmentStructure {
  Manager: string;
  WA_Manager: string;
  Staff: Record<string, string>;
}

export interface Ticket {
  ID_Tiket: string;
  Waktu_Request: string; // "DD/MM/YYYY HH:mm"
  Peminta: string;
  WA_Peminta: string;
  SO: string;
  Pemasukan_Penawaran: string; // "DD/MM/YYYY"
  Tujuan_Permintaan: string;
  Kode_Proyek: string;
  Proyek: string;
  Lokasi: string;
  Jenis_Produk: string;
  Dimensi: string;
  Dokumen: string; // "Analisis, SSP, Gambar" etc.
  Departemen_Tujuan: DepartmentName;
  Manager_Tujuan: string;
  WA_Manager: string;
  Staff_Tujuan: string;
  WA_Staff: string;
  Target_Selesai: string; // "DD/MM/YYYY"
  Status_Pengerjaan: TicketStatus;
  Keterangan_Penerima: string;
  File_Pendukung: string; // e.g. "nama_file.pdf::id" or filename
  File_Hasil: string;
  Aktual_Selesai: string;
}

export type UserRole = 
  | 'pemberi_tugas'
  | 'manager'
  | 'staff'
  | 'dashboard';

export interface UserSession {
  isLoggedIn: boolean;
  role: UserRole;
  roleName: string;
  userName: string;
  department?: DepartmentName;
  staffName?: string;
}

export interface WhatsAppNotificationPayload {
  id: string;
  wa: string;
  pesan: string;
  target_role: string;
  target_name: string;
}
