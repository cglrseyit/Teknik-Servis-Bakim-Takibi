import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import bellisLogo from '/bellis-logo-dark.png';

const API_BASE = import.meta.env.VITE_API_URL ?? '/api';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/stats`)
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data) setStats(data); })
      .catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(form.email, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'E-posta veya şifre hatalı');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex bg-white">

      {/* ── Sol Panel ── */}
      <div className="hidden lg:flex flex-col w-[460px] flex-shrink-0 bg-[#0d0e12] relative overflow-hidden">

        {/* Nokta grid arka plan */}
        <div
          className="absolute inset-0 opacity-100"
          style={{
            backgroundImage: 'radial-gradient(circle, rgba(251,191,36,0.07) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />
        {/* Atmosfer gradyanları */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_-10%,_rgba(180,83,9,0.18)_0%,_transparent_100%)]" />
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-[#0d0e12] to-transparent" />

        {/* Sağ kenar çizgisi */}
        <div className="absolute top-0 right-0 bottom-0 w-px bg-gradient-to-b from-transparent via-amber-600/20 to-transparent" />

        {/* Logo */}
        <div className="relative z-10 px-10 pt-10">
          <img
            src={bellisLogo}
            alt="Bellis Deluxe Hotel"
            className="h-14 object-contain object-left"
          />
        </div>

        {/* Ana içerik */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-10">

          {/* Büyük oran görseli */}
          <div className="mb-8">
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-[80px] font-black text-white leading-none tracking-[-3px]">
                {stats ? stats.completion_rate : '—'}
              </span>
              {stats && <span className="text-amber-400/50 text-[28px] font-bold leading-none mb-1">/100</span>}
            </div>
            <p className="text-slate-400 text-[12.5px] mb-4 tracking-wide">bakım skoru</p>
            <div className="h-[3px] bg-slate-800/80 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-amber-700 via-amber-500 to-amber-300 rounded-full transition-all duration-1000"
                style={{ width: stats ? `${stats.completion_rate}%` : '0%' }}
              />
            </div>
          </div>

          {/* İkincil stat kartları */}
          <div className="grid grid-cols-2 gap-3 mb-12">
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
              <p className="text-[30px] font-bold text-white leading-none tracking-tight">
                {stats ? stats.completed_tasks.toLocaleString('tr-TR') : '—'}
              </p>
              <p className="text-slate-500 text-[11px] mt-2 leading-snug">tamamlanan<br />bakım görevi</p>
            </div>
            <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-4">
              <div className="flex items-center gap-1.5 mb-3">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="text-[10px] text-emerald-400 font-medium uppercase tracking-wider">Aktif</span>
              </div>
              <p className="text-[30px] font-bold text-white leading-none tracking-tight">
                {stats ? stats.active_equipment : '—'}
              </p>
              <p className="text-slate-500 text-[11px] mt-2 leading-snug">ekipman<br />takipte</p>
            </div>
          </div>

          {/* İnsan gibi tagline */}
          <div>
            <div className="w-7 h-[2px] bg-amber-500/50 mb-5 rounded-full" />
            <p className="text-slate-300 text-[17px] font-light leading-[1.6]">
              Misafir gülümserken,
            </p>
            <p className="text-white text-[17px] font-semibold leading-[1.6]">
              biz zaten hazır olmuştuk.
            </p>
          </div>
        </div>

        {/* Alt bilgi */}
        <div className="relative z-10 px-10 pb-8">
          <div className="h-px bg-gradient-to-r from-amber-600/20 via-amber-600/5 to-transparent mb-5" />
          <p className="text-[11px] text-slate-600">
            © {new Date().getFullYear()} Bellis Deluxe Hotel · Teknik Servis Sistemi
          </p>
        </div>
      </div>

      {/* ── Sağ Panel — Form ── */}
      <div className="flex-1 flex flex-col bg-[#f7f8fc]">

        {/* Mobil header */}
        <div className="flex items-center px-8 pt-8 pb-0 lg:hidden">
          <img src={bellisLogo} alt="Bellis Deluxe Hotel" className="h-10 object-contain" />
        </div>

        <div className="flex-1 flex items-center justify-center p-8">
          <div className="w-full max-w-[380px]">

            {/* Başlık */}
            <div className="mb-8">
              <h1 className="text-[24px] font-bold text-slate-900 tracking-tight">
                Hoş geldiniz
              </h1>
              <p className="text-slate-500 text-[13.5px] mt-1.5">
                Devam etmek için hesabınıza giriş yapın
              </p>
            </div>

            {/* Hata mesajı */}
            {error && (
              <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200 text-red-600 text-[13px] rounded-xl flex items-center gap-2.5">
                <AlertCircle size={14} className="flex-shrink-0" />
                {error}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* E-posta */}
              <div>
                <label className="block text-[12.5px] font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  E-posta
                </label>
                <div className="relative">
                  <Mail size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type="email"
                    required
                    autoComplete="email"
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-[13.5px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-sm"
                    placeholder="ornek@bellis.com.tr"
                  />
                </div>
              </div>

              {/* Şifre */}
              <div>
                <label className="block text-[12.5px] font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">
                  Şifre
                </label>
                <div className="relative">
                  <Lock size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    autoComplete="current-password"
                    value={form.password}
                    onChange={e => setForm({ ...form, password: e.target.value })}
                    className="w-full pl-10 pr-11 py-3 bg-white border border-slate-200 rounded-xl text-[13.5px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all shadow-sm"
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-amber-600 hover:bg-amber-700 active:scale-[0.99] text-white py-3 rounded-xl text-[13.5px] font-semibold transition-all shadow-lg shadow-amber-600/20 hover:shadow-amber-600/35 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 size={14} className="animate-spin" />
                      Giriş yapılıyor...
                    </>
                  ) : (
                    'Giriş Yap'
                  )}
                </button>
              </div>
            </form>

            {/* Alt not */}
            <p className="text-center text-[11.5px] text-slate-400 mt-8">
              Hesap erişimi için sistem yöneticinize başvurun.
            </p>

            {/* Geliştirici imzası */}
            <p className="text-center text-[10.5px] text-slate-300 mt-6 tracking-wide">
              Tasarım & Geliştirme · <span className="text-slate-400 font-medium">Seyit Çağlar</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
