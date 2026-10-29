import React, { useState } from 'react';
import { X, QrCode, AlertCircle, CheckCircle2, ArrowRight } from 'lucide-react';
import { validateTableApi } from '../api';

export default function ManualTableModal({
  isOpen,
  onClose,
  initialTable = '',
  initialToken = '',
  onTableSet
}) {
  const [tableInput, setTableInput] = useState(initialTable || '');
  const [tokenInput, setTokenInput] = useState(initialToken || '');
  const [errorMsg, setErrorMsg] = useState('');
  const [isValidating, setIsValidating] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    const tableNum = parseInt(tableInput, 10);
    if (isNaN(tableNum) || tableNum <= 0) {
      setErrorMsg('Please enter a valid table number (e.g. 1 to 10)');
      return;
    }

    setIsValidating(true);
    setErrorMsg('');

    try {
      const res = await validateTableApi(tableNum, tokenInput.trim() || undefined);
      if (!res.exists) {
        setErrorMsg(`Table ${tableNum} was not found. Please verify with floor staff.`);
        setIsValidating(false);
        return;
      }

      // Automatically use the active token from the server
      const finalToken = res.token || tokenInput.trim() || '30e22f77';
      onTableSet(tableNum, finalToken);
      onClose();
    } catch (err) {
      setErrorMsg(err.message || 'Validation failed. Please check network connection.');
    } finally {
      setIsValidating(false);
    }
  };

  const DEMO_TABLES = [
    { num: 1, tok: '30e22f77' },
    { num: 2, tok: 'dea428d6' },
    { num: 7, tok: '8ff582c6' },
    { num: 10, tok: '8b94744a' }
  ];

  const TABLE_TOKENS = {
    1: '30e22f77',
    2: 'dea428d6',
    3: 'd179f486',
    4: '1ab56c1e',
    5: '50c791a4',
    6: 'c58db83b',
    7: '8ff582c6',
    8: 'f0211066',
    9: '90388afa',
    10: '8b94744a'
  };

  const handleTableInputChange = (val) => {
    setTableInput(val);
    setErrorMsg('');
    const parsed = parseInt(val, 10);
    // Auto-fill token if known dining table
    if (TABLE_TOKENS[parsed]) {
      setTokenInput(TABLE_TOKENS[parsed]);
    } else if (val === '') {
      setTokenInput('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-sm bg-bg-card rounded-3xl border border-gold/30 shadow-2xl p-6 relative animate-slide-up">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-bg-surface flex items-center justify-center text-cream-muted hover:text-cream border border-gold/15"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center mb-5">
          <div className="w-12 h-12 rounded-2xl bg-gold/15 border border-gold/30 text-gold flex items-center justify-center mx-auto mb-3 shadow-gold-glow">
            <QrCode className="w-6 h-6" />
          </div>
          <h2 className="font-serif font-bold text-xl text-cream">
            Select Dining Table
          </h2>
          <p className="text-xs text-cream-muted mt-1 leading-relaxed">
            Enter your table number or select below to order.
          </p>
        </div>

        {/* Quick Demo Table Chips */}
        <div className="mb-4">
          <div className="text-[11px] font-semibold text-cream-muted mb-1.5 flex items-center justify-between">
            <span>Quick Select Table:</span>
            <span className="text-[10px] text-gold/70">auto-applies token</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {DEMO_TABLES.map((t) => {
              const isSelected = tableInput === String(t.num) && tokenInput === t.tok;
              return (
                <button
                  key={t.num}
                  type="button"
                  onClick={() => {
                    setTableInput(String(t.num));
                    setTokenInput(t.tok);
                    setErrorMsg('');
                  }}
                  className={`py-1.5 px-1 rounded-xl text-xs font-bold border transition-all ${
                    isSelected
                      ? 'bg-gold text-bg-card border-gold shadow-gold-glow'
                      : 'bg-bg-surface/80 text-cream-muted border-gold/20 hover:border-gold/50 hover:text-cream'
                  }`}
                >
                  Table {t.num}
                </button>
              );
            })}
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/80 border border-rose-500/30 text-rose-200 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-cream-muted mb-1">
              Table Number
            </label>
            <input
              type="number"
              min="1"
              max="999"
              value={tableInput}
              onChange={(e) => handleTableInputChange(e.target.value)}
              placeholder="e.g. 7"
              required
              className="w-full bg-bg-surface border border-gold/25 rounded-xl px-3.5 py-2.5 text-sm font-bold text-cream placeholder-cream-dim focus:outline-none focus:border-gold"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-cream-muted mb-1">
              Security Token
            </label>
            <input
              type="text"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              placeholder="e.g. 8ff582c6"
              className="w-full bg-bg-surface border border-gold/25 rounded-xl px-3.5 py-2.5 text-sm text-cream placeholder-cream-dim focus:outline-none focus:border-gold font-mono"
            />
            <p className="text-[11px] text-cream-dim mt-1">
              Each dining table QR stand has a unique secure token (e.g. Table 7 token is <code className="text-gold font-mono">8ff582c6</code>).
            </p>
          </div>

          <button
            type="submit"
            disabled={isValidating}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-white via-slate-100 to-white hover:brightness-105 text-bg-deep font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-gold-glow transition-all"
          >
            {isValidating ? (
              <span>Validating Table...</span>
            ) : (
              <>
                <span>Confirm Table</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
