import React, { useState } from 'react';
import { 
  Building2, UserCheck, Send, Clock, CheckCircle2, 
  ArrowRight, MessageSquare, AlertCircle, Eye, ShieldCheck, 
  Layers, Users, Check, Download
} from 'lucide-react';
import { DepartmentName, Ticket, UserAccount, UserSession, WhatsAppNotificationPayload } from '../types';
import { STRUKTUR_ORG, cleanWhatsAppNumber } from '../data/mockData';
import { downloadFile } from '../data/fileStore';

interface ManagerViewProps {
  tickets: Ticket[];
  session?: UserSession;
  users?: UserAccount[];
  onUpdateTicket: (ticket: Ticket) => void;
  onOpenWhatsApp: (payload: WhatsAppNotificationPayload) => void;
  onSelectTicketDetail: (ticket: Ticket) => void;
}

export const ManagerView: React.FC<ManagerViewProps> = ({
  tickets,
  session,
  users = [],
  onUpdateTicket,
  onOpenWhatsApp,
  onSelectTicketDetail
}) => {
  const [activeDept, setActiveDept] = useState<DepartmentName>(
    session?.department || 'Engineering Precast'
  );
  const [selectedTicketId, setSelectedTicketId] = useState<string>('');
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [catatanManager, setCatatanManager] = useState<string>('');
  const [activeViewTab, setActiveViewTab] = useState<'antrean' | 'histori'>('antrean');

  const deptConfig = STRUKTUR_ORG[activeDept];
  const dynamicManager = users.find(
    u => u.role === 'manager' && u.department === activeDept && !u.isDefault
  );
  const managerName =
    session?.role === 'manager' && session?.department === activeDept && session?.userName
      ? session.userName
      : dynamicManager?.fullName || deptConfig.Manager;
  const managerWa =
    session?.role === 'manager' && session?.department === activeDept && session?.whatsapp
      ? session.whatsapp
      : dynamicManager?.whatsapp || deptConfig.WA_Manager;

  // Merge static department staff with dynamically registered staff in this department
  const combinedStaffMap: Record<string, string> = { ...deptConfig.Staff };
  users
    .filter(u => u.role === 'staff' && (u.department || 'Engineering Precast') === activeDept)
    .forEach(u => {
      if (!combinedStaffMap[u.fullName]) {
        combinedStaffMap[u.fullName] = u.whatsapp || '6281200000000';
      }
    });
  const staffList = Object.keys(combinedStaffMap);

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
      wa: combinedStaffMap[staff] || '6281200000000',
      activeTasks,
      completedTasks
    };
  });

  const handleDisposisi = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentTicket) return;

    const staffToAssign = selectedStaff || staffList[0];
    const staffWa = combinedStaffMap[staffToAssign] || '';

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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-white via-white to-indigo-50/70 border border-slate-200 shadow-xs">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">
            Manajemen Disposisi & Delegasi
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-0.5">
            Dashboard Manager Engineering
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Tinjau permintaan dokumen teknis yang masuk, monitor beban kerja personel, dan disposisikan tugas secara merata dengan notifikasi WhatsApp otomatis.
          </p>
        </div>

        {/* Department Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200 shrink-0">
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
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white'
                }`}
              >
                <span>{dept.replace('Engineering ', '')}</span>
                {deptOpenCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-white font-mono text-[10px] font-bold flex items-center justify-center">
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
        <div className="md:col-span-4 p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 flex items-center justify-center font-bold text-sm">
              MGR
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase font-semibold">
                Manager {activeDept}
              </div>
              <div className="text-sm font-bold text-slate-900">{managerName}</div>
              <div className="text-[11px] font-mono text-emerald-700 font-medium">
                +{managerWa}
              </div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] text-slate-500">Antrean OPEN</div>
            <div className="text-xl font-mono font-bold text-amber-600 tabular-nums">
              {openTickets.length}
            </div>
          </div>
        </div>

        {/* Staff Workload Visualizer (8 cols) */}
        <div className="md:col-span-8 p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[11px] font-bold text-slate-700 uppercase flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
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
                className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between"
              >
                <div>
                  <div className="text-xs font-semibold text-slate-900">{staff.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono">+{staff.wa.slice(0, 6)}...</div>
                </div>
                <div className="text-right">
                  <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold tabular-nums ${
                    staff.activeTasks === 0
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : staff.activeTasks <= 2
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
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
          <div className="flex items-center gap-1.5 p-1 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <button
              type="button"
              onClick={() => setActiveViewTab('antrean')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeViewTab === 'antrean'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Antrean Perlu Disposisi ({openTickets.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveViewTab('histori')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                activeViewTab === 'histori'
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              Histori Departemen ({deptTickets.length})
            </button>
          </div>
        </div>

        {activeViewTab === 'antrean' ? (
          openTickets.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <div className="text-sm font-bold text-slate-900">Semua Tiket Telah Didisposisikan!</div>
              <p className="text-xs text-slate-600 max-w-md mx-auto">
                Tidak ada tiket berstatus OPEN yang menunggu delegasi di {activeDept}. Seluruh tim sedang fokus mengerjakan tugas aktif.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: List of Open Tickets (6 cols) */}
              <div className="lg:col-span-6 space-y-3">
                <div className="text-xs font-semibold text-slate-600">
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
                            ? 'bg-indigo-50/70 border-indigo-600 shadow-sm'
                            : 'bg-white border-slate-200 hover:border-slate-300 shadow-2xs'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-[11px] font-bold text-blue-600">
                            {ticket.ID_Tiket}
                          </span>
                          <span className="text-[11px] text-amber-700 font-semibold font-mono">
                            Target: {ticket.Target_Selesai}
                          </span>
                        </div>

                        <h4 className="text-xs font-bold text-slate-900 line-clamp-1">
                          {ticket.Proyek}
                        </h4>

                        <div className="text-[11px] text-slate-600 mt-1 flex items-center justify-between">
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
                  <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                      <div>
                        <div className="text-[11px] font-mono text-indigo-600 font-bold">
                          FORMULIR DISPOSISI RESMI
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 mt-0.5">
                          {currentTicket.Proyek}
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => onSelectTicketDetail(currentTicket)}
                        className="p-1.5 text-slate-500 hover:text-slate-900 rounded-lg hover:bg-slate-100 transition-colors"
                        title="Lihat Detail Lengkap"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                      <div>
                        <span className="text-slate-500 text-[10px]">Pemohon:</span>
                        <div className="text-slate-900 font-semibold">{currentTicket.Peminta}</div>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px]">Target Selesai:</span>
                        <div className="text-emerald-700 font-mono font-bold">{currentTicket.Target_Selesai}</div>
                      </div>
                      <div className="col-span-2 pt-1.5 border-t border-slate-200">
                        <span className="text-slate-500 text-[10px]">Dokumen yang Diminta:</span>
                        <div className="text-slate-800 font-medium">{currentTicket.Dokumen}</div>
                      </div>
                      {currentTicket.File_Pendukung && currentTicket.File_Pendukung !== '-' && (
                        <div className="col-span-2 pt-1.5 border-t border-slate-200 flex items-center justify-between">
                          <span className="text-slate-500 text-[10px]">Lampiran Pemohon:</span>
                          <button
                            type="button"
                            onClick={() => downloadFile(currentTicket.File_Pendukung.split('||')[0]?.trim() || currentTicket.File_Pendukung, {
                              proyek: currentTicket.Proyek,
                              idTiket: currentTicket.ID_Tiket,
                              dokumen: currentTicket.Dokumen
                            })}
                            className="inline-flex items-center gap-1 text-[11px] font-mono text-blue-600 hover:text-blue-800 font-semibold underline"
                          >
                            <Download className="w-3 h-3" />
                            <span>{currentTicket.File_Pendukung.split('||')[0]?.trim()}</span>
                          </button>
                        </div>
                      )}
                    </div>

                    <form onSubmit={handleDisposisi} className="space-y-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Delegasikan Tugas ini Kepada Staf: <span className="text-rose-500">*</span>
                        </label>
                        <select
                          value={selectedStaff || staffList[0]}
                          onChange={(e) => setSelectedStaff(e.target.value)}
                          className="w-full px-3.5 py-2.5 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-indigo-600 font-medium"
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
                        <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                          Catatan & Instruksi Khusus Manager:
                        </label>
                        <textarea
                          rows={3}
                          value={catatanManager}
                          onChange={(e) => setCatatanManager(e.target.value)}
                          placeholder="e.g. Prioritaskan kalkulasi momen lentur dan koordinasikan dengan tim marketing esok hari..."
                          className="w-full p-3 text-xs bg-white border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-indigo-600"
                        />
                      </div>

                      <div className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl text-[11px] text-slate-700 flex items-start gap-2">
                        <Send className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <div>
                          Status tiket akan otomatis berubah menjadi <strong className="text-indigo-700">DISPOSISI</strong> dan modal WhatsApp akan muncul untuk mengirim instruksi langsung ke staf.
                        </div>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-2.5 px-4 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm shadow-indigo-600/20 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
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
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
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
                <tbody className="divide-y divide-slate-200">
                  {deptTickets.map(ticket => (
                    <tr key={ticket.ID_Tiket} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-blue-600">{ticket.ID_Tiket}</td>
                      <td className="px-4 py-3 font-semibold text-slate-900 max-w-xs truncate">{ticket.Proyek}</td>
                      <td className="px-4 py-3 text-slate-700">{ticket.Peminta}</td>
                      <td className="px-4 py-3 text-slate-800 font-medium">
                        {ticket.Staff_Tujuan !== '-' ? ticket.Staff_Tujuan : <span className="text-slate-400">-</span>}
                      </td>
                      <td className="px-4 py-3 font-mono text-slate-600">{ticket.Target_Selesai}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          ticket.Status_Pengerjaan === 'OPEN'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : ticket.Status_Pengerjaan === 'CLOSED (Selesai)'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-blue-50 text-blue-700 border border-blue-200'
                        }`}>
                          {ticket.Status_Pengerjaan}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={() => onSelectTicketDetail(ticket)}
                          className="px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:text-white bg-blue-50 hover:bg-blue-600 border border-blue-200 hover:border-blue-600 rounded-lg transition-colors"
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
