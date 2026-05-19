import { useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'taskflow.local.tasks.v1';
const TITLE_LIMIT = 90;

const seedTasks = [
  {
    taskpk: 'seed-1',
    taskcode: 'TASK-0001',
    taskdesc: 'Review catatan prioritas minggu ini',
    duedate: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
    status: 'open',
    createdat: new Date().toISOString(),
    lastupdated: new Date().toISOString(),
    updatedby: 'local-user',
    isdeleted: false,
    note: 'Pisahkan tugas cepat dan tugas besar.',
  },
  {
    taskpk: 'seed-2',
    taskcode: 'TASK-0002',
    taskdesc: 'Rapikan daftar belanja rumah',
    duedate: new Date(Date.now() + 3 * 86400000).toISOString().slice(0, 10),
    status: 'done',
    createdat: new Date().toISOString(),
    lastupdated: new Date().toISOString(),
    updatedby: 'local-user',
    isdeleted: false,
    note: 'Sudah dicek dengan stok dapur.',
  },
];

const emptyForm = { title: '', due: '', note: '' };

function safeParseTasks() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { tasks: seedTasks, warning: '' };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('Invalid task data');
    const valid = parsed.filter((task) => task && task.taskpk && task.taskdesc && task.duedate);
    return { tasks: valid, warning: valid.length !== parsed.length ? 'Sebagian data lokal rusak dan dilewati.' : '' };
  } catch {
    return { tasks: [], warning: 'Data lokal tidak bisa dibaca. Daftar direset agar aplikasi tetap bisa dipakai.' };
  }
}

function formatDate(value) {
  if (!value) return '-';
  return new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
}

function diffDays(value) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${value}T00:00:00`);
  return Math.round((due - today) / 86400000);
}

function dueLabel(task) {
  if (task.status === 'done') return 'Selesai';
  const days = diffDays(task.duedate);
  if (days < 0) return `Terlambat ${Math.abs(days)} hari`;
  if (days === 0) return 'Jatuh tempo hari ini';
  if (days === 1) return 'Besok';
  return `${days} hari lagi`;
}

function classNames(...names) {
  return names.filter(Boolean).join(' ');
}

export default function App() {
  const initial = useMemo(() => safeParseTasks(), []);
  const [tasks, setTasks] = useState(initial.tasks);
  const [storageWarning, setStorageWarning] = useState(initial.warning);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [toast, setToast] = useState('');
  const [isOnline, setIsOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  useEffect(() => {
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch {
      setStorageWarning('Penyimpanan lokal gagal. Perubahan mungkin hilang setelah refresh.');
    }
  }, [tasks]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const activeTasks = tasks.filter((task) => !task.isdeleted);
  const sortedTasks = [...activeTasks].sort((a, b) => new Date(a.duedate) - new Date(b.duedate));
  const visibleTasks = sortedTasks.filter((task) => {
    if (filter === 'active') return task.status === 'open';
    if (filter === 'done') return task.status === 'done';
    return true;
  });

  const stats = useMemo(() => {
    const total = activeTasks.length;
    const done = activeTasks.filter((task) => task.status === 'done').length;
    const open = total - done;
    const overdue = activeTasks.filter((task) => task.status !== 'done' && diffDays(task.duedate) < 0).length;
    const today = activeTasks.filter((task) => task.status !== 'done' && diffDays(task.duedate) === 0).length;
    const progress = total ? Math.round((done / total) * 100) : 0;
    return { total, done, open, overdue, today, progress };
  }, [activeTasks]);

  function validate(currentForm) {
    const nextErrors = {};
    const title = currentForm.title.trim();
    if (!title) nextErrors.title = 'Judul tugas wajib diisi.';
    if (title.length > TITLE_LIMIT) nextErrors.title = `Judul maksimal ${TITLE_LIMIT} karakter.`;
    if (!currentForm.due) nextErrors.due = 'Tenggat wajib dipilih.';
    return nextErrors;
  }

  function resetForm() {
    setForm(emptyForm);
    setErrors({});
    setEditingId(null);
  }

  function handleSubmit(event) {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const now = new Date().toISOString();
    const cleanTitle = form.title.trim();
    const cleanNote = form.note.trim();

    if (editingId) {
      setTasks((current) =>
        current.map((task) =>
          task.taskpk === editingId
            ? { ...task, taskdesc: cleanTitle, duedate: form.due, note: cleanNote, lastupdated: now }
            : task
        )
      );
      setToast('Tugas berhasil diperbarui.');
    } else {
      const nextNumber = activeTasks.length + 1;
      const task = {
        taskpk: crypto?.randomUUID ? crypto.randomUUID() : `task-${Date.now()}`,
        taskcode: `TASK-${String(nextNumber).padStart(4, '0')}`,
        taskdesc: cleanTitle,
        duedate: form.due,
        status: 'open',
        createdat: now,
        lastupdated: now,
        updatedby: 'local-user',
        isdeleted: false,
        note: cleanNote,
      };
      setTasks((current) => [task, ...current]);
      setToast('Tugas baru tersimpan lokal.');
    }

    resetForm();
  }

  function startEdit(task) {
    setEditingId(task.taskpk);
    setForm({ title: task.taskdesc, due: task.duedate, note: task.note || '' });
    setErrors({});
    document.getElementById('task-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function toggleStatus(taskId) {
    setTasks((current) =>
      current.map((task) =>
        task.taskpk === taskId
          ? { ...task, status: task.status === 'done' ? 'open' : 'done', lastupdated: new Date().toISOString() }
          : task
      )
    );
  }

  function deleteTask(taskId) {
    const ok = window.confirm('Hapus tugas ini permanen dari penyimpanan lokal?');
    if (!ok) return;
    setTasks((current) => current.filter((task) => task.taskpk !== taskId));
    setToast('Tugas dihapus.');
  }

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Navigasi utama">
        <div className="brand-block">
          <div className="brand-mark">TF</div>
          <div>
            <strong>TaskFlow</strong>
            <span>Daftar pribadi</span>
          </div>
        </div>
        <nav className="side-nav">
          <a className="active" href="#dashboard">🏠 Ringkasan</a>
          <a href="#task-form">➕ Tambah tugas</a>
          <a href="#task-list">✅ Status</a>
          <a href="#insight">📊 Insight</a>
        </nav>
        <div className="health-card">
          <span>Skor Fokus</span>
          <strong>{stats.progress}%</strong>
          <p>{stats.open === 0 ? 'Semua tugas bersih. Pertahankan ritme.' : `${stats.open} tugas aktif menunggu diselesaikan.`}</p>
        </div>
      </aside>

      <main className="main-content" id="dashboard">
        {(storageWarning || !isOnline || toast) && (
          <div className="notice-stack" aria-live="polite">
            {storageWarning && <div className="notice warning">{storageWarning}</div>}
            {!isOnline && <div className="notice info">Mode offline aktif. Data tetap disimpan di browser.</div>}
            {toast && <div className="notice success">{toast}</div>}
          </div>
        )}

        <section className="hero-card">
          <div className="orb orb-one" />
          <div className="orb orb-two" />
          <div className="hero-copy">
            <span className="eyebrow">Agenda hari ini</span>
            <h1>Kelola tugas cepat, rapi, dan tetap ringan.</h1>
            <p>Semua tugas wajib punya tenggat. Data tersimpan lokal di browser tanpa login atau server.</p>
            <div className="hero-actions">
              <a className="btn primary" href="#task-form">Catat sekarang</a>
              <button className="btn ghost" type="button" onClick={() => setFilter('active')}>Lihat aktif</button>
            </div>
          </div>
          <div className="hero-metric" aria-label="Ringkasan tugas aktif">
            <span>Tugas aktif</span>
            <strong>{stats.open}</strong>
            <em>{stats.today ? `${stats.today} jatuh tempo hari ini` : 'Tidak ada tenggat hari ini'}</em>
          </div>
        </section>

        <section className="stats-grid" aria-label="Metrik tugas">
          <article className="metric-card">
            <span>Total tugas</span>
            <strong>{stats.total}</strong>
            <p>Status: {stats.done} selesai</p>
          </article>
          <article className="metric-card">
            <span>Aktif</span>
            <strong>{stats.open}</strong>
            <p>Butuh tindakan</p>
          </article>
          <article className="metric-card danger-card">
            <span>Terlambat</span>
            <strong>{stats.overdue}</strong>
            <p>Status risiko waktu</p>
          </article>
        </section>

        <section className="content-grid">
          <form className="task-form panel" id="task-form" onSubmit={handleSubmit} noValidate>
            <div className="section-heading">
              <span>{editingId ? 'Edit tugas' : 'Input cepat'}</span>
              <h2>{editingId ? 'Perbarui detail tugas' : 'Tambah tugas baru'}</h2>
            </div>

            <label className="field">
              <span>Judul tugas</span>
              <input
                className={errors.title ? 'error' : ''}
                value={form.title}
                maxLength={TITLE_LIMIT + 10}
                onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Contoh: Bayar tagihan listrik"
              />
              {errors.title && <small className="error-text">{errors.title}</small>}
            </label>

            <label className="field">
              <span>Tenggat wajib</span>
              <input
                type="date"
                className={errors.due ? 'error' : ''}
                value={form.due}
                onChange={(event) => setForm((current) => ({ ...current, due: event.target.value }))}
              />
              {errors.due && <small className="error-text">{errors.due}</small>}
            </label>

            <label className="field">
              <span>Catatan opsional</span>
              <textarea
                value={form.note}
                onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                placeholder="Tambahkan konteks singkat jika perlu"
                rows="4"
              />
            </label>

            <div className="form-actions">
              <button className="btn primary" type="submit">{editingId ? 'Simpan perubahan' : 'Simpan tugas'}</button>
              {editingId && <button className="btn soft" type="button" onClick={resetForm}>Batal edit</button>}
            </div>
          </form>

          <aside className="insight-panel" id="insight">
            <span>Insight fokus</span>
            <h2>{stats.progress}% selesai</h2>
            <p>{stats.overdue ? 'Ada tugas terlambat. Dahulukan yang tenggatnya paling dekat.' : 'Ritme aman. Tugas terurut otomatis dari tenggat terdekat.'}</p>
            <div className="progress-track"><div style={{ width: `${stats.progress}%` }} /></div>
            <ul>
              <li>Urutan berdasarkan tenggat terdekat.</li>
              <li>Status tersimpan setelah refresh.</li>
              <li>Input ditampilkan sebagai teks aman.</li>
            </ul>
          </aside>
        </section>

        <section className="panel list-panel" id="task-list">
          <div className="list-topbar">
            <div className="section-heading">
              <span>Daftar tugas</span>
              <h2>Status pekerjaan</h2>
            </div>
            <div className="filter-tabs" role="tablist" aria-label="Filter tugas">
              <button className={filter === 'all' ? 'active' : ''} type="button" onClick={() => setFilter('all')}>Semua</button>
              <button className={filter === 'active' ? 'active' : ''} type="button" onClick={() => setFilter('active')}>Aktif</button>
              <button className={filter === 'done' ? 'active' : ''} type="button" onClick={() => setFilter('done')}>Selesai</button>
            </div>
          </div>

          {visibleTasks.length === 0 ? (
            <div className="empty-state">
              <div>📝</div>
              <h3>{activeTasks.length === 0 ? 'Belum ada tugas' : 'Tidak ada tugas pada filter ini'}</h3>
              <p>{activeTasks.length === 0 ? 'Mulai dengan satu tugas kecil dan pilih tenggatnya.' : 'Coba filter lain atau tambah tugas baru.'}</p>
              <a className="btn primary" href="#task-form">Catat sekarang</a>
            </div>
          ) : (
            <div className="task-list">
              {visibleTasks.map((task) => {
                const overdue = task.status !== 'done' && diffDays(task.duedate) < 0;
                return (
                  <article className={classNames('task-row', task.status === 'done' && 'done')} key={task.taskpk}>
                    <label className="check-wrap">
                      <input type="checkbox" checked={task.status === 'done'} onChange={() => toggleStatus(task.taskpk)} />
                      <span>{task.status === 'done' ? 'Selesai' : 'Belum selesai'}</span>
                    </label>
                    <div className="task-main">
                      <div className="task-title-line">
                        <h3>{task.taskdesc}</h3>
                        <span className={classNames('badge', task.status === 'done' ? 'success' : overdue ? 'danger' : 'blue')}>{dueLabel(task)}</span>
                      </div>
                      <p>{task.note || 'Tidak ada catatan tambahan.'}</p>
                      <div className="task-meta"><span>{task.taskcode}</span><span>Tenggat {formatDate(task.duedate)}</span></div>
                    </div>
                    <div className="row-actions">
                      <button type="button" onClick={() => startEdit(task)}>Edit</button>
                      <button type="button" className="danger" onClick={() => deleteTask(task.taskpk)}>Hapus</button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      <nav className="bottom-nav" aria-label="Navigasi mobile">
        <a href="#dashboard" className="active">🏠<span>Home</span></a>
        <a href="#task-list">✅<span>Status</span></a>
        <a href="#task-form" className="add-fab">＋</a>
        <a href="#insight">📊<span>Insight</span></a>
      </nav>
    </div>
  );
}
