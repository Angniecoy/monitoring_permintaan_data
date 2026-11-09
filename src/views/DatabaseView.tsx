import React, { useState } from 'react';
import { 
  Database, Search, Filter, Download, RotateCcw, 
  Eye, CheckCircle2, Clock, ArrowRight, FileSpreadsheet, Sparkles
} from 'lucide-react';
import { DepartmentName, Ticket, TicketStatus } from '../types';

interface DatabaseViewProps {
  tickets: Ticket[];
  onResetData: () => void;
  onSelectTicketDetail: (ticket: Ticket) => void;
}

export const DatabaseView: React.FC<DatabaseViewProps> = ({
  tickets,
  onResetData,
  onSelectTicketDetail
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [deptFilter, setDeptFilter] = useState<string>('all');

  const filteredTickets = tickets.filter(t => {
    const matchesSearch = 
      t.ID_Tiket.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.Proyek.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.Peminta.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.SO.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.Kode_Proyek.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus = statusFilter === 'all' || t.Status_Pengerjaan === statusFilter;
    const matchesDept = deptFilter === 'all' || t.Departemen_Tujuan === deptFilter;

    return matchesSearch && matchesStatus && matchesDept;
  });

  // Export to CSV functionality
  const handleExportCSV = () => {
    if (tickets.length === 0) return;

    const headers = [
      "ID_Tiket", "Waktu_Request", "Peminta", "WA_Peminta", "SO",
      "Pemasukan_Penawaran", "Tujuan_Permintaan", "Kode_Proyek", "Proyek", "Lokasi",
      "Jenis_Produk", "Dimensi", "Dokumen", "Departemen_Tujuan", "Manager_Tujuan", "WA_Manager",
      "Staff_Tujuan", "WA_Staff", "Target_Selesai", "Status_Pengerjaan", 
      "Keterangan_Penerima", "File_Pendukung", "File_Hasil", "Aktual_Selesai"
    ];

    const rows = filteredTickets.map(t => [
      `"${t.ID_Tiket}"`,
      `"${t.Waktu_Request}"`,
      `"${t.Peminta}"`,
      `"${t.WA_Peminta}"`,
      `"${t.SO}"`,
      `"${t.Pemasukan_Penawaran}"`,
      `"${t.Tujuan_Permintaan}"`,
      `"${t.Kode_Proyek}"`,
      `"${t.Proyek.replace(/"/g, '""')}"`,
      `"${t.Lokasi}"`,
      `"${t.Jenis_Produk}"`,
      `"${t.Dimensi}"`,
      `"${t.Dokumen}"`,
      `"${t.Departemen_Tujuan}"`,
      `"${t.Manager_Tujuan}"`,
      `"${t.WA_Manager}"`,
      `"${t.Staff_Tujuan}"`,
      `"${t.WA_Staff}"`,
      `"${t.Target_Selesai}"`,
      `"${t.Status_Pengerjaan}"`,
      `"${t.Keterangan_Penerima.replace(/"/g, '""')}"`,
      `"${t.File_Pendukung}"`,
      `"${t.File_Hasil}"`,
      `"${t.Aktual_Selesai}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `WBP_REKAP_DOKUMEN_TEKNIS_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-white via-white to-[#282974]/8 border border-slate-200 shadow-xs">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-[#282974]">
            Basis Data & Rekapitulasi
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight mt-0.5">
            Arsip & Database Tiket Terintegrasi
          </h1>
          <p className="text-xs text-slate-600 mt-1">
            Data terstruktur 24 kolom sinkron dengan format Google Sheets resmi WBP. Filter multi-kriteria dan ekspor instan ke CSV / Microsoft Excel.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={onResetData}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors"
            title="Reset data ke tiket bawaan"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Demo</span>
          </button>

          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm shadow-emerald-600/20 transition-all active:scale-[0.98]"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Ekspor ke CSV</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-5 relative">
            <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari ID tiket, proyek, SO, pemohon..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder-slate-400 focus:outline-none focus:border-[#282974] focus:bg-white font-sans"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-[#282974] focus:bg-white font-medium"
            >
              <option value="all">Semua Status</option>
              <option value="OPEN">Status: OPEN</option>
              <option value="DISPOSISI">Status: DISPOSISI</option>
              <option value="PROSES">Status: PROSES</option>
              <option value="CLOSED (Selesai)">Status: CLOSED (Selesai)</option>
            </select>
          </div>

          <div className="md:col-span-4">
            <select
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:border-[#282974] focus:bg-white font-medium"
            >
              <option value="all">Semua Departemen</option>
              <option value="Engineering Precast">Engineering Precast</option>
              <option value="Engineering Readymix">Engineering Readymix</option>
              <option value="Engineering Konstruksi">Engineering Konstruksi</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600">
          <span>Menampilkan <strong className="text-slate-900">{filteredTickets.length}</strong> dari <strong className="text-slate-900">{tickets.length}</strong> data dokumen</span>
          <span className="text-[11px] text-slate-500">Kolom tabular presisi standar ISO WBP</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 select-none">
              <tr>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">ID Tiket</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Waktu</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Proyek</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Peminta</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">SO</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Departemen</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Staf</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Target</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap">Status</th>
                <th className="px-4 py-3 font-semibold whitespace-nowrap text-right">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredTickets.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-slate-500">
                    Tidak ada tiket yang cocok dengan kriteria pencarian.
                  </td>
                </tr>
              ) : (
                filteredTickets.map(t => (
                  <tr key={t.ID_Tiket} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 font-mono font-bold text-[#282974] whitespace-nowrap">
                      {t.ID_Tiket}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600 whitespace-nowrap">
                      {t.Waktu_Request.split(' ')[0]}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900 max-w-xs truncate" title={t.Proyek}>
                      {t.Proyek}
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      {t.Peminta}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-600 whitespace-nowrap">
                      {t.SO}
                    </td>
                    <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                      {t.Departemen_Tujuan.replace('Engineering ', '')}
                    </td>
                    <td className="px-4 py-3 text-slate-800 font-medium whitespace-nowrap">
                      {t.Staff_Tujuan !== '-' ? t.Staff_Tujuan : <span className="text-slate-400">-</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700 whitespace-nowrap">
                      {t.Target_Selesai}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
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
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onSelectTicketDetail(t)}
                        className="px-2.5 py-1 text-[11px] font-semibold text-[#282974] hover:text-white bg-[#282974]/10 hover:bg-[#282974] border border-[#282974]/25 hover:border-[#282974] rounded-lg transition-colors inline-flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Lihat</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
