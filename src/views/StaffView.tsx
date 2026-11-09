import React, { useState } from 'react';
import { 
  Wrench, CheckCircle2, Clock, FileUp, Send, 
  Download, AlertTriangle, ArrowRight, X, FileText, Check, Phone, Eye, Search
} from 'lucide-react';
import { Ticket, UserAccount, UserSession, WhatsAppNotificationPayload } from '../types';
import { STRUKTUR_ORG, cleanWhatsAppNumber, formatCurrentDateTime } from '../data/mockData';
import { saveFileToStorage, downloadFile } from '../data/fileStore';

interface StaffViewProps {
  tickets: Ticket[];
  session?: UserSession;
  users?: UserAccount[];
  onUpdateTicket: (ticket: Ticket) => void;
  onOpenWhatsApp: (payload: WhatsAppNotificationPayload) => void;
  onSelectTicketDetail: (ticket: Ticket) => void;
}

export const StaffView: React.FC<StaffViewProps> = ({
  tickets,
  session,
  users = [],
  onUpdateTicket,
  onOpenWhatsApp,
  onSelectTicketDetail
}) => {
  // Extract all staff from STRUKTUR_ORG + dynamically registered staff users
  const allStaff: { name: string; dept: string }[] = [];
  Object.entries(STRUKTUR_ORG).forEach(([dept, data]) => {
    Object.keys(data.Staff).forEach(staffName => {
      allStaff.push({ name: staffName, dept });
    });
  });
  users
    .filter(u => u.role === 'staff')
    .forEach(u => {
      if (!allStaff.some(s => s.name.toLowerCase() === u.fullName.toLowerCase())) {
        allStaff.push({
          name: u.fullName,
          dept: u.department || 'Engineering Precast'
        });
      }
    });

  const defaultStaffName =
    session?.userName && allStaff.some(s => s.name === session.userName)
      ? session.userName
      : 'Fikri R';

  const [activeStaff, setActiveStaff] = useState<string>(defaultStaffName);
  const [activeTab, setActiveTab] = useState<'aktif' | 'selesai' | 'semua'>('aktif');
  const [selectedTicketId, setSelectedTicketId] = useState<string>('');
  const [updateStatus, setUpdateStatus] = useState<'PROSES' | 'CLOSED (Selesai)'>('PROSES');
  const [keteranganBalasan, setKeteranganBalasan] = useState('');
  const [hasilFiles, setHasilFiles] = useState<string[]>([]);
  const [showDoneNotice, setShowDoneNotice] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState('');

  // Tickets assigned to this staff
  const myTickets = tickets.filter(t => t.Staff_Tujuan === activeStaff);
  const myActiveTasks = myTickets.filter(t => ['DISPOSISI', 'PROSES'].includes(t.Status_Pengerjaan));
  const myCompletedTasks = myTickets.filter(t => t.Status_Pengerjaan === 'CLOSED (Selesai)');

  const currentTask = myActiveTasks.find(t => t.ID_Tiket === selectedTicketId) || myActiveTasks[0] || null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const filesArray = Array.from(e.target.files);
      for (const file of filesArray) {
        await saveFileToStorage(file);
      }
      const names = filesArray.map(f => f.name);
      setHasilFiles(prev => [...prev, ...names]);
    }
  };

  const removeFile = (idx: number) => {
    setHasilFiles(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSaveUpdate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTask) return;

    let updatedFilesStr = currentTask.File_Hasil;
    if (hasilFiles.length > 0) {
      const newFilesJoined = hasilFiles.join(' || ');
      updatedFilesStr = currentTask.File_Hasil === '-' || !currentTask.File_Hasil
        ? newFilesJoined
        : `${currentTask.File_Hasil} || ${newFilesJoined}`;
    }

    const isNowClosed = updateStatus === 'CLOSED (Selesai)';
    const aktualTimestamp = isNowClosed ? formatCurrentDateTime() : currentTask.Aktual_Selesai;

    const updated: Ticket = {
      ...currentTask,
      Status_Pengerjaan: updateStatus,
      Keterangan_Penerima: keteranganBalasan.trim() 
        ? `[Update Staff ${activeStaff}]: ${keteranganBalasan.trim()}`
        : currentTask.Keterangan_Penerima,
      File_Hasil: updatedFilesStr,
      Aktual_Selesai: aktualTimestamp
    };

    onUpdateTicket(updated);
    setHasilFiles([]);
    setKeteranganBalasan('');
    setShowDoneNotice(true);
    setTimeout(() => setShowDoneNotice(false), 3000);

    // If marked closed, switch view or keep updated
    if (isNowClosed) {
      // Allow user to see completed tab if all active tasks done
      if (myActiveTasks.length <= 1) {
        setTimeout(() => setActiveTab('selesai'), 1200);
      }
    }

    // If closed or updated, send WhatsApp notification to Peminta (Sales / Proyek)
    const cleanWaPeminta = cleanWhatsAppNumber(currentTask.WA_Peminta);
    const pesanBalik = `*UPDATE TIKET ${currentTask.ID_Tiket}*\n\nHalo ${currentTask.Peminta},\nDokumen teknis untuk proyek *${currentTask.Proyek}* saat ini berstatus *${updateStatus}*.\n\nStaf Eksekutor: ${activeStaff}\nCatatan: ${keteranganBalasan.trim() || 'Pengerjaan diperbarui di portal.'}\n${isNowClosed ? 'File hasil telah siap diunduh di sistem.' : ''}`;

    onOpenWhatsApp({
      id: currentTask.ID_Tiket,
      wa: cleanWaPeminta,
      pesan: pesanBalik,
      target_role: 'Pemberi Tugas (Sales / Proyek)',
      target_name: currentTask.Peminta
    });
  };

  // Filter completed tasks by search query
  const filteredCompletedTasks = myCompletedTasks.filter(t => 
    t.ID_Tiket.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
    t.Proyek.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
    t.Peminta.toLowerCase().includes(historySearchQuery.toLowerCase()) ||
    t.Dokumen.toLowerCase().includes(historySearchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-white via-white to-[#282974]/8 border border-slate-200 shadow-xs">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#282974]">
            Eksekusi Staf Teknis
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-0.5">
            Dashboard Staff Engineering
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Unduh berkas TOR referensi, lakukan kalkulasi struktur & penggambaran CAD, unggah dokumen hasil, dan pantau seluruh rekam jejak pekerjaan yang telah diselesaikan.
          </p>
        </div>

        {/* Staff Selector */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-50 rounded-xl border border-slate-200 shrink-0">
          <label className="text-xs text-slate-600 px-2 font-medium">PIC / Staf:</label>
          <select
            value={activeStaff}
            onChange={(e) => {
              setActiveStaff(e.target.value);
              setSelectedTicketId('');
            }}
            className="px-3 py-1.5 text-xs font-semibold bg-white border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:border-[#282974] font-sans"
          >
            {allStaff.map(staf => {
              const activeCount = tickets.filter(
                t => t.Staff_Tujuan === staf.name && ['DISPOSISI', 'PROSES'].includes(t.Status_Pengerjaan)
              ).length;
              const closedCount = tickets.filter(
                t => t.Staff_Tujuan === staf.name && t.Status_Pengerjaan === 'CLOSED (Selesai)'
              ).length;

              return (
                <option key={staf.name} value={staf.name}>
                  {staf.name} ({staf.dept.replace('Engineering ', '')}) · {activeCount} Aktif / {closedCount} Selesai
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Staff KPI Summary Strip - Clickable to switch tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Active Tasks */}
        <div 
          onClick={() => setActiveTab('aktif')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
            activeTab === 'aktif' 
              ? 'bg-[#282974]/8 border-[#282974] ring-1 ring-[#282974]/20 shadow-xs' 
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div>
            <div className="text-[11px] text-slate-600 font-medium">Tugas Aktif (Perlu Dikerjakan)</div>
            <div className="text-2xl font-mono font-bold text-[#282974] mt-1">
              {myActiveTasks.length}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Status: DISPOSISI & PROSES</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-[#282974]/10 text-[#282974] flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Card 2: Completed Tasks */}
        <div 
          onClick={() => setActiveTab('selesai')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
            activeTab === 'selesai' 
              ? 'bg-emerald-50/70 border-emerald-500 ring-1 ring-emerald-500/20 shadow-xs' 
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div>
            <div className="text-[11px] text-slate-600 font-medium">Tugas Telah Selesai (CLOSED)</div>
            <div className="text-2xl font-mono font-bold text-emerald-600 mt-1">
              {myCompletedTasks.length}
            </div>
            <div className="text-[10px] text-emerald-700 font-medium mt-0.5">Rekam Jejak Tervalidasi</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Card 3: Total Tasks */}
        <div 
          onClick={() => setActiveTab('semua')}
          className={`p-4 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
            activeTab === 'semua' 
              ? 'bg-[#282974]/8 border-[#282974] ring-1 ring-[#282974]/20 shadow-xs' 
              : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
          }`}
        >
          <div>
            <div className="text-[11px] text-slate-600 font-medium">Total Akumulasi Tugas</div>
            <div className="text-2xl font-mono font-bold text-slate-900 mt-1">
              {myTickets.length}
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5">Seluruh Riwayat Penugasan</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
            <Wrench className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Segmented Control Tab Switcher */}
      <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-xl w-fit shadow-2xs">
        <button
          type="button"
          onClick={() => setActiveTab('aktif')}
          className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'aktif'
              ? 'bg-[#282974] text-white shadow-sm shadow-[#282974]/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Tugas Aktif ({myActiveTasks.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('selesai')}
          className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'selesai'
              ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Riwayat Tugas Selesai ({myCompletedTasks.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('semua')}
          className={`flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
            activeTab === 'semua'
              ? 'bg-[#282974] text-white shadow-sm shadow-[#282974]/20'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Semua Rekap ({myTickets.length})</span>
        </button>
      </div>

      {showDoneNotice && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium animate-in fade-in duration-200">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
          <span>Pengerjaan berhasil diperbarui dan status telah dicatat ke dalam riwayat tugas Anda!</span>
        </div>
      )}

      {/* TAB 1: TUGAS AKTIF */}
      {activeTab === 'aktif' && (
        <div>
          {myActiveTasks.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-3">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
              <h3 className="text-base font-bold text-slate-900">Tidak Ada Tugas Tertunda untuk PIC {activeStaff}!</h3>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                Semua pekerjaan aktif yang didelegasikan oleh Manager telah diselesaikan dengan baik. Anda dapat meninjau seluruh pekerjaan yang telah selesai pada tab riwayat.
              </p>
              {myCompletedTasks.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveTab('selesai')}
                  className="mt-2 inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm shadow-emerald-600/20"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Lihat {myCompletedTasks.length} Tugas Telah Selesai</span>
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: My Active Tasks Cards (5 cols) */}
              <div className="lg:col-span-5 space-y-3">
                <div className="text-xs font-semibold text-slate-600 flex items-center justify-between">
                  <span>Daftar Tugas Aktif ({myActiveTasks.length}):</span>
                  <span className="text-[10px] text-slate-500">Pilih untuk mengupdate</span>
                </div>

                <div className="space-y-3 max-h-[580px] overflow-y-auto pr-1">
                  {myActiveTasks.map(ticket => {
                    const isSelected = currentTask?.ID_Tiket === ticket.ID_Tiket;
                    return (
                      <div
                        key={ticket.ID_Tiket}
                        onClick={() => setSelectedTicketId(ticket.ID_Tiket)}
                        className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-[#282974]/8 border-[#282974] shadow-sm'
                            : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="font-mono text-[11px] font-bold text-[#282974]">
                            {ticket.ID_Tiket}
                          </span>
                          <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-[#282974]/10 text-[#282974] border border-[#282974]/25">
                            {ticket.Status_Pengerjaan}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-slate-900 line-clamp-2">
                          {ticket.Proyek}
                        </h4>

                        <div className="text-[11px] text-slate-600 mt-2 space-y-1">
                          <div className="flex justify-between">
                            <span>Target:</span>
                            <span className="font-mono text-emerald-700 font-bold">{ticket.Target_Selesai}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Dokumen:</span>
                            <span className="text-slate-700 font-medium truncate max-w-[180px]">{ticket.Dokumen}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Execution Form & File Uploader (7 cols) */}
              <div className="lg:col-span-7">
                {currentTask ? (
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                      <div>
                        <span className="text-[10px] font-mono text-[#282974] uppercase font-bold tracking-wider">
                          RUANG KERJA EKSEKUSI TIKET
                        </span>
                        <h3 className="text-base font-bold text-slate-900 mt-0.5">
                          {currentTask.Proyek}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => onSelectTicketDetail(currentTask)}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-slate-900 bg-slate-100 rounded-lg hover:bg-slate-200 border border-slate-200 transition-colors"
                      >
                        Detail Lengkap
                      </button>
                    </div>

                    {/* Requirements info card */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Dokumen Diminta:</span>
                        <span className="font-semibold text-slate-900">{currentTask.Dokumen}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Spesifikasi / Dimensi:</span>
                        <span className="text-slate-800 font-medium">{currentTask.Dimensi}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-500">Pemohon (Sales/Proyek):</span>
                        <span className="text-slate-800 font-medium">{currentTask.Peminta} (+{currentTask.WA_Peminta})</span>
                      </div>
                      <div className="pt-2 border-t border-slate-200">
                        <span className="text-slate-500 block mb-1">Catatan Manager:</span>
                        <div className="p-2.5 bg-white border border-slate-200 rounded-lg text-slate-800 font-medium text-[11px]">
                          {currentTask.Keterangan_Penerima !== '-' ? currentTask.Keterangan_Penerima : 'Tidak ada catatan khusus.'}
                        </div>
                      </div>
                      <div className="pt-1">
                        <span className="text-slate-500 block mb-1">Berkas Referensi Awal:</span>
                        {currentTask.File_Pendukung !== '-' ? (
                          <div className="flex flex-wrap gap-1.5">
                            {currentTask.File_Pendukung.split('||').map((fileName, idx) => {
                              const trimmed = fileName.trim();
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => downloadFile(trimmed, {
                                    proyek: currentTask.Proyek,
                                    idTiket: currentTask.ID_Tiket,
                                    dokumen: currentTask.Dokumen
                                  })}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#282974]/10 border border-[#282974]/25 text-[#282974] hover:text-white hover:bg-[#282974] hover:border-[#282974] transition-colors text-[11px] font-mono font-semibold group"
                                  title={`Unduh ${trimmed}`}
                                >
                                  <Download className="w-3 h-3 text-[#282974] group-hover:text-white group-hover:scale-110 transition-transform" />
                                  <span className="truncate max-w-[200px]">{trimmed}</span>
                                </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-slate-400 italic text-[11px]">Tidak ada berkas terlampir</div>
                        )}
                      </div>
                    </div>

                    {/* Update Form */}
                    <form onSubmit={handleSaveUpdate} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Perbarui Status Pengerjaan:
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setUpdateStatus('PROSES')}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              updateStatus === 'PROSES'
                                ? 'bg-[#282974]/8 border-[#282974] text-slate-900 shadow-2xs'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            <div className="text-xs font-bold text-[#282974]">PROSES</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">Sedang dalam analisis / gambar</div>
                          </button>

                          <button
                            type="button"
                            onClick={() => setUpdateStatus('CLOSED (Selesai)')}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              updateStatus === 'CLOSED (Selesai)'
                                ? 'bg-emerald-50 border-emerald-500 text-slate-900 shadow-2xs'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            <div className="text-xs font-bold text-emerald-700">CLOSED (Selesai)</div>
                            <div className="text-[11px] text-slate-500 mt-0.5">Dokumen lengkap & simpan riwayat</div>
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Upload Dokumen Hasil Engineering (Kalkulasi / Drawing / SSP):
                        </label>
                        <div className="border border-dashed border-slate-300 hover:border-[#282974] rounded-xl p-4 text-center bg-slate-50 transition-colors">
                          <FileUp className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                          <div className="text-xs text-slate-700 font-medium">Pilih berkas hasil teknis (PDF, DWG, XLSX)</div>
                          <input
                            type="file"
                            multiple
                            onChange={handleFileUpload}
                            className="mt-2 text-xs text-slate-600 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-[#282974] file:text-white hover:file:bg-[#1e1f5a] cursor-pointer"
                          />
                        </div>
                      </div>

                      {hasilFiles.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-semibold text-slate-600">Berkas Hasil yang Akan Diunggah:</div>
                          {hasilFiles.map((fn, idx) => (
                            <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-emerald-50 border border-emerald-200 text-xs">
                              <span className="font-mono text-emerald-800 font-medium truncate max-w-sm">{fn}</span>
                              <button
                                type="button"
                                onClick={() => removeFile(idx)}
                                className="p-1 text-slate-500 hover:text-rose-600 transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}

                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Catatan / Pesan Balasan untuk Sales & Pemohon:
                        </label>
                        <textarea
                          rows={3}
                          value={keteranganBalasan}
                          onChange={(e) => setKeteranganBalasan(e.target.value)}
                          placeholder="e.g. Analisis momen lentur dan kapasitas geser telah selesai memenuhi SNI 2847:2019. Gambar shop drawing terlampir..."
                          className="w-full p-3 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#282974]"
                        />
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 px-4 text-xs font-bold text-white bg-[#282974] hover:bg-[#1e1f5a] rounded-xl shadow-sm shadow-[#282974]/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                      >
                        <Send className="w-4 h-4" />
                        <span>Simpan Update & Kirim Notifikasi via WhatsApp</span>
                      </button>
                    </form>
                  </div>
                ) : null}
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: RIWAYAT TUGAS SELESAI (CLOSED) */}
      {activeTab === 'selesai' && (
        <div className="space-y-4">
          {/* Header & Search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white border border-slate-200 rounded-2xl shadow-xs">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Rekam Jejak Pekerjaan Selesai (CLOSED) · PIC: {activeStaff}</span>
              </h3>
              <p className="text-xs text-slate-600 mt-0.5">
                Daftar seluruh dokumen teknis yang telah Anda selesaikan dan diterbitkan ke pemohon.
              </p>
            </div>

            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400" />
              <input
                type="text"
                value={historySearchQuery}
                onChange={(e) => setHistorySearchQuery(e.target.value)}
                placeholder="Cari proyek atau tiket selesai..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-emerald-600 focus:bg-white"
              />
            </div>
          </div>

          {myCompletedTasks.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <AlertTriangle className="w-10 h-10 text-slate-400 mx-auto" />
              <h4 className="text-sm font-bold text-slate-900">Belum Ada Rekam Jejak Selesai</h4>
              <p className="text-xs text-slate-600 max-w-sm mx-auto">
                PIC {activeStaff} belum memiliki tiket yang berstatus CLOSED. Begitu Anda menyelesaikan tugas aktif dan mengubah statusnya menjadi CLOSED, riwayatnya akan tersimpan di sini.
              </p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="px-4 py-3 font-semibold">ID Tiket</th>
                      <th className="px-4 py-3 font-semibold">Nama Proyek</th>
                      <th className="px-4 py-3 font-semibold">Pemohon</th>
                      <th className="px-4 py-3 font-semibold">Dokumen Diterbitkan</th>
                      <th className="px-4 py-3 font-semibold">Tanggal Selesai</th>
                      <th className="px-4 py-3 font-semibold">Berkas Hasil</th>
                      <th className="px-4 py-3 font-semibold text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {filteredCompletedTasks.map(ticket => (
                      <tr key={ticket.ID_Tiket} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3.5 font-mono font-bold text-[#282974] whitespace-nowrap">
                          {ticket.ID_Tiket}
                        </td>
                        <td className="px-4 py-3.5 font-medium text-slate-900 max-w-xs">
                          <div className="truncate font-semibold">{ticket.Proyek}</div>
                          <div className="text-[10px] text-slate-500">{ticket.Lokasi}</div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-700 whitespace-nowrap">
                          <div className="font-medium">{ticket.Peminta}</div>
                          <div className="text-[10px] text-slate-500 font-mono">{ticket.SO}</div>
                        </td>
                        <td className="px-4 py-3.5 text-slate-800">
                          <div className="flex flex-wrap gap-1">
                            {ticket.Dokumen.split(',').map((doc, i) => (
                              <span key={i} className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-medium">
                                {doc.trim()}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-3.5 font-mono whitespace-nowrap">
                          <span className="text-emerald-700 font-bold block">
                            {ticket.Aktual_Selesai !== '-' ? ticket.Aktual_Selesai : ticket.Target_Selesai}
                          </span>
                          <span className="text-[10px] text-slate-500">Target: {ticket.Target_Selesai}</span>
                        </td>
                        <td className="px-4 py-3.5 text-slate-700 max-w-xs">
                          {ticket.File_Hasil !== '-' ? (
                            <div className="flex flex-col gap-1">
                              {ticket.File_Hasil.split('||').map((fileName, idx) => {
                                const trimmed = fileName.trim();
                                return (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => downloadFile(trimmed, {
                                      proyek: ticket.Proyek,
                                      idTiket: ticket.ID_Tiket,
                                      dokumen: ticket.Dokumen
                                    })}
                                    className="text-[11px] font-mono text-emerald-700 hover:text-emerald-900 font-semibold flex items-center gap-1.5 truncate text-left underline group w-fit"
                                    title={`Unduh ${trimmed}`}
                                  >
                                    <Download className="w-3 h-3 shrink-0 group-hover:scale-110 transition-transform" />
                                    <span className="truncate max-w-[200px]">{trimmed}</span>
                                  </button>
                                );
                              })}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-[11px]">-</span>
                          )}
                        </td>
                        <td className="px-4 py-3.5 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onSelectTicketDetail(ticket)}
                            className="px-2.5 py-1 text-[11px] font-semibold text-[#282974] hover:text-white bg-[#282974]/10 hover:bg-[#282974] border border-[#282974]/25 hover:border-[#282974] rounded-lg transition-colors inline-flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            <span>Detail</span>
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SEMUA REKAP TUGAS */}
      {activeTab === 'semua' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Semua Tugas yang Pernah Ditugaskan ke {activeStaff} ({myTickets.length})
            </h3>
            <span className="text-xs text-slate-600 font-mono font-medium">
              {myActiveTasks.length} Aktif · {myCompletedTasks.length} Selesai
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 font-semibold">ID Tiket</th>
                  <th className="px-4 py-3 font-semibold">Nama Proyek</th>
                  <th className="px-4 py-3 font-semibold">Pemohon</th>
                  <th className="px-4 py-3 font-semibold">Target</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {myTickets.map(ticket => (
                  <tr key={ticket.ID_Tiket} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-[#282974]">{ticket.ID_Tiket}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900 max-w-xs truncate">{ticket.Proyek}</td>
                    <td className="px-4 py-3 text-slate-700">{ticket.Peminta}</td>
                    <td className="px-4 py-3 font-mono text-slate-600">{ticket.Target_Selesai}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        ticket.Status_Pengerjaan === 'OPEN'
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : ticket.Status_Pengerjaan === 'CLOSED (Selesai)'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-[#282974]/10 text-[#282974] border border-[#282974]/25'
                      }`}>
                        {ticket.Status_Pengerjaan}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => onSelectTicketDetail(ticket)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-[#282974] hover:text-white bg-[#282974]/10 hover:bg-[#282974] border border-[#282974]/25 hover:border-[#282974] rounded-lg transition-colors inline-flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Lihat</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
