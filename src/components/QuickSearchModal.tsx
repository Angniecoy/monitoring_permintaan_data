import React, { useState } from 'react';
import { Search, X, FileText, ArrowRight } from 'lucide-react';
import { Ticket } from '../types';

interface QuickSearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  tickets: Ticket[];
  onSelectTicket: (ticket: Ticket) => void;
}

export const QuickSearchModal: React.FC<QuickSearchModalProps> = ({
  isOpen,
  onClose,
  tickets,
  onSelectTicket
}) => {
  const [query, setQuery] = useState('');

  if (!isOpen) return null;

  const matches = tickets.filter(t => 
    t.ID_Tiket.toLowerCase().includes(query.toLowerCase()) ||
    t.Proyek.toLowerCase().includes(query.toLowerCase()) ||
    t.Peminta.toLowerCase().includes(query.toLowerCase()) ||
    t.SO.toLowerCase().includes(query.toLowerCase()) ||
    t.Kode_Proyek.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-20 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3 border-b border-slate-800 bg-slate-950">
          <Search className="w-4 h-4 text-slate-400 mr-3 shrink-0" />
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari ID tiket, nama proyek, atau pemohon..."
            className="w-full bg-transparent text-sm text-white placeholder-slate-500 focus:outline-none font-sans"
          />
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 divide-y divide-slate-800/60">
          {matches.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-500">
              Tidak ada hasil yang cocok dengan &quot;{query}&quot;
            </div>
          ) : (
            matches.map(ticket => (
              <div
                key={ticket.ID_Tiket}
                onClick={() => {
                  onSelectTicket(ticket);
                  onClose();
                }}
                className="flex items-center justify-between p-3 rounded-xl hover:bg-slate-800/60 cursor-pointer transition-colors group"
              >
                <div className="min-w-0 pr-3">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="font-mono text-xs font-bold text-blue-400">
                      {ticket.ID_Tiket}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                      {ticket.Status_Pengerjaan}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-white truncate">
                    {ticket.Proyek}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {ticket.Departemen_Tujuan} · Pemohon: {ticket.Peminta}
                  </div>
                </div>

                <ArrowRight className="w-4 h-4 text-slate-600 group-hover:text-blue-400 shrink-0 transition-colors" />
              </div>
            ))
          )}
        </div>

        <div className="p-2.5 bg-slate-950 border-t border-slate-800 text-[10px] text-slate-500 flex justify-between">
          <span>Menampilkan {matches.length} hasil</span>
          <span>Tekan ESC atau klik luar untuk menutup</span>
        </div>
      </div>
    </div>
  );
};
