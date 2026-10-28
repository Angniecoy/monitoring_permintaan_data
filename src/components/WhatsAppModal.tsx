import React, { useState } from 'react';
import { MessageSquare, Send, Copy, Check, X, ExternalLink } from 'lucide-react';
import { WhatsAppNotificationPayload } from '../types';

interface WhatsAppModalProps {
  payload: WhatsAppNotificationPayload | null;
  onClose: () => void;
}

export const WhatsAppModal: React.FC<WhatsAppModalProps> = ({ payload, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!payload) return null;

  const waLink = `https://wa.me/${payload.wa}?text=${encodeURIComponent(payload.pesan)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(payload.pesan);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header with WhatsApp green accent */}
        <div className="flex items-center justify-between px-6 py-4 bg-emerald-950/40 border-b border-emerald-900/40">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">Notifikasi WhatsApp Otomatis</h3>
              <p className="text-xs text-emerald-400/90">ID Tiket: <span className="font-mono">{payload.id}</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div className="p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/50 text-xs flex items-center justify-between">
            <span className="text-slate-400">Penerima Pesan:</span>
            <span className="font-semibold text-white">
              {payload.target_name} ({payload.target_role})
            </span>
          </div>

          <div className="p-3.5 bg-slate-800/60 rounded-xl border border-slate-700/50 text-xs flex items-center justify-between">
            <span className="text-slate-400">Nomor WhatsApp:</span>
            <span className="font-mono text-emerald-400 font-medium">+{payload.wa || 'Belum diisi'}</span>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              Draft Pesan WhatsApp:
            </label>
            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
              {payload.pesan}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 px-6 py-4 bg-slate-900/90 border-t border-slate-800">
          <button
            type="button"
            onClick={handleCopy}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-xl border border-slate-700 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Tersalin!' : 'Salin Pesan'}
          </button>

          {payload.wa ? (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-lg shadow-emerald-950/40 transition-all active:scale-[0.98]"
            >
              <Send className="w-4 h-4" />
              <span>Buka WhatsApp</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </a>
          ) : (
            <button
              disabled
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-medium text-slate-500 bg-slate-800/40 rounded-xl border border-slate-800 cursor-not-allowed"
            >
              Nomor WhatsApp Tidak Ada
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
