import React from 'react';
import { X, Calendar, User, Phone, FileText, CheckCircle2, Clock, AlertTriangle, ArrowRight, Download, Send } from 'lucide-react';
import { Ticket } from '../types';
import { cleanWhatsAppNumber } from '../data/mockData';
import { downloadFile } from '../data/fileStore';

interface TicketDetailModalProps {
  ticket: Ticket | null;
  onClose: () => void;
  onOpenWhatsApp?: (payload: { id: string; wa: string; pesan: string; target_role: string; target_name: string }) => void;
}

export const TicketDetailModal: React.FC<TicketDetailModalProps> = ({ ticket, onClose, onOpenWhatsApp }) => {
  if (!ticket) return null;

  const isClosed = ticket.Status_Pengerjaan === 'CLOSED (Selesai)';
  const isProses = ticket.Status_Pengerjaan === 'PROSES';
  const isDisposisi = ticket.Status_Pengerjaan === 'DISPOSISI';
  const isOpen = ticket.Status_Pengerjaan === 'OPEN';

  const parseFiles = (fileStr: string) => {
    if (!fileStr || fileStr === '-' || fileStr === 'nan') return [];
    return fileStr.split('||').map(f => {
      const trimmed = f.trim();
      const parts = trimmed.split('::');
      return {
        name: parts[0] || trimmed,
        id: parts[1] || ''
      };
    });
  };

  const filesPendukung = parseFiles(ticket.File_Pendukung);
  const filesHasil = parseFiles(ticket.File_Hasil);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
            <Clock className="w-3.5 h-3.5" /> Menunggu Disposisi Manager
          </span>
        );
      case 'DISPOSISI':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
            <ArrowRight className="w-3.5 h-3.5" /> Didisposisikan ke Staff
          </span>
        );
      case 'PROSES':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-sky-50 text-sky-700 border border-sky-200">
            <Clock className="w-3.5 h-3.5" /> Sedang Dikerjakan Staff
          </span>
        );
      case 'CLOSED (Selesai)':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" /> Selesai (CLOSED)
          </span>
        );
      default:
        return <span className="text-xs text-slate-600">{status}</span>;
    }
  };

  // Helper WhatsApp dispatch
  const handleNotifyRequester = () => {
    if (!onOpenWhatsApp) return;
    const cleanWa = cleanWhatsAppNumber(ticket.WA_Peminta);
    const msg = `*STATUS TIKET ${ticket.ID_Tiket}*\n\nHalo Bpk/Ibu ${ticket.Peminta},\nUpdate terkini untuk proyek *${ticket.Proyek}*:\nStatus: *${ticket.Status_Pengerjaan}*\nDepartemen: ${ticket.Departemen_Tujuan}\nStaff Eksekutor: ${ticket.Staff_Tujuan}\nCatatan: ${ticket.Keterangan_Penerima !== '-' ? ticket.Keterangan_Penerima : 'Sedang diproses sesuai target.'}`;
    onOpenWhatsApp({
      id: ticket.ID_Tiket,
      wa: cleanWa,
      pesan: msg,
      target_role: 'Pemberi Tugas',
      target_name: ticket.Peminta
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-white border border-slate-200 rounded-2xl shadow-xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold text-blue-600">{ticket.ID_Tiket}</span>
              {getStatusBadge(ticket.Status_Pengerjaan)}
            </div>
            <h3 className="text-base font-bold text-slate-900 mt-1 line-clamp-1">
              {ticket.Proyek}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-200/60 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-xs text-slate-700">
          {/* Stepper Timeline */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider mb-3">
              Tahapan Pengerjaan Dokumen
            </div>
            <div className="grid grid-cols-4 gap-2 relative">
              {/* Step 1 */}
              <div className="flex flex-col items-center text-center">
                <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center justify-center text-xs font-bold mb-1.5">
                  ✓
                </div>
                <div className="text-[11px] font-semibold text-slate-900">1. Request</div>
                <div className="text-[10px] text-slate-500 font-mono">{ticket.Waktu_Request.split(' ')[0]}</div>
              </div>

              {/* Step 2 */}
              <div className="flex flex-col items-center text-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-1.5 ${
                  isOpen 
                    ? 'bg-amber-100 text-amber-700 border border-amber-300 animate-pulse'
                    : 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                }`}>
                  {isOpen ? '2' : '✓'}
                </div>
                <div className="text-[11px] font-semibold text-slate-900">2. Disposisi</div>
                <div className="text-[10px] text-slate-500">
                  {isOpen ? 'Menunggu' : ticket.Manager_Tujuan}
                </div>
              </div>

              {/* Step 3 */}
              <div className="flex flex-col items-center text-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-1.5 ${
                  isOpen 
                    ? 'bg-slate-200 text-slate-500'
                    : isDisposisi || isProses
                    ? 'bg-sky-100 text-sky-700 border border-sky-300 animate-pulse'
                    : 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                }`}>
                  {isClosed ? '✓' : '3'}
                </div>
                <div className="text-[11px] font-semibold text-slate-900">3. Pengerjaan</div>
                <div className="text-[10px] text-slate-500">
                  {ticket.Staff_Tujuan !== '-' ? ticket.Staff_Tujuan : 'Belum Ditugaskan'}
                </div>
              </div>

              {/* Step 4 */}
              <div className="flex flex-col items-center text-center">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold mb-1.5 ${
                  isClosed
                    ? 'bg-emerald-600 text-white font-bold'
                    : 'bg-slate-200 text-slate-500'
                }`}>
                  {isClosed ? '✓' : '4'}
                </div>
                <div className="text-[11px] font-semibold text-slate-900">4. Hasil Terbit</div>
                <div className="text-[10px] text-slate-500 font-mono">
                  {ticket.Aktual_Selesai !== '-' ? ticket.Aktual_Selesai.split(' ')[0] : 'Target ' + ticket.Target_Selesai}
                </div>
              </div>
            </div>
          </div>

          {/* Grid Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Detail Proyek */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
              <div className="text-xs font-bold text-slate-900 border-b border-slate-200 pb-1.5 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-600" /> Informasi Proyek & Sales
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Sales Order (SO):</span>
                <span className="font-mono text-slate-900 font-semibold">{ticket.SO || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Kode Proyek:</span>
                <span className="font-mono text-slate-900">{ticket.Kode_Proyek || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Lokasi:</span>
                <span className="text-slate-900 font-medium text-right">{ticket.Lokasi || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Tujuan Permintaan:</span>
                <span className="text-slate-900 font-medium text-right">{ticket.Tujuan_Permintaan || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Pemasukan Penawaran:</span>
                <span className="font-mono text-amber-700 font-semibold">{ticket.Pemasukan_Penawaran || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Target Selesai:</span>
                <span className="font-mono text-emerald-700 font-semibold">{ticket.Target_Selesai}</span>
              </div>
            </div>

            {/* Spesifikasi Teknis */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
              <div className="text-xs font-bold text-slate-900 border-b border-slate-200 pb-1.5 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-blue-600" /> Spesifikasi & Dokumen
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Departemen Tujuan:</span>
                <span className="text-slate-900 font-semibold">{ticket.Departemen_Tujuan}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Jenis Produk:</span>
                <span className="text-slate-900 font-medium text-right">{ticket.Jenis_Produk || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Dimensi / Spek:</span>
                <span className="text-slate-900 font-medium text-right">{ticket.Dimensi || '-'}</span>
              </div>
              <div className="pt-1">
                <span className="text-slate-500 block mb-1">Dokumen yang Diminta:</span>
                <div className="flex flex-wrap gap-1.5">
                  {ticket.Dokumen.split(',').map((doc, idx) => (
                    <span key={idx} className="px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-medium">
                      {doc.trim()}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Stakeholders Contact */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-xs font-bold text-slate-900 border-b border-slate-200 pb-1.5 mb-3 flex items-center gap-2">
              <User className="w-4 h-4 text-blue-600" /> Penanggung Jawab & Kontak
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <div className="text-[10px] text-slate-500 uppercase font-medium">Pemohon / Sales</div>
                <div className="font-semibold text-slate-900 mt-0.5">{ticket.Peminta}</div>
                <div className="text-emerald-700 font-mono text-[11px] mt-1 flex items-center gap-1 font-medium">
                  <Phone className="w-3 h-3" /> +{ticket.WA_Peminta}
                </div>
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <div className="text-[10px] text-slate-500 uppercase font-medium">Manager Engineering</div>
                <div className="font-semibold text-slate-900 mt-0.5">{ticket.Manager_Tujuan}</div>
                <div className="text-emerald-700 font-mono text-[11px] mt-1 flex items-center gap-1 font-medium">
                  <Phone className="w-3 h-3" /> +{ticket.WA_Manager}
                </div>
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <div className="text-[10px] text-slate-500 uppercase font-medium">Staff Eksekutor</div>
                <div className="font-semibold text-slate-900 mt-0.5">
                  {ticket.Staff_Tujuan !== '-' ? ticket.Staff_Tujuan : 'Menunggu Delegasi'}
                </div>
                {ticket.WA_Staff && ticket.WA_Staff !== '-' ? (
                  <div className="text-emerald-700 font-mono text-[11px] mt-1 flex items-center gap-1 font-medium">
                    <Phone className="w-3 h-3" /> +{ticket.WA_Staff}
                  </div>
                ) : (
                  <div className="text-slate-400 text-[11px] mt-1">-</div>
                )}
              </div>
            </div>
          </div>

          {/* Feedback Notes */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
            <div className="text-xs font-bold text-slate-900 mb-2">
              💬 Catatan & Pesan Balasan Engineering:
            </div>
            <div className="p-3 bg-white rounded-lg border border-slate-200 text-slate-800 font-medium">
              {ticket.Keterangan_Penerima && ticket.Keterangan_Penerima !== '-' 
                ? ticket.Keterangan_Penerima 
                : 'Belum ada catatan tambahan dari tim engineering.'}
            </div>
          </div>

          {/* Files List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* File Pendukung */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-xs font-bold text-slate-900 mb-2">
                📎 Berkas Pendukung (TOR/Gambar/Data Lapangan)
              </div>
              {filesPendukung.length > 0 ? (
                <div className="space-y-1.5">
                  {filesPendukung.map((file, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-200">
                      <span className="font-mono text-[11px] text-slate-700 truncate max-w-[200px]">
                        {file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => downloadFile(file.name, { proyek: ticket.Proyek, idTiket: ticket.ID_Tiket, dokumen: ticket.Dokumen })}
                        className="px-2.5 py-1 text-[10px] bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 hover:border-blue-600 rounded-md flex items-center gap-1 font-semibold transition-colors"
                      >
                        <Download className="w-3 h-3" /> Unduh
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-slate-500 italic">Tidak ada lampiran pendukung</div>
              )}
            </div>

            {/* File Hasil */}
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
              <div className="text-xs font-bold text-slate-900 mb-2">
                📁 Dokumen Hasil Engineering
              </div>
              {filesHasil.length > 0 ? (
                <div className="space-y-1.5">
                  {filesHasil.map((file, i) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-emerald-50/70 border border-emerald-200">
                      <span className="font-mono text-[11px] text-emerald-800 font-medium truncate max-w-[200px]">
                        {file.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => downloadFile(file.name, { proyek: ticket.Proyek, idTiket: ticket.ID_Tiket, dokumen: ticket.Dokumen })}
                        className="px-2.5 py-1 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white rounded-md flex items-center gap-1 font-semibold transition-colors shadow-2xs"
                      >
                        <Download className="w-3 h-3" /> Unduh Hasil
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-slate-500 italic">Dokumen hasil belum diunggah</div>
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            onClick={handleNotifyRequester}
            className="flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-xl border border-emerald-200 transition-colors"
          >
            <Send className="w-3.5 h-3.5" />
            <span>Kirim Update via WhatsApp</span>
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-xl border border-slate-300 transition-colors"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
