import React, { useState, useEffect, useMemo } from 'react';
import { 
  PlusCircle, Search, Edit3, Send, CheckCircle2, FileUp, 
  Clock, AlertCircle, Building2, User, Phone, MapPin, 
  Calendar, Layers, FileCheck, ArrowRight, X, Eye, Download, ExternalLink, Loader2
} from 'lucide-react';
import { DepartmentName, Ticket, UserAccount, UserSession, WhatsAppNotificationPayload } from '../types';
import { STRUKTUR_ORG, cleanWhatsAppNumber, generateTicketId, formatCurrentDateTime, getStoredUsers } from '../data/mockData';
import { downloadFile, parseTicketFileEntry } from '../data/fileStore';
import { GoogleDriveStatusBanner } from '../components/GoogleDriveStatusBanner';
import {
  uploadFileViaGasAndBackend,
  DRIVE_PERMINTAAN_FOLDER_ID,
  DRIVE_PERMINTAAN_FOLDER_URL,
  DRIVE_JAWABAN_FOLDER_ID,
  DRIVE_JAWABAN_FOLDER_URL
} from '../services/googleDrive';

interface PemberiTugasViewProps {
  tickets: Ticket[];
  session?: UserSession;
  users?: UserAccount[];
  onAddTicket: (ticket: Ticket) => void;
  onUpdateTicket: (ticket: Ticket) => void;
  onOpenWhatsApp: (payload: WhatsAppNotificationPayload) => void;
  onSelectTicketDetail: (ticket: Ticket) => void;
}

export const PemberiTugasView: React.FC<PemberiTugasViewProps> = ({
  tickets,
  session,
  users,
  onAddTicket,
  onUpdateTicket,
  onOpenWhatsApp,
  onSelectTicketDetail
}) => {
  const [activeTab, setActiveTab] = useState<'baru' | 'lacak' | 'edit'>('baru');

  // Resolve logged-in user identity from active session + user account database
  const { autoPeminta, autoWaPeminta } = useMemo(() => {
    const accountList = users && users.length > 0 ? users : getStoredUsers();
    const matchedAccount = accountList.find(
      u =>
        (session?.userId && u.id === session.userId) ||
        (session?.username && u.username.toLowerCase() === session.username.toLowerCase()) ||
        (session?.userName && u.fullName.toLowerCase() === session.userName.toLowerCase())
    ) || (session?.username?.toUpperCase() === 'WBP' ? accountList.find(u => u.role === 'pemberi_tugas') : undefined);

    const resolvedName = (
      matchedAccount?.fullName ||
      (session?.userName && !session.userName.startsWith('WBP ') ? session.userName : '') ||
      session?.userName ||
      ''
    ).trim();

    const resolvedWa = (
      matchedAccount?.whatsapp ||
      session?.whatsapp ||
      ''
    ).trim();

    return {
      autoPeminta: resolvedName,
      autoWaPeminta: resolvedWa
    };
  }, [session, users]);

  // Form State: Buat Baru (Auto-filled from active login session)
  const [peminta, setPeminta] = useState(autoPeminta);
  const [waPeminta, setWaPeminta] = useState(autoWaPeminta);

  // Keep Peminta & No. WhatsApp Peminta synced with the active login session automatically
  useEffect(() => {
    if (autoPeminta) {
      setPeminta(autoPeminta);
    }
    if (autoWaPeminta) {
      setWaPeminta(autoWaPeminta);
    }
  }, [autoPeminta, autoWaPeminta]);
  const [soNumber, setSoNumber] = useState('');
  const [pemasukanPenawaran, setPemasukanPenawaran] = useState('');
  const [tujuanPermintaan, setTujuanPermintaan] = useState('');
  const [kodeProyek, setKodeProyek] = useState('');
  const [namaProyek, setNamaProyek] = useState('');
  const [lokasi, setLokasi] = useState('');
  const [jenisProduk, setJenisProduk] = useState('');
  const [dimensi, setDimensi] = useState('');
  const [departemenTujuan, setDepartemenTujuan] = useState<DepartmentName>('Engineering Precast');
  const [targetSelesai, setTargetSelesai] = useState('');
  
  // Document checkboxes
  const [docAnalisis, setDocAnalisis] = useState(true);
  const [docSSP, setDocSSP] = useState(false);
  const [docGambar, setDocGambar] = useState(true);
  const [docOthers, setDocOthers] = useState(false);
  const [detailOthers, setDetailOthers] = useState('');

  // Uploaded files
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadCurrentFile, setUploadCurrentFile] = useState('');
  const [uploadStageText, setUploadStageText] = useState('');
  const [uploadNotice, setUploadNotice] = useState('');
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  // Stepper State for form
  const [formStep, setFormStep] = useState<1 | 2 | 3>(1);

  // Tab Lacak State
  const [searchTicketQuery, setSearchTicketQuery] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState<string>(tickets[0]?.ID_Tiket || '');

  // Tab Edit State
  const openTickets = tickets.filter(t => t.Status_Pengerjaan === 'OPEN');
  const [editTicketId, setEditTicketId] = useState<string>(openTickets[0]?.ID_Tiket || '');
  const [editTicketData, setEditTicketData] = useState<Ticket | null>(openTickets[0] || null);

  const handleSelectEditTicket = (id: string) => {
    setEditTicketId(id);
    const found = openTickets.find(t => t.ID_Tiket === id);
    if (found) setEditTicketData({ ...found });
  };

  const currentManager = STRUKTUR_ORG[departemenTujuan].Manager;
  const currentWaManager = STRUKTUR_ORG[departemenTujuan].WA_Manager;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      const totalFiles = filesArray.length;
      setIsUploading(true);
      setUploadProgress(10);
      setUploadNotice('');
      setUploadCurrentFile(filesArray[0]?.name || '');
      setUploadStageText('Mengunggah ke Folder Permintaan Google Drive...');

      try {
        const newEntries: string[] = [];
        let syncedCount = 0;

        for (let i = 0; i < totalFiles; i++) {
          const file = filesArray[i];
          const fileLabel = totalFiles > 1 ? `(${i + 1}/${totalFiles}) ${file.name}` : file.name;
          setUploadCurrentFile(fileLabel);
          setUploadProgress(Math.round(((i + 0.5) / totalFiles) * 100));

          // Convert file to Base64 data URL for backend/GAS forwarding
          const dataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });

          const result = await uploadFileViaGasAndBackend({
            file,
            dataUrl,
            category: 'permintaan'
          });

          const fileId = result.id || 'drive-synced';
          const viewUrl = result.webViewLink || DRIVE_PERMINTAAN_FOLDER_URL;
          const formattedEntry = `${file.name}::${fileId}::${viewUrl}`;
          newEntries.push(formattedEntry);
          syncedCount++;

          setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
        }

        setUploadProgress(100);
        setUploadStageText('Unggahan berhasil!');
        await new Promise(resolve => setTimeout(resolve, 300));

        setUploadedFiles(prev => [...prev, ...newEntries]);
        if (syncedCount > 0) {
          setUploadNotice(`${syncedCount} berkas berhasil diunggah ke Folder Google Drive Permintaan (${DRIVE_PERMINTAAN_FOLDER_ID})!`);
        }
      } catch (err) {
        setFormError(err instanceof Error ? err.message : 'Gagal mengunggah berkas.');
      } finally {
        setIsUploading(false);
        setUploadProgress(0);
        setUploadCurrentFile('');
        setUploadStageText('');
        e.target.value = '';
      }
    }
  };

  const removeUploadedFile = (idx: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmitNew = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const finalPeminta = (peminta || autoPeminta).trim();
    const finalWaPeminta = cleanWhatsAppNumber(waPeminta || autoWaPeminta);

    if (!finalPeminta) {
      setFormError('Nama Pemberi Tugas wajib diisi.');
      return;
    }
    if (!namaProyek.trim()) {
      setFormError('Nama Proyek wajib diisi.');
      return;
    }
    if (!targetSelesai) {
      setFormError('Target Selesai wajib ditentukan.');
      return;
    }

    const docList: string[] = [];
    if (docAnalisis) docList.push('Analisis');
    if (docSSP) docList.push('SSP');
    if (docGambar) docList.push('Gambar');
    if (docOthers) docList.push(`Others (${detailOthers.trim() || 'Lainnya'})`);
    const dokumenStr = docList.length > 0 ? docList.join(', ') : '-';

    const filePendukungStr = uploadedFiles.length > 0 ? uploadedFiles.join(' || ') : '-';
    const newId = generateTicketId();
    const waktuReq = formatCurrentDateTime();

    let formattedTarget = targetSelesai;
    if (targetSelesai.includes('-')) {
      const [yyyy, mm, dd] = targetSelesai.split('-');
      formattedTarget = `${dd}/${mm}/${yyyy}`;
    }

    let formattedPemasukan = pemasukanPenawaran;
    if (pemasukanPenawaran && pemasukanPenawaran.includes('-')) {
      const [yyyy, mm, dd] = pemasukanPenawaran.split('-');
      formattedPemasukan = `${dd}/${mm}/${yyyy}`;
    }

    const newTicket: Ticket = {
      ID_Tiket: newId,
      Waktu_Request: waktuReq,
      Peminta: finalPeminta,
      WA_Peminta: finalWaPeminta,
      SO: soNumber || '-',
      Pemasukan_Penawaran: formattedPemasukan || '-',
      Tujuan_Permintaan: tujuanPermintaan || '-',
      Kode_Proyek: kodeProyek || '-',
      Proyek: namaProyek,
      Lokasi: lokasi || '-',
      Jenis_Produk: jenisProduk || '-',
      Dimensi: dimensi || '-',
      Dokumen: dokumenStr,
      Departemen_Tujuan: departemenTujuan,
      Manager_Tujuan: currentManager,
      WA_Manager: currentWaManager,
      Staff_Tujuan: '-',
      WA_Staff: '-',
      Target_Selesai: formattedTarget,
      Status_Pengerjaan: 'OPEN',
      Keterangan_Penerima: '-',
      File_Pendukung: filePendukungStr,
      File_Hasil: '-',
      Aktual_Selesai: '-'
    };

    onAddTicket(newTicket);
    setFormSuccess(`Tiket ${newId} berhasil didaftarkan ke sistem!`);

    setPeminta(autoPeminta);
    setWaPeminta(autoWaPeminta);
    setNamaProyek('');
    setKodeProyek('');
    setSoNumber('');
    setLokasi('');
    setJenisProduk('');
    setDimensi('');
    setTujuanPermintaan('');
    setUploadedFiles([]);
    setFormStep(1);

    const pesan = `*PERMINTAAN TUGAS BARU*\n\nHalo Bpk. ${currentManager},\nAda request dokumen teknis baru dari *${finalPeminta}* untuk proyek *${namaProyek}*.\nMohon segera didisposisikan ke tim ${departemenTujuan}.\n\nID Tiket: ${newId}\nTarget: ${formattedTarget}`;
    onOpenWhatsApp({
      id: newId,
      wa: currentWaManager,
      pesan: pesan,
      target_role: 'Manager Engineering',
      target_name: currentManager
    });
  };

  const [editSavedNotice, setEditSavedNotice] = useState('');
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTicketData) return;

    onUpdateTicket(editTicketData);
    setEditSavedNotice(`Perubahan tiket ${editTicketData.ID_Tiket} berhasil disimpan!`);
    setTimeout(() => setEditSavedNotice(''), 3000);
  };

  const displayedTicket = tickets.find(t => t.ID_Tiket === selectedTicketId) || tickets[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-white via-white to-[#282974]/6 border border-slate-200 shadow-xs">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#282974]">
            Sales & Tim Proyek
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-0.5">
            Form Registrasi & Monitoring Dokumen Teknis
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            Ajukan permohonan analisis struktur, SSP, shop drawing, atau metode kerja kepada divisi Engineering WBP secara terstruktur dan terintegrasi langsung dengan WhatsApp Manager.
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 shrink-0 self-start md:self-center">
          <button
            type="button"
            onClick={() => setActiveTab('baru')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'baru'
                ? 'bg-[#282974] text-white shadow-sm shadow-[#282974]/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>Buat Baru</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('lacak')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'lacak'
                ? 'bg-[#282974] text-white shadow-sm shadow-[#282974]/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <Search className="w-3.5 h-3.5" />
            <span>Lacak Status ({tickets.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('edit')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'edit'
                ? 'bg-[#282974] text-white shadow-sm shadow-[#282974]/20'
                : 'text-slate-600 hover:text-slate-900 hover:bg-white'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Tiket OPEN ({openTickets.length})</span>
          </button>
        </div>
      </div>

      {activeTab === 'baru' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  formStep >= 1 ? 'bg-[#282974] text-white' : 'bg-slate-200 text-slate-600'
                }`}>1</span>
                <span className={`text-xs font-semibold ${formStep === 1 ? 'text-slate-900' : 'text-slate-500'}`}>Data Proyek</span>
                <span className="text-slate-300 mx-1">›</span>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  formStep >= 2 ? 'bg-[#282974] text-white' : 'bg-slate-200 text-slate-600'
                }`}>2</span>
                <span className={`text-xs font-semibold ${formStep === 2 ? 'text-slate-900' : 'text-slate-500'}`}>Spesifikasi Teknis</span>
                <span className="text-slate-300 mx-1">›</span>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  formStep >= 3 ? 'bg-[#282974] text-white' : 'bg-slate-200 text-slate-600'
                }`}>3</span>
                <span className={`text-xs font-semibold ${formStep === 3 ? 'text-slate-900' : 'text-slate-500'}`}>Lampiran & Kirim</span>
              </div>
              <div className="text-[11px] text-slate-500 font-mono">Langkah {formStep} dari 3</div>
            </div>

            {formError && (
              <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSubmitNew} className="space-y-5">
              {formStep === 1 && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Pemberi Tugas / Sales *</label>
                      <input
                        type="text"
                        value={peminta || autoPeminta}
                        onChange={(e) => setPeminta(e.target.value)}
                        readOnly={Boolean(autoPeminta)}
                        className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 font-semibold"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">No. WhatsApp Peminta *</label>
                      <input
                        type="text"
                        value={waPeminta || autoWaPeminta}
                        onChange={(e) => setWaPeminta(e.target.value)}
                        readOnly={Boolean(autoWaPeminta)}
                        className="w-full px-3 py-2 text-xs border rounded-xl bg-slate-50 font-mono font-semibold"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">SO / No. Surat</label>
                      <input
                        type="text"
                        value={soNumber}
                        onChange={(e) => setSoNumber(e.target.value)}
                        placeholder="SO-WBP/..."
                        className="w-full px-3 py-2 text-xs border rounded-xl font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Pemasukan Penawaran Tender</label>
                      <input
                        type="date"
                        value={pemasukanPenawaran}
                        onChange={(e) => setPemasukanPenawaran(e.target.value)}
                        className="w-full px-3 py-2 text-xs border rounded-xl font-mono"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Proyek *</label>
                      <input
                        type="text"
                        value={namaProyek}
                        onChange={(e) => setNamaProyek(e.target.value)}
                        placeholder="Nama Proyek..."
                        className="w-full px-3 py-2 text-xs border rounded-xl"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Kode Proyek</label>
                      <input
                        type="text"
                        value={kodeProyek}
                        onChange={(e) => setKodeProyek(e.target.value)}
                        placeholder="PRJ-..."
                        className="w-full px-3 py-2 text-xs border rounded-xl font-mono"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Lokasi Proyek</label>
                      <input
                        type="text"
                        value={lokasi}
                        onChange={(e) => setLokasi(e.target.value)}
                        placeholder="Lokasi..."
                        className="w-full px-3 py-2 text-xs border rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Tujuan Permintaan</label>
                      <input
                        type="text"
                        value={tujuanPermintaan}
                        onChange={(e) => setTujuanPermintaan(e.target.value)}
                        placeholder="Tujuan..."
                        className="w-full px-3 py-2 text-xs border rounded-xl"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (!namaProyek.trim()) {
                          setFormError('Nama Proyek wajib diisi.');
                          return;
                        }
                        setFormError('');
                        setFormStep(2);
                      }}
                      className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-[#282974] rounded-xl"
                    >
                      <span>Lanjut: Spesifikasi Teknis</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {formStep === 2 && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Departemen Engineering Tujuan *</label>
                      <select
                        value={departemenTujuan}
                        onChange={(e) => setDepartemenTujuan(e.target.value as DepartmentName)}
                        className="w-full px-3.5 py-2 text-xs bg-white border rounded-xl font-medium"
                      >
                        {Object.keys(STRUKTUR_ORG).map(dept => (
                          <option key={dept} value={dept}>{dept}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Target Selesai Pekerjaan *</label>
                      <input
                        type="date"
                        value={targetSelesai}
                        onChange={(e) => setTargetSelesai(e.target.value)}
                        className="w-full px-3 py-2 text-xs border rounded-xl font-mono"
                        required
                      />
                    </div>
                  </div>

                  <div className="p-3 bg-[#282974]/8 border border-[#282974]/25 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-[#282974]">
                      <User className="w-4 h-4" />
                      <span>Manager Penerima: <strong>{currentManager}</strong></span>
                    </div>
                    <span className="text-slate-600 font-mono text-[11px]">WA: +{currentWaManager}</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Jenis Produk</label>
                      <input
                        type="text"
                        value={jenisProduk}
                        onChange={(e) => setJenisProduk(e.target.value)}
                        placeholder="Produk..."
                        className="w-full px-3 py-2 text-xs border rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">Dimensi / Volume</label>
                      <input
                        type="text"
                        value={dimensi}
                        onChange={(e) => setDimensi(e.target.value)}
                        placeholder="Dimensi..."
                        className="w-full px-3 py-2 text-xs border rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-xl border space-y-2.5">
                    <label className="block text-xs font-semibold text-slate-800">Dokumen yang Dibutuhkan:</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <label className="flex items-center gap-2 p-2 rounded-lg bg-white border cursor-pointer text-xs">
                        <input type="checkbox" checked={docAnalisis} onChange={(e) => setDocAnalisis(e.target.checked)} />
                        <span>Analisis</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 rounded-lg bg-white border cursor-pointer text-xs">
                        <input type="checkbox" checked={docSSP} onChange={(e) => setDocSSP(e.target.checked)} />
                        <span>SSP</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 rounded-lg bg-white border cursor-pointer text-xs">
                        <input type="checkbox" checked={docGambar} onChange={(e) => setDocGambar(e.target.checked)} />
                        <span>Gambar / CAD</span>
                      </label>
                      <label className="flex items-center gap-2 p-2 rounded-lg bg-white border cursor-pointer text-xs">
                        <input type="checkbox" checked={docOthers} onChange={(e) => setDocOthers(e.target.checked)} />
                        <span>Others</span>
                      </label>
                    </div>
                    {docOthers && (
                      <div className="pt-2">
                        <input
                          type="text"
                          value={detailOthers}
                          onChange={(e) => setDetailOthers(e.target.value)}
                          placeholder="Sebutkan detail lainnya..."
                          className="w-full px-3 py-1.5 text-xs border rounded-lg"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3">
                    <button
                      type="button"
                      onClick={() => setFormStep(1)}
                      className="px-4 py-2 text-xs font-semibold bg-slate-100 rounded-xl border"
                    >
                      Kembali
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!targetSelesai) {
                          setFormError('Target Selesai wajib ditentukan.');
                          return;
                        }
                        setFormError('');
                        setFormStep(3);
                      }}
                      className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-[#282974] rounded-xl"
                    >
                      <span>Lanjut: Lampiran</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {formStep === 3 && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <GoogleDriveStatusBanner category="permintaan" />

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Upload Dokumen Pendukung Permintaan ke Google Drive ({DRIVE_PERMINTAAN_FOLDER_ID})
                    </label>
                    <div className="border-2 border-dashed rounded-xl p-5 text-center bg-slate-50">
                      {isUploading ? (
                        <div className="py-2 px-2 max-w-lg mx-auto space-y-2.5 text-left">
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="text-xs font-bold text-[#282974] truncate">
                                {uploadCurrentFile ? `Mengunggah: ${uploadCurrentFile}` : 'Mengunggah ke Drive...'}
                              </div>
                              <div className="text-[11px] text-slate-600 truncate mt-0.5">{uploadStageText}</div>
                            </div>
                            <span className="px-2.5 py-1 rounded-lg bg-[#282974] text-white font-mono text-xs font-bold shrink-0">
                              {uploadProgress}%
                            </span>
                          </div>
                          <div className="w-full h-3 bg-slate-200 rounded-full overflow-hidden p-0.5">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-[#282974] to-emerald-500 transition-all duration-200"
                              style={{ width: `${Math.max(4, uploadProgress)}%` }}
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          <FileUp className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                          <div className="text-xs text-slate-700 font-medium">
                            Klik untuk memilih berkas — langsung masuk ke Folder Permintaan
                          </div>
                          <div className="text-[11px] text-slate-500 mt-1">Format: PDF, DWG, XLSX, DOCX, ZIP</div>
                        </>
                      )}
                      <input
                        type="file"
                        multiple
                        disabled={isUploading}
                        onChange={handleFileUpload}
                        className="mt-3 text-xs text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#282974] file:text-white cursor-pointer"
                      />
                    </div>
                    {uploadNotice && (
                      <div className="mt-2 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 flex items-center justify-between gap-2">
                        <span>{uploadNotice}</span>
                        <a
                          href={DRIVE_PERMINTAAN_FOLDER_URL}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-semibold underline shrink-0"
                        >
                          <span>Buka Folder</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>

                  {uploadedFiles.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold text-slate-600">Berkas Terlampir:</div>
                      {uploadedFiles.map((fn, idx) => {
                        const parsed = parseTicketFileEntry(fn, 'permintaan');
                        return (
                          <div key={idx} className="flex items-center justify-between gap-2 p-2.5 rounded-lg bg-slate-50 border text-xs">
                            <span className="font-mono font-semibold truncate">{parsed.name}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <a
                                href={parsed.driveViewUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-1 rounded bg-[#282974]/10 text-[#282974] hover:bg-[#282974] hover:text-white font-semibold text-[11px]"
                              >
                                Tautan Drive
                              </a>
                              <button type="button" onClick={() => removeUploadedFile(idx)} className="text-slate-400 hover:text-rose-600">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1.5">
                    <div className="font-bold text-emerald-800 flex items-center gap-1.5">
                      <Send className="w-4 h-4 text-emerald-600" /> Pengiriman Otomatis
                    </div>
                    <p className="text-slate-700">
                      Tiket akan berstatus <strong className="text-amber-700">OPEN</strong> dan notifikasi WhatsApp disiapkan untuk Bpk. <strong>{currentManager}</strong>.
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3">
                    <button type="button" onClick={() => setFormStep(2)} className="px-4 py-2 text-xs font-semibold bg-slate-100 rounded-xl border">
                      Kembali
                    </button>
                    <button type="submit" className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 rounded-xl">
                      <Send className="w-4 h-4" />
                      <span>Kirim Permintaan ke Manager</span>
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>

          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white border rounded-2xl p-5 sticky top-20 shadow-xs">
              <div className="flex items-center justify-between pb-3 border-b">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Pratinjau Tiket</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-50 text-amber-700 border font-semibold">STATUS: OPEN</span>
              </div>
              <div className="mt-4 space-y-3 text-xs">
                <div>
                  <span className="text-slate-500 text-[11px]">Proyek:</span>
                  <div className="font-bold text-slate-900 text-sm mt-0.5">{namaProyek.trim() || 'Belum Diisi'}</div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500">Pemohon:</span>
                    <div className="font-semibold">{peminta || '-'}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Target:</span>
                    <div className="text-emerald-700 font-mono font-bold">{targetSelesai || '-'}</div>
                  </div>
                </div>
                <div className="pt-2 border-t">
                  <span className="text-slate-500 text-[11px]">Penerima Disposisi:</span>
                  <div className="font-semibold mt-0.5">{currentManager} (Manager {departemenTujuan})</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'lacak' && (
        <div className="space-y-6">
          <div className="bg-white border rounded-2xl p-4 shadow-xs">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              <div className="md:col-span-5 relative">
                <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={searchTicketQuery}
                  onChange={(e) => setSearchTicketQuery(e.target.value)}
                  placeholder="Cari proyek atau tiket..."
                  className="w-full pl-10 pr-4 py-2 text-xs border rounded-xl"
                />
              </div>
              <div className="md:col-span-7 flex items-center gap-3">
                <label className="text-xs font-medium text-slate-600 shrink-0">Pilih ID Tiket:</label>
                <select
                  value={selectedTicketId}
                  onChange={(e) => setSelectedTicketId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono border rounded-xl"
                >
                  {tickets.map(t => (
                    <option key={t.ID_Tiket} value={t.ID_Tiket}>{t.ID_Tiket} - {t.Proyek} ({t.Status_Pengerjaan})</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {displayedTicket ? (
            <div className="bg-white border rounded-2xl p-6 shadow-xs space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-[#282974]">{displayedTicket.ID_Tiket}</span>
                    <span className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border">
                      {displayedTicket.Status_Pengerjaan}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 mt-1">{displayedTicket.Proyek}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => onSelectTicketDetail(displayedTicket)}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-[#282974] bg-[#282974]/8 rounded-xl border"
                >
                  <Eye className="w-4 h-4" />
                  <span>Lihat Detail</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-slate-50 rounded-xl border">
                  <div className="font-bold text-slate-800 mb-2">Berkas Pendukung (Permintaan):</div>
                  {displayedTicket.File_Pendukung !== '-' ? (
                    <div className="space-y-2">
                      {displayedTicket.File_Pendukung.split('||').map((fn, idx) => {
                        const parsed = parseTicketFileEntry(fn, 'permintaan');
                        return (
                          <div key={idx} className="p-2.5 rounded-lg bg-white border flex items-center justify-between">
                            <span className="font-mono text-[11px] truncate">{parsed.name}</span>
                            <a href={parsed.driveViewUrl} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 text-[10px] bg-[#282974] text-white rounded-md font-semibold">
                              Buka Drive
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  ) : <div className="text-slate-500 italic">Tidak ada berkas</div>}
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border">
                  <div className="font-bold text-slate-800 mb-2">Dokumen Hasil:</div>
                  {displayedTicket.File_Hasil !== '-' ? (
                    <div className="space-y-2">
                      {displayedTicket.File_Hasil.split('||').map((fn, idx) => {
                        const parsed = parseTicketFileEntry(fn, 'jawaban_atas_permintaan');
                        return (
                          <div key={idx} className="p-2.5 rounded-lg bg-emerald-50 border flex items-center justify-between">
                            <span className="font-mono text-[11px] truncate">{parsed.name}</span>
                            <a href={parsed.driveViewUrl} target="_blank" rel="noopener noreferrer" className="px-2.5 py-1 text-[10px] bg-emerald-600 text-white rounded-md font-semibold">
                              Buka Hasil
                            </a>
                          </div>
                        );
                      })}
                    </div>
                  ) : <div className="text-slate-500 italic">Belum ada hasil.</div>}
                </div>
              </div>
            </div>
          ) : <div className="p-12 text-center text-slate-500 bg-white rounded-2xl border">Belum ada tiket.</div>}
        </div>
      )}

      {activeTab === 'edit' && (
        <div className="bg-white border rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex items-center justify-between pb-3 border-b">
            <h3 className="text-sm font-bold text-slate-900">Revisi Permintaan Berstatus OPEN</h3>
            <span className="px-2.5 py-1 rounded bg-amber-50 text-amber-700 text-xs font-mono font-semibold">{openTickets.length} Tiket OPEN</span>
          </div>
          {openTickets.length === 0 ? (
            <div className="p-12 text-center text-slate-500 bg-slate-50 rounded-xl border">Tidak ada tiket OPEN.</div>
          ) : (
            <div>
              <select
                value={editTicketId}
                onChange={(e) => handleSelectEditTicket(e.target.value)}
                className="w-full max-w-md px-3.5 py-2 text-xs font-mono border rounded-xl mb-4"
              >
                {openTickets.map(t => (
                  <option key={t.ID_Tiket} value={t.ID_Tiket}>{t.ID_Tiket} - {t.Proyek}</option>
                ))}
              </select>
              {editTicketData && (
                <form onSubmit={handleSaveEdit} className="space-y-4 pt-2 border-t">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                      type="text"
                      value={editTicketData.Proyek}
                      onChange={(e) => setEditTicketData({ ...editTicketData, Proyek: e.target.value })}
                      className="w-full px-3 py-2 text-xs border rounded-xl"
                      required
                    />
                  </div>
                  <button type="submit" className="px-6 py-2.5 text-xs font-semibold text-white bg-[#282974] rounded-xl">
                    Simpan Perubahan
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
