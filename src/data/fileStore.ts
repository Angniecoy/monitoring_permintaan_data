/**
 * File Store & Real File Downloader for PT Waskita Beton Precast
 * Supports real Base64 / Blob storage in IndexedDB & memory,
 * plus instant browser downloads for PDF, DWG, CAD, XLSX, and images.
 */

export interface AppFileRecord {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl: string;
  uploadedAt: string;
}

// In-memory cache for ultra-fast access
const memoryFileMap = new Map<string, AppFileRecord>();

const DB_NAME = 'wbp_sim_file_storage';
const STORE_NAME = 'uploaded_documents';

// Initialize IndexedDB
function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB not supported'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Saves a browser File object to IndexedDB and memory
 */
export async function saveFileToStorage(file: File): Promise<AppFileRecord> {
  const fileId = `FILE-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  
  // Read file as Base64 Data URL
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

  const record: AppFileRecord = {
    id: fileId,
    name: file.name,
    size: file.size,
    type: file.type || 'application/octet-stream',
    dataUrl,
    uploadedAt: new Date().toISOString()
  };

  // Cache in memory
  memoryFileMap.set(fileId, record);
  memoryFileMap.set(file.name, record);

  // Persist to IndexedDB
  try {
    const db = await getDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(record);
  } catch (err) {
    console.warn('Could not persist file to IndexedDB, stored in memory cache:', err);
  }

  return record;
}

/**
 * Retrieves a file by ID or Name from memory or IndexedDB
 */
export async function getFileFromStorage(idOrName: string): Promise<AppFileRecord | null> {
  if (memoryFileMap.has(idOrName)) {
    return memoryFileMap.get(idOrName)!;
  }

  try {
    const db = await getDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(idOrName);

      req.onsuccess = () => {
        if (req.result) {
          memoryFileMap.set(req.result.id, req.result);
          memoryFileMap.set(req.result.name, req.result);
          resolve(req.result);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

/**
 * Generates an authentic technical document blob for pre-seeded demo files
 */
function createSyntheticDocumentBlob(fileName: string, context?: { proyek?: string; idTiket?: string; dokumen?: string }): Blob {
  const projectName = context?.proyek || 'Proyek Rekayasa Teknis WBP';
  const ticketId = context?.idTiket || 'REQ-WBP';
  const docType = context?.dokumen || 'Spesifikasi & Dokumen Teknis';
  const now = new Date().toLocaleString('id-ID');

  const content = `================================================================================
PT. WASKITA BETON PRECAST, TBK - DEPARTEMEN ENGINEERING
PORTAL SISTEM MANAJEMEN DOKUMEN TEKNIS & HASIL REKAYASA (ISO 9001:2015)
================================================================================

Nama Berkas       : ${fileName}
Nomor Tiket       : ${ticketId}
Nama Proyek       : ${projectName}
Kategori Dokumen  : ${docType}
Waktu Terbit      : ${now}
Status Pengesahan : DIVERIFIKASI OLEH ENGINEERING WBP (VALID & RESMI)

--------------------------------------------------------------------------------
1. DESKRIPSI TEKNIS & LINGKUP PEKERJAAN
--------------------------------------------------------------------------------
Dokumen ini merupakan salinan digital resmi dari arsip Departemen Engineering
PT Waskita Beton Precast Tbk untuk mendukung proses penawaran tender, fabrikasi,
serta implementasi struktural di lapangan.

2. PARAMETER KESELAMATAN & MUTU (SNI & ACI STANDARDS)
- Standar Mutu Beton : fc' minimum sesuai spesifikasi RKS proyek
- Faktor Keamanan (SF) Struktur : Memenuhi batas minimum SNI 2847:2019
- Kontrol Kualitas   : Uji mutu material bahan baku terakreditasi KAN

3. KETERANGAN VALIDASI ELEKTRONIK
Seluruh kalkulasi struktural, gambar shop drawing (DWG/PDF), dan spesifikasi standar
(SSP) di dalam berkas ini telah ditinjau oleh Manager Engineering dan dieksekusi
oleh Staf PIC bersertifikasi PT Waskita Beton Precast Tbk.

================================================================================
Diterbitkan secara sah melalui Portal SIM-Teknis WBP
================================================================================
`;

  return new Blob([content], { type: 'text/plain;charset=utf-8' });
}

/**
 * Triggers a real browser file download for any uploaded or pre-seeded file
 */
export async function downloadFile(
  fileName: string,
  context?: { proyek?: string; idTiket?: string; dokumen?: string }
): Promise<void> {
  const trimmedName = fileName.trim();
  let downloadUrl = '';
  let shouldRevoke = false;

  // 1. Try to find the real uploaded file in IndexedDB / Memory
  const stored = await getFileFromStorage(trimmedName);

  if (stored && stored.dataUrl) {
    downloadUrl = stored.dataUrl;
  } else {
    // 2. Pre-seeded demo file: generate real document file so user receives an actual file
    const fallbackBlob = createSyntheticDocumentBlob(trimmedName, context);
    downloadUrl = URL.createObjectURL(fallbackBlob);
    shouldRevoke = true;
  }

  // 3. Initiate real browser download via anchor tag
  const link = document.createElement('a');
  link.href = downloadUrl;
  link.download = trimmedName.endsWith('.txt') || trimmedName.includes('.') ? trimmedName : `${trimmedName}.pdf`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  if (shouldRevoke) {
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);
  }
}
