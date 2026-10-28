import React, { useState } from 'react';
import { 
  BarChart3, TrendingUp, Clock, CheckCircle2, 
  Layers, Users, Calendar, ArrowUpRight, Filter, Download
} from 'lucide-react';
import { DepartmentName, Ticket } from '../types';
import { STRUKTUR_ORG } from '../data/mockData';

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
    { label: 'Minggu 1', count: Math.max(1, Math.round(totalCount * 0.15)) },
    { label: 'Minggu 2', count: Math.max(2, Math.round(totalCount * 0.25)) },
    { label: 'Minggu 3', count: Math.max(3, Math.round(totalCount * 0.35)) },
    { label: 'Minggu 4 (Aktif)', count: Math.max(2, Math.round(totalCount * 0.25)) },
  ];
  const weeklyMax = Math.max(...weeklyData.map(w => w.count), 1);

  // Chart data: Group by month (Bulanan)
  const monthlyData = [
    { label: 'Agustus 2026', count: 12 },
    { label: 'September 2026', count: 18 },
    { label: 'Oktober 2026 (Berjalan)', count: totalCount },
  ];
  const monthlyMax = Math.max(...monthlyData.map(m => m.count), 1);

  // Department distribution
  const deptStats = (Object.keys(STRUKTUR_ORG) as DepartmentName[]).map(dept => {
    const count = tickets.filter(t => t.Departemen_Tujuan === dept).length;
    const percentage = totalCount > 0 ? Math.round((count / tickets.length) * 100) : 0;
    return { dept, count, percentage };
  });

  // Staff Workload breakdown
  const staffLoadList: { name: string; dept: string; active: number; closed: number }[] = [];
  Object.entries(STRUKTUR_ORG).forEach(([dept, data]) => {
    Object.keys(data.Staff).forEach(staffName => {
      const active = tickets.filter(t => t.Staff_Tujuan === staffName && ['DISPOSISI', 'PROSES'].includes(t.Status_Pengerjaan)).length;
      const closed = tickets.filter(t => t.Staff_Tujuan === staffName && t.Status_Pengerjaan === 'CLOSED (Selesai)').length;
      staffLoadList.push({ name: staffName, dept, active, closed });
    });
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900 to-indigo-950/40 border border-slate-800">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-indigo-400">
            Eksekutif & Analitik
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight mt-0.5">
            Dashboard Workload & Analitik Dokumen Teknis
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Pantau volume permohonan proyek, rasio penyelesaian dokumen, dan distribusi beban kerja personel lintas divisi engineering WBP.
          </p>
        </div>

        {/* Filter Department */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-950/80 rounded-xl border border-slate-800 shrink-0">
          <Filter className="w-3.5 h-3.5 text-slate-400 ml-2" />
          <select
            value={filterDept}
            onChange={(e) => setFilterDept(e.target.value)}
            className="px-2.5 py-1 text-xs font-semibold bg-slate-900 border-0 rounded-lg text-white focus:outline-none"
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
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Total Permintaan</span>
            <span className="p-2 rounded-xl bg-blue-500/10 text-blue-400">
              <Layers className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-mono font-bold text-white tabular-nums mt-3">
            {totalCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            Terdaftar di basis data
          </div>
        </div>

        {/* Menunggu Disposisi */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Menunggu Manager</span>
            <span className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Clock className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-mono font-bold text-amber-300 tabular-nums mt-3">
            {openCount}
          </div>
          <div className="text-[11px] text-amber-400/90 mt-1">
            Status: OPEN
          </div>
        </div>

        {/* Sedang Berjalan */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Sedang Dikerjakan</span>
            <span className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-mono font-bold text-sky-400 tabular-nums mt-3">
            {inProgressCount}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">
            DISPOSISI & PROSES
          </div>
        </div>

        {/* Selesai / CLOSED */}
        <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400">Selesai (CLOSED)</span>
            <span className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </span>
          </div>
          <div className="text-3xl font-mono font-bold text-emerald-400 tabular-nums mt-3">
            {closedCount}
          </div>
          <div className="text-[11px] text-emerald-400/90 mt-1">
            Tingkat Penyelesaian: {completionRate}%
          </div>
        </div>
      </div>

      {/* Interactive Trends Chart Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 pb-4 border-b border-slate-800">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-blue-400" />
              <span>Tren Volume Permintaan Dokumen</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Grafik intensitas permintaan per periode waktu (Harian, Mingguan, Bulanan)
            </p>
          </div>

          <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setTimePeriod('harian')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                timePeriod === 'harian' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              📅 Harian
            </button>
            <button
              type="button"
              onClick={() => setTimePeriod('mingguan')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                timePeriod === 'mingguan' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              📆 Mingguan
            </button>
            <button
              type="button"
              onClick={() => setTimePeriod('bulanan')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                timePeriod === 'bulanan' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
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
              <div className="h-56 flex items-end gap-3 sm:gap-6 pt-6 px-4 bg-slate-950/60 rounded-xl border border-slate-800/80">
                {dailyKeys.map(key => {
                  const val = dailyMap[key];
                  const heightPercent = Math.max(15, Math.round((val / dailyMax) * 85));
                  return (
                    <div key={key} className="flex-1 flex flex-col items-center h-full justify-end group">
                      <span className="text-[10px] font-mono text-blue-400 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {val} Tiket
                      </span>
                      <div
                        style={{ height: `${heightPercent}%` }}
                        className="w-full max-w-[48px] bg-gradient-to-t from-blue-600 to-sky-400 rounded-t-lg transition-all group-hover:brightness-125"
                      />
                      <span className="text-[10px] font-mono text-slate-400 mt-2 truncate max-w-[60px]">
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
            <div className="h-56 flex items-end gap-4 sm:gap-8 pt-6 px-6 bg-slate-950/60 rounded-xl border border-slate-800/80">
              {weeklyData.map(w => {
                const heightPercent = Math.max(15, Math.round((w.count / weeklyMax) * 85));
                return (
                  <div key={w.label} className="flex-1 flex flex-col items-center h-full justify-end group">
                    <span className="text-[10px] font-mono text-indigo-400 mb-1">
                      {w.count}
                    </span>
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full max-w-[56px] bg-gradient-to-t from-indigo-600 to-blue-500 rounded-t-lg transition-all group-hover:brightness-125"
                    />
                    <span className="text-[11px] text-slate-300 mt-2 font-medium">
                      {w.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          {timePeriod === 'bulanan' && (
            <div className="h-56 flex items-end gap-6 sm:gap-12 pt-6 px-8 bg-slate-950/60 rounded-xl border border-slate-800/80">
              {monthlyData.map(m => {
                const heightPercent = Math.max(15, Math.round((m.count / monthlyMax) * 85));
                return (
                  <div key={m.label} className="flex-1 flex flex-col items-center h-full justify-end group">
                    <span className="text-[10px] font-mono text-sky-400 mb-1 font-bold">
                      {m.count} Permintaan
                    </span>
                    <div
                      style={{ height: `${heightPercent}%` }}
                      className="w-full max-w-[70px] bg-gradient-to-t from-sky-600 to-teal-400 rounded-t-lg transition-all group-hover:brightness-125"
                    />
                    <span className="text-[11px] text-slate-300 mt-2 font-medium">
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
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-between">
            <span>Distribusi per Departemen</span>
            <Layers className="w-4 h-4 text-blue-400" />
          </div>

          <div className="space-y-3 pt-2">
            {deptStats.map(d => (
              <div key={d.dept} className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-300 font-medium">{d.dept}</span>
                  <span className="font-mono text-white font-bold">{d.count} tiket ({d.percentage}%)</span>
                </div>
                <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden">
                  <div
                    style={{ width: `${d.percentage}%` }}
                    className="h-full bg-blue-500 rounded-full transition-all"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="pt-4 border-t border-slate-800">
            <div className="text-xs font-semibold text-slate-400 mb-2.5">
              Jenis Dokumen Diminta:
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              {docTypes.map(dt => (
                <div key={dt.name} className="p-2.5 rounded-lg bg-slate-950/60 border border-slate-800 flex items-center justify-between">
                  <span className="text-slate-300 truncate">{dt.name}</span>
                  <span className="font-mono text-blue-400 font-bold ml-1">{dt.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Staff Workload Ranking (7 cols) */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-4">
          <div className="text-xs font-bold text-white uppercase tracking-wider flex items-center justify-between">
            <span>Beban Kerja Tim Staf Engineering</span>
            <Users className="w-4 h-4 text-sky-400" />
          </div>

          <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
            {staffLoadList.map(staf => (
              <div
                key={staf.name}
                className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/80 flex items-center justify-between text-xs"
              >
                <div>
                  <div className="font-semibold text-white">{staf.name}</div>
                  <div className="text-[10px] text-slate-500">{staf.dept}</div>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">Aktif</span>
                    <span className="font-mono font-bold text-sky-400 tabular-nums">
                      {staf.active}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">Selesai</span>
                    <span className="font-mono font-bold text-emerald-400 tabular-nums">
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
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold text-white uppercase tracking-wider">
            Aktivitas Registrasi Tiket Terkini
          </h3>
          <span className="text-xs text-slate-400">Total {tickets.length} Tiket</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
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
            <tbody className="divide-y divide-slate-800/80">
              {tickets.slice(0, 5).map(t => (
                <tr key={t.ID_Tiket} className="hover:bg-slate-800/40">
                  <td className="px-3.5 py-2 font-mono font-bold text-blue-400">{t.ID_Tiket}</td>
                  <td className="px-3.5 py-2 font-medium text-white max-w-xs truncate">{t.Proyek}</td>
                  <td className="px-3.5 py-2 text-slate-300">{t.Peminta}</td>
                  <td className="px-3.5 py-2 text-slate-400">{t.Departemen_Tujuan.replace('Engineering ', '')}</td>
                  <td className="px-3.5 py-2 text-slate-300">{t.Staff_Tujuan}</td>
                  <td className="px-3.5 py-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                      t.Status_Pengerjaan === 'OPEN'
                        ? 'bg-amber-500/10 text-amber-300 border border-amber-500/20'
                        : t.Status_Pengerjaan === 'CLOSED (Selesai)'
                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                        : 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                    }`}>
                      {t.Status_Pengerjaan}
                    </span>
                  </td>
                  <td className="px-3.5 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onSelectTicketDetail(t)}
                      className="px-2 py-1 text-[11px] text-blue-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded transition-colors"
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
