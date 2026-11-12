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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg max-h-[92dvh] bg-white border border-slate-200 rounded-2xl shadow-xl flex flex-col overflow-hidden">
        {/* Header with WhatsApp green accent */}
        <div className="flex items-center justify-between gap-2 px-4 py-3.5 sm:px-6 sm:py-4 bg-emerald-50/70 border-b border-emerald-200">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-100 text-emerald-700 border border-emerald-200 shrink-0">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">Notifikasi WhatsApp Otomatis</h3>
              <p className="text-xs text-emerald-700 font-medium truncate">ID Tiket: <span className="font-mono font-bold">{payload.id}</span></p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-white rounded-lg transition-colors shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-4 sm:p-6 space-y-3.5 sm:space-y-4 overflow-y-auto">
          <div className="p-3 sm:p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="text-slate-600 shrink-0">Penerima Pesan:</span>
            <span className="font-semibold text-slate-900 sm:text-right break-words">
              {payload.target_name} ({payload.target_role})
            </span>
          </div>

          <div className="p-3 sm:p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="text-slate-600 shrink-0">Nomor WhatsApp:</span>
            <span className="font-mono text-emerald-700 font-bold sm:text-right break-all">+{payload.wa || 'Belum diisi'}</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Draft Pesan WhatsApp:
            </label>
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono text-slate-800 whitespace-pre-wrap break-words leading-relaxed max-h-48 overflow-y-auto">
              {payload.pesan}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-2.5 px-6 py-4 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            onClick={handleCopy}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 rounded-xl border border-slate-300 transition-colors"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Tersalin!' : 'Salin Pesan'}
          </button>

          {payload.wa ? (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={onClose}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-sm shadow-emerald-600/20 transition-all active:scale-[0.98]"
            >
              <Send className="w-4 h-4" />
              <span>Buka WhatsApp</span>
              <ExternalLink className="w-3.5 h-3.5 opacity-80" />
            </a>
          ) : (
            <button
              disabled
              className="w-full sm:w-auto px-4 py-2.5 text-xs font-medium text-slate-400 bg-slate-100 rounded-xl border border-slate-200 cursor-not-allowed"
            >
              Nomor WhatsApp Tidak Ada
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
