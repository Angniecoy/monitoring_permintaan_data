import React, { useState } from 'react';
import { 
  Building2, UserCheck, Send, Clock, CheckCircle2, 
  ArrowRight, MessageSquare, AlertCircle, Eye, ShieldCheck, 
  Layers, Users, Check
} from 'lucide-react';
import { DepartmentName, Ticket, WhatsAppNotificationPayload } from '../types';
import { STRUKTUR_ORG, cleanWhatsAppNumber } from '../data/mockData';

interface ManagerViewProps {
  tickets: Ticket[];
  onUpdateTicket: (ticket: Ticket) => void;
  onOpenWhatsApp: (payload: WhatsAppNotificationPayload) => void;
  onSelectTicketDetail: (ticket: Ticket) => void;
}

export const ManagerView: React.FC<ManagerViewProps> = ({
  tickets,
  onUpdateTicket,
  onOpenWhatsApp,
  onSelectTicketDetail
}) => {
  const [activeDept, setActiveDept] = useState<DepartmentName>('Engineering Precast');
  const [selectedTicketId, setSelectedTicketId] = useState<string>('');
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [catatanManager, setCatatanManager] = useState<string>('');
  const [activeViewTab, setActiveViewTab] = useState<'antrean' | 'histori'>('antrean');

  const deptConfig = STRUKTUR_ORG[activeDept];
  const managerName = deptConfig.Manager;
  const managerWa = deptConfig.WA_Manager;
  const staffList = Object.keys(deptConfig.Staff);

  // Tickets for this department
  const deptTickets = tickets.filter(t => t.Departemen_Tujuan === activeDept);
  const openTickets = deptTickets.filter(t => t.Status_Pengerjaan === 'OPEN');
  const activeTickets = deptTickets.filter(t => ['DISPOSISI', 'PROSES'].includes(t.Status_Pengerjaan));
  const closedTickets = deptTickets.filter(t => t.Status_Pengerjaan === 'CLOSED (Selesai)');

  // Selected ticket for disposition
  const currentTicket = openTickets.find(t => t.ID_Tiket === selectedTicketId) || openTickets[0] || null;

  // Calculate workload per staff in this department
  const staffWorkload = staffList.map(staff => {
    const activeTasks = tickets.filter(
      t => t.Staff_Tujuan === staff && ['DISPOSISI', 'PROSES'].includes(t.Status_Pengerjaan)
    ).length;
    const completedTasks = tickets.filter(
      t => t.Staff_Tujuan === staff && t.Status_Pengerjaan === 'CLOSED (Selesai)'
    ).length;
    return {
      name: staff,
      wa: deptConfig.Staff[staff],
      activeTasks,
      completedTasks
    };
  });

  const handleDisposisi = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTicket) return;

    const staffToAssign = selectedStaff || staffList[0];
    const staffWa = deptConfig.Staff[staffToAssign] || '';

    const updated: Ticket = {
      ...currentTicket,
      Staff_Tujuan: staffToAssign,
      WA_Staff: staffWa,
      Status_Pengerjaan: 'DISPOSISI',
      Keterangan_Penerima: catatanManager 
        ? `Catatan Manager (${managerName}): ${catatanManager}`
        : currentTicket.Keterangan_Penerima
    };

    onUpdateTicket(updated);
    setCatatanManager('');

    // Trigger WhatsApp notification for Staff
    const pesan = `*DISPOSISI TUGAS TEKNIS BARU*\n\nHalo ${staffToAssign},\nBpk. ${managerName} telah mendelegasikan tugas proyek *${currentTicket.Proyek}* kepada Anda.\nTarget Selesai: *${currentTicket.Target_Selesai}*\nDokumen: ${currentTicket.Dokumen}\n\n${catatanManager ? `Catatan: ${catatanManager}\n\n` : ''}Silakan periksa portal Staff untuk memproses tiket ${currentTicket.ID_Tiket}.`;

    onOpenWhatsApp({
      id: currentTicket.ID_Tiket,
      wa: cleanWhatsAppNumber(staffWa),
      pesan: pesan,
      target_role: 'Staff Engineering',
      target_name: staffToAssign
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
            Modul 02 · Manajemen Disposisi & Delegasi
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight mt-0.5">
            Dashboard Manager Engineering
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Tinjau permintaan dokumen teknis yang masuk, monitor beban kerja personel, dan disposisikan tugas secara merata dengan notifikasi WhatsApp otomatis.
          </p>
        </div>

        {/* Department Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800 shrink-0">
          {(Object.keys(STRUKTUR_ORG) as DepartmentName[]).map(dept => {
            const isDeptActive = activeDept === dept;
            const deptOpenCount = tickets.filter(
              t => t.Departemen_Tujuan === dept && t.Status_Pengerjaan === 'OPEN'
            ).length;

            return (
              <button
                key={dept}
                type="button"
                onClick={() => {
                  setActiveDept(dept);
                  setSelectedTicketId('');
                  setSelectedStaff('');
                }}
                className={`flex items-center gap-2 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                  isDeptActive
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-950/40'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <span>{dept.replace('Engineering ', '')}</span>
                {deptOpenCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 font-mono text-[10px] font-bold flex items-center justify-center">
                    {deptOpenCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Manager & Staff Workload Bar */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
        {/* Manager Profile card (4 cols) */}
        <div className="md:col-span-4 p-4 rounded-2xl bg-slate-900 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold text-sm">
              MGR
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">
                Manager {activeDept}
              </div>
              <div className="text-sm font-bold text-white">{managerName}</div>
              <div className="text-[11px] font-mono text-emerald-400">
                +{managerWa}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-400">Antrean OPEN</div>
            <div className="text-xl font-mono font-bold text-amber-400 tabular-nums">
              {openTickets.length}
            </div>
          </div>
        </div>

        {/* Staff Workload Visualizer (8 cols) */}
        <div className="md:col-span-8 p-4 rounded-2xl bg-slate-900 border border-slate-800">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-bold text-slate-400 uppercase flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-400" />
              <span>Beban Kerja Staf Aktif ({activeDept})</span>
            </div>
            <span className="text-[10px] text-slate-500">
              *Tinjau sebelum mendelegasikan tugas
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
            {staffWorkload.map(staff => (
              <div
                key={staff.name}
                className="p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-semibold text-white">{staff.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono">+{staff.wa.slice(0, 6)}...</div>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold tabular-nums ${
                    staff.activeTasks === 0
                      ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                      : staff.activeTasks <= 2
                      ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                      : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                  }`}>
                    {staff.activeTasks} Aktif
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Content: Split View (Queue + Action) or History */}
      <div className="space-y-4">
        {/* Subtab Toggle */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveViewTab('antrean')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeViewTab === 'antrean'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Antrean Perlu Disposisi ({openTickets.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveViewTab('histori')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeViewTab === 'histori'
                  ? 'bg-slate-800 text-white'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Histori Departemen ({deptTickets.length})
            </button>
          </div>
        </div>

        {activeViewTab === 'antrean' ? (
          openTickets.length === 0 ? (
            <div className="p-12 text-center bg-slate-900 rounded-2xl border border-slate-800 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <div className="text-sm font-bold text-white">Semua Tiket Telah Didisposisikan!</div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Tidak ada tiket berstatus OPEN yang menunggu delegasi di {activeDept}. Seluruh tim sedang fokus mengerjakan tugas aktif.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: List of Open Tickets (6 cols) */}
              <div className="lg:col-span-6 space-y-3">
                <div className="text-xs font-semibold text-slate-400">
                  Daftar Tiket Masuk (Pilih untuk Disposisi):
                </div>

                <div className="space-y-2.5 max-h-[580px] overflow-y-auto pr-1">
                  {openTickets.map(ticket => {
                    const isSelected = currentTicket?.ID_Tiket === ticket.ID_Tiket;
                    return (
                      <div
                        key={ticket.ID_Tiket}
                        onClick={() => setSelectedTicketId(ticket.ID_Tiket)}
                        className={`p-4 rounded-xl border text-left cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-indigo-950/30 border-indigo-500 shadow-md shadow-indigo-950/30'
                            : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-[11px] font-bold text-blue-400">
                            {ticket.ID_Tiket}
                          </span>
                          <span className="text-[11px] text-amber-300 font-mono">
                            Target: {ticket.Target_Selesai}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-white line-clamp-1">
                          {ticket.Proyek}
                        </h4>

                        <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
                          <span>Pemohon: {ticket.Peminta}</span>
                          <span className="text-slate-500">{ticket.Dokumen}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right Column: Disposition Action Form (6 cols) */}
              <div className="lg:col-span-6">
                {currentTicket ? (
                  <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                      <div>
                        <div className="text-[11px] font-mono text-blue-400 font-semibold">
                          FORMULIR DISPOSISI RESMI
                        </div>
                        <h3 className="text-sm font-bold text-white mt-0.5">
                          {currentTicket.Proyek}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => onSelectTicketDetail(currentTicket)}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                        title="Lihat Detail Lengkap"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs p-3 bg-slate-950/70 rounded-xl border border-slate-800">
                      <div>
                        <span className="text-slate-500 text-[10px]">Pemohon:</span>
                        <div className="text-white font-medium">{currentTicket.Peminta}</div>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px]">Target Selesai:</span>
                        <div className="text-emerald-400 font-mono font-medium">{currentTicket.Target_Selesai}</div>
                      </div>
                      <div className="col-span-2 pt-1 border-t border-slate-800/80">
                        <span className="text-slate-500 text-[10px]">Dokumen yang Diminta:</span>
                        <div className="text-slate-300 font-medium">{currentTicket.Dokumen}</div>
                      </div>
                    </div>

                    <form onSubmit={handleDisposisi} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          Delegasikan Tugas ini Kepada Staf: <span className="text-rose-400">*</span>
                        </label>
                        <select
                          value={selectedStaff || staffList[0]}
                          onChange={(e) => setSelectedStaff(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none focus:border-indigo-500 font-medium"
                          required
                        >
                          {staffList.map(staf => {
                            const load = staffWorkload.find(s => s.name === staf)?.activeTasks || 0;
                            return (
                              <option key={staf} value={staf}>
                                {staf} ({load} tugas aktif saat ini)
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                          Catatan & Instruksi Khusus Manager:
                        </label>
                        <textarea
                          rows={3}
                          value={catatanManager}
                          onChange={(e) => setCatatanManager(e.target.value)}
                          placeholder="e.g. Prioritaskan kalkulasi momen lentur dan koordinasikan dengan tim marketing esok hari..."
                          className="w-full p-3 text-xs bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                        />
                      </div>

                      <div className="p-3 bg-indigo-950/20 border border-indigo-900/30 rounded-xl text-[11px] text-slate-300 flex items-start gap-2">
                        <Send className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                        <div>
                          Status tiket akan otomatis berubah menjadi <strong className="text-indigo-300">DISPOSISI</strong> dan modal WhatsApp akan muncul untuk mengirim instruksi langsung ke staf.
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 px-4 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-500 rounded-xl shadow-lg shadow-indigo-950/40 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                      >
                        <UserCheck className="w-4 h-4" />
                        <span>Disposisikan ke Staf & Kirim WhatsApp</span>
                      </button>
                    </form>
                  </div>
                ) : null}
              </div>
            </div>
          )
        ) : (
          /* Subtab Histori Departemen */
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                  <tr>
                    <th className="px-4 py-3 font-semibold">ID Tiket</th>
                    <th className="px-4 py-3 font-semibold">Proyek</th>
                    <th className="px-4 py-3 font-semibold">Pemohon</th>
                    <th className="px-4 py-3 font-semibold">Staf Ditugaskan</th>
                    <th className="px-4 py-3 font-semibold">Target</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/80">
                  {deptTickets.map(ticket => (
                    <tr key={ticket.ID_Tiket} className="hover:bg-slate-800/40 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-blue-400">{ticket.ID_Tiket}</td>
                      <td className="px-4 py-3 font-medium text-white max-w-xs truncate">{ticket.Proyek}</td>
                      <td className="px-4 py-3 text-slate-300">{ticket.Peminta}</td>
                      <td className="px-4 py-3 text-slate-200">
                        {ticket.Staff_Tujuan !== '-' ? ticket.Staff_Tujuan : <span className="text-slate-500">-</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-400">{ticket.Target_Selesai}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          ticket.Status_Pengerjaan === 'OPEN'
                            ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                            : ticket.Status_Pengerjaan === 'CLOSED (Selesai)'
                            ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                            : 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                        }`}>
                          {ticket.Status_Pengerjaan}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onSelectTicketDetail(ticket)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-blue-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                        >
                          Detail
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
    </div>
  );
};
