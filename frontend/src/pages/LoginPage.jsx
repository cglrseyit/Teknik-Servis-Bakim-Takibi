import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle, ShieldCheck, BarChart3, Bell } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import bellisLogo from '/bellis-logo-dark.png';

const FEATURES = [
  {
    icon: ShieldCheck,
    label: 'Bakım Planları',
    desc: 'Periyodik görev otomasyonu ve takvim yönetimi',
  },
  {
    icon: Bell,
    label: 'Anlık Bildirimler',
    desc: 'Geciken ve yaklaşan görevler için uyarı sistemi',
  },
  {
    icon: BarChart3,
    label: 'Detaylı Raporlama',
    desc: 'Grafik analiz ve denetim kayıtları',
  },
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

      {/* ── Sol Panel ── */}
      <div className="hidden lg:flex flex-col w-[460px] flex-shrink-0 bg-[#0d0e12] relative overflow-hidden">

        {/* Dekoratif arka plan */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_#92400e22_0%,_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_#1e1b4b18_0%,_transparent_60%)]" />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-amber-600/30 to-transparent" />

        {/* İnce altın çizgi sol kenar */}
        <div className="absolute top-0 right-0 bottom-0 w-px bg-gradient-to-b from-transparent via-amber-600/20 to-transparent" />

        {/* Logo — sol üst */}
        <div className="relative z-10 px-10 pt-10">
          <img
            src={bellisLogo}
            alt="Bellis Deluxe Hotel"
            className="h-14 object-contain object-left"
          />
        </div>

        {/* Divider */}
        <div className="relative z-10 mx-10 mt-8 mb-0 h-px bg-gradient-to-r from-amber-600/40 via-amber-600/10 to-transparent" />

        {/* Orta içerik */}
        <div className="relative z-10 flex-1 flex flex-col justify-center px-10 py-12">
          <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] text-amber-500 mb-5">
            Teknik Servis Yönetimi
          </span>

          <h2 className="text-[28px] font-bold text-white leading-[1.3] mb-4">
            Tesisinizin bakımını<br />
            <span className="text-amber-400">tam kontrol altında</span><br />
            tutun.
          </h2>

          <p className="text-slate-400 text-[13.5px] leading-relaxed mb-10 max-w-[300px]">
            Bakım planları, görev takibi ve anlık raporlarla operasyonel sürekliliği sağlayın.
          </p>

          <div className="space-y-5">
            {FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-4">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Icon size={14} className="text-amber-400" strokeWidth={1.8} />
                </div>
                <div>
                  <p className="text-[13px] font-semibold text-slate-200">{label}</p>
                  <p className="text-[11.5px] text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Alt bilgi */}
        <div className="relative z-10 px-10 pb-8">
          <div className="h-px bg-gradient-to-r from-amber-600/20 via-amber-600/5 to-transparent mb-6" />
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
          </div>
        </div>
      </div>
    </div>
  );
}
