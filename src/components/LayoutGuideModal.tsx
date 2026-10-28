import React from 'react';
import { X, CheckCircle2, ArrowRight, Smartphone, LayoutGrid, Zap, ShieldAlert, Sparkles, Layers } from 'lucide-react';

interface LayoutGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LayoutGuideModal: React.FC<LayoutGuideModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-800/80 border-b border-slate-700/80">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Rekomendasi & Rationale Layout Profesional
              </h3>
              <p className="text-xs text-slate-400">
                Transformasi dari Form Streamlit Tradisional ke Enterprise Workflow Platform
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-300">
          {/* Comparison Banner */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-rose-950/20 border border-rose-900/40">
              <div className="flex items-center gap-2 text-rose-400 font-semibold text-xs mb-2">
                <ShieldAlert className="w-4 h-4" /> Masalah Layout Awal (Streamlit)
              </div>
              <ul className="text-xs space-y-1.5 text-slate-400 list-disc list-inside">
                <li>Background foto gelap + teks putih berbayang tebal melelahkan mata.</li>
                <li>Form 20+ kolom memanjang ke bawah tanpa pembagian tahapan kognitif.</li>
                <li>Pelacakan tiket mengharuskan mengingat & memilih ID di dropdown acak.</li>
                <li>Manager tidak bisa melihat berapa beban tugas aktif tiap staf saat delegasi.</li>
                <li>Chart analitik berupa gambar statis Matplotlib tanpa interaksi hover.</li>
              </ul>
            </div>

            <div className="p-4 rounded-xl bg-emerald-950/20 border border-emerald-900/40">
              <div className="flex items-center gap-2 text-emerald-400 font-semibold text-xs mb-2">
                <CheckCircle2 className="w-4 h-4" /> Solusi Layout Baru (Enterprise WBP)
              </div>
              <ul className="text-xs space-y-1.5 text-slate-300 list-disc list-inside">
                <li>Industrial Slate & Blueprint Navy: kontras tinggi, bersih, dan elegan.</li>
                <li>Form Stepper 3-Langkah: data proyek → spek teknis → berkas lampiran.</li>
                <li>Visual Status Pipeline & Progress Stepper interaktif per tiket.</li>
                <li>Workload Balancer: Manager tahu beban staf secara real-time.</li>
                <li>WhatsApp Dispatcher dengan preview teks dan tombol salin instan.</li>
              </ul>
            </div>
          </div>

          {/* 5 Core Layout Principles */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold tracking-wider text-slate-400 uppercase">
              5 Prinsip Desain Layout yang Diterapkan:
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700/60">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center mb-3">
                  <Layers className="w-4 h-4" />
                </div>
                <h5 className="font-semibold text-white text-xs mb-1">1. Progressive Disclosure</h5>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Data teknis yang kompleks dipecah ke dalam tab dan accordion. Pengguna hanya melihat informasi yang relevan pada peran mereka.
                </p>
              </div>

              <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700/60">
                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center mb-3">
                  <LayoutGrid className="w-4 h-4" />
                </div>
                <h5 className="font-semibold text-white text-xs mb-1">2. Two-Column Desktop Grid</h5>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Pada layar monitor desktop, formulir di sisi kiri dipasangkan dengan <em>Live Ticket Preview Card</em> di sisi kanan untuk memverifikasi input.
                </p>
              </div>

              <div className="p-4 bg-slate-800/40 rounded-xl border border-slate-700/60">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center mb-3">
                  <Smartphone className="w-4 h-4" />
                </div>
                <h5 className="font-semibold text-white text-xs mb-1">3. WhatsApp Direct Bridge</h5>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Integrasi tautan WhatsApp tidak lagi sekadar teks polos, melainkan disajikan dalam modal pop-up dengan template pesan profesional.
                </p>
              </div>
            </div>
          </div>

          {/* Visual Architecture Diagram */}
          <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800">
            <h5 className="text-xs font-semibold text-white mb-2.5 flex items-center gap-2">
              <Zap className="w-4 h-4 text-blue-400" /> Alur Lifecycle Tiket dalam Layout Baru
            </h5>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-3 py-1.5 rounded-lg bg-slate-800 text-slate-300 font-mono">
                1. Sales Request (OPEN)
              </span>
              <ArrowRight className="w-4 h-4 text-slate-600 shrink-0" />
              <span className="px-3 py-1.5 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/30 font-mono">
                2. Manager Disposisi
              </span>
              <ArrowRight className="w-4 h-4 text-slate-600 shrink-0" />
              <span className="px-3 py-1.5 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/30 font-mono">
                3. Staff Eksekusi (PROSES)
              </span>
              <ArrowRight className="w-4 h-4 text-slate-600 shrink-0" />
              <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-mono">
                4. Selesai (CLOSED)
              </span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 bg-slate-800/60 border-t border-slate-700/80">
          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-500 rounded-xl transition-colors"
          >
            Mengerti, Lanjutkan ke Aplikasi
          </button>
        </div>
      </div>
    </div>
  );
};
