import { useEffect, useState } from 'react';
import { Plus, X, User, Mail, Lock, Shield, Trash2, AlertCircle, Pencil, ToggleLeft, ToggleRight } from 'lucide-react';
import Layout from '../components/Layout';
import ConfirmModal from '../components/ConfirmModal';
import api from '../api/axios';

const ROLES = [
  { value: 'admin',         label: 'Admin' },
  { value: 'teknik_muduru', label: 'Teknik Müdürü' },
  { value: 'order_taker',   label: 'Order Taker' },
];
const ROLE_CONFIG = {
  admin:         { bg: 'bg-purple-50',  text: 'text-purple-700',  dot: 'bg-purple-500' },
  teknik_muduru: { bg: 'bg-sky-50',     text: 'text-sky-700',     dot: 'bg-sky-500' },
  order_taker:   { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
};

const INPUT_CLS = "w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500 transition-all shadow-sm";
const SELECT_CLS = "w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500/25 focus:border-amber-500 transition-all shadow-sm appearance-none";

function FieldWrap({ icon: Icon, children }) {
  return (
    <div className="relative">
      <Icon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
      {children}
    </div>
  );
}

const EMPTY_FORM = { name: '', email: '', password: '', role: 'order_taker', is_active: true };

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    api.get('/users').then(r => setUsers(r.data)).catch(() => {});
  }, []);

  function set(field) { return e => setForm(f => ({ ...f, [field]: e.target.value })); }

  function openCreate() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
    setShowForm(true);
  }

  function openEdit(u) {
    setEditingId(u.id);
    setForm({ name: u.name, email: u.email, password: '', role: u.role, is_active: u.is_active });
    setError('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    try {
      if (editingId) {
        const payload = { name: form.name, email: form.email, role: form.role, is_active: form.is_active };
        if (form.password) payload.password = form.password;
        const { data } = await api.put(`/users/${editingId}`, payload);
        setUsers(u => u.map(x => x.id === editingId ? data : x));
      } else {
        const { data } = await api.post('/users', form);
        setUsers(u => [...u, data]);
      }
      closeForm();
    } catch (err) {
      setError(err.response?.data?.error || 'Hata oluştu');
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    setDeleteTarget(null);
    await api.delete(`/users/${id}`);
    setUsers(u => u.filter(x => x.id !== id));
  }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Kullanıcılar</h1>
          <p className="text-sm text-slate-500 mt-0.5">{users.length} kullanıcı kayıtlı</p>
        </div>
        <button
          onClick={() => showForm ? closeForm() : openCreate()}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-xl transition-colors shadow-md ${
            showForm
              ? 'bg-slate-200 text-slate-700 hover:bg-slate-300 shadow-slate-200/50'
              : 'bg-amber-600 text-white hover:bg-amber-700 shadow-amber-600/20'
          }`}
        >
          {showForm ? <><X size={15} /> İptal</> : <><Plus size={15} strokeWidth={2.5} /> Kullanıcı Ekle</>}
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6 animate-fade-up">
          <h2 className="text-[15px] font-semibold text-slate-800 mb-4">
            {editingId ? 'Kullanıcıyı Düzenle' : 'Yeni Kullanıcı'}
          </h2>
          {error && (
            <div className="mb-4 flex items-center gap-2.5 px-4 py-3 bg-red-50 border border-red-200/80 text-red-600 text-sm rounded-xl">
              <AlertCircle size={15} className="flex-shrink-0" />
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Ad Soyad *</label>
                <FieldWrap icon={User}>
                  <input required value={form.name} onChange={set('name')} placeholder="Adı Soyadı" className={INPUT_CLS} />
                </FieldWrap>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">E-posta *</label>
                <FieldWrap icon={Mail}>
                  <input required type="email" value={form.email} onChange={set('email')} placeholder="ornek@sirket.com" className={INPUT_CLS} />
                </FieldWrap>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">
                  Şifre {editingId ? '' : '*'}
                </label>
                <FieldWrap icon={Lock}>
                  <input
                    required={!editingId}
                    type="password"
                    value={form.password}
                    onChange={set('password')}
                    placeholder={editingId ? 'Boş bırakırsanız değişmez' : '••••••••'}
                    className={INPUT_CLS}
                    autoComplete="new-password"
                  />
                </FieldWrap>
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Rol *</label>
                <FieldWrap icon={Shield}>
                  <select value={form.role} onChange={set('role')} className={SELECT_CLS}>
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </FieldWrap>
              </div>
              {editingId && (
                <div className="col-span-2">
                  <label className="block text-[12px] font-semibold text-slate-600 mb-1.5">Durum</label>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, is_active: !f.is_active }))}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-semibold transition-colors border ${
                      form.is_active
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                    }`}
                  >
                    {form.is_active ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                    {form.is_active ? 'Aktif' : 'Pasif'}
                  </button>
                </div>
              )}
            </div>
            <div className="flex justify-end mt-5 pt-4 border-t border-slate-100">
              <button type="submit" className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-md shadow-amber-600/20">
                {editingId ? 'Güncelle' : 'Kaydet'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Tablo */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              {['Kullanıcı', 'E-posta', 'Rol', 'Durum', ''].map(h => (
                <th key={h} className="px-5 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {users.map(u => {
              const rc = ROLE_CONFIG[u.role] || ROLE_CONFIG.order_taker;
              const initials = u.name?.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?';
              return (
                <tr key={u.id} className="hover:bg-slate-50/80 transition-colors group">
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-300 to-slate-400 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                        {initials}
                      </div>
                      <span className="font-semibold text-slate-800">{u.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-slate-500">{u.email}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${rc.bg} ${rc.text}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${rc.dot}`} />
                      {ROLES.find(r => r.value === u.role)?.label}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${u.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${u.is_active ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      {u.is_active ? 'Aktif' : 'Pasif'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(u)}
                        title="Düzenle"
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(u)}
                        title="Sil"
                        className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Kullanıcıyı silmek istiyor musunuz?"
        message={deleteTarget ? `"${deleteTarget.name}" kalıcı olarak silinecek.` : ''}
        confirmLabel="Evet, Sil"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </Layout>
  );
}
