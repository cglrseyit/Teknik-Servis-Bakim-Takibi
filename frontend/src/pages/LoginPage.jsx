import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Loader2, CheckCircle2, Settings2, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const FEATURES = [
  { label: 'Bakım Planları', desc: 'Periyodik görev otomasyonu ve takvim yönetimi' },
  { label: 'Anlık Bildirimler', desc: 'Geciken ve yaklaşan görevler için uyarı sistemi' },
  { label: 'Detaylı Raporlama', desc: 'Grafik analiz ve denetim kayıtları' },
];

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

      {/* ── Sol Panel — Marka ── */}
      <div className="hidden lg:flex flex-col justify-between w-[420px] flex-shrink-0 bg-[#0f1117] p-10 relative overflow-hidden">
        {/* Arka plan dekorasyon */}
        <div className="absolute top-0 right-0 w-72 h-72 bg-amber-600/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-56 h-56 bg-indigo-600/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-3xl pointer-events-none" />

        {/* Logo */}
        <div className="flex items-center gap-3 relative z-10">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-lg shadow-amber-700/40">
            <Settings2 size={16} className="text-white" strokeWidth={2.2} />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-white tracking-tight">Teknik Bakım</p>
            <p className="text-[11px] text-slate-500">Takip Sistemi v2.0</p>
          </div>
        </div>

        {/* Hero */}
        <div className="relative z-10">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-amber-400 mb-4">
            Tesis Yönetimi
          </p>
          <h1 className="text-3xl font-bold text-white leading-tight mb-4">
            Ekipmanlarınızı<br />tam kontrolde<br />tutun.
          </h1>
          <p className="text-slate-400 text-[14px] leading-relaxed mb-10">
            Bakım planları, görev takibi ve anlık raporlarla tesisinizin operasyonel sürekliliğini sağlayın.
          </p>

          <div className="space-y-4">
            {FEATURES.map(f => (
              <div key={f.label} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-amber-500/15 flex items-center justify-center mt-0.5 flex-shrink-0 ring-1 ring-amber-500/20">
                  <CheckCircle2 size={13} className="text-amber-400" />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-slate-200">{f.label}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-[11px] text-slate-600 relative z-10">© 2026 Teknik Bakım Takip</p>
      </div>

      {/* ── Sağ Panel — Form ── */}
      <div className="flex-1 flex items-center justify-center p-8 bg-[#f5f6fa]">
        <div className="w-full max-w-[360px]">

          {/* Mobil logo */}
          <div className="flex items-center gap-2.5 mb-8 lg:hidden">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-md shadow-amber-600/30">
              <Settings2 size={14} className="text-white" />
            </div>
            <p className="text-[14px] font-semibold text-slate-800">Teknik Bakım Takip</p>
          </div>

          {/* Başlık */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Hoş geldiniz</h1>
            <p className="text-slate-500 text-sm mt-1.5">Hesabınıza erişmek için giriş yapın</p>
          </div>

          {/* Hata */}
          {error && (
            <div className="mb-5 px-4 py-3 bg-red-50 border border-red-200/80 text-red-600 text-sm rounded-xl flex items-center gap-2.5">
              <AlertCircle size={15} className="flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">

            {/* E-posta */}
            <div>
              <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">E-posta</label>
              <div className="relative">
                <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm({ ...form, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-[14px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500 transition-all shadow-sm"
                  placeholder="ornek@sirket.com"
                />
              </div>
            </div>

            {/* Şifre */}
            <div>
              <label className="block text-[13px] font-semibold text-slate-700 mb-1.5">Şifre</label>
              <div className="relative">
                <Lock size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  className="w-full pl-10 pr-11 py-2.5 bg-white border border-slate-200 rounded-xl text-[14px] text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500 transition-all shadow-sm"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors p-0.5"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white py-2.5 rounded-xl text-[14px] font-semibold transition-all shadow-md shadow-amber-600/20 hover:shadow-lg hover:shadow-amber-600/30 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  Giriş yapılıyor...
                </>
              ) : (
                'Giriş Yap'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
