import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  CheckCircle2, RotateCcw, Upload, PenTool, Trash2, Move,
  ZoomIn, ChevronLeft, ChevronRight, FileText, Download,
  ExternalLink, AlertCircle, ShieldCheck, Sparkles, Check, X, Loader2
} from 'lucide-react';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { Ticket, WhatsAppNotificationPayload } from '../types';
import { cleanWhatsAppNumber, formatCurrentDateTime } from '../data/mockData';
import {
  getFileFromStorage,
  saveFileToStorage,
  downloadFile,
  parseTicketFileEntry,
  DRIVE_JAWABAN_FOLDER_ID,
  DRIVE_JAWABAN_FOLDER_URL
} from '../data/fileStore';

// Configure PDF.js worker safely for Vite
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
} catch {
  // Fallback if URL resolution fails in certain environments
}

export interface SignatureSpecimen {
  id: string;
  name: string;
  managerName: string;
  dataUrl: string; // Pure image/png Data URL
  aspectRatio: number; // width / height
  createdAt: string;
}

const SPECIMEN_STORAGE_KEY = 'wbp_manager_png_specimens_v1';

function loadStoredSpecimens(): SignatureSpecimen[] {
  try {
    const raw = localStorage.getItem(SPECIMEN_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveStoredSpecimens(list: SignatureSpecimen[]): void {
  try {
    localStorage.setItem(SPECIMEN_STORAGE_KEY, JSON.stringify(list));
  } catch {
    // ignore storage quota errors
  }
}

/**
 * Ensures any uploaded image DataURL is converted into a clean transparent PNG DataURL
 * and returns its natural width/height aspect ratio.
 */
async function normalizeToPngDataUrl(sourceUrl: string): Promise<{ pngDataUrl: string; aspectRatio: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const w = img.naturalWidth || 400;
      const h = img.naturalHeight || 180;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ pngDataUrl: sourceUrl, aspectRatio: w / h });
        return;
      }
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve({
        pngDataUrl: canvas.toDataURL('image/png'),
        aspectRatio: Math.max(0.5, Math.min(6, w / h))
      });
    };
    img.onerror = () => reject(new Error('Gagal memuat gambar spesimen tanda tangan.'));
    img.src = sourceUrl;
  });
}

/**
 * Generates an official transparent PNG signature specimen for a Manager name
 */
function createDefaultManagerSignaturePng(managerName: string): { pngDataUrl: string; aspectRatio: number } {
  const canvas = document.createElement('canvas');
  canvas.width = 520;
  canvas.height = 200;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Subtle official stamp border
    ctx.strokeStyle = 'rgba(40, 41, 116, 0.35)';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
    ctx.setLineDash([]);

    // Header badge
    ctx.fillStyle = '#282974';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText('PT WASKITA BETON PRECAST TBK · ENGINEERING', 28, 38);

    // Stylized handwritten-like signature flourish
    ctx.save();
    ctx.strokeStyle = '#141654';
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(45, 125);
    ctx.bezierCurveTo(95, 55, 145, 145, 200, 82);
    ctx.bezierCurveTo(245, 40, 270, 135, 335, 95);
    ctx.bezierCurveTo(375, 75, 420, 110, 470, 88);
    ctx.stroke();

    // Underline sweep
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(38, 142);
    ctx.quadraticCurveTo(240, 126, 455, 138);
    ctx.stroke();
    ctx.restore();

    // Manager Name in bold italic signature style
    ctx.fillStyle = '#1e1f5a';
    ctx.font = 'italic bold 28px Georgia, serif';
    ctx.fillText(managerName || 'Manager Engineering', 48, 115);

    ctx.fillStyle = '#047857';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('VERIFIED DIGITAL SPECIMEN (PNG)', 28, 174);
  }
  return {
    pngDataUrl: canvas.toDataURL('image/png'),
    aspectRatio: 520 / 200
  };
}

/**
 * Generates a realistic PDF document via pdf-lib when the ticket's result file
 * is either not a binary PDF (e.g. DWG/XLSX/TXT) or not found in local IndexedDB cache.
 */
async function buildFallbackTechnicalPdfBytes(ticket: Ticket, fileName: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // Standard A4
  const { width, height } = page.getSize();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Header Banner
  page.drawRectangle({
    x: 36,
    y: height - 96,
    width: width - 72,
    height: 60,
    color: rgb(0.157, 0.161, 0.455) // #282974
  });

  page.drawText('PT. WASKITA BETON PRECAST, TBK - DIVISI ENGINEERING', {
    x: 50,
    y: height - 62,
    size: 13,
    font: fontBold,
    color: rgb(1, 1, 1)
  });

  page.drawText('DOKUMEN HASIL REKAYASA TEKNIS & LEMBAR PENGESAHAN MANAGER', {
    x: 50,
    y: height - 80,
    size: 9.5,
    font: fontRegular,
    color: rgb(0.88, 0.9, 1)
  });

  // Document Metadata Box
  page.drawRectangle({
    x: 36,
    y: height - 275,
    width: width - 72,
    height: 165,
    borderColor: rgb(0.8, 0.83, 0.88),
    borderWidth: 1,
    color: rgb(0.975, 0.98, 0.99)
  });

  const rows: [string, string][] = [
    ['Nomor Tiket', ticket.ID_Tiket],
    ['Nama Berkas Hasil', fileName || 'Dokumen_Hasil_Engineering.pdf'],
    ['Nama Proyek', ticket.Proyek],
    ['Kode Proyek / SO', `${ticket.Kode_Proyek || '-'} / ${ticket.SO || '-'}`],
    ['Tujuan Permintaan', ticket.Tujuan_Permintaan || '-'],
    ['Pemohon (Sales/Proyek)', `${ticket.Peminta} (+${ticket.WA_Peminta})`],
    ['Departemen Engineering', ticket.Departemen_Tujuan],
    ['Staf Penyusun (PIC)', ticket.Staff_Tujuan || '-'],
    ['Jenis Produk & Dimensi', `${ticket.Jenis_Produk || '-'} (${ticket.Dimensi || '-'})`],
    ['Dokumen Diterbitkan', ticket.Dokumen || '-']
  ];

  let currentY = height - 130;
  rows.forEach(([label, val]) => {
    page.drawText(`${label}`, {
      x: 48,
      y: currentY,
      size: 9,
      font: fontBold,
      color: rgb(0.25, 0.28, 0.35)
    });
    page.drawText(`:  ${(val || '-').slice(0, 72)}`, {
      x: 175,
      y: currentY,
      size: 9,
      font: fontRegular,
      color: rgb(0.1, 0.12, 0.18)
    });
    currentY -= 14;
  });

  // Technical Content Section
  page.drawText('RINGKASAN HASIL ANALISIS & DOKUMEN TEKNIS STAF ENGINEERING', {
    x: 36,
    y: height - 305,
    size: 10.5,
    font: fontBold,
    color: rgb(0.157, 0.161, 0.455)
  });

  page.drawRectangle({
    x: 36,
    y: height - 510,
    width: width - 72,
    height: 195,
    borderColor: rgb(0.82, 0.85, 0.9),
    borderWidth: 1,
    color: rgb(1, 1, 1)
  });

  const noteLines = [
    '1. Seluruh dokumen perhitungan struktur, shop drawing, dan spesifikasi teknis (SSP)',
    '   telah disusun sesuai standar SNI 2847:2019, SNI 1726:2019, dan ISO 9001:2015 WBP.',
    '2. Pemeriksaan mutu dimensi elemen pracetak / readymix telah diverifikasi terhadap',
    '   ketentuan dokumen kontrak & kebutuhan proyek.',
    '',
    'Catatan Pengiriman Staf Engineering:',
    `   ${(ticket.Keterangan_Penerima || 'Dokumen hasil telah diunggah oleh Staf Engineering.').slice(0, 88)}`,
    (ticket.Keterangan_Penerima || '').length > 88
      ? `   ${ticket.Keterangan_Penerima.slice(88, 176)}`
      : ''
  ];

  let textY = height - 332;
  noteLines.forEach((line) => {
    page.drawText(line, {
      x: 48,
      y: textY,
      size: 9,
      font: fontRegular,
      color: rgb(0.18, 0.2, 0.25)
    });
    textY -= 16;
  });

  // Signature Area Guide Box at Bottom
  page.drawRectangle({
    x: 36,
    y: 70,
    width: width - 72,
    height: 190,
    borderColor: rgb(0.75, 0.78, 0.86),
    borderWidth: 1,
    color: rgb(0.99, 0.995, 1)
  });

  page.drawText('AREA PENGESAHAN & TANDA TANGAN MANAGER ENGINEERING', {
    x: 48,
    y: 240,
    size: 9.5,
    font: fontBold,
    color: rgb(0.157, 0.161, 0.455)
  });

  page.drawText(
    'Geser (drag) dan sesuaikan ukuran spesimen tanda tangan PNG Manager pada area dokumen ini.',
    {
      x: 48,
      y: 224,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.4, 0.44, 0.52)
    }
  );

  return await pdfDoc.save();
}

interface ManagerDocumentReviewPanelProps {
  ticket: Ticket;
  managerName: string;
  managerWa: string;
  onUpdateTicket: (ticket: Ticket) => void;
  onOpenWhatsApp: (payload: WhatsAppNotificationPayload) => void;
  onSelectTicketDetail: (ticket: Ticket) => void;
}

export const ManagerDocumentReviewPanel: React.FC<ManagerDocumentReviewPanelProps> = ({
  ticket,
  managerName,
  onUpdateTicket,
  onOpenWhatsApp,
  onSelectTicketDetail
}) => {
  // Parse result files uploaded by Staff
  const resultFiles = React.useMemo(() => {
    if (!ticket.File_Hasil || ticket.File_Hasil === '-' || ticket.File_Hasil === 'nan') {
      return [];
    }
    return ticket.File_Hasil.split('||')
      .map(raw => raw.trim())
      .filter(Boolean)
      .map(raw => parseTicketFileEntry(raw, 'jawaban_atas_permintaan'));
  }, [ticket.File_Hasil]);

  const [selectedFileRaw, setSelectedFileRaw] = useState<string>(resultFiles[0]?.raw || '');

  useEffect(() => {
    if (resultFiles.length > 0 && !resultFiles.some(f => f.raw === selectedFileRaw)) {
      setSelectedFileRaw(resultFiles[0].raw);
    } else if (resultFiles.length === 0) {
      setSelectedFileRaw('');
    }
  }, [resultFiles, selectedFileRaw]);

  // Saved PNG Signature Specimens state
  const [specimens, setSpecimens] = useState<SignatureSpecimen[]>(() => loadStoredSpecimens());
  const [selectedSpecimenId, setSelectedSpecimenId] = useState<string>('');
  const [isDrawingModalOpen, setIsDrawingModalOpen] = useState(false);
  const [includeApprovalTextOnPdf, setIncludeApprovalTextOnPdf] = useState(true);

  // Ensure at least one default PNG specimen exists for this manager or select the matching one
  useEffect(() => {
    const existing = loadStoredSpecimens();
    const forManager = existing.find(
      s => s.managerName.toLowerCase() === (managerName || '').toLowerCase()
    );
    if (forManager) {
      setSpecimens(existing);
      if (!selectedSpecimenId || !existing.some(s => s.id === selectedSpecimenId)) {
        setSelectedSpecimenId(forManager.id);
      }
    } else if (existing.length > 0) {
      setSpecimens(existing);
      if (!selectedSpecimenId) {
        setSelectedSpecimenId(existing[0].id);
      }
    } else {
      const generated = createDefaultManagerSignaturePng(managerName || 'Manager Engineering');
      const initialSpec: SignatureSpecimen = {
        id: `SIG-${Date.now()}`,
        name: `Spesimen_${(managerName || 'Manager').replace(/\s+/g, '_')}.png`,
        managerName: managerName || 'Manager Engineering',
        dataUrl: generated.pngDataUrl,
        aspectRatio: generated.aspectRatio,
        createdAt: formatCurrentDateTime()
      };
      const updated = [initialSpec];
      saveStoredSpecimens(updated);
      setSpecimens(updated);
      setSelectedSpecimenId(initialSpec.id);
    }
  }, [managerName]);

  const activeSpecimen =
    specimens.find(s => s.id === selectedSpecimenId) || specimens[0] || null;

  // PDF Document & Page Rendering State
  const [pdfBytes, setPdfBytes] = useState<Uint8Array | null>(null);
  const [isRealUploadedPdf, setIsRealUploadedPdf] = useState(false);
  const [totalPages, setTotalPages] = useState(1);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageAspectRatio, setPageAspectRatio] = useState(595.28 / 841.89); // width / height
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);

  // Draggable & Resizable Signature Position (in percentage of page width & height: 0..100)
  const [sigPos, setSigPos] = useState<{ xPct: number; yPct: number; widthPct: number }>({
    xPct: 56,
    yPct: 72,
    widthPct: 32
  });

  // Interaction state for drag / resize
  const previewContainerRef = useRef<HTMLDivElement | null>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragStateRef = useRef<{
    mode: 'drag' | 'resize' | null;
    startX: number;
    startY: number;
    initialXPct: number;
    initialYPct: number;
    initialWidthPct: number;
  }>({
    mode: null,
    startX: 0,
    startY: 0,
    initialXPct: 56,
    initialYPct: 72,
    initialWidthPct: 32
  });

  // Revision & Approval Form States
  const [catatanRevisi, setCatatanRevisi] = useState('');
  const [catatanApproval, setCatatanApproval] = useState('');
  const [actionError, setActionError] = useState('');
  const [actionSuccess, setActionSuccess] = useState('');
  const [isProcessingSign, setIsProcessingSign] = useState(false);
  const [signProgress, setSignProgress] = useState(0);
  const [signStageText, setSignStageText] = useState('');

  // Signature Drawing Pad Canvas Ref
  const drawPadCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingPadActiveRef = useRef(false);

  // Calculate height percentage of signature on the page based on specimen aspect ratio and page aspect ratio
  const sigHeightPct = React.useMemo(() => {
    const specRatio = activeSpecimen?.aspectRatio || 2.5;
    // heightPct = widthPct * (pageWidth / pageHeight) / (sigWidth / sigHeight)
    return Math.max(6, Math.min(45, (sigPos.widthPct * pageAspectRatio) / specRatio));
  }, [sigPos.widthPct, pageAspectRatio, activeSpecimen]);

  // Load PDF bytes from storage (or synthesize official WBP PDF sheet if non-PDF / missing binary)
  useEffect(() => {
    let isCancelled = false;
    async function loadDocumentPdf() {
      setIsLoadingPreview(true);
      setActionError('');
      try {
        const targetEntry = selectedFileRaw || resultFiles[0]?.raw || `${ticket.ID_Tiket}_Hasil_Teknis.pdf`;
        const parsedEntry = parseTicketFileEntry(targetEntry, 'jawaban_atas_permintaan');
        const storedRecord = await getFileFromStorage(targetEntry);

        let loadedBytes: Uint8Array | null = null;
        let isUploadedPdf = false;

        if (storedRecord && storedRecord.dataUrl) {
          const isPdfMime =
            storedRecord.type === 'application/pdf' ||
            parsedEntry.name.toLowerCase().endsWith('.pdf') ||
            storedRecord.dataUrl.startsWith('data:application/pdf');

          if (isPdfMime && storedRecord.dataUrl.includes(',')) {
            try {
              const base64 = storedRecord.dataUrl.split(',')[1];
              const binaryStr = atob(base64);
              const bytes = new Uint8Array(binaryStr.length);
              for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
              }
              // Validate with pdf-lib
              const testDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
              if (testDoc.getPageCount() > 0) {
                loadedBytes = bytes;
                isUploadedPdf = true;
              }
            } catch {
              loadedBytes = null;
            }
          }
        }

        if (!loadedBytes) {
          loadedBytes = await buildFallbackTechnicalPdfBytes(ticket, parsedEntry.name);
          isUploadedPdf = false;
        }

        if (isCancelled) return;

        const pdfDoc = await PDFDocument.load(loadedBytes, { ignoreEncryption: true });
        const pageCount = Math.max(1, pdfDoc.getPageCount());
        const firstPage = pdfDoc.getPage(0);
        const { width, height } = firstPage.getSize();

        setPdfBytes(loadedBytes);
        setIsRealUploadedPdf(isUploadedPdf);
        setTotalPages(pageCount);
        setCurrentPage(pageCount); // Default to last page (or page 1) where signatures usually go
        setPageAspectRatio(width / height);
      } catch (err) {
        console.warn('Fallback PDF builder error:', err);
      } finally {
        if (!isCancelled) {
          setIsLoadingPreview(false);
        }
      }
    }

    void loadDocumentPdf();
    return () => {
      isCancelled = true;
    };
  }, [ticket.ID_Tiket, selectedFileRaw, resultFiles]);

  // Render active PDF page onto <canvas>
  const renderPageToCanvas = useCallback(async () => {
    const canvas = pdfCanvasRef.current;
    if (!canvas || !pdfBytes) return;

    // First update page aspect ratio from pdf-lib
    let pageWidth = 595.28;
    let pageHeight = 841.89;
    try {
      const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
      const pIdx = Math.max(0, Math.min(doc.getPageCount() - 1, currentPage - 1));
      const p = doc.getPage(pIdx);
      const sz = p.getSize();
      pageWidth = sz.width;
      pageHeight = sz.height;
      setPageAspectRatio(pageWidth / pageHeight);
    } catch {
      // keep default A4 ratio
    }

    // Attempt high-fidelity PDF.js rendering first
    try {
      const loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
      const pdf = await loadingTask.promise;
      const safePageNum = Math.max(1, Math.min(pdf.numPages, currentPage));
      const page = await pdf.getPage(safePageNum);

      const scale = 1.6;
      const viewport = page.getViewport({ scale });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({
          canvasContext: ctx,
          viewport,
          canvas
        }).promise;
        return;
      }
    } catch {
      // Fallback high-resolution schematic canvas rendering if PDF.js worker is blocked
    }

    // Fallback direct canvas renderer so preview NEVER fails or shows blank
    const scale = 1.5;
    canvas.width = Math.round(pageWidth * scale);
    canvas.height = Math.round(pageHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Header
    ctx.fillStyle = '#282974';
    ctx.fillRect(45, 45, canvas.width - 90, 82);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('PT. WASKITA BETON PRECAST, TBK - DIVISI ENGINEERING', 65, 82);
    ctx.fillStyle = '#dbeafe';
    ctx.font = '13px sans-serif';
    ctx.fillText(
      `DOKUMEN HASIL TEKNIS (${ticket.ID_Tiket}) · HALAMAN ${currentPage} DARI ${totalPages}`,
      65,
      108
    );

    // Metadata box
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.5;
    ctx.fillRect(45, 148, canvas.width - 90, 235);
    ctx.strokeRect(45, 148, canvas.width - 90, 235);

    const infoRows = [
      ['Nomor Tiket', ticket.ID_Tiket],
      ['Nama Proyek', ticket.Proyek],
      ['Tujuan Permintaan', ticket.Tujuan_Permintaan || '-'],
      ['Pemohon / Sales', `${ticket.Peminta} (+${ticket.WA_Peminta})`],
      ['Departemen Tujuan', ticket.Departemen_Tujuan],
      ['Staf Eksekutor (PIC)', ticket.Staff_Tujuan],
      ['Dokumen Diterbitkan', ticket.Dokumen],
      ['Target Selesai', ticket.Target_Selesai]
    ];

    let y = 180;
    infoRows.forEach(([k, v]) => {
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(k, 65, y);
      ctx.fillStyle = '#0f172a';
      ctx.font = '13px sans-serif';
      ctx.fillText(`:  ${(v || '-').slice(0, 62)}`, 235, y);
      y += 24;
    });

    // Content summary box
    ctx.fillStyle = '#282974';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText('ISI DOKUMEN & CATATAN HASIL PENGERJAAN STAF ENGINEERING', 45, 420);

    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#cbd5e1';
    ctx.fillRect(45, 435, canvas.width - 90, 280);
    ctx.strokeRect(45, 435, canvas.width - 90, 280);

    ctx.fillStyle = '#334155';
    ctx.font = '13px sans-serif';
    ctx.fillText('1. Perhitungan analisis struktur, gambar shop drawing, dan spesifikasi teknis (SSP)', 65, 470);
    ctx.fillText('   telah diverifikasi oleh Staf Engineering sesuai standar SNI & ISO 9001:2015 WBP.', 65, 492);
    ctx.fillText('2. Catatan Staf Eksekutor:', 65, 530);
    ctx.fillStyle = '#0f172a';
    ctx.font = 'bold 13px sans-serif';
    ctx.fillText(`   "${(ticket.Keterangan_Penerima || '-').slice(0, 75)}"`, 65, 555);

    // Bottom signature guide area
    ctx.fillStyle = '#f8fafc';
    ctx.strokeStyle = '#94a3b8';
    ctx.setLineDash([6, 4]);
    ctx.fillRect(45, canvas.height - 320, canvas.width - 90, 260);
    ctx.strokeRect(45, canvas.height - 320, canvas.width - 90, 260);
    ctx.setLineDash([]);

    ctx.fillStyle = '#282974';
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText('AREA PENEMPATAN SPESIMEN TANDA TANGAN PNG MANAGER', 65, canvas.height - 285);
    ctx.fillStyle = '#64748b';
    ctx.font = '12px sans-serif';
    ctx.fillText('Geser (drag) dan atur ukuran tanda tangan PNG pada halaman ini sebelum menekan Approve & Sign.', 65, canvas.height - 262);
  }, [pdfBytes, currentPage, totalPages, ticket]);

  useEffect(() => {
    void renderPageToCanvas();
  }, [renderPageToCanvas]);

  // Handle Upload PNG Specimen
  const handleUploadSpecimenPng = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setActionError('');

    try {
      const rawDataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      const { pngDataUrl, aspectRatio } = await normalizeToPngDataUrl(rawDataUrl);
      const newSpec: SignatureSpecimen = {
        id: `SIG-${Date.now()}`,
        name: file.name.toLowerCase().endsWith('.png') ? file.name : `${file.name}.png`,
        managerName: managerName || 'Manager Engineering',
        dataUrl: pngDataUrl,
        aspectRatio,
        createdAt: formatCurrentDateTime()
      };

      const updated = [newSpec, ...specimens];
      setSpecimens(updated);
      saveStoredSpecimens(updated);
      setSelectedSpecimenId(newSpec.id);
      setActionSuccess(`Spesimen PNG "${newSpec.name}" berhasil disimpan dan dipilih!`);
      setTimeout(() => setActionSuccess(''), 3500);
    } catch {
      setActionError('Gagal membaca file gambar spesimen. Pastikan file berformat PNG yang valid.');
    } finally {
      e.target.value = '';
    }
  };

  const handleDeleteSpecimen = (id: string) => {
    const filtered = specimens.filter(s => s.id !== id);
    setSpecimens(filtered);
    saveStoredSpecimens(filtered);
    if (selectedSpecimenId === id) {
      setSelectedSpecimenId(filtered[0]?.id || '');
    }
  };

  // Drawing Pad Handlers for creating custom transparent PNG signature specimen
  const initDrawPad = useCallback(() => {
    const canvas = drawPadCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  useEffect(() => {
    if (isDrawingModalOpen) {
      setTimeout(initDrawPad, 50);
    }
  }, [isDrawingModalOpen, initDrawPad]);

  const handleDrawPadPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = drawPadCanvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    isDrawingPadActiveRef.current = true;
    ctx.strokeStyle = '#141654';
    ctx.lineWidth = 3.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const handleDrawPadPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingPadActiveRef.current) return;
    const canvas = drawPadCanvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const handleDrawPadPointerUp = () => {
    isDrawingPadActiveRef.current = false;
  };

  const handleSaveDrawnSpecimen = () => {
    const canvas = drawPadCanvasRef.current;
    if (!canvas) return;
    const pngDataUrl = canvas.toDataURL('image/png');
    const newSpec: SignatureSpecimen = {
      id: `SIG-${Date.now()}`,
      name: `TTD_${(managerName || 'Manager').replace(/\s+/g, '_')}_${Date.now().toString().slice(-4)}.png`,
      managerName: managerName || 'Manager Engineering',
      dataUrl: pngDataUrl,
      aspectRatio: canvas.width / canvas.height,
      createdAt: formatCurrentDateTime()
    };
    const updated = [newSpec, ...specimens];
    setSpecimens(updated);
    saveStoredSpecimens(updated);
    setSelectedSpecimenId(newSpec.id);
    setIsDrawingModalOpen(false);
    setActionSuccess('Spesimen tanda tangan PNG transparan berhasil dibuat dan dipilih!');
    setTimeout(() => setActionSuccess(''), 3500);
  };

  // Drag & Resize Pointer Handlers on the PDF Page Preview
  const handleSigPointerDown = (
    e: React.PointerEvent<HTMLDivElement>,
    mode: 'drag' | 'resize'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    dragStateRef.current = {
      mode,
      startX: e.clientX,
      startY: e.clientY,
      initialXPct: sigPos.xPct,
      initialYPct: sigPos.yPct,
      initialWidthPct: sigPos.widthPct
    };
  };

  const handleSigPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const state = dragStateRef.current;
    if (!state.mode || !previewContainerRef.current) return;
    e.stopPropagation();
    e.preventDefault();

    const rect = previewContainerRef.current.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;

    const deltaXPct = ((e.clientX - state.startX) / rect.width) * 100;
    const deltaYPct = ((e.clientY - state.startY) / rect.height) * 100;

    if (state.mode === 'drag') {
      const clampedX = Math.max(0, Math.min(100 - sigPos.widthPct, state.initialXPct + deltaXPct));
      const clampedY = Math.max(0, Math.min(100 - sigHeightPct, state.initialYPct + deltaYPct));
      setSigPos(prev => ({
        ...prev,
        xPct: Number(clampedX.toFixed(2)),
        yPct: Number(clampedY.toFixed(2))
      }));
    } else if (state.mode === 'resize') {
      const nextWidthPct = Math.max(
        12,
        Math.min(65, Math.min(100 - state.initialXPct, state.initialWidthPct + deltaXPct))
      );
      setSigPos(prev => ({
        ...prev,
        widthPct: Number(nextWidthPct.toFixed(2))
      }));
    }
  };

  const handleSigPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current.mode) {
      e.stopPropagation();
      dragStateRef.current.mode = null;
    }
  };

  // ACTION 1: Kembalikan untuk Revisi (REVISI STAF)
  const handleReturnForRevision = () => {
    setActionError('');
    if (!catatanRevisi.trim()) {
      setActionError('Mohon isi Catatan Koreksi / Revisi terlebih dahulu sebelum mengembalikan tiket ke Staf.');
      return;
    }

    const timestamp = formatCurrentDateTime();
    const updatedTicket: Ticket = {
      ...ticket,
      Status_Pengerjaan: 'REVISI STAF',
      Catatan_Revisi: catatanRevisi.trim(),
      Keterangan_Penerima: `[REVISI MANAGER - ${managerName} (${timestamp})]: ${catatanRevisi.trim()}`
    };

    onUpdateTicket(updatedTicket);
    setCatatanRevisi('');
    setActionSuccess(`Tiket ${ticket.ID_Tiket} dikembalikan ke Staf (${ticket.Staff_Tujuan}) dengan status REVISI STAF.`);

    const staffWa = cleanWhatsAppNumber(ticket.WA_Staff);
    const pesan = `*INSTRUKSI REVISI DOKUMEN (${ticket.ID_Tiket})*\n\nHalo ${ticket.Staff_Tujuan},\nDokumen hasil untuk proyek *${ticket.Proyek}* telah direview oleh Manager (${managerName}) dan dikembalikan dengan status *REVISI STAF*.\n\n*Catatan Koreksi Manager:*\n"${catatanRevisi.trim()}"\n\nSilakan perbaiki dokumen sesuai catatan koreksi di atas dan unggah kembali melalui portal Staff.`;

    onOpenWhatsApp({
      id: ticket.ID_Tiket,
      wa: staffWa,
      pesan,
      target_role: 'Staff Engineering (Revisi)',
      target_name: ticket.Staff_Tujuan
    });
  };

  // ACTION 2: Approve & Sign (Embed PNG into PDF, Upload to Storage/Google Drive, & Close Ticket)
  const handleApproveAndSign = async () => {
    setActionError('');
    if (!activeSpecimen) {
      setActionError('Pilih atau unggah spesimen tanda tangan berformat PNG terlebih dahulu.');
      return;
    }

    setIsProcessingSign(true);
    setSignProgress(5);
    setSignStageText('Menyiapkan dokumen PDF & spesimen tanda tangan PNG...');

    try {
      const approvalDateTime = formatCurrentDateTime();
      const baseBytes =
        pdfBytes || (await buildFallbackTechnicalPdfBytes(ticket, `${ticket.ID_Tiket}_Hasil.pdf`));

      const pdfDoc = await PDFDocument.load(baseBytes, { ignoreEncryption: true });
      const pages = pdfDoc.getPages();
      const targetPageIndex = Math.max(0, Math.min(pages.length - 1, currentPage - 1));
      const page = pages[targetPageIndex];
      const { width: pageWidth, height: pageHeight } = page.getSize();

      setSignProgress(20);
      setSignStageText('Menempelkan spesimen tanda tangan PNG ke halaman PDF...');

      // Ensure pure PNG bytes
      const { pngDataUrl } = await normalizeToPngDataUrl(activeSpecimen.dataUrl);
      const pngBase64 = pngDataUrl.split(',')[1];
      const pngBinary = atob(pngBase64);
      const pngBytes = new Uint8Array(pngBinary.length);
      for (let i = 0; i < pngBinary.length; i++) {
        pngBytes[i] = pngBinary.charCodeAt(i);
      }

      const embeddedPng = await pdfDoc.embedPng(pngBytes);

      // Compute exact PDF coordinates (PDF origin (0,0) is bottom-left; preview origin (0,0) is top-left)
      const pdfSigWidth = (sigPos.widthPct / 100) * pageWidth;
      const pdfSigHeight = (sigHeightPct / 100) * pageHeight;
      const pdfX = (sigPos.xPct / 100) * pageWidth;
      const pdfY = pageHeight - (sigPos.yPct / 100) * pageHeight - pdfSigHeight;

      // Draw signature PNG image on the page
      page.drawImage(embeddedPng, {
        x: Math.max(4, pdfX),
        y: Math.max(18, pdfY),
        width: pdfSigWidth,
        height: pdfSigHeight
      });

      // Optionally draw "Approved by & Tanggal Persetujuan" stamp directly below the PNG signature
      if (includeApprovalTextOnPdf) {
        const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
        const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const textX = Math.max(6, pdfX);
        const line1Y = Math.max(14, pdfY - 9);
        const line2Y = Math.max(5, pdfY - 19);

        page.drawText(`Approved by: ${managerName}`, {
          x: textX,
          y: line1Y,
          size: 7.5,
          font: fontBold,
          color: rgb(0.157, 0.161, 0.455)
        });

        page.drawText(`Date: ${approvalDateTime} · WBP Engineering Verified`, {
          x: textX,
          y: line2Y,
          size: 6.8,
          font: fontRegular,
          color: rgb(0.02, 0.47, 0.34)
        });
      }

      setSignProgress(45);
      setSignStageText('Menyimpan berkas PDF bertanda tangan...');

      const signedPdfBytes = await pdfDoc.save();
      const rawTargetName =
        resultFiles.find(f => f.raw === selectedFileRaw)?.name ||
        resultFiles[0]?.name ||
        `${ticket.ID_Tiket}_${ticket.Proyek.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`;
      const baseCleanName = rawTargetName.replace(/\.pdf$/i, '').replace(/^SIGNED_/i, '');
      const signedFileName = `SIGNED_${baseCleanName}.pdf`;

      const signedBlob = new Blob([new Uint8Array(signedPdfBytes)], { type: 'application/pdf' });
      const signedFile = new File([signedBlob], signedFileName, { type: 'application/pdf' });

      const uploadedRecord = await saveFileToStorage(
        signedFile,
        'jawaban_atas_permintaan',
        ticket.ID_Tiket,
        (pct, stageMsg) => {
          const mappedPct = 45 + Math.round((pct / 100) * 55);
          setSignProgress(Math.min(100, mappedPct));
          if (stageMsg) setSignStageText(stageMsg);
        }
      );

      // Update File_Hasil list: replace the signed target file or prepend the signed PDF
      const otherFiles = resultFiles
        .filter(f => f.raw !== selectedFileRaw)
        .map(f => f.raw);
      const updatedFileHasil = [uploadedRecord.formattedEntry, ...otherFiles].join(' || ');

      const approvalNote = `[APPROVED & SIGNED oleh ${managerName} pada ${approvalDateTime}]${
        catatanApproval.trim() ? `: ${catatanApproval.trim()}` : ' — Dokumen telah disetujui & ditempel spesimen tanda tangan Manager.'
      }`;

      const updatedTicket: Ticket = {
        ...ticket,
        Status_Pengerjaan: 'CLOSED (Selesai)',
        File_Hasil: updatedFileHasil,
        Aktual_Selesai: approvalDateTime,
        Approved_By: managerName,
        Tanggal_Persetujuan: approvalDateTime,
        Keterangan_Penerima: approvalNote
      };

      onUpdateTicket(updatedTicket);
      setCatatanApproval('');
      setActionSuccess(
        `Dokumen "${signedFileName}" berhasil di-Approve & Sign oleh ${managerName} (${approvalDateTime}) dan status tiket ditutup (CLOSED)!`
      );

      // Send WhatsApp notification to Requester (Peminta)
      const cleanWaPeminta = cleanWhatsAppNumber(ticket.WA_Peminta);
      const pesan = `*DOKUMEN DISETUJUI & DITANDATANGANI (${ticket.ID_Tiket})*\n\nHalo Bpk/Ibu ${ticket.Peminta},\nDokumen teknis untuk proyek *${ticket.Proyek}* telah *DISETUJUI & DITANDATANGANI (APPROVED & SIGNED)* oleh Manager ${ticket.Departemen_Tujuan}.\n\nApproved by: *${managerName}*\nTanggal Persetujuan: *${approvalDateTime}*\nBerkas Hasil: *${signedFileName}*\nStatus Tiket: *CLOSED (Selesai)*\n\nSilakan unduh dokumen PDF yang telah ditandatangani melalui portal atau Folder Jawaban Google Drive.`;

      onOpenWhatsApp({
        id: ticket.ID_Tiket,
        wa: cleanWaPeminta,
        pesan,
        target_role: 'Pemberi Tugas (Sales / Proyek)',
        target_name: ticket.Peminta
      });
    } catch (err) {
      console.error('Approve & Sign error:', err);
      setActionError('Terjadi kendala saat menempelkan tanda tangan PNG ke PDF. Silakan coba kembali.');
    } finally {
      setIsProcessingSign(false);
      setSignProgress(0);
      setSignStageText('');
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-5 overflow-hidden">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3.5 border-b border-slate-200">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-md bg-indigo-50 text-[#282974] border border-indigo-200 text-[10px] font-mono font-bold uppercase">
              REVIEW & APPROVAL MANAGER · {ticket.ID_Tiket}
            </span>
            <span className="px-2 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-semibold">
              Staf PIC: {ticket.Staff_Tujuan}
            </span>
          </div>
          <h3 className="text-sm sm:text-base font-bold text-slate-900 mt-1 break-words">
            {ticket.Proyek}
          </h3>
        </div>

        <button
          type="button"
          onClick={() => onSelectTicketDetail(ticket)}
          className="px-3 py-1.5 text-xs font-semibold text-[#282974] bg-[#282974]/8 hover:bg-[#282974]/15 rounded-xl border border-[#282974]/20 transition-colors shrink-0 self-start sm:self-center"
        >
          Detail Tiket Lengkap
        </button>
      </div>

      {actionError && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>{actionError}</span>
        </div>
      )}

      {actionSuccess && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* Summary & Uploaded Files by Staff */}
      <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5 text-xs">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <span className="text-slate-500 text-[10px] block">Pemohon (Sales/Proyek):</span>
            <span className="font-semibold text-slate-900">{ticket.Peminta}</span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block">Tujuan & Dokumen:</span>
            <span className="font-semibold text-slate-900">
              {ticket.Tujuan_Permintaan !== '-' ? `${ticket.Tujuan_Permintaan} · ` : ''}
              {ticket.Dokumen}
            </span>
          </div>
          <div>
            <span className="text-slate-500 text-[10px] block">Target Selesai:</span>
            <span className="font-mono font-bold text-emerald-700">{ticket.Target_Selesai}</span>
          </div>
        </div>

        <div className="pt-2 border-t border-slate-200">
          <span className="text-slate-500 text-[10px] block mb-1">Catatan Pengiriman Staf ({ticket.Staff_Tujuan}):</span>
          <div className="p-2.5 bg-white rounded-lg border border-slate-200 text-slate-800 font-medium text-[11px] break-words">
            {ticket.Keterangan_Penerima !== '-' ? ticket.Keterangan_Penerima : 'Dokumen hasil telah diunggah dan siap direview Manager.'}
          </div>
        </div>

        {/* File selector for preview & signing */}
        <div className="pt-2 border-t border-slate-200 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-slate-800">
              Berkas Hasil yang Diunggah Staf ({resultFiles.length} berkas):
            </span>
            <a
              href={DRIVE_JAWABAN_FOLDER_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 hover:underline"
            >
              <span>Folder Jawaban ({DRIVE_JAWABAN_FOLDER_ID.slice(0, 8)}...)</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {resultFiles.length > 0 ? (
            <div className="space-y-1.5">
              {resultFiles.map((file, idx) => {
                const isSelected = file.raw === selectedFileRaw;
                return (
                  <div
                    key={idx}
                    onClick={() => setSelectedFileRaw(file.raw)}
                    className={`flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-[#282974]/8 border-[#282974] shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <FileText className="w-4 h-4 text-[#282974] shrink-0" />
                      <span className="font-mono text-[11px] font-semibold text-slate-900 truncate">
                        {file.name}
                      </span>
                      {isSelected && (
                        <span className="px-1.5 py-0.5 rounded bg-[#282974] text-white text-[9px] font-bold shrink-0">
                          Aktif di Pratinjau
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void downloadFile(file.raw, {
                            proyek: ticket.Proyek,
                            idTiket: ticket.ID_Tiket,
                            dokumen: ticket.Dokumen
                          });
                        }}
                        className="px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold inline-flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" /> Unduh
                      </button>
                      <a
                        href={file.driveViewUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="px-2 py-1 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-semibold inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" /> Drive
                      </a>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-[11px]">
              Staf belum melampirkan file biner; sistem menampilkan Lembar Pengesahan PDF Otomatis untuk proyek ini.
            </div>
          )}
        </div>
      </div>

      {/* SECTION 1: MANAJEMEN SPESIMEN TANDA TANGAN PNG MANAGER */}
      <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <PenTool className="w-3.5 h-3.5 text-[#282974]" />
              <span>1. Pilih / Simpan Spesimen Tanda Tangan Manager (Format PNG)</span>
            </h4>
            <p className="text-[11px] text-slate-600 mt-0.5">
              Unggah gambar spesimen tanda tangan berformat <strong>.PNG</strong> (transparan) atau gambar langsung di kanvas. Spesimen tersimpan permanen untuk digunakan kembali.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#282974] hover:bg-[#1e1f5a] text-white text-xs font-semibold cursor-pointer transition-colors shadow-2xs">
              <Upload className="w-3.5 h-3.5" />
              <span>Unggah Spesimen PNG</span>
              <input
                type="file"
                accept="image/png,image/*"
                onChange={handleUploadSpecimenPng}
                className="hidden"
              />
            </label>

            <button
              type="button"
              onClick={() => setIsDrawingModalOpen(prev => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 text-xs font-semibold transition-colors"
            >
              <PenTool className="w-3.5 h-3.5 text-[#282974]" />
              <span>{isDrawingModalOpen ? 'Tutup Kanvas TTD' : 'Gambar TTD PNG Baru'}</span>
            </button>
          </div>
        </div>

        {/* Optional Drawing Pad for creating a fresh transparent PNG signature */}
        {isDrawingModalOpen && (
          <div className="p-3.5 rounded-xl bg-white border border-indigo-200 space-y-2.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-[#282974]">
                Kanvas Pembuat Spesimen Tanda Tangan PNG Transparan ({managerName})
              </span>
              <button
                type="button"
                onClick={initDrawPad}
                className="text-[11px] font-semibold text-rose-600 hover:underline"
              >
                Bersihkan Kanvas
              </button>
            </div>
            <div className="border-2 border-dashed border-slate-300 rounded-xl bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:12px_12px] overflow-hidden">
              <canvas
                ref={drawPadCanvasRef}
                width={520}
                height={180}
                onPointerDown={handleDrawPadPointerDown}
                onPointerMove={handleDrawPadPointerMove}
                onPointerUp={handleDrawPadPointerUp}
                onPointerCancel={handleDrawPadPointerUp}
                className="w-full h-36 touch-none cursor-crosshair block"
              />
            </div>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setIsDrawingModalOpen(false)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleSaveDrawnSpecimen}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Simpan sebagai Spesimen PNG</span>
              </button>
            </div>
          </div>
        )}

        {/* Gallery of saved PNG specimens */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {specimens.map(spec => {
            const isSelected = activeSpecimen?.id === spec.id;
            return (
              <div
                key={spec.id}
                onClick={() => setSelectedSpecimenId(spec.id)}
                className={`p-2.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                  isSelected
                    ? 'bg-white border-[#282974] ring-2 ring-[#282974]/20 shadow-xs'
                    : 'bg-white/70 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="h-16 rounded-lg border border-slate-200 bg-[radial-gradient(#cbd5e1_1px,transparent_1px)] [background-size:10px_10px] flex items-center justify-center p-1.5 overflow-hidden">
                  <img
                    src={spec.dataUrl}
                    alt={spec.name}
                    className="max-h-full max-w-full object-contain select-none pointer-events-none"
                  />
                </div>
                <div className="mt-2 flex items-center justify-between gap-1.5">
                  <div className="min-w-0">
                    <div className="text-[11px] font-bold text-slate-800 truncate">{spec.name}</div>
                    <div className="text-[10px] text-slate-500 truncate">{spec.managerName}</div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isSelected && (
                      <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[9px] font-bold">
                        Terpilih
                      </span>
                    )}
                    {specimens.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteSpecimen(spec.id);
                        }}
                        className="p-1 text-slate-400 hover:text-rose-600 transition-colors"
                        title="Hapus spesimen ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: PRATINJAU DOKUMEN PDF INTERAKTIF & DRAG/RESIZE SPESIMEN PNG */}
      <div className="p-4 rounded-xl bg-slate-100 border border-slate-300 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h4 className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
              <Move className="w-3.5 h-3.5 text-[#282974]" />
              <span>2. Pratinjau Halaman Dokumen & Posisi Tempel Spesimen PNG</span>
            </h4>
            <p className="text-[11px] text-slate-600">
              Geser (<em>drag</em>) kotak tanda tangan PNG di bawah ini ke posisi yang diinginkan dan tarik sudut kanan-bawah atau gunakan slider untuk mengatur ukurannya.
            </p>
          </div>

          {/* Page Navigation Controls */}
          <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-xl border border-slate-200 shrink-0 self-start sm:self-center">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"
              title="Halaman Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4 text-slate-700" />
            </button>
            <span className="text-[11px] font-mono font-bold text-slate-800 px-1.5">
              Hal {currentPage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              className="p-1 rounded hover:bg-slate-100 disabled:opacity-40"
              title="Halaman Berikutnya"
            >
              <ChevronRight className="w-4 h-4 text-slate-700" />
            </button>
          </div>
        </div>

        {/* Size Slider & Quick Position Presets Toolbar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2.5 bg-white rounded-xl border border-slate-200 text-xs">
          <div className="flex items-center gap-2.5 flex-1">
            <ZoomIn className="w-4 h-4 text-[#282974] shrink-0" />
            <span className="text-[11px] font-semibold text-slate-700 whitespace-nowrap">
              Ukuran TTD ({Math.round(sigPos.widthPct)}%):
            </span>
            <input
              type="range"
              min={14}
              max={60}
              step={1}
              value={sigPos.widthPct}
              onChange={(e) => {
                const newW = Number(e.target.value);
                setSigPos(prev => ({
                  ...prev,
                  widthPct: newW,
                  xPct: Math.min(prev.xPct, 100 - newW)
                }));
              }}
              className="w-full max-w-[180px] accent-[#282974] cursor-pointer"
            />
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] text-slate-500 font-medium mr-1">Posisi Cepat:</span>
            <button
              type="button"
              onClick={() => setSigPos(prev => ({ ...prev, xPct: 8, yPct: 72 }))}
              className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold"
            >
              Kiri Bawah
            </button>
            <button
              type="button"
              onClick={() => setSigPos(prev => ({ ...prev, xPct: 34, yPct: 72 }))}
              className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold"
            >
              Tengah Bawah
            </button>
            <button
              type="button"
              onClick={() => setSigPos(prev => ({ ...prev, xPct: 58, yPct: 72 }))}
              className="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-semibold"
            >
              Kanan Bawah
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between px-1">
          <label className="inline-flex items-center gap-2 text-[11px] font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={includeApprovalTextOnPdf}
              onChange={(e) => setIncludeApprovalTextOnPdf(e.target.checked)}
              className="rounded border-slate-300 text-[#282974] focus:ring-0"
            />
            <span>Sertakan teks stempel <strong>"Approved by: {managerName} & Tanggal Persetujuan"</strong> di bawah tanda tangan pada PDF</span>
          </label>
          <span className="text-[10px] font-mono text-slate-500">
            {isRealUploadedPdf ? 'Pratinjau PDF Asli Staf' : 'Pratinjau Lembar Pengesahan PDF'}
          </span>
        </div>

        {/* Interactive PDF Page Canvas + Draggable/Resizable PNG Overlay */}
        <div className="w-full flex justify-center bg-slate-200/80 p-2 sm:p-4 rounded-xl border border-slate-300 overflow-hidden">
          <div
            ref={previewContainerRef}
            style={{ aspectRatio: `${pageAspectRatio}` }}
            className="relative w-full max-w-[560px] bg-white shadow-lg border border-slate-300 select-none overflow-hidden"
          >
            {isLoadingPreview && (
              <div className="absolute inset-0 z-20 bg-white/80 flex flex-col items-center justify-center gap-2 text-xs text-slate-600">
                <Loader2 className="w-6 h-6 animate-spin text-[#282974]" />
                <span>Memuat halaman dokumen PDF...</span>
              </div>
            )}

            {/* Rendered PDF Page Canvas */}
            <canvas
              ref={pdfCanvasRef}
              className="w-full h-full block pointer-events-none"
            />

            {/* Draggable & Resizable PNG Signature Specimen Overlay */}
            {activeSpecimen && (
              <div
                onPointerDown={(e) => handleSigPointerDown(e, 'drag')}
                onPointerMove={handleSigPointerMove}
                onPointerUp={handleSigPointerUp}
                onPointerCancel={handleSigPointerUp}
                style={{
                  left: `${sigPos.xPct}%`,
                  top: `${sigPos.yPct}%`,
                  width: `${sigPos.widthPct}%`,
                  height: `${sigHeightPct}%`
                }}
                className="absolute z-10 cursor-move touch-none group border-2 border-dashed border-[#282974] bg-[#282974]/5 hover:bg-[#282974]/10 rounded-md transition-colors flex flex-col justify-between p-1"
                title="Geser (Drag) untuk memindahkan posisi tanda tangan PNG"
              >
                {/* Top Drag Pill */}
                <div className="absolute -top-5 left-0 px-1.5 py-0.5 rounded bg-[#282974] text-white text-[9px] font-bold flex items-center gap-1 shadow-xs whitespace-nowrap pointer-events-none">
                  <Move className="w-2.5 h-2.5" />
                  <span>Geser TTD PNG</span>
                </div>

                {/* Transparent PNG Signature Specimen Image */}
                <div className="w-full h-full flex items-center justify-center overflow-hidden pointer-events-none">
                  <img
                    src={activeSpecimen.dataUrl}
                    alt="Spesimen Tanda Tangan Manager"
                    className="w-full h-full object-contain select-none"
                    draggable={false}
                  />
                </div>

                {/* Live Stamp Metadata Preview below PNG */}
                {includeApprovalTextOnPdf && (
                  <div className="w-full bg-white/85 backdrop-blur-[1px] px-1 py-0.5 rounded text-[8px] sm:text-[9px] leading-tight border-t border-[#282974]/20 pointer-events-none">
                    <div className="font-bold text-[#282974] truncate">
                      Approved by: {managerName}
                    </div>
                    <div className="font-mono text-emerald-700 truncate text-[7px] sm:text-[8px]">
                      Date: {formatCurrentDateTime()}
                    </div>
                  </div>
                )}

                {/* Bottom-Right Resize Handle */}
                <div
                  onPointerDown={(e) => handleSigPointerDown(e, 'resize')}
                  onPointerMove={handleSigPointerMove}
                  onPointerUp={handleSigPointerUp}
                  onPointerCancel={handleSigPointerUp}
                  className="absolute -bottom-2 -right-2 w-5 h-5 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white border-2 border-white shadow-md cursor-nwse-resize flex items-center justify-center touch-none"
                  title="Tarik untuk mengubah ukuran tanda tangan"
                >
                  <span className="text-[9px] font-bold leading-none">↘</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload / Signing Progress Indicator */}
      {isProcessingSign && (
        <div className="p-4 rounded-xl bg-[#282974]/6 border border-[#282974]/25 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-[#282974] flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>{signStageText || 'Memproses Approve & Sign PDF...'}</span>
            </span>
            <span className="font-mono font-bold text-[#282974]">{signProgress}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#282974] to-emerald-600 transition-all duration-200"
              style={{ width: `${Math.max(6, signProgress)}%` }}
            />
          </div>
        </div>
      )}

      {/* SECTION 3: KEPUTUSAN MANAGER (REVISI STAF ATAU APPROVE & SIGN) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        {/* Card A: Kembalikan untuk Revisi */}
        <div className="p-4 rounded-xl bg-rose-50/60 border border-rose-200 flex flex-col justify-between space-y-3">
          <div className="space-y-2">
            <div className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
              <RotateCcw className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Opsi A: Kembalikan untuk Revisi (REVISI STAF)</span>
            </div>
            <p className="text-[11px] text-rose-800">
              Jika hasil pekerjaan Staf belum sesuai, tuliskan catatan koreksi di bawah ini. Status tiket akan berubah menjadi <strong>REVISI STAF</strong>.
            </p>
            <textarea
              rows={3}
              value={catatanRevisi}
              onChange={(e) => setCatatanRevisi(e.target.value)}
              placeholder="Tuliskan catatan koreksi / bagian dokumen yang harus diperbaiki oleh Staf..."
              className="w-full p-2.5 text-xs bg-white border border-rose-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-rose-600"
            />
          </div>

          <button
            type="button"
            disabled={isProcessingSign}
            onClick={handleReturnForRevision}
            className="w-full py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm shadow-rose-600/20 transition-all flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4 shrink-0" />
            <span>Kembalikan untuk Revisi</span>
          </button>
        </div>

        {/* Card B: Approve & Sign (Tempel Spesimen PNG & Tutup Tiket) */}
        <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-col justify-between space-y-3">
          <div className="space-y-2">
            <div className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Opsi B: Setujui & Tempel Tanda Tangan (Approve & Sign)</span>
            </div>
            <p className="text-[11px] text-emerald-800">
              Menempelkan spesimen PNG tanda tangan Manager ke halaman PDF sesuai posisi pratinjau, menyertakan info <em>Approved by & Tanggal</em>, mengunggah ke Google Drive, dan menutup tiket (<strong>CLOSED</strong>).
            </p>
            <textarea
              rows={3}
              value={catatanApproval}
              onChange={(e) => setCatatanApproval(e.target.value)}
              placeholder="Catatan persetujuan Manager (opsional, misal: Dokumen telah diverifikasi & disetujui untuk diterbitkan)..."
              className="w-full p-2.5 text-xs bg-white border border-emerald-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600"
            />
          </div>

          <button
            type="button"
            disabled={isProcessingSign}
            onClick={() => void handleApproveAndSign()}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-xs font-bold shadow-sm shadow-emerald-600/20 transition-all flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>Approve & Sign (Simpan PDF & CLOSED)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
