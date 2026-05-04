import { useEffect, useRef, useState } from 'react';
import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  Home, Wrench, ClipboardList, BarChart3,
  Users, Bell, LogOut, User, X
} from 'lucide-react';
import Badge from './Badge';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';

const NAV = [
  { to: '/dashboard', label: 'Bakım Takvimi', Icon: Home,          roles: ['admin', 'teknik_muduru', 'order_taker'] },
  { to: '/equipment', label: 'Ekipmanlar',    Icon: Wrench,        roles: ['admin', 'teknik_muduru', 'order_taker'] },
  { to: '/plans',     label: 'Bakım Planları', Icon: ClipboardList, roles: ['admin', 'teknik_muduru', 'order_taker'] },
  { to: '/reports',   label: 'Raporlar',      Icon: BarChart3,     roles: ['admin', 'teknik_muduru', 'order_taker'] },
  { to: '/users',     label: 'Kullanıcılar',  Icon: Users,         roles: ['admin'] },
];

const PAGE_TITLES = {
  '/dashboard': 'Bakım Takvimi',
  '/equipment': 'Ekipmanlar',
  '/plans':     'Bakım Planları',
  '/reports':   'Raporlar',
  '/users':     'Kullanıcılar',
};

const ROLE_LABELS  = { admin: 'Admin', teknik_muduru: 'Teknik Müdürü', order_taker: 'Order Taker' };
const ROLE_VARIANT = { admin: 'primary', teknik_muduru: 'warning', order_taker: 'success' };
const TYPE_COLORS  = { overdue: 'text-red-500', reminder: 'text-amber-500' };
const TYPE_ICONS   = { overdue: '⚠', reminder: '🔔' };

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState([]);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const unread = notifications.filter(n => !n.is_read).length;
  const pageTitle = PAGE_TITLES[location.pathname] ?? 'Sayfa';

  function loadNotifications() {
    api.get('/notifications').then(r => setNotifications(r.data)).catch(() => {});
  }

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleOpen() {
    setOpen(o => !o);
    if (!open && unread > 0) {
      api.put('/notifications/read-all')
        .then(() => setNotifications(n => n.map(x => ({ ...x, is_read: true }))))
        .catch(() => {});
    }
  }

  function handleLogout() {
    logout();
    navigate('/login');
  }

  const visibleNav = NAV.filter(n => n.roles.includes(user?.role));

  return (
    <div className="flex h-screen w-full bg-[#FAF7F0] overflow-hidden">

      {/* ── Sidebar ── */}
      <aside className="w-64 h-screen bg-white border-r border-amber-100/80 flex flex-col flex-shrink-0 shadow-[1px_0_3px_rgba(184,146,74,0.04)]">

        {/* Logo */}
        <div className="px-3 py-4 border-b border-amber-100/70 flex-shrink-0 flex items-center justify-center bg-gradient-to-b from-amber-50/40 to-transparent">
          <img
            src="/bellis-logo-dark.png"
            alt="Bellis Deluxe Hotel"
            className="h-20 w-auto max-w-full object-contain"
            onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextSibling.style.display = 'block'; }}
          />
          <div style={{ display: 'none' }} className="text-center">
            <h1 className="text-lg font-bold tracking-[0.25em] text-amber-700 leading-tight">BELLIS</h1>
            <p className="text-[9px] tracking-[0.3em] text-amber-600/80 mt-0.5">DELUXE HOTEL</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          <p className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-amber-700/60">Menü</p>
          {visibleNav.map(({ to, label, Icon, notifs }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `relative w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all text-sm font-medium group ${
                  isActive
                    ? 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md shadow-amber-600/25'
                    : 'text-slate-600 hover:bg-amber-50 hover:text-amber-800'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={isActive ? 2.2 : 1.7} />
                  <span className="flex-1 text-left">{label}</span>
                  {notifs && (
                    <span className={`text-[11px] font-bold rounded-full min-w-5 h-5 px-1.5 flex items-center justify-center ${
                      isActive ? 'bg-white/25 text-white' : 'bg-red-500 text-white'
                    }`}>
                      {notifs}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User Profile */}
        <div className="p-3 border-t border-amber-100/70 flex-shrink-0 bg-gradient-to-t from-amber-50/40 to-transparent">
          <div className="flex items-center gap-3 px-2 py-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center flex-shrink-0 ring-2 ring-white shadow-sm">
              <User className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-800 truncate leading-tight">{user?.name}</p>
              <Badge variant={ROLE_VARIANT[user?.role] || 'secondary'} appearance="light">
                {ROLE_LABELS[user?.role]}
              </Badge>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3.5 py-2 mt-1 rounded-xl text-slate-500 hover:bg-red-50 hover:text-red-600 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">Çıkış Yap</span>
          </button>
        </div>
      </aside>

      {/* ── Main Area ── */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Header */}
        <header className="h-16 bg-white border-b border-amber-100/70 flex items-center justify-between px-6 flex-shrink-0">
          <div>
            <h2 className="text-[17px] font-bold text-slate-900 leading-tight">{pageTitle}</h2>
            <p className="text-xs text-slate-500 mt-0.5">Hoş geldiniz, {user?.name?.split(' ')[0]}</p>
          </div>
          <div className="relative" ref={ref}>
            <button
              onClick={handleOpen}
              className="relative p-2.5 rounded-xl hover:bg-amber-50 transition-colors"
            >
              <Bell className="w-5 h-5 text-slate-600" />
              {unread > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center ring-2 ring-white">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>

            {open && (
              <div className="absolute right-0 mt-2 w-[340px] bg-white rounded-2xl shadow-xl shadow-amber-900/10 border border-amber-100 z-50 overflow-hidden animate-modal-in">
                <div className="px-4 py-3 border-b border-amber-100/70 flex items-center justify-between bg-gradient-to-r from-amber-50/60 to-transparent">
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4 text-amber-600" />
                    <p className="text-[13px] font-semibold text-slate-800">Bildirimler</p>
                    {unread > 0 && (
                      <span className="text-[10px] font-semibold text-white bg-red-500 px-1.5 py-0.5 rounded-full">
                        {unread}
                      </span>
                    )}
                  </div>
                  <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="max-h-80 overflow-y-auto divide-y divide-amber-50">
                  {notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                      <Bell className="w-7 h-7 mb-2 opacity-30" />
                      <p className="text-sm">Bildirim yok</p>
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        onClick={() => {
                          setOpen(false);
                          if (n.task_id) navigate('/dashboard?task=' + n.task_id);
                        }}
                        className={`px-4 py-3 transition-colors cursor-pointer ${
                          n.is_read ? 'bg-white hover:bg-amber-50/50' : 'bg-amber-50/40 hover:bg-amber-50/80'
                        }`}
                      >
                        <div className="flex gap-2.5">
                          <span className="text-sm mt-0.5 flex-shrink-0">{TYPE_ICONS[n.type]}</span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-[13px] font-medium leading-snug ${TYPE_COLORS[n.type] || 'text-slate-700'}`}>
                              {n.message}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-2">
                              {new Date(n.sent_at).toLocaleDateString('tr-TR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                              {n.task_id && <span className="text-amber-700 font-medium">Göreve git →</span>}
                            </p>
                          </div>
                          {!n.is_read && <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
