import React, { useState } from 'react';
import { 
  Wrench, CheckCircle2, Clock, FileUp, Send, 
  Download, AlertTriangle, ArrowRight, X, FileText, Check, Phone
} from 'lucide-react';
import { Ticket, WhatsAppNotificationPayload } from '../types';
import { STRUKTUR_ORG, cleanWhatsAppNumber, formatCurrentDateTime } from '../data/mockData';

interface StaffViewProps {
  tickets: Ticket[];
  onUpdateTicket: (ticket: Ticket) => void;
  onOpenWhatsApp: (payload: WhatsAppNotificationPayload) => void;
  onSelectTicketDetail: (ticket: Ticket) => void;
}

export const StaffView: React.FC<StaffViewProps> = ({
  tickets,
  onUpdateTicket,
  onOpenWhatsApp,
  onSelectTicketDetail
}) => {
  // Extract all staff
  const allStaff: { name: string; dept: string }[] = [];
  Object.entries(STRUKTUR_ORG).forEach(([dept, data]) => {
    Object.keys(data.Staff).forEach(staffName => {
      allStaff.push({ name: staffName, dept });
    });
  });

  const [activeStaff, setActiveStaff] = useState<string>('Fikri R');
  const [selectedTicketId, setSelectedTicketId] = useState<string>('');
  const [updateStatus, setUpdateStatus] = useState<'PROSES' | 'CLOSED (Selesai)'>('PROSES');
  const [keteranganBalasan, setKeteranganBalasan] = useState('');
  const [hasilFiles, setHasilFiles] = useState<string[]>([]);
  const [showDoneNotice, setShowDoneNotice] = useState(false);

  // Tickets assigned to this staff
  const myTickets = tickets.filter(t => t.Staff_Tujuan === activeStaff);
  const myActiveTasks = myTickets.filter(t => ['DISPOSISI', 'PROSES'].includes(t.Status_Pengerjaan));
  const myCompletedTasks = myTickets.filter(t => t.Status_Pengerjaan === 'CLOSED (Selesai)');

  const currentTask = myActiveTasks.find(t => t.ID_Tiket === selectedTicketId) || myActiveTasks[0] || null;

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const names = Array.from(e.target.files).map(f => f.name);
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

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-sky-950/40 border border-slate-800">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-sky-400">
            Eksekusi Staf Teknis
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight mt-0.5">
            Dashboard Staff Engineering
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Unduh berkas TOR referensi, lakukan kalkulasi struktur & penggambaran CAD, lalu unggah dokumen hasil dan perbarui status pekerjaan secara transparan.
          </p>
        </div>

        {/* Staff Selector */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-950/80 rounded-xl border border-slate-800 shrink-0">
          <label className="text-xs text-slate-400 px-2 font-medium">Staf Aktif:</label>
          <select
            value={activeStaff}
            onChange={(e) => {
              setActiveStaff(e.target.value);
              setSelectedTicketId('');
            }}
            className="px-3 py-1.5 text-xs font-semibold bg-slate-900 border border-slate-700 rounded-lg text-white focus:outline-none focus:border-sky-500"
          >
            {allStaff.map(staf => {
              const activeCount = tickets.filter(
                t => t.Staff_Tujuan === staf.name && ['DISPOSISI', 'PROSES'].includes(t.Status_Pengerjaan)
              ).length;
              return (
                <option key={staf.name} value={staf.name}>
                  {staf.name} ({staf.dept.replace('Engineering ', '')}) - {activeCount} Tugas
                </option>
              );
            })}
          </select>
        </div>
      </div>

      {/* Staff KPI Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-400">Tugas Aktif (Perlu Dikerjakan)</div>
            <div className="text-2xl font-mono font-bold text-sky-400 mt-1">
              {myActiveTasks.length}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-400">Tugas Telah Selesai (CLOSED)</div>
            <div className="text-2xl font-mono font-bold text-emerald-400 mt-1">
              {myCompletedTasks.length}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div>
            <div className="text-[11px] text-slate-400">Total Akumulasi Tugas</div>
            <div className="text-2xl font-mono font-bold text-white mt-1">
              {myTickets.length}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-800 text-slate-300 flex items-center justify-center font-bold">
            <Wrench className="w-5 h-5" />
          </div>
        </div>
      </div>

      {showDoneNotice && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-950/40 border border-emerald-800 text-emerald-300 text-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Status pengerjaan berhasil disimpan dan notifikasi WhatsApp telah disiapkan!</span>
        </div>
      )}

      {/* Main Execution Area */}
      {myActiveTasks.length === 0 ? (
        <div className="p-12 text-center bg-slate-900 rounded-2xl border border-slate-800 space-y-2">
          <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
          <h3 className="text-base font-bold text-white">Tidak Ada Tugas Tertunda untuk {activeStaff}!</h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            Semua pekerjaan yang didelegasikan oleh Manager telah diselesaikan dengan baik atau belum ada penugasan baru.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: My Active Tasks Cards (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="text-xs font-semibold text-slate-400">
              Daftar Tugas Aktif ({myActiveTasks.length}):
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
                        ? 'bg-sky-950/30 border-sky-500 shadow-md shadow-sky-950/40'
                        : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-mono text-[11px] font-bold text-sky-400">
                        {ticket.ID_Tiket}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-sky-500/10 text-sky-300 border border-sky-500/20">
                        {ticket.Status_Pengerjaan}
                      </span>
                    </div>

                    <h4 className="text-xs font-bold text-white line-clamp-2">
                      {ticket.Proyek}
                    </h4>

                    <div className="text-[11px] text-slate-400 mt-2 space-y-1">
                      <div className="flex justify-between">
                        <span>Target:</span>
                        <span className="font-mono text-emerald-400 font-semibold">{ticket.Target_Selesai}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Dokumen:</span>
                        <span className="text-slate-300 truncate max-w-[180px]">{ticket.Dokumen}</span>
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
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div>
                    <span className="text-[10px] font-mono text-sky-400 uppercase font-bold tracking-wider">
                      RUANG KERJA EKSEKUSI TIKET
                    </span>
                    <h3 className="text-base font-bold text-white mt-0.5">
                      {currentTask.Proyek}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectTicketDetail(currentTask)}
                    className="px-3 py-1 text-xs text-slate-300 hover:text-white bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
                  >
                    Detail Lengkap
                  </button>
                </div>

                {/* Requirements info card */}
                <div className="p-4 bg-slate-950/80 rounded-xl border border-slate-800 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Dokumen Diminta:</span>
                    <span className="font-semibold text-white">{currentTask.Dokumen}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Spesifikasi / Dimensi:</span>
                    <span className="text-slate-300">{currentTask.Dimensi}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Pemohon (Sales/Proyek):</span>
                    <span className="text-slate-300">{currentTask.Peminta} (+{currentTask.WA_Peminta})</span>
                  </div>
                  <div className="pt-2 border-t border-slate-800">
                    <span className="text-slate-400 block mb-1">Catatan Manager:</span>
                    <div className="p-2.5 bg-slate-900 rounded-lg text-slate-300 font-medium text-[11px]">
                      {currentTask.Keterangan_Penerima !== '-' ? currentTask.Keterangan_Penerima : 'Tidak ada catatan khusus.'}
                    </div>
                  </div>
                  <div className="pt-1">
                    <span className="text-slate-400 block mb-1">Berkas Referensi Awal:</span>
                    <div className="font-mono text-sky-400 text-[11px]">
                      {currentTask.File_Pendukung !== '-' ? currentTask.File_Pendukung : 'Tidak ada berkas terlampir'}
                    </div>
                  </div>
                </div>

                {/* Update Form */}
                <form onSubmit={handleSaveUpdate} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Perbarui Status Pengerjaan:
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setUpdateStatus('PROSES')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          updateStatus === 'PROSES'
                            ? 'bg-sky-600/20 border-sky-500 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold">PROSES</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">Sedang dalam analisis / gambar</div>
                      </button>

                      <button
                        type="button"
                        onClick={() => setUpdateStatus('CLOSED (Selesai)')}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          updateStatus === 'CLOSED (Selesai)'
                            ? 'bg-emerald-600/20 border-emerald-500 text-white'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <div className="text-xs font-bold text-emerald-400">CLOSED (Selesai)</div>
                        <div className="text-[11px] text-slate-400 mt-0.5">Dokumen lengkap & terbit</div>
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Upload Dokumen Hasil Engineering (Kalkulasi / Drawing / SSP):
                    </label>
                    <div className="border border-dashed border-slate-700 hover:border-sky-500 rounded-xl p-4 text-center bg-slate-950/50 transition-colors">
                      <FileUp className="w-6 h-6 text-slate-500 mx-auto mb-1" />
                      <div className="text-xs text-slate-300">Pilih berkas hasil teknis (PDF, DWG, XLSX)</div>
                      <input
                        type="file"
                        multiple
                        onChange={handleFileUpload}
                        className="mt-2 text-xs text-slate-400 file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:bg-sky-600 file:text-white cursor-pointer"
                      />
                    </div>
                  </div>

                  {hasilFiles.length > 0 && (
                    <div className="space-y-1.5">
                      <div className="text-[11px] font-semibold text-slate-400">Berkas Hasil yang Akan Diunggah:</div>
                      {hasilFiles.map((fn, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-emerald-950/20 border border-emerald-900/30 text-xs">
                          <span className="font-mono text-emerald-300 truncate max-w-sm">{fn}</span>
                          <button
                            type="button"
                            onClick={() => removeFile(idx)}
                            className="p-1 text-slate-500 hover:text-rose-400 transition-colors"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                      Catatan / Pesan Balasan untuk Sales & Pemohon:
                    </label>
                    <textarea
                      rows={3}
                      value={keteranganBalasan}
                      onChange={(e) => setKeteranganBalasan(e.target.value)}
                      placeholder="e.g. Analisis momen lentur dan kapasitas geser telah selesai memenuhi SNI 2847:2019. Gambar shop drawing terlampir..."
                      className="w-full p-3 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-sky-500"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-2.5 px-4 text-xs font-bold text-white bg-sky-600 hover:bg-sky-500 rounded-xl shadow-lg shadow-sky-950/40 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <Send className="w-4 h-4" />
                    <span>Simpan Update & Notifikasi Pemohon via WhatsApp</span>
                  </button>
                </form>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};
