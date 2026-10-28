import React, { useState } from 'react';
import { 
  PlusCircle, Search, Edit3, Send, CheckCircle2, FileUp, 
  Clock, AlertCircle, Building2, User, Phone, MapPin, 
  Calendar, Layers, FileCheck, ArrowRight, X, Eye
} from 'lucide-react';
import { DepartmentName, Ticket, WhatsAppNotificationPayload } from '../types';
import { STRUKTUR_ORG, cleanWhatsAppNumber, generateTicketId, formatCurrentDateTime } from '../data/mockData';

interface PemberiTugasViewProps {
  tickets: Ticket[];
  onAddTicket: (ticket: Ticket) => void;
  onUpdateTicket: (ticket: Ticket) => void;
  onOpenWhatsApp: (payload: WhatsAppNotificationPayload) => void;
  onSelectTicketDetail: (ticket: Ticket) => void;
}

export const PemberiTugasView: React.FC<PemberiTugasViewProps> = ({
  tickets,
  onAddTicket,
  onUpdateTicket,
  onOpenWhatsApp,
  onSelectTicketDetail
}) => {
  const [activeTab, setActiveTab] = useState<'baru' | 'lacak' | 'edit'>('baru');

  // Form State: Buat Baru
  const [peminta, setPeminta] = useState('');
  const [waPeminta, setWaPeminta] = useState('');
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

  // Simulated uploaded files
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
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

  // Synchronize edit form when editTicketId changes
  const handleSelectEditTicket = (id: string) => {
    setEditTicketId(id);
    const found = openTickets.find(t => t.ID_Tiket === id);
    if (found) setEditTicketData({ ...found });
  };

  const currentManager = STRUKTUR_ORG[departemenTujuan].Manager;
  const currentWaManager = STRUKTUR_ORG[departemenTujuan].WA_Manager;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const names = Array.from(e.target.files).map(f => f.name);
      setUploadedFiles(prev => [...prev, ...names]);
    }
  };

  const removeUploadedFile = (idx: number) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== idx));
  };

  // Submit Buat Tiket Baru
  const handleSubmitNew = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!peminta.trim()) {
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

    // Format targetSelesai from input (YYYY-MM-DD -> DD/MM/YYYY)
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
      Peminta: peminta,
      WA_Peminta: cleanWhatsAppNumber(waPeminta),
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

    // Reset form
    setPeminta('');
    setNamaProyek('');
    setKodeProyek('');
    setSoNumber('');
    setLokasi('');
    setJenisProduk('');
    setDimensi('');
    setTujuanPermintaan('');
    setUploadedFiles([]);
    setFormStep(1);

    // Trigger WhatsApp notification for Manager
    const pesan = `*PERMINTAAN TUGAS BARU*\n\nHalo Bpk. ${currentManager},\nAda request dokumen teknis baru dari *${peminta}* untuk proyek *${namaProyek}*.\nMohon segera didisposisikan ke tim ${departemenTujuan}.\n\nID Tiket: ${newId}\nTarget: ${formattedTarget}`;
    onOpenWhatsApp({
      id: newId,
      wa: currentWaManager,
      pesan: pesan,
      target_role: 'Manager Engineering',
      target_name: currentManager
    });
  };

  // Submit Edit Tiket
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTicketData) return;

    onUpdateTicket(editTicketData);
    alert(`Perubahan tiket ${editTicketData.ID_Tiket} berhasil disimpan!`);
  };

  // Selected ticket for Lacak
  const displayedTicket = tickets.find(t => t.ID_Tiket === selectedTicketId) || tickets[0];

  return (
    <div className="space-y-6">
      {/* Top Banner & Module Description */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-blue-950/40 border border-slate-800">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-blue-400">
            Sales & Tim Proyek
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight mt-0.5">
            Form Registrasi & Pelacakan Dokumen Teknis
          </h1>
          <p className="text-xs text-slate-400 mt-1 max-w-2xl">
            Ajukan permohonan analisis struktur, SSP, shop drawing, atau metode kerja kepada divisi Engineering WBP secara terstruktur dan terintegrasi langsung dengan WhatsApp Manager.
          </p>
        </div>

        {/* Tab Navigation Controls */}
        <div className="flex items-center gap-1 p-1 bg-slate-950/80 rounded-xl border border-slate-800 shrink-0 self-start md:self-center">
          <button
            type="button"
            onClick={() => setActiveTab('baru')}
            className={`flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'baru'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
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
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
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
                ? 'bg-blue-600 text-white shadow-md shadow-blue-900/40'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit Tiket OPEN ({openTickets.length})</span>
          </button>
        </div>
      </div>

      {/* TAB 1: BUAT PERMINTAAN BARU */}
      {activeTab === 'baru' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Form Container (7 cols) */}
          <div className="lg:col-span-8 bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
            {/* Step Wizard Header */}
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  formStep >= 1 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'
                }`}>
                  1
                </span>
                <span className={`text-xs font-semibold ${formStep === 1 ? 'text-white' : 'text-slate-400'}`}>
                  Data Proyek
                </span>
                <span className="text-slate-600 mx-1">›</span>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  formStep >= 2 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'
                }`}>
                  2
                </span>
                <span className={`text-xs font-semibold ${formStep === 2 ? 'text-white' : 'text-slate-400'}`}>
                  Spesifikasi Teknis
                </span>
                <span className="text-slate-600 mx-1">›</span>
                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  formStep >= 3 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'
                }`}>
                  3
                </span>
                <span className={`text-xs font-semibold ${formStep === 3 ? 'text-white' : 'text-slate-400'}`}>
                  Lampiran & Kirim
                </span>
              </div>

              <div className="text-[11px] text-slate-500 font-mono">
                Langkah {formStep} dari 3
              </div>
            </div>

            {formError && (
              <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="mb-4 flex items-center gap-2 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSubmitNew} className="space-y-5">
              {/* STEP 1: INFORMASI PROYEK & PEMINTA */}
              {formStep === 1 && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Nama Pemberi Tugas / Sales <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={peminta}
                        onChange={(e) => setPeminta(e.target.value)}
                        placeholder="e.g. Budi Santoso"
                        className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        No. WhatsApp Peminta <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={waPeminta}
                        onChange={(e) => setWaPeminta(e.target.value)}
                        placeholder="Contoh: 08123456789"
                        className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        SO (Sales Order) / No. Surat
                      </label>
                      <input
                        type="text"
                        value={soNumber}
                        onChange={(e) => setSoNumber(e.target.value)}
                        placeholder="SO-WBP/2026/X/..."
                        className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Pemasukan Penawaran Tender
                      </label>
                      <input
                        type="date"
                        value={pemasukanPenawaran}
                        onChange={(e) => setPemasukanPenawaran(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Nama Proyek <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={namaProyek}
                        onChange={(e) => setNamaProyek(e.target.value)}
                        placeholder="e.g. Tol Probolinggo Banyuwangi Seksi 2"
                        className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Kode Proyek
                      </label>
                      <input
                        type="text"
                        value={kodeProyek}
                        onChange={(e) => setKodeProyek(e.target.value)}
                        placeholder="PRJ-TB-01"
                        className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Lokasi Proyek
                      </label>
                      <input
                        type="text"
                        value={lokasi}
                        onChange={(e) => setLokasi(e.target.value)}
                        placeholder="e.g. Probolinggo, Jawa Timur"
                        className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Tujuan Permintaan
                      </label>
                      <input
                        type="text"
                        value={tujuanPermintaan}
                        onChange={(e) => setTujuanPermintaan(e.target.value)}
                        placeholder="e.g. Perhitungan Struktur & Metode Kerja Tender"
                        className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end pt-3">
                    <button
                      type="button"
                      onClick={() => {
                        if (!peminta.trim() || !namaProyek.trim()) {
                          setFormError('Nama Pemberi Tugas dan Nama Proyek wajib diisi sebelum lanjut.');
                          return;
                        }
                        setFormError('');
                        setFormStep(2);
                      }}
                      className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors shadow-lg shadow-blue-900/30"
                    >
                      <span>Lanjut: Spesifikasi Teknis</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 2: SPESIFIKASI & KEBUTUHAN DOKUMEN */}
              {formStep === 2 && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Departemen Engineering Tujuan <span className="text-rose-400">*</span>
                      </label>
                      <select
                        value={departemenTujuan}
                        onChange={(e) => setDepartemenTujuan(e.target.value as DepartmentName)}
                        className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-colors"
                      >
                        {Object.keys(STRUKTUR_ORG).map(dept => (
                          <option key={dept} value={dept}>{dept}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Target Selesai Pekerjaan <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="date"
                        value={targetSelesai}
                        onChange={(e) => setTargetSelesai(e.target.value)}
                        className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-xl text-white focus:outline-none focus:border-blue-500 transition-colors font-mono"
                        required
                      />
                    </div>
                  </div>

                  {/* Manager Auto-Badge Info */}
                  <div className="p-3 bg-blue-950/20 border border-blue-900/40 rounded-xl flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-blue-300">
                      <User className="w-4 h-4" />
                      <span>Manager Penerima: <strong>{currentManager}</strong></span>
                    </div>
                    <span className="text-slate-400 font-mono text-[11px]">
                      WA: +{currentWaManager}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Jenis Produk
                      </label>
                      <input
                        type="text"
                        value={jenisProduk}
                        onChange={(e) => setJenisProduk(e.target.value)}
                        placeholder="e.g. PC-I Girder, Box Girder, Readymix"
                        className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Dimensi / Volume
                      </label>
                      <input
                        type="text"
                        value={dimensi}
                        onChange={(e) => setDimensi(e.target.value)}
                        placeholder="e.g. H-210 L-40.8m atau Volume 1.500 m3"
                        className="w-full px-3.5 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-blue-500 transition-colors"
                      />
                    </div>
                  </div>

                  {/* Dokumen yang Dibutuhkan */}
                  <div className="p-4 bg-slate-950/70 rounded-xl border border-slate-800 space-y-2.5">
                    <label className="block text-xs font-semibold text-white">
                      Dokumen yang Dibutuhkan:
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={docAnalisis}
                          onChange={(e) => setDocAnalisis(e.target.checked)}
                          className="rounded border-slate-700 text-blue-600 focus:ring-0"
                        />
                        <span className="text-slate-200">Analisis</span>
                      </label>

                      <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={docSSP}
                          onChange={(e) => setDocSSP(e.target.checked)}
                          className="rounded border-slate-700 text-blue-600 focus:ring-0"
                        />
                        <span className="text-slate-200">SSP</span>
                      </label>

                      <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={docGambar}
                          onChange={(e) => setDocGambar(e.target.checked)}
                          className="rounded border-slate-700 text-blue-600 focus:ring-0"
                        />
                        <span className="text-slate-200">Gambar / CAD</span>
                      </label>

                      <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-900 border border-slate-800 hover:border-slate-700 cursor-pointer text-xs">
                        <input
                          type="checkbox"
                          checked={docOthers}
                          onChange={(e) => setDocOthers(e.target.checked)}
                          className="rounded border-slate-700 text-blue-600 focus:ring-0"
                        />
                        <span className="text-slate-200">Others</span>
                      </label>
                    </div>

                    {docOthers && (
                      <div className="pt-2">
                        <input
                          type="text"
                          value={detailOthers}
                          onChange={(e) => setDetailOthers(e.target.value)}
                          placeholder="Sebutkan detail kebutuhan dokumen lainnya..."
                          className="w-full px-3.5 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-3">
                    <button
                      type="button"
                      onClick={() => setFormStep(1)}
                      className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-xl transition-colors"
                    >
                      Kembali ke Langkah 1
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!targetSelesai) {
                          setFormError('Target Selesai wajib ditentukan sebelum lanjut.');
                          return;
                        }
                        setFormError('');
                        setFormStep(3);
                      }}
                      className="flex items-center gap-2 px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors shadow-lg shadow-blue-900/30"
                    >
                      <span>Lanjut: Lampiran & Review</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* STEP 3: LAMPIRAN & SUBMIT */}
              {formStep === 3 && (
                <div className="space-y-4 animate-in fade-in duration-150">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Upload Dokumen Pendukung (TOR, Gambar Referensi, Data Tanah)
                    </label>
                    <div className="border-2 border-dashed border-slate-700 hover:border-blue-500 rounded-xl p-5 text-center transition-colors bg-slate-950/40">
                      <FileUp className="w-8 h-8 text-slate-500 mx-auto mb-2" />
                      <div className="text-xs text-slate-300 font-medium">
                        Klik untuk memilih berkas atau seret berkas ke sini
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Format didukung: PDF, DWG, XLSX, DOCX (Maks. 25MB)
                      </div>
                      <input
                        type="file"
                        multiple
                        onChange={handleFileUpload}
                        className="mt-3 text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-500 cursor-pointer"
                      />
                    </div>
                  </div>

                  {uploadedFiles.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-xs font-semibold text-slate-400">Berkas Terlampir:</div>
                      {uploadedFiles.map((fn, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-950 border border-slate-800 text-xs">
                          <span className="font-mono text-slate-300 truncate max-w-sm">{fn}</span>
                          <button
                            type="button"
                            onClick={() => removeUploadedFile(idx)}
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="p-4 bg-emerald-950/20 border border-emerald-900/30 rounded-xl text-xs space-y-1.5">
                    <div className="font-bold text-emerald-300 flex items-center gap-1.5">
                      <Send className="w-4 h-4" /> Pengiriman & Notifikasi Otomatis
                    </div>
                    <p className="text-slate-300">
                      Setelah menekan tombol di bawah, tiket akan berstatus <strong className="text-amber-300">OPEN</strong> dan sistem akan otomatis menyiapkan notifikasi WhatsApp untuk Bpk. <strong>{currentManager}</strong> (Manager {departemenTujuan}).
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3">
                    <button
                      type="button"
                      onClick={() => setFormStep(2)}
                      className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white bg-slate-800 rounded-xl transition-colors"
                    >
                      Kembali ke Langkah 2
                    </button>
                    <button
                      type="submit"
                      className="flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-lg shadow-emerald-950/40 transition-all active:scale-[0.98]"
                    >
                      <Send className="w-4 h-4" />
                      <span>Kirim Permintaan ke Manager</span>
                    </button>
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* Right Column: Live Ticket Preview Card (5 cols) */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 sticky top-20 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Pratinjau Tiket Real-Time
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/30 font-semibold">
                  STATUS: OPEN
                </span>
              </div>

              <div className="mt-4 space-y-3 text-xs">
                <div>
                  <span className="text-slate-500 text-[11px]">Proyek:</span>
                  <div className="font-semibold text-white text-sm mt-0.5">
                    {namaProyek.trim() || 'Nama Proyek Belum Diisi'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div>
                    <span className="text-slate-500">Pemohon:</span>
                    <div className="text-slate-200 font-medium">{peminta || '-'}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">SO / Ref:</span>
                    <div className="text-slate-200 font-mono">{soNumber || '-'}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500">Departemen:</span>
                    <div className="text-blue-400 font-medium">{departemenTujuan}</div>
                  </div>
                  <div>
                    <span className="text-slate-500">Target Selesai:</span>
                    <div className="text-emerald-400 font-mono font-medium">{targetSelesai || '-'}</div>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-slate-500 text-[11px]">Dokumen yang Diminta:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {docAnalisis && <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">Analisis</span>}
                    {docSSP && <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">SSP</span>}
                    {docGambar && <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">Gambar CAD</span>}
                    {docOthers && <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px]">Others</span>}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-slate-500 text-[11px]">Penerima Disposisi:</span>
                  <div className="text-slate-200 font-medium mt-0.5">
                    {currentManager} (Manager {departemenTujuan})
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: LACAK STATUS & UNDUH HASIL */}
      {activeTab === 'lacak' && (
        <div className="space-y-6">
          {/* Search bar & Ticket selector */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-xl">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
              <div className="md:col-span-5 relative">
                <Search className="absolute left-3.5 top-3 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  value={searchTicketQuery}
                  onChange={(e) => setSearchTicketQuery(e.target.value)}
                  placeholder="Ketik nama proyek, pemohon, atau ID tiket..."
                  className="w-full pl-10 pr-4 py-2 text-xs bg-slate-950 border border-slate-700/80 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="md:col-span-7 flex items-center gap-3">
                <label className="text-xs text-slate-400 shrink-0">Pilih ID Tiket:</label>
                <select
                  value={selectedTicketId}
                  onChange={(e) => setSelectedTicketId(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-950 border border-slate-700/80 rounded-xl text-white focus:outline-none focus:border-blue-500"
                >
                  {tickets
                    .filter(t => 
                      t.ID_Tiket.toLowerCase().includes(searchTicketQuery.toLowerCase()) ||
                      t.Proyek.toLowerCase().includes(searchTicketQuery.toLowerCase()) ||
                      t.Peminta.toLowerCase().includes(searchTicketQuery.toLowerCase())
                    )
                    .map(t => (
                      <option key={t.ID_Tiket} value={t.ID_Tiket}>
                        {t.ID_Tiket} - {t.Proyek} ({t.Status_Pengerjaan})
                      </option>
                    ))}
                </select>
              </div>
            </div>
          </div>

          {/* Ticket Display Card */}
          {displayedTicket ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-blue-400">{displayedTicket.ID_Tiket}</span>
                    <span className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold ${
                      displayedTicket.Status_Pengerjaan === 'OPEN'
                        ? 'bg-amber-500/10 text-amber-300 border border-amber-500/30'
                        : displayedTicket.Status_Pengerjaan === 'CLOSED (Selesai)'
                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30'
                        : 'bg-blue-500/10 text-blue-300 border border-blue-500/30'
                    }`}>
                      {displayedTicket.Status_Pengerjaan}
                    </span>
                  </div>
                  <h2 className="text-lg font-bold text-white mt-1">
                    {displayedTicket.Proyek}
                  </h2>
                </div>

                <button
                  type="button"
                  onClick={() => onSelectTicketDetail(displayedTicket)}
                  className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-blue-300 bg-blue-950/40 hover:bg-blue-900/40 rounded-xl border border-blue-800/50 transition-colors self-start sm:self-auto"
                >
                  <Eye className="w-4 h-4" />
                  <span>Lihat Seluruh Detail</span>
                </button>
              </div>

              {/* Progress Stepper */}
              <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800/80">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Progress Alur Permintaan
                </div>
                <div className="grid grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 rounded-lg bg-emerald-950/20 border border-emerald-900/40">
                    <div className="font-bold text-emerald-400">1. Dibuat</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 font-mono">{displayedTicket.Waktu_Request}</div>
                  </div>
                  <div className={`p-2 rounded-lg ${
                    displayedTicket.Status_Pengerjaan !== 'OPEN'
                      ? 'bg-emerald-950/20 border border-emerald-900/40 text-emerald-400'
                      : 'bg-amber-950/20 border border-amber-900/40 text-amber-300 animate-pulse'
                  }`}>
                    <div className="font-bold">2. Disposisi</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {displayedTicket.Manager_Tujuan}
                    </div>
                  </div>
                  <div className={`p-2 rounded-lg ${
                    displayedTicket.Status_Pengerjaan === 'PROSES' || displayedTicket.Status_Pengerjaan === 'CLOSED (Selesai)'
                      ? 'bg-blue-950/20 border border-blue-900/40 text-blue-300'
                      : 'bg-slate-900 text-slate-500'
                  }`}>
                    <div className="font-bold">3. Pengerjaan</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      {displayedTicket.Staff_Tujuan !== '-' ? displayedTicket.Staff_Tujuan : 'Menunggu Staf'}
                    </div>
                  </div>
                  <div className={`p-2 rounded-lg ${
                    displayedTicket.Status_Pengerjaan === 'CLOSED (Selesai)'
                      ? 'bg-emerald-950/30 border border-emerald-500/40 text-emerald-300'
                      : 'bg-slate-900 text-slate-500'
                  }`}>
                    <div className="font-bold">4. Selesai</div>
                    <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                      {displayedTicket.Aktual_Selesai !== '-' ? displayedTicket.Aktual_Selesai : 'Target: ' + displayedTicket.Target_Selesai}
                    </div>
                  </div>
                </div>
              </div>

              {/* Engineering feedback */}
              <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2">
                <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>💬 Pesan Balasan Engineering:</span>
                  <span className="text-[11px] text-slate-500">Departemen: {displayedTicket.Departemen_Tujuan}</span>
                </div>
                <div className="text-xs text-white p-3 bg-slate-900 rounded-lg border border-slate-800 font-medium">
                  {displayedTicket.Keterangan_Penerima !== '-' 
                    ? displayedTicket.Keterangan_Penerima 
                    : 'Belum ada catatan dari tim engineering.'}
                </div>
              </div>

              {/* Files */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700/60">
                  <div className="font-bold text-slate-300 mb-2">Berkas Pendukung Awal:</div>
                  <div className="text-slate-400 font-mono text-[11px]">
                    {displayedTicket.File_Pendukung !== '-' ? displayedTicket.File_Pendukung : 'Tidak ada berkas'}
                  </div>
                </div>

                <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700/60">
                  <div className="font-bold text-slate-300 mb-2">Dokumen Hasil Engineering:</div>
                  {displayedTicket.File_Hasil !== '-' ? (
                    <div className="space-y-1.5">
                      <div className="text-emerald-300 font-mono text-[11px]">{displayedTicket.File_Hasil}</div>
                      <button
                        type="button"
                        onClick={() => alert(`Mengunduh hasil dokumen: ${displayedTicket.File_Hasil}`)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px] transition-colors"
                      >
                        Unduh Berkas Hasil
                      </button>
                    </div>
                  ) : (
                    <div className="text-slate-500 italic">Pengerjaan belum selesai / belum diunggah.</div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 bg-slate-900 rounded-2xl border border-slate-800">
              Belum ada data tiket.
            </div>
          )}
        </div>
      )}

      {/* TAB 3: EDIT PERMINTAAN (OPEN) */}
      {activeTab === 'edit' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div>
              <h3 className="text-sm font-bold text-white">Revisi Permintaan Berstatus OPEN</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Perubahan hanya dapat dilakukan pada tiket yang belum didisposisikan atau belum masuk proses pengerjaan.
              </p>
            </div>
            <span className="px-2.5 py-1 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30 text-xs font-mono">
              {openTickets.length} Tiket OPEN
            </span>
          </div>

          {openTickets.length === 0 ? (
            <div className="p-12 text-center text-slate-500 bg-slate-950/60 rounded-xl border border-slate-800">
              Saat ini tidak ada tiket berstatus OPEN yang dapat diedit.
            </div>
          ) : (
            <div>
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Pilih ID Tiket yang Ingin Direvisi:
                </label>
                <select
                  value={editTicketId}
                  onChange={(e) => handleSelectEditTicket(e.target.value)}
                  className="w-full max-w-md px-3.5 py-2 text-xs font-mono bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                >
                  {openTickets.map(t => (
                    <option key={t.ID_Tiket} value={t.ID_Tiket}>
                      {t.ID_Tiket} - {t.Proyek} ({t.Peminta})
                    </option>
                  ))}
                </select>
              </div>

              {editTicketData && (
                <form onSubmit={handleSaveEdit} className="space-y-4 pt-2 border-t border-slate-800">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Nama Pemohon</label>
                      <input
                        type="text"
                        value={editTicketData.Peminta}
                        onChange={(e) => setEditTicketData({ ...editTicketData, Peminta: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">No. WhatsApp</label>
                      <input
                        type="text"
                        value={editTicketData.WA_Peminta}
                        onChange={(e) => setEditTicketData({ ...editTicketData, WA_Peminta: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-medium text-slate-300 mb-1">Nama Proyek</label>
                      <input
                        type="text"
                        value={editTicketData.Proyek}
                        onChange={(e) => setEditTicketData({ ...editTicketData, Proyek: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Target Selesai</label>
                      <input
                        type="text"
                        value={editTicketData.Target_Selesai}
                        onChange={(e) => setEditTicketData({ ...editTicketData, Target_Selesai: e.target.value })}
                        placeholder="DD/MM/YYYY"
                        className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Jenis Produk</label>
                      <input
                        type="text"
                        value={editTicketData.Jenis_Produk}
                        onChange={(e) => setEditTicketData({ ...editTicketData, Jenis_Produk: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Dimensi</label>
                      <input
                        type="text"
                        value={editTicketData.Dimensi}
                        onChange={(e) => setEditTicketData({ ...editTicketData, Dimensi: e.target.value })}
                        className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Dokumen Diminta</label>
                    <input
                      type="text"
                      value={editTicketData.Dokumen}
                      onChange={(e) => setEditTicketData({ ...editTicketData, Dokumen: e.target.value })}
                      className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white"
                    />
                  </div>

                  <div className="flex justify-end pt-3">
                    <button
                      type="submit"
                      className="px-6 py-2.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors shadow-lg shadow-blue-900/30"
                    >
                      Simpan Perubahan
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
