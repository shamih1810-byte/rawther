import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { Shield, Lock, User, AlertCircle, ArrowRight, Utensils, ChefHat } from 'lucide-react';
import { loginApi, setAuthSession, clearAuthSession, getAuthRole, getAuthToken } from '../api';
import { RESTAURANT_CONFIG } from '../config';

export default function Login() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const portalParam = searchParams.get('portal');
  const redirectPath = searchParams.get('redirect');

  // Determine portal from query or redirect
  const [portal, setPortal] = useState(() => {
    if (portalParam === 'admin' || redirectPath === '/admin') return 'admin';
    return 'kitchen';
  });

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  // Sync portal if query changes
  useEffect(() => {
    if (portalParam === 'admin' || redirectPath === '/admin') {
      setPortal('admin');
    } else if (portalParam === 'kitchen' || redirectPath === '/kitchen') {
      setPortal('kitchen');
    }
  }, [portalParam, redirectPath]);

  const handlePortalSwitch = (newPortal) => {
    setPortal(newPortal);
    setErrorMsg('');
    setUsername('');
    setPassword('');
    const newParams = new URLSearchParams(searchParams);
    newParams.set('portal', newPortal);
    if (newPortal === 'admin') {
      newParams.set('redirect', '/admin');
    } else {
      newParams.set('redirect', '/kitchen');
    }
    setSearchParams(newParams);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const data = await loginApi(username.trim(), password);

      if (portal === 'admin') {
        // STRICT SECURITY: Only admin role can enter Admin Panel
        if (data.role !== 'admin') {
          clearAuthSession();
          setErrorMsg('Access Denied: Staff accounts cannot access the Owner & Admin Control Panel. Administrator credentials required.');
          return;
        }
        setAuthSession(data.access_token, data.role, data.username);
        navigate('/admin');
      } else {
        // Kitchen portal: strictly navigates to Kitchen
        setAuthSession(data.access_token, data.role, data.username);
        navigate('/kitchen');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Incorrect username or password');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-bg-deep flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-sm bg-bg-card rounded-3xl border border-gold/30 shadow-2xl p-6 sm:p-7 relative">
        {/* Portal Switcher Tabs */}
        <div className="grid grid-cols-2 p-1 bg-bg-surface/90 rounded-2xl border border-gold/20 mb-6 shadow-inner">
          <button
            type="button"
            onClick={() => handlePortalSwitch('kitchen')}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 duration-150 ${
              portal === 'kitchen'
                ? 'bg-gradient-to-r from-white via-slate-100 to-white text-bg-deep shadow-gold-glow font-extrabold'
                : 'text-cream-muted hover:text-cream'
            }`}
          >
            <ChefHat className="w-4 h-4" />
            <span>Kitchen</span>
          </button>
          <button
            type="button"
            onClick={() => handlePortalSwitch('admin')}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 duration-150 ${
              portal === 'admin'
                ? 'bg-gradient-to-r from-white via-slate-100 to-white text-bg-deep shadow-gold-glow font-extrabold'
                : 'text-cream-muted hover:text-cream'
            }`}
          >
            <Shield className="w-4 h-4" />
            <span>Owner Admin</span>
          </button>
        </div>

        {/* Restaurant Crest & Portal Identity */}
        <div className="text-center mb-5">
          <img
            src={RESTAURANT_CONFIG.logoUrl || "/rawther_logo.jpg"}
            alt={RESTAURANT_CONFIG.restaurantName}
            className="w-16 h-16 sm:w-20 sm:h-20 rounded-full object-cover border-2 border-gold/60 mx-auto mb-2.5 shadow-gold-glow"
          />
          <h1 className="font-serif font-extrabold text-xl sm:text-2xl text-gold tracking-wide">
            {RESTAURANT_CONFIG.restaurantName}
          </h1>

          {portal === 'admin' ? (
            <div className="mt-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-white border border-white/30 uppercase tracking-wider">
                <Shield className="w-3 h-3" /> Owner & Admin Portal
              </span>
              <p className="text-[11px] text-cream-muted mt-1">
                Restricted access. Menu, prices & table management.
              </p>
            </div>
          ) : (
            <div className="mt-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#87A96B]/20 text-[#87A96B] border border-[#87A96B]/40 uppercase tracking-wider">
                <ChefHat className="w-3 h-3" /> Kitchen Staff Portal
              </span>
              <p className="text-[11px] text-cream-muted mt-1">
                Live tickets display & kitchen order preparation.
              </p>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 rounded-xl bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs flex items-start gap-2 animate-pop">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span className="leading-tight">{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <div>
            <label className="block text-xs font-semibold text-cream-muted mb-1">
              {portal === 'admin' ? 'Administrator Username' : 'Staff / Chef Username'}
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-gold/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={portal === 'admin' ? "Enter admin username" : "Enter staff username"}
                required
                className="w-full bg-bg-surface border border-gold/25 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-cream placeholder-cream-dim focus:outline-none focus:border-gold transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-cream-muted mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gold/70 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full bg-bg-surface border border-gold/25 rounded-xl pl-10 pr-3.5 py-2.5 text-xs sm:text-sm text-cream placeholder-cream-dim focus:outline-none focus:border-gold transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-white via-slate-100 to-white hover:brightness-105 text-bg-deep font-extrabold text-xs uppercase tracking-wider shadow-gold-glow flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer"
          >
            {loading ? (
              <span>Authenticating...</span>
            ) : portal === 'admin' ? (
              <>
                <span>Sign In to Admin Panel</span>
                <ArrowRight className="w-4 h-4" />
              </>
            ) : (
              <>
                <span>Sign In to Kitchen Display</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-5 pt-4 border-t border-gold/15 text-center">
          <Link
            to="/menu"
            className="text-xs text-cream-dim hover:text-gold transition-colors inline-flex items-center justify-center gap-1 py-1"
          >
            <Utensils className="w-3.5 h-3.5" />
            <span>Return to Customer Menu</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
