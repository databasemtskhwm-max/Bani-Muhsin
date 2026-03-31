import React, { useState, useEffect, useRef } from 'react';
import { FamilyMember, User, AuditEntry, NewsItem, GalleryItem } from '../types';
import { Plus, Trash2, Save, ArrowLeft, Heart, History, LogOut, Newspaper, Calendar, User as UserIcon, Image as ImageIcon, Upload } from 'lucide-react';
import { motion } from 'motion/react';

interface AdminPageProps {
  user: User;
  onLogout: () => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({ user, onLogout }) => {
  const [data, setData] = useState<FamilyMember | null>(null);
  const [history, setHistory] = useState<string>('');
  const [news, setNews] = useState<NewsItem[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [showAudit, setShowAudit] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch('/api/family').then(res => res.json()),
      fetch('/api/history').then(res => res.json()),
      fetch('/api/news').then(res => res.json()),
      fetch('/api/gallery').then(res => res.json()),
      fetch('/api/last-update').then(res => res.json()),
      fetch('/api/audit-log').then(res => res.json())
    ]).then(([familyData, historyData, newsData, galleryData, updateData, logs]) => {
      setData(familyData);
      setHistory(historyData.history);
      setNews(newsData);
      setGallery(galleryData);
      setLastSaved(updateData.lastUpdate);
      setAuditLogs(logs);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      alert('Gagal memuat data.');
      setLoading(false);
    });
  }, []);

  const saveChanges = async () => {
    setSaving(true);
    try {
      const [resFamily, resHistory, resNews, resGallery] = await Promise.all([
        fetch('/api/family', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ data, userEmail: user.email })
        }),
        fetch('/api/history', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ history, userEmail: user.email })
        }),
        fetch('/api/news', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ news, userEmail: user.email })
        }),
        fetch('/api/gallery', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gallery, userEmail: user.email })
        })
      ]);

      if (!resFamily.ok || !resHistory.ok || !resNews.ok || !resGallery.ok) {
        throw new Error('Gagal menyimpan ke server');
      }

      const familyResult = await resFamily.json();
      setLastSaved(familyResult.lastUpdate);
      
      // Refresh audit logs
      const logsRes = await fetch('/api/audit-log');
      const logs = await logsRes.json();
      setAuditLogs(logs);

      alert('Perubahan berhasil disimpan!');
    } catch (err) {
      console.error(err);
      alert('Gagal menyimpan perubahan. Silakan coba lagi.');
    } finally {
      setSaving(false);
    }
  };

  const updateMember = (id: string, updates: Partial<FamilyMember>) => {
    const newData = JSON.parse(JSON.stringify(data));
    const findAndUpdate = (node: FamilyMember) => {
      if (node.id === id) {
        Object.assign(node, updates);
        return true;
      }
      if (node.children) {
        for (const child of node.children) {
          if (findAndUpdate(child)) return true;
        }
      }
      return false;
    };
    findAndUpdate(newData);
    setData(newData);
  };

  const addChild = (parentId: string) => {
    const newData = JSON.parse(JSON.stringify(data));
    const newId = Math.random().toString(36).substr(2, 9);
    const findAndAdd = (node: FamilyMember) => {
      if (node.id === parentId) {
        if (!node.children) node.children = [];
        node.children.push({
          id: newId,
          name: 'Anggota Baru',
          type: 'descendant',
          children: [],
          isDeceased: false
        });
        return true;
      }
      if (node.children) {
        for (const child of node.children) {
          if (findAndAdd(child)) return true;
        }
      }
      return false;
    };
    findAndAdd(newData);
    setData(newData);
  };

  const addSpouse = (parentId: string) => {
    const newData = JSON.parse(JSON.stringify(data));
    const newId = Math.random().toString(36).substr(2, 9);
    const findAndAdd = (node: FamilyMember) => {
      if (node.id === parentId) {
        if (!node.children) node.children = [];
        node.children.push({
          id: newId,
          name: 'Nama Pasangan',
          type: 'spouse',
          children: [],
          isDeceased: false
        });
        return true;
      }
      if (node.children) {
        for (const child of node.children) {
          if (findAndAdd(child)) return true;
        }
      }
      return false;
    };
    findAndAdd(newData);
    setData(newData);
  };

  const removeMember = (id: string) => {
    if (id === 'root') return;
    const newData = JSON.parse(JSON.stringify(data));
    const findAndRemove = (node: FamilyMember) => {
      if (node.children) {
        const index = node.children.findIndex(c => c.id === id);
        if (index !== -1) {
          node.children.splice(index, 1);
          return true;
        }
        for (const child of node.children) {
          if (findAndRemove(child)) return true;
        }
      }
      return false;
    };
    findAndRemove(newData);
    setData(newData);
  };

  const addNews = () => {
    const newNews: NewsItem = {
      id: Math.random().toString(36).substr(2, 9),
      title: 'Judul Berita Baru',
      content: 'Isi berita di sini...',
      date: new Date().toISOString().split('T')[0],
      category: 'upcoming',
      author: user.name,
      imageUrl: 'https://picsum.photos/seed/' + Math.random().toString(36).substr(2, 5) + '/1200/800'
    };
    setNews([newNews, ...news]);
  };

  const updateNewsItem = (id: string, updates: Partial<NewsItem>) => {
    setNews(news.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const removeNews = (id: string) => {
    setNews(news.filter(item => item.id !== id));
  };

  const addGalleryItem = () => {
    const newItem: GalleryItem = {
      id: Math.random().toString(36).substr(2, 9),
      headOfFamilyId: '',
      headOfFamilyName: '',
      imageUrl: 'https://picsum.photos/seed/' + Math.random().toString(36).substr(2, 5) + '/1200/800',
      caption: 'Foto Keluarga',
      date: new Date().toISOString().split('T')[0],
      uploadedBy: user.name
    };
    setGallery([newItem, ...gallery]);
  };

  const updateGalleryItem = (id: string, updates: Partial<GalleryItem>) => {
    setGallery(gallery.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const removeGalleryItem = (id: string) => {
    setGallery(gallery.filter(item => item.id !== id));
  };

  const getAllMembers = (node: FamilyMember): { id: string, name: string }[] => {
    let members = [{ id: node.id, name: node.name }];
    if (node.children) {
      node.children.forEach(child => {
        members = [...members, ...getAllMembers(child)];
      });
    }
    return members;
  };

  const allMembers = data ? getAllMembers(data) : [];

  const handleFileUpload = async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    });
    if (!res.ok) throw new Error('Gagal mengunggah file');
    const result = await res.json();
    return result.url;
  };

  const FileUploadButton: React.FC<{ onUpload: (url: string) => void, className?: string }> = ({ onUpload, className }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);

    const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploading(true);
      try {
        const url = await handleFileUpload(file);
        onUpload(url);
      } catch (err) {
        console.error(err);
        alert('Gagal mengunggah foto.');
      } finally {
        setUploading(false);
      }
    };

    return (
      <div className={className}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={onChange}
          className="hidden"
          accept="image/*"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1 text-[10px] bg-brand-olive/10 text-brand-olive px-2 py-1 rounded-lg hover:bg-brand-olive/20 transition-all disabled:opacity-50"
        >
          <Upload size={10} />
          {uploading ? 'Mengunggah...' : 'Upload File'}
        </button>
      </div>
    );
  };

  const renderEditor = (node: FamilyMember, depth = 0) => {
    return (
      <div key={node.id} className="ml-6 border-l border-brand-olive/10 pl-4 my-4">
        <div className="flex flex-wrap items-center gap-2 bg-white p-3 rounded-xl shadow-sm border border-brand-olive/5">
          <input
            type="text"
            value={node.name}
            onChange={(e) => updateMember(node.id, { name: e.target.value })}
            className="border-none focus:ring-0 font-medium text-sm flex-grow"
          />
          <select
            value={node.type}
            onChange={(e) => updateMember(node.id, { type: e.target.value as any })}
            className="text-xs border-brand-olive/10 rounded-lg p-1"
          >
            <option value="ancestor">Leluhur</option>
            <option value="wife1">Istri 1 (Root)</option>
            <option value="wife2">Istri 2 (Root)</option>
            <option value="spouse">Pasangan</option>
            <option value="child">Anak Utama</option>
            <option value="descendant">Keturunan</option>
          </select>
          <input
            type="text"
            placeholder="Pasangan (opsional)"
            value={node.spouse || ''}
            onChange={(e) => updateMember(node.id, { spouse: e.target.value })}
            className="text-xs border-brand-olive/10 rounded-lg p-1 w-32"
          />
          <label className="flex items-center gap-1 text-xs text-brand-ink/60 cursor-pointer hover:text-brand-olive">
            <input
              type="checkbox"
              checked={node.isDeceased || false}
              onChange={(e) => updateMember(node.id, { isDeceased: e.target.checked })}
              className="rounded text-brand-olive focus:ring-brand-olive"
            />
            Almarhum/ah
          </label>
          <button onClick={() => addChild(node.id)} className="p-1 text-emerald-600 hover:bg-emerald-50 rounded" title="Tambah Anak">
            <Plus size={18} />
          </button>
          <button onClick={() => addSpouse(node.id)} className="p-1 text-rose-600 hover:bg-rose-50 rounded" title="Tambah Pasangan">
            <Heart size={18} />
          </button>
          {node.id !== 'root' && (
            <button onClick={() => removeMember(node.id)} className="p-1 text-rose-600 hover:bg-rose-50 rounded" title="Hapus">
              <Trash2 size={18} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-2 mt-2 ml-8 pb-2 border-b border-brand-olive/5">
          <div className="flex items-center gap-2">
            {node.photoUrl && (
              <div className="w-8 h-8 rounded-full overflow-hidden border border-brand-olive/10 bg-white">
                <img src={node.photoUrl} alt="" className="w-full h-full object-cover" />
              </div>
            )}
            <input
              type="text"
              placeholder="URL Foto"
              value={node.photoUrl || ''}
              onChange={(e) => updateMember(node.id, { photoUrl: e.target.value })}
              className="text-[10px] border-brand-olive/10 rounded-lg p-1 w-32"
            />
            <FileUploadButton onUpload={(url) => updateMember(node.id, { photoUrl: url })} />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] opacity-50">Lahir:</span>
            <input
              type="date"
              value={node.birthDate || ''}
              onChange={(e) => updateMember(node.id, { birthDate: e.target.value })}
              className="text-[10px] border-brand-olive/10 rounded-lg p-1"
            />
          </div>
          {node.isDeceased && (
            <div className="flex items-center gap-1">
              <span className="text-[10px] opacity-50">Wafat:</span>
              <input
                type="date"
                value={node.deathDate || ''}
                onChange={(e) => updateMember(node.id, { deathDate: e.target.value })}
                className="text-[10px] border-brand-olive/10 rounded-lg p-1"
              />
            </div>
          )}
          <input
            type="text"
            placeholder="Alamat Sekarang"
            value={node.address || ''}
            onChange={(e) => updateMember(node.id, { address: e.target.value })}
            className="text-[10px] border-brand-olive/10 rounded-lg p-1 flex-grow"
          />
        </div>
        {node.children && node.children.map(child => renderEditor(child, depth + 1))}
      </div>
    );
  };

  if (loading) return <div className="p-20 text-center">Memuat editor...</div>;

  return (
    <div className="min-h-screen bg-brand-cream p-6 md:p-12">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <a href="/" className="flex items-center text-brand-olive hover:underline mb-2 text-sm">
              <ArrowLeft size={16} className="mr-1" /> Kembali ke Website
            </a>
            <h1 className="serif text-4xl font-bold">Admin Panel Silsilah</h1>
            <div className="flex items-center gap-4 mt-2">
              <span className="text-sm bg-brand-olive/10 px-3 py-1 rounded-full text-brand-olive font-medium">
                Editor: {user.name} ({user.email})
              </span>
              {lastSaved && (
                <p className="text-xs text-brand-olive/60">
                  Terakhir disimpan: {new Date(lastSaved).toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} WIB
                </p>
              )}
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowAudit(!showAudit)}
              className="flex items-center border border-brand-olive/20 text-brand-olive px-4 py-2 rounded-full hover:bg-brand-olive/5 transition-all"
            >
              <History size={18} className="mr-2" />
              {showAudit ? 'Tutup Log' : 'Riwayat Perubahan'}
            </button>
            <button
              onClick={onLogout}
              className="flex items-center border border-rose-200 text-rose-600 px-4 py-2 rounded-full hover:bg-rose-50 transition-all"
            >
              <LogOut size={18} className="mr-2" />
              Keluar
            </button>
            <button
              onClick={saveChanges}
              disabled={saving}
              className="flex items-center bg-brand-olive text-white px-6 py-3 rounded-full hover:shadow-lg transition-all disabled:opacity-50"
            >
              <Save size={18} className="mr-2" />
              {saving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </div>

        {showAudit && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-white p-6 rounded-3xl border border-brand-olive/10 shadow-sm mb-8 overflow-hidden"
          >
            <h2 className="serif text-2xl mb-4">Riwayat Perubahan (Audit Log)</h2>
            <div className="max-h-64 overflow-y-auto space-y-3">
              {auditLogs.length === 0 ? (
                <p className="text-sm text-brand-olive/50 italic">Belum ada riwayat perubahan.</p>
              ) : (
                auditLogs.slice().reverse().map((log) => (
                  <div key={log.id} className="text-sm border-b border-brand-olive/5 pb-2 flex justify-between items-start">
                    <div>
                      <span className="font-semibold text-brand-olive">{log.action}</span>
                      <p className="text-brand-ink/60">{log.details}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">{log.userEmail}</p>
                      <p className="text-[10px] opacity-50">{new Date(log.timestamp).toLocaleString('id-ID')}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl text-sm text-emerald-800">
              <p className="font-semibold mb-1">Cara Mengedit:</p>
              <ul className="list-disc ml-5 space-y-1">
                <li>Ubah nama langsung pada kotak teks.</li>
                <li>Centang <strong>"Almarhum/ah"</strong> jika anggota keluarga sudah meninggal dunia.</li>
                <li>Gunakan tombol <Plus size={14} className="inline" /> untuk menambah anak/keturunan.</li>
                <li>Gunakan tombol <Trash2 size={14} className="inline" /> untuk menghapus anggota.</li>
              </ul>
            </div>

            <div className="bg-white/50 p-6 rounded-3xl border border-brand-olive/10 shadow-sm overflow-x-auto">
              <h2 className="serif text-2xl mb-4">Edit Silsilah</h2>
              {data && renderEditor(data)}
            </div>

            <div className="bg-white/50 p-6 rounded-3xl border border-brand-olive/10 shadow-sm">
              <h2 className="serif text-2xl mb-4">Edit Sejarah (Kisah Kami)</h2>
              <textarea
                value={history}
                onChange={(e) => setHistory(e.target.value)}
                className="w-full h-64 p-4 rounded-xl border border-brand-olive/10 focus:ring-brand-olive focus:border-brand-olive bg-white/80"
                placeholder="Tuliskan sejarah keluarga di sini..."
              />
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-white/50 p-6 rounded-3xl border border-brand-olive/10 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h2 className="serif text-2xl">Berita & Kegiatan</h2>
                <button 
                  onClick={addNews}
                  className="p-2 bg-brand-olive text-white rounded-full hover:shadow-md transition-all"
                >
                  <Plus size={20} />
                </button>
              </div>
              
              <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2">
                {news.length === 0 ? (
                  <p className="text-sm text-brand-ink/40 italic text-center py-8">Belum ada berita.</p>
                ) : (
                  news.map((item) => (
                    <div key={item.id} className="bg-white p-4 rounded-2xl border border-brand-olive/5 shadow-sm space-y-3">
                      <input
                        type="text"
                        value={item.title}
                        onChange={(e) => updateNewsItem(item.id, { title: e.target.value })}
                        className="w-full font-bold text-sm border-none p-0 focus:ring-0"
                        placeholder="Judul Berita"
                      />
                      <div className="flex gap-2">
                        <div className="flex items-center text-[10px] text-brand-ink/40 bg-brand-cream px-2 py-1 rounded-lg">
                          <Calendar size={10} className="mr-1" />
                          <input
                            type="date"
                            value={item.date}
                            onChange={(e) => updateNewsItem(item.id, { date: e.target.value })}
                            className="bg-transparent border-none p-0 focus:ring-0 text-[10px]"
                          />
                        </div>
                        <select
                          value={item.category}
                          onChange={(e) => updateNewsItem(item.id, { category: e.target.value as any })}
                          className="text-[10px] bg-brand-cream border-none rounded-lg px-2 py-1 focus:ring-0"
                        >
                          <option value="upcoming">Akan Datang</option>
                          <option value="past">Sudah Lewat</option>
                        </select>
                      </div>
                      <textarea
                        value={item.content}
                        onChange={(e) => updateNewsItem(item.id, { content: e.target.value })}
                        className="w-full text-xs border-none p-0 focus:ring-0 min-h-[60px] bg-transparent"
                        placeholder="Isi berita..."
                      />
                      <div className="flex justify-between items-center pt-2 border-t border-brand-olive/5">
                        <span className="text-[10px] text-brand-ink/40 flex items-center">
                          <UserIcon size={10} className="mr-1" /> {item.author}
                        </span>
                        <button 
                          onClick={() => removeNews(item.id)}
                          className="text-rose-500 hover:text-rose-700 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={item.imageUrl || ''}
                          onChange={(e) => updateNewsItem(item.id, { imageUrl: e.target.value })}
                          className="flex-grow text-[10px] border border-brand-olive/10 rounded-lg p-1 focus:ring-brand-olive"
                          placeholder="URL Gambar (opsional)"
                        />
                        <FileUploadButton onUpload={(url) => updateNewsItem(item.id, { imageUrl: url })} />
                      </div>
                      {item.imageUrl && (
                        <div className="h-20 rounded-lg overflow-hidden border border-brand-olive/5">
                          <img src={item.imageUrl} alt="" className="w-full h-full object-cover grayscale opacity-50" />
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="bg-white/50 p-6 rounded-3xl border border-brand-olive/10 shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h2 className="serif text-2xl">Galeri Keluarga</h2>
                <button 
                  onClick={addGalleryItem}
                  className="p-2 bg-brand-olive text-white rounded-full hover:shadow-md transition-all"
                >
                  <Plus size={20} />
                </button>
              </div>
              
              <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2">
                {gallery.length === 0 ? (
                  <p className="text-sm text-brand-ink/40 italic text-center py-8">Belum ada foto galeri.</p>
                ) : (
                  gallery.map((item) => (
                    <div key={item.id} className="bg-white p-4 rounded-2xl border border-brand-olive/5 shadow-sm space-y-3">
                      <select
                        value={item.headOfFamilyId}
                        onChange={(e) => {
                          const member = allMembers.find(m => m.id === e.target.value);
                          updateGalleryItem(item.id, { 
                            headOfFamilyId: e.target.value,
                            headOfFamilyName: member ? member.name : ''
                          });
                        }}
                        className="w-full text-xs bg-brand-cream border-none rounded-lg px-2 py-1 focus:ring-0"
                      >
                        <option value="">Pilih Kepala Keluarga</option>
                        {allMembers.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={item.caption}
                        onChange={(e) => updateGalleryItem(item.id, { caption: e.target.value })}
                        className="w-full font-bold text-sm border-none p-0 focus:ring-0"
                        placeholder="Keterangan Foto"
                      />
                      <div className="flex gap-2">
                        <div className="flex items-center text-[10px] text-brand-ink/40 bg-brand-cream px-2 py-1 rounded-lg">
                          <Calendar size={10} className="mr-1" />
                          <input
                            type="date"
                            value={item.date}
                            onChange={(e) => updateGalleryItem(item.id, { date: e.target.value })}
                            className="bg-transparent border-none p-0 focus:ring-0 text-[10px]"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={item.imageUrl || ''}
                          onChange={(e) => updateGalleryItem(item.id, { imageUrl: e.target.value })}
                          className="flex-grow text-[10px] border border-brand-olive/10 rounded-lg p-1 focus:ring-brand-olive"
                          placeholder="URL Gambar"
                        />
                        <FileUploadButton onUpload={(url) => updateGalleryItem(item.id, { imageUrl: url })} />
                      </div>
                      {item.imageUrl && (
                        <div className="h-32 rounded-lg overflow-hidden border border-brand-olive/5">
                          <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                        </div>
                      )}
                      <div className="flex justify-between items-center pt-2 border-t border-brand-olive/5">
                        <span className="text-[10px] text-brand-ink/40 flex items-center">
                          <UserIcon size={10} className="mr-1" /> {item.uploadedBy}
                        </span>
                        <button 
                          onClick={() => removeGalleryItem(item.id)}
                          className="text-rose-500 hover:text-rose-700 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
