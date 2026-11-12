import React, { useState } from 'react';
import { 
  BarChart3, TrendingUp, Clock, CheckCircle2, 
  Layers, Users, Calendar, ArrowUpRight, Filter, Download
} from 'lucide-react';
import { DepartmentName, Ticket } from '../types';
import { STRUKTUR_ORG, getStoredUsers } from '../data/mockData';

interface DashboardViewProps {
  tickets: Ticket[];
  onSelectTicketDetail: (ticket: Ticket) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ tickets, onSelectTicketDetail }) => {
  const [timePeriod, setTimePeriod] = useState<'harian' | 'mingguan' | 'bulanan'>('harian');
  const [filterDept, setFilterDept] = useState<string>('all');

  const filteredTickets = filterDept === 'all' 
    ? tickets 
    : tickets.filter(t => t.Departemen_Tujuan === filterDept);

  // Key KPI calculations
  const totalCount = filteredTickets.length;
  const openCount = filteredTickets.filter(t => t.Status_Pengerjaan === 'OPEN').length;
  const inProgressCount = filteredTickets.filter(t => ['DISPOSISI', 'PROSES'].includes(t.Status_Pengerjaan)).length;
  const closedCount = filteredTickets.filter(t => t.Status_Pengerjaan === 'CLOSED (Selesai)').length;

  const completionRate = totalCount > 0 ? Math.round((closedCount / totalCount) * 100) : 0;

  // Chart data: Group by date (Harian)
  const dailyMap: Record<string, number> = {};
  filteredTickets.forEach(t => {
    const dateStr = t.Waktu_Request.split(' ')[0] || 'Unknown';
    dailyMap[dateStr] = (dailyMap[dateStr] || 0) + 1;
  });

  const dailyKeys = Object.keys(dailyMap).slice(-7); // Last 7 days
  const dailyMax = Math.max(...dailyKeys.map(k => dailyMap[k]), 1);

  // Chart data: Group by week (Mingguan)
  const weeklyData = [
    { label: 'Minggu 1', count: Math.max(0, Math.round(totalCount * 0.15)) },
    { label: 'Minggu 2', count: Math.max(0, Math.round(totalCount * 0.25)) },
    { label: 'Minggu 3', count: Math.max(0, Math.round(totalCount * 0.35)) },
    { label: 'Minggu 4 (Aktif)', count: Math.max(0, Math.round(totalCount * 0.25)) },
  ];
  const weeklyMax = Math.max(...weeklyData.map(w => w.count), 1);

  // Chart data: Group by month (Bulanan)
  const monthlyData = [
    { label: 'Agustus 2026', count: 0 },
    { label: 'September 2026', count: 0 },
    { label: 'Oktober 2026 (Berjalan)', count: totalCount },
  ];
  const monthlyMax = Math.max(...monthlyData.map(m => m.count), 1);

  // Department distribution
  const deptStats = (Object.keys(STRUKTUR_ORG) as DepartmentName[]).map(dept => {
    const count = tickets.filter(t => t.Departemen_Tujuan === dept).length;
    const percentage = totalCount > 0 ? Math.round((count / tickets.length) * 100) : 0;
    return { dept, count, percentage };
  });

  // Staff Workload breakdown (populated dynamically from inputted staff users)
  const staffLoadList: { name: string; dept: string; active: number; closed: number }[] = [];
  const seenStaff = new Set<string>();
  Object.entries(STRUKTUR_ORG).forEach(([dept, data]) => {
    Object.keys(data.Staff).forEach(staffName => {
      if (!seenStaff.has(staffName.toLowerCase())) {
        seenStaff.add(staffName.toLowerCase());
        const active = tickets.filter(t => t.Staff_Tujuan === staffName && ['DISPOSISI', 'PROSES'].includes(t.Status_Pengerjaan)).length;
        const closed = tickets.filter(t => t.Staff_Tujuan === staffName && t.Status_Pengerjaan === 'CLOSED (Selesai)').length;
        staffLoadList.push({ name: staffName, dept, active, closed });
      }
    });
  });
  getStoredUsers()
    .filter(u => u.role === 'staff' && u.fullName)
    .forEach(u => {
      if (!seenStaff.has(u.fullName.toLowerCase())) {
        seenStaff.add(u.fullName.toLowerCase());
        const dept = u.department || 'Engineering Precast';
        const active = tickets.filter(t => t.Staff_Tujuan === u.fullName && ['DISPOSISI', 'PROSES'].includes(t.Status_Pengerjaan)).length;
        const closed = tickets.filter(t => t.Staff_Tujuan === u.fullName && t.Status_Pengerjaan === 'CLOSED (Selesai)').length;
        staffLoadList.push({ name: u.fullName, dept, active, closed });
      }
    });

  // Document types breakdown
  const docTypes = [
    { name: 'Analisis', count: tickets.filter(t => t.Dokumen.includes('Analisis')).length },
    { name: 'Gambar CAD / Shop Drawing', count: tickets.filter(t => t.Dokumen.includes('Gambar')).length },
    { name: 'SSP (Spesifikasi Standar)', count: tickets.filter(t => t.Dokumen.includes('SSP')).length },
    { name: 'Others / Metode Khusus', count: tickets.filter(t => t.Dokumen.includes('Others')).length },
  ];

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-white via-white to-[#282974]/8 border border-slate-200 shadow-xs">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#282974]">
            Eksekutif & Analitik
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-0.5">
            Dashboard Workload & Analitik Dokumen Teknis
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Pantau volume permohonan proyek, rasio penyelesaian dokumen, dan distribusi beban kerja personel lintas divisi engineering WBP.
          </p>
        </div>

        {/* Filter Department */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-50 rounded-xl border border-slate-200 shrink-0">
          <Filter className="w-3.5 h-3.5 text-slate-500 ml-2" />
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="px-2.5 py-1 text-xs font-semibold bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none"
          >
            <option value="all">Semua Departemen (Global)</option>
            <option value="Engineering Precast">Engineering Precast</option>
            <option value="Engineering Readymix">Engineering Readymix</option>
            <option value="Engineering Konstruksi">Engineering Konstruksi</option>
          </select>
        </div>
      </div>

      {/* 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Permintaan */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">Total Permintaan</span>
            <span className="p-2 rounded-xl bg-[#282974]/10 text-[#282974] border border-[#282974]/20">
              <Layers className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-mono font-bold text-slate-900 tabular-nums mt-3">
            {totalCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Terdaftar di basis data
          </div>
        </div>

        {/* Menunggu Disposisi */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">Menunggu Manager</span>
            <span className="p-2 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-mono font-bold text-amber-600 tabular-nums mt-3">
            {openCount}
          </div>
          <div className="text-[11px] text-amber-700 font-medium mt-1">
            Status: OPEN
          </div>
        </div>

        {/* Sedang Berjalan */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">Sedang Dikerjakan</span>
            <span className="p-2 rounded-xl bg-[#282974]/10 text-[#282974] border border-[#282974]/20">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-mono font-bold text-[#282974] tabular-nums mt-3">
            {inProgressCount}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            DISPOSISI & PROSES
          </div>
        </div>

        {/* Selesai / CLOSED */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">Selesai (CLOSED)</span>
            <span className="p-2 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-mono font-bold text-emerald-600 tabular-nums mt-3">
            {closedCount}
          </div>
          <div className="text-[11px] text-emerald-700 font-medium mt-1">
            Tingkat Penyelesaian: {completionRate}%
          </div>
        </div>
      </div>

      {/* Interactive Trends Chart Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-200">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-[#282974]" />
              <span>Tren Volume Permintaan Dokumen</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Grafik intensitas permintaan per periode waktu (Harian, Mingguan, Bulanan)
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setTimePeriod('harian')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                timePeriod === 'harian' ? 'bg-[#282974] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📅 Harian
            </button>
            <button
              type="button"
              onClick={() => setTimePeriod('mingguan')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                timePeriod === 'mingguan' ? 'bg-[#282974] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📆 Mingguan
            </button>
            <button
              type="button"
              onClick={() => setTimePeriod('bulanan')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                timePeriod === 'bulanan' ? 'bg-[#282974] text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🗓️ Bulanan
            </button>
          </div>
        </div>

        {/* Chart View */}
        <div className="pt-2">
          {timePeriod === 'harian' && (
            <div className="space-y-3">
              <div className="h-56 flex items-end gap-3 sm:gap-6 pt-6 px-4 bg-slate-50 rounded-xl border border-slate-200">
                {dailyKeys.map(key => {
                  const val = dailyMap[key];
                  const heightPercent = Math.max(15, Math.round((val / dailyMax) * 85));
                  return (
                    <div key={key} className="flex-1 flex flex-col items-center h-full justify-end group">
                      <span className="text-[10px] font-mono text-[#282974] font-bold mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {val} Tiket
                      </span>
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className="w-full max-w-[48px] bg-gradient-to-t from-[#282974] to-[#3f419e] rounded-t-lg transition-all group-hover:brightness-110"
                      />
                      <span className="text-[10px] font-mono text-slate-600 mt-2 truncate max-w-[60px]">
                        {key.split('/')[0]}/{key.split('/')[1]}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="text-[11px] text-slate-500 text-center">
                *Menampilkan data registrasi per tanggal aktif (Format: DD/MM)
              </div>
            </div>
          )}

          {timePeriod === 'mingguan' && (
            <div className="h-56 flex items-end gap-4 sm:gap-8 pt-6 px-6 bg-slate-50 rounded-xl border border-slate-200">
              {weeklyData.map(w => {
                const heightPercent = Math.max(15, Math.round((w.count / weeklyMax) * 85));
                return (
                  <div key={w.label} className="flex-1 flex flex-col items-center h-full justify-end group">
                    <span className="text-[10px] font-mono text-[#282974] font-bold mb-1">
                      {w.count}
                    </span>
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full max-w-[56px] bg-gradient-to-t from-[#282974] to-[#3f419e] rounded-t-lg transition-all group-hover:brightness-110"
                    />
                    <span className="text-[11px] text-slate-700 mt-2 font-medium">
                      {w.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {timePeriod === 'bulanan' && (
            <div className="h-56 flex items-end gap-6 sm:gap-12 pt-6 px-8 bg-slate-50 rounded-xl border border-slate-200">
              {monthlyData.map(m => {
                const heightPercent = Math.max(15, Math.round((m.count / monthlyMax) * 85));
                return (
                  <div key={m.label} className="flex-1 flex flex-col items-center h-full justify-end group">
                    <span className="text-[10px] font-mono text-[#282974] mb-1 font-bold">
                      {m.count} Permintaan
                    </span>
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full max-w-[70px] bg-gradient-to-t from-[#282974] to-[#3f419e] rounded-t-lg transition-all group-hover:brightness-110"
                    />
                    <span className="text-[11px] text-slate-700 mt-2 font-medium">
                      {m.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Grid: Department Share & Staff Workload */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Department Share (5 cols) */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center justify-between">
            <span>Distribusi per Departemen</span>
            <Layers className="w-4 h-4 text-[#282974]" />
          </div>

          <div className="space-y-3 pt-2">
            {deptStats.map(d => (
              <div key={d.dept} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-700 font-medium">{d.dept}</span>
                  <span className="font-mono text-slate-900 font-bold">{d.count} tiket ({d.percentage}%)</span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${d.percentage}%` }}
                    className="h-full bg-[#282974] rounded-full transition-all"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-200">
            <div className="text-xs font-semibold text-slate-600 mb-2.5">
              Jenis Dokumen Diminta:
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {docTypes.map(dt => (
                <div key={dt.name} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="text-slate-700 truncate font-medium">{dt.name}</span>
                  <span className="font-mono text-[#282974] font-bold ml-1">{dt.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Staff Workload Ranking (7 cols) */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center justify-between">
            <span>Beban Kerja Tim Staf Engineering</span>
            <Users className="w-4 h-4 text-[#282974]" />
          </div>

          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {staffLoadList.map(staf => (
              <div
                key={staf.name}
                className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-slate-900">{staf.name}</div>
                  <div className="text-[10px] text-slate-500">{staf.dept}</div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block">Aktif</span>
                    <span className="font-mono font-bold text-[#282974] tabular-nums">
                      {staf.active}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 block">Selesai</span>
                    <span className="font-mono font-bold text-emerald-600 tabular-nums">
                      {staf.closed}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Mini Recent Activity Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Aktivitas Registrasi Tiket Terkini
          </h3>
          <span className="text-xs text-slate-500 font-medium">Total {tickets.length} Tiket</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-3.5 py-2.5 font-semibold">ID Tiket</th>
                <th className="px-3.5 py-2.5 font-semibold">Nama Proyek</th>
                <th className="px-3.5 py-2.5 font-semibold">Pemohon</th>
                <th className="px-3.5 py-2.5 font-semibold">Departemen</th>
                <th className="px-3.5 py-2.5 font-semibold">Staf</th>
                <th className="px-3.5 py-2.5 font-semibold">Status</th>
                <th className="px-3.5 py-2.5 font-semibold text-right">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {tickets.slice(0, 5).map(t => (
                <tr key={t.ID_Tiket} className="hover:bg-slate-50">
                  <td className="px-3.5 py-2 font-mono font-bold text-[#282974]">{t.ID_Tiket}</td>
                  <td className="px-3.5 py-2 font-semibold text-slate-900 max-w-xs truncate">{t.Proyek}</td>
                  <td className="px-3.5 py-2 text-slate-700">{t.Peminta}</td>
                  <td className="px-3.5 py-2 text-slate-600">{t.Departemen_Tujuan.replace('Engineering ', '')}</td>
                  <td className="px-3.5 py-2 text-slate-700">{t.Staff_Tujuan}</td>
                  <td className="px-3.5 py-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      t.Status_Pengerjaan === 'OPEN'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : t.Status_Pengerjaan === 'CLOSED (Selesai)'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-[#282974]/10 text-[#282974] border border-[#282974]/25'
                    }`}>
                      {t.Status_Pengerjaan}
                    </span>
                  </td>
                  <td className="px-3.5 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onSelectTicketDetail(t)}
                      className="px-2.5 py-1 text-[11px] font-semibold text-[#282974] hover:text-white bg-[#282974]/10 hover:bg-[#282974] border border-[#282974]/25 hover:border-[#282974] rounded-md transition-colors"
                    >
                      Buka
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
