import React, { useState, useEffect, useRef, useMemo } from 'react';
import { FamilyMember, AuditEntry, GalleryItem, UserProfile } from '../types';
import { Plus, Trash2, Save, ArrowLeft, Heart, History, LogOut, Image as ImageIcon, Upload, Database, Check, X as XIcon, Shield, Calendar, User as UserIcon, AlertCircle, User, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, doc, collection, setDoc, deleteDoc, onSnapshot, query, orderBy, getDocs, ref, uploadBytes, uploadBytesResumable, getDownloadURL, storage, handleFirestoreError, OperationType } from '../firebase';
import { User as FirebaseUser } from 'firebase/auth';
import { cn } from '../lib/utils';
import imageCompression from 'browser-image-compression';

// Error Boundary Component
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, errorInfo: string | null }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorInfo: null };
  }

  static getDerivedStateFromError(error: any) {
    return { hasError: true, errorInfo: error.message };
  }

  componentDidCatch(error: any, errorInfo: any) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-brand-cream flex items-center justify-center p-6 text-center">
          <div className="max-w-md bg-white p-8 rounded-3xl shadow-xl border border-brand-olive/10">
            <h2 className="serif text-2xl text-brand-ink mb-4">Ups! Terjadi kesalahan di Admin Panel</h2>
            <p className="text-brand-ink/60 mb-6">Terjadi kendala saat memuat data admin. Silakan muat ulang halaman.</p>
            <button 
              onClick={() => window.location.reload()}
              className="bg-brand-olive text-white px-6 py-2 rounded-full hover:shadow-lg transition-all"
            >
              Muat Ulang
            </button>
            {this.state.errorInfo && (
              <pre className="mt-6 p-4 bg-rose-50 text-rose-600 text-[10px] rounded-xl overflow-auto text-left">
                {this.state.errorInfo}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

interface AdminPageProps {
  user: FirebaseUser;
  userProfile: UserProfile | null;
  onLogout: () => void;
}

export const AdminPage: React.FC<AdminPageProps> = ({ user, userProfile, onLogout }) => {
  const [data, setData] = useState<FamilyMember | null>(null);
  const [history, setHistory] = useState<string>('');

  const getAllMembers = (node: FamilyMember): FamilyMember[] => {
    let members = [node];
    if (node.children) {
      node.children.forEach(child => {
        members = [...members, ...getAllMembers(child)];
      });
    }
    return members;
  };

  const allMembers = data ? getAllMembers(data) : [];

  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  const [showUsers, setShowUsers] = useState(false);
  const [showDeletionRequests, setShowDeletionRequests] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const filteredSuggestions = useMemo(() => {
    if (!searchQuery || searchQuery.length < 2) return [];
    return allMembers.filter(m => 
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (m.spouse && m.spouse.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (m.address && m.address.toLowerCase().includes(searchQuery.toLowerCase()))
    ).slice(0, 8); // Limit to 8 suggestions
  }, [searchQuery, allMembers]);

  useEffect(() => {
    if (searchQuery) {
      const timer = setTimeout(() => {
        const firstMatch = document.querySelector('.search-match');
        if (firstMatch) {
          firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [searchQuery]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const editorName = userProfile?.role === 'admin' ? 'Admin' : (user.displayName || user.email || 'Editor');

  useEffect(() => {
    // Listen to Global Settings
    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setData(data.familyTree);
        setHistory(data.history);
        setLastSaved(data.lastUpdate);
      } else {
        // Fallback to API if Firebase is empty
        fetch('/api/family').then(res => res.json()).then(fData => setData(fData));
        fetch('/api/history').then(res => res.json()).then(hData => setHistory(hData.history));
        fetch('/api/last-update').then(res => res.json()).then(uData => setLastSaved(uData.lastUpdate));
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/global');
      setLoading(false);
    });

    // Listen to Gallery
    const unsubscribeGallery = onSnapshot(collection(db, 'gallery'), (snapshot) => {
      const galleryData = snapshot.docs.map(doc => doc.data() as GalleryItem);
      if (galleryData.length > 0) {
        setGallery(galleryData);
      } else {
        fetch('/api/gallery').then(res => res.json()).then(gData => setGallery(gData));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'gallery');
    });

    // Listen to Users (Admin only)
    const unsubscribeUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData = snapshot.docs.map(doc => doc.data() as UserProfile);
      setUsers(usersData);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'users');
    });

    // Listen to Audit Logs
    const unsubscribeAudit = onSnapshot(query(collection(db, 'auditLog'), orderBy('timestamp', 'desc')), (snapshot) => {
      const logs = snapshot.docs.map(doc => doc.data() as AuditEntry);
      if (logs.length > 0) {
        setAuditLogs(logs);
      } else {
        fetch('/api/audit-log').then(res => res.json()).then(logs => setAuditLogs(logs));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'auditLog');
    });

    return () => {
      unsubscribeSettings();
      unsubscribeGallery();
      unsubscribeUsers();
      unsubscribeAudit();
    };
  }, []);

  const migrateToFirebase = async () => {
    if (!window.confirm('Apakah Anda yakin ingin memigrasikan data lokal ke Firebase? Ini akan menimpa data di Firebase.')) return;
    setSaving(true);
    try {
      // 1. Save Global Settings
      try {
        await setDoc(doc(db, 'settings', 'global'), {
          familyTree: data,
          history: history,
          lastUpdate: new Date().toISOString()
        });
      } catch (err) {
        console.error('Migration error (settings):', err);
        handleFirestoreError(err, OperationType.WRITE, 'settings/global');
        throw new Error('Gagal menyimpan pengaturan global saat migrasi.');
      }

      // 2. Save Gallery
      for (const item of gallery) {
        try {
          await setDoc(doc(db, 'gallery', item.id), item);
        } catch (err) {
          console.error('Migration error (gallery):', item.id, err);
          handleFirestoreError(err, OperationType.WRITE, 'gallery/' + item.id);
          throw new Error(`Gagal menyimpan galeri saat migrasi: ${item.caption}`);
        }
      }

      // 3. Add Audit Log
      const auditId = Math.random().toString(36).substring(2, 11);
      try {
        await setDoc(doc(db, 'auditLog', auditId), {
          id: auditId,
          timestamp: new Date().toISOString(),
          userEmail: editorName,
          action: 'MIGRATE_TO_FIREBASE',
          details: 'Migrated local data to Firebase'
        });
      } catch (err) {
        console.error('Migration error (audit):', err);
        handleFirestoreError(err, OperationType.WRITE, 'auditLog/' + auditId);
        throw new Error('Gagal menyimpan catatan audit saat migrasi.');
      }

      alert('Migrasi ke Firebase berhasil!');
    } catch (err) {
      console.error('Migration failed:', err);
      alert(`Gagal migrasi: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const saveChanges = async () => {
    setSaving(true);
    try {
      const timestamp = new Date().toISOString();
      
      // Save to Firebase
      try {
        await setDoc(doc(db, 'settings', 'global'), {
          familyTree: data,
          history: history,
          lastUpdate: timestamp
        });
      } catch (err) {
        console.error('Error saving settings:', err);
        handleFirestoreError(err, OperationType.WRITE, 'settings/global');
        throw new Error('Gagal menyimpan pengaturan global.');
      }

      // Update Gallery (actually save them now)
      for (const item of gallery) {
        try {
          await setDoc(doc(db, 'gallery', item.id), item);
        } catch (err) {
          console.error('Error saving gallery item:', item.id, err);
          handleFirestoreError(err, OperationType.WRITE, 'gallery/' + item.id);
          throw new Error(`Gagal menyimpan galeri: ${item.caption}`);
        }
      }
      
      // Add Audit Log
      const auditId = Math.random().toString(36).substring(2, 11);
      try {
        await setDoc(doc(db, 'auditLog', auditId), {
          id: auditId,
          timestamp: timestamp,
          userEmail: editorName,
          action: 'UPDATE_ALL',
          details: 'Updated family tree, history, and gallery'
        });
      } catch (err) {
        console.error('Error saving audit log:', err);
        handleFirestoreError(err, OperationType.WRITE, 'auditLog/' + auditId);
        throw new Error('Gagal menyimpan catatan audit.');
      }

      alert('Perubahan berhasil disimpan ke Firebase!');
    } catch (err) {
      console.error('saveChanges failed:', err);
      alert(`Gagal menyimpan perubahan: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setSaving(false);
    }
  };

  const updateUserStatus = async (uid: string, role: 'editor' | 'viewer', status: 'approved' | 'rejected') => {
    try {
      const userRef = doc(db, 'users', uid);
      await setDoc(userRef, { role, status }, { merge: true });
      alert('Status pengguna diperbarui.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'users/' + uid);
      alert('Gagal memperbarui status pengguna.');
    }
  };

  const updateMember = (id: string, updates: Partial<FamilyMember>) => {
    const newData = JSON.parse(JSON.stringify(data));
    const timestamp = new Date().toISOString();
    const findAndUpdate = (node: FamilyMember) => {
      if (node.id === id) {
        Object.assign(node, {
          ...updates,
          updatedBy: editorName,
          updatedAt: timestamp
        });
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
    const timestamp = new Date().toISOString();
    const findAndAdd = (node: FamilyMember) => {
      if (node.id === parentId) {
        if (!node.children) node.children = [];
        node.children.push({
          id: newId,
          name: 'Anggota Baru',
          type: 'descendant',
          children: [],
          isDeceased: false,
          createdBy: editorName,
          createdAt: timestamp
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
    const timestamp = new Date().toISOString();
    
    const findAndProcess = (node: FamilyMember) => {
      if (node.children) {
        const index = node.children.findIndex(c => c.id === id);
        if (index !== -1) {
          if (userProfile?.role === 'admin') {
            // Admin can delete immediately
            if (!window.confirm(`Hapus ${node.children[index].name} secara permanen?`)) return false;
            node.children.splice(index, 1);
          } else {
            // Editor requests deletion
            if (!window.confirm(`Ajukan penghapusan untuk ${node.children[index].name}?`)) return false;
            node.children[index].pendingDeletion = true;
            node.children[index].deletionRequestedBy = editorName;
            node.children[index].deletionRequestedAt = timestamp;
          }
          return true;
        }
        for (const child of node.children) {
          if (findAndProcess(child)) return true;
        }
      }
      return false;
    };
    findAndProcess(newData);
    setData(newData);
  };

  const addGalleryItem = () => {
    const newItem: GalleryItem = {
      id: Math.random().toString(36).substr(2, 9),
      headOfFamilyId: '',
      headOfFamilyName: '',
      imageUrl: 'https://picsum.photos/seed/' + Math.random().toString(36).substr(2, 5) + '/1200/800',
      caption: 'Foto Keluarga',
      date: new Date().toISOString().split('T')[0],
      uploadedBy: editorName
    };
    setGallery([newItem, ...gallery]);
  };

  const updateGalleryItem = (id: string, updates: Partial<GalleryItem>) => {
    setGallery(gallery.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const removeGalleryItem = async (id: string) => {
    if (!window.confirm('Hapus foto ini dari galeri?')) return;
    try {
      await deleteDoc(doc(db, 'gallery', id));
      setGallery(gallery.filter(item => item.id !== id));

      // Log deletion
      const auditId = Math.random().toString(36).substring(2, 11);
      await setDoc(doc(db, 'auditLog', auditId), {
        id: auditId,
        timestamp: new Date().toISOString(),
        userEmail: editorName,
        action: 'DELETE_GALLERY',
        details: `Menghapus foto galeri dengan ID: ${id}`
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'gallery/' + id);
      alert('Gagal menghapus foto dari database.');
    }
  };

  const handleFileUpload = async (file: File, onProgress: (progress: number) => void): Promise<string> => {
    if (!storage) {
      throw new Error('Firebase Storage tidak terinisialisasi. Pastikan Firebase Storage sudah diaktifkan di konsol Firebase.');
    }

    // Compression options
    const options = {
      maxSizeMB: 0.5, // Max 500KB
      maxWidthOrHeight: 1200,
      useWebWorker: false, // Disable web worker for better compatibility in iframe environments
    };

    let fileToUpload = file;
    try {
      console.log('Starting image compression...');
      fileToUpload = await imageCompression(file, options);
      console.log('Compression successful:', fileToUpload.size / 1024, 'KB');
    } catch (compErr) {
      console.warn('Compression failed, uploading original:', compErr);
      fileToUpload = file;
    }

    try {
      const storageRef = ref(storage, `uploads/${Date.now()}-${file.name}`);
      const uploadTask = uploadBytesResumable(storageRef, fileToUpload);

      return new Promise((resolve, reject) => {
        uploadTask.on('state_changed', 
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            onProgress(Math.round(progress));
          }, 
          (error) => {
            console.error('Upload error details:', error);
            let message = 'Gagal mengunggah.';
            if (error.code === 'storage/unauthorized') {
              message = 'Izin ditolak. Pastikan Storage Rules mengizinkan unggahan.';
            } else if (error.code === 'storage/canceled') {
              message = 'Unggahan dibatalkan.';
            } else if (error.code === 'storage/unknown') {
              message = 'Kesalahan tidak diketahui pada Storage.';
            }
            reject(new Error(`${message} (${error.code})`));
          }, 
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(downloadURL);
            } catch (urlErr) {
              console.error('Error getting download URL:', urlErr);
              reject(new Error('Gagal mendapatkan URL unduhan setelah unggah.'));
            }
          }
        );
      });
    } catch (error) {
      console.error('File upload process error:', error);
      throw error;
    }
  };

  const FileUploadButton: React.FC<{ onUpload: (url: string) => void, className?: string }> = ({ onUpload, className }) => {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);

    const onChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setUploading(true);
      setProgress(0);
      try {
        const url = await handleFileUpload(file, (p) => setProgress(p));
        onUpload(url);
      } catch (err) {
        console.error('Upload component error:', err);
        alert(`Gagal mengunggah foto: ${err instanceof Error ? err.message : String(err)}`);
      } finally {
        setUploading(false);
        setProgress(0);
      }
    };

    return (
      <div className={className}>
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => {
            onChange(e);
            // Reset input so same file can be selected again
            e.target.value = '';
          }}
          className="hidden"
          accept="image/*"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex flex-col items-center justify-center gap-1 w-full py-2 bg-brand-olive/10 text-brand-olive rounded-xl hover:bg-brand-olive/20 transition-all disabled:opacity-50 text-xs font-semibold border border-dashed border-brand-olive/30"
        >
          {uploading ? (
            <div className="w-full px-4">
              <div className="flex justify-between mb-1">
                <span>Mengunggah...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-brand-olive/20 rounded-full h-1.5">
                <div 
                  className="bg-brand-olive h-1.5 rounded-full transition-all duration-300" 
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Upload size={14} />
              <span>Unggah Foto</span>
            </div>
          )}
        </button>
      </div>
    );
  };

  const approveDeletion = (id: string) => {
    if (!window.confirm('Setujui penghapusan anggota ini secara permanen?')) return;
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
    
    const entry: AuditEntry = {
      id: Date.now().toString(),
      timestamp: new Date().toISOString(),
      userEmail: userProfile?.email || 'unknown',
      action: 'APPROVE_DELETION',
      details: `Menyetujui penghapusan anggota ID: ${id}`
    };
    setAuditLogs(prev => [entry, ...prev]);
  };

  const rejectDeletion = (id: string) => {
    const newData = JSON.parse(JSON.stringify(data));
    const findAndCancel = (node: FamilyMember) => {
      if (node.id === id) {
        delete node.pendingDeletion;
        delete node.deletionRequestedBy;
        delete node.deletionRequestedAt;
        return true;
      }
      if (node.children) {
        for (const child of node.children) {
          if (findAndCancel(child)) return true;
        }
      }
      return false;
    };
    findAndCancel(newData);
    setData(newData);
  };

  const getDeletionRequests = (node: FamilyMember): FamilyMember[] => {
    let requests: FamilyMember[] = [];
    if (node.pendingDeletion) {
      requests.push(node);
    }
    if (node.children) {
      node.children.forEach(child => {
        requests = [...requests, ...getDeletionRequests(child)];
      });
    }
    return requests;
  };

  const deletionRequests = data ? getDeletionRequests(data) : [];

  const renderEditor = (node: FamilyMember, depth = 0) => {
    const isMatch = searchQuery && (
      node.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (node.spouse && node.spouse.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (node.address && node.address.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    return (
      <div key={node.id} className={cn(
        "ml-6 border-l border-brand-olive/10 pl-4 my-4 transition-all duration-300",
        isMatch && "bg-brand-olive/5 border-l-2 border-brand-olive rounded-r-2xl search-match"
      )}>
        <div className={cn(
          "flex flex-wrap items-center gap-2 bg-white p-3 rounded-xl shadow-sm border border-brand-olive/5 transition-all",
          isMatch && "ring-2 ring-brand-olive/30 border-brand-olive shadow-md"
        )}>
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
          {node.spouse && (
            <label className="flex items-center gap-1 text-[10px] text-brand-ink/60 cursor-pointer hover:text-brand-olive">
              <input
                type="checkbox"
                checked={node.spouseIsDeceased || false}
                onChange={(e) => updateMember(node.id, { spouseIsDeceased: e.target.checked })}
                className="rounded text-brand-olive focus:ring-brand-olive w-3 h-3"
              />
              Pasangan Alm/ah
            </label>
          )}
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
            <button 
              onClick={() => removeMember(node.id)} 
              className={`p-1 rounded transition-all ${node.pendingDeletion ? 'text-amber-600 bg-amber-50' : 'text-rose-600 hover:bg-rose-50'}`}
              title={node.pendingDeletion ? 'Menunggu Persetujuan Hapus' : 'Hapus'}
            >
              {node.pendingDeletion ? <AlertCircle size={18} /> : <Trash2 size={18} />}
            </button>
          )}
        </div>
        {node.pendingDeletion && (
          <div className="ml-8 mt-1 text-[10px] text-amber-600 flex items-center gap-1 bg-amber-50 px-2 py-0.5 rounded-full w-fit">
            <AlertCircle size={10} />
            Menunggu persetujuan penghapusan oleh {node.deletionRequestedBy}
          </div>
        )}
        <div className="flex flex-wrap gap-2 mt-2 ml-8 pb-2 border-b border-brand-olive/5">
          <div className="flex items-center gap-2 flex-grow">
            {node.photoUrl && (
              <div className="relative w-10 h-10 rounded-full overflow-hidden border-2 border-brand-olive/20 bg-white shadow-sm flex-shrink-0 group">
                <img src={node.photoUrl} alt="" className="w-full h-full object-cover" />
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    updateMember(node.id, { photoUrl: '' });
                  }}
                  className="absolute inset-0 bg-rose-500/80 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                  title="Hapus Foto"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            )}
            <FileUploadButton 
              onUpload={(url) => updateMember(node.id, { photoUrl: url })} 
              className="flex-grow"
            />
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
    <ErrorBoundary>
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
                Editor: {editorName}
              </span>
              {lastSaved && (
                <p className="text-xs text-brand-olive/60">
                  Terakhir disimpan: {new Date(lastSaved).toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} WIB
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={migrateToFirebase}
              disabled={saving}
              className="flex items-center border border-amber-600 text-amber-600 px-4 py-2 rounded-full hover:bg-amber-50 transition-all"
            >
              <Database size={18} className="mr-2" />
              Migrasi ke Firebase
            </button>
            {userProfile?.role === 'admin' && (
              <>
                <button
                  onClick={() => { setShowUsers(!showUsers); setShowAudit(false); setShowDeletionRequests(false); }}
                  className={cn(
                    "flex items-center border border-brand-olive/20 text-brand-olive px-4 py-2 rounded-full hover:bg-brand-olive/5 transition-all",
                    showUsers && "bg-brand-olive text-white"
                  )}
                >
                  <Shield size={18} className="mr-2" />
                  {showUsers ? 'Tutup Pengguna' : 'Manajemen Pengguna'}
                </button>
                <button
                  onClick={() => { setShowDeletionRequests(!showDeletionRequests); setShowUsers(false); setShowAudit(false); }}
                  className={cn(
                    "flex items-center border border-rose-200 text-rose-600 px-4 py-2 rounded-full hover:bg-rose-50 transition-all relative",
                    showDeletionRequests && "bg-rose-600 text-white"
                  )}
                >
                  <Trash2 size={18} className="mr-2" />
                  {showDeletionRequests ? 'Tutup Persetujuan' : 'Persetujuan Hapus'}
                  {deletionRequests.length > 0 && !showDeletionRequests && (
                    <span className="absolute -top-1 -right-1 bg-white text-rose-600 text-[10px] font-bold w-4 h-4 flex items-center justify-center rounded-full shadow-sm border border-rose-600">
                      {deletionRequests.length}
                    </span>
                  )}
                </button>
              </>
            )}
            <button
              onClick={() => { setShowAudit(!showAudit); setShowUsers(false); setShowDeletionRequests(false); }}
              className={cn(
                "flex items-center border border-brand-olive/20 text-brand-olive px-4 py-2 rounded-full hover:bg-brand-olive/5 transition-all",
                showAudit && "bg-brand-olive text-white"
              )}
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

        {showUsers && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-white p-6 rounded-3xl border border-brand-olive/10 shadow-sm mb-8 overflow-hidden"
          >
            <h2 className="serif text-2xl mb-4">Manajemen Pengguna (Persetujuan Editor)</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {users.filter(u => u.uid !== user.uid).map((u) => (
                <div key={u.uid} className="p-4 rounded-2xl bg-brand-cream/50 border border-brand-olive/5">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-bold text-sm">{u.displayName || 'Tanpa Nama'}</p>
                      <p className="text-[10px] opacity-50">{u.email}</p>
                    </div>
                    <span className={cn(
                      "text-[9px] font-bold uppercase px-2 py-0.5 rounded-full",
                      u.status === 'approved' ? "bg-emerald-100 text-emerald-700" : 
                      u.status === 'pending' ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700"
                    )}>
                      {u.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-4">
                    <div className="flex gap-2">
                      <span className="text-[10px] opacity-60">Role: {u.role}</span>
                    </div>
                    <div className="flex gap-1">
                      {u.status !== 'approved' && (
                        <button 
                          onClick={() => updateUserStatus(u.uid, 'editor', 'approved')}
                          className="p-1.5 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"
                          title="Setujui sebagai Editor"
                        >
                          <Check size={14} />
                        </button>
                      )}
                      {u.status !== 'rejected' && (
                        <button 
                          onClick={() => updateUserStatus(u.uid, 'viewer', 'rejected')}
                          className="p-1.5 bg-rose-500 text-white rounded-lg hover:bg-rose-600 transition-colors"
                          title="Tolak / Cabut Akses"
                        >
                          <XIcon size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              {users.length <= 1 && (
                <p className="col-span-full text-center text-sm text-brand-olive/50 italic py-10">Belum ada pengguna lain.</p>
              )}
            </div>
          </motion.div>
        )}

        {showDeletionRequests && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="bg-white p-6 rounded-3xl border border-brand-olive/10 shadow-sm mb-8 overflow-hidden"
          >
            <h2 className="serif text-2xl mb-4">Persetujuan Penghapusan Anggota</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {deletionRequests.map((req) => (
                <div key={req.id} className="p-4 rounded-2xl bg-brand-cream/50 border border-brand-olive/5">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden bg-white border border-brand-olive/10">
                      {req.photoUrl ? (
                        <img src={req.photoUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-brand-olive/40">
                          <User size={20} />
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{req.name}</p>
                      <p className="text-[10px] opacity-50">ID: {req.id}</p>
                    </div>
                  </div>
                  <div className="bg-white/50 p-2 rounded-xl mb-4">
                    <p className="text-[10px] text-brand-ink/60">
                      Diminta oleh: <span className="font-semibold">{req.deletionRequestedBy}</span>
                    </p>
                    <p className="text-[10px] text-brand-ink/60">
                      Waktu: {req.deletionRequestedAt ? new Date(req.deletionRequestedAt).toLocaleString('id-ID') : '-'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => rejectDeletion(req.id)}
                      className="flex-grow py-2 bg-brand-cream text-brand-ink/60 rounded-xl text-xs font-semibold hover:bg-brand-olive/10 transition-all"
                    >
                      Tolak
                    </button>
                    <button 
                      onClick={() => approveDeletion(req.id)}
                      className="flex-grow py-2 bg-rose-600 text-white rounded-xl text-xs font-semibold hover:bg-rose-700 transition-all"
                    >
                      Setujui Hapus
                    </button>
                  </div>
                </div>
              ))}
              {deletionRequests.length === 0 && (
                <p className="col-span-full text-center text-sm text-brand-olive/50 italic py-10">Tidak ada permintaan penghapusan tertunda.</p>
              )}
            </div>
          </motion.div>
        )}

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
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div className="flex flex-col">
                  <h2 className="serif text-2xl">Edit Silsilah</h2>
                  {searchQuery && (
                    <span className="text-[10px] text-brand-olive font-medium">
                      Ditemukan {allMembers.filter(m => 
                        m.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        (m.spouse && m.spouse.toLowerCase().includes(searchQuery.toLowerCase())) ||
                        (m.address && m.address.toLowerCase().includes(searchQuery.toLowerCase()))
                      ).length} anggota
                    </span>
                  )}
                </div>
                <div className="relative max-w-sm w-full" ref={searchRef}>
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-brand-olive/40">
                    <Search size={16} />
                  </div>
                  <input 
                    type="text" 
                    placeholder="Cari anggota keluarga..." 
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    className="w-full bg-white border border-brand-olive/10 rounded-full py-2 pl-10 pr-10 text-xs focus:outline-none focus:ring-2 focus:ring-brand-olive/30 transition-all shadow-sm"
                  />
                  {searchQuery && (
                    <button 
                      onClick={() => {
                        setSearchQuery('');
                        setShowSuggestions(false);
                      }}
                      className="absolute inset-y-0 right-4 flex items-center text-brand-olive/40 hover:text-rose-500 transition-colors"
                    >
                      <XIcon size={14} />
                    </button>
                  )}

                  {/* Search Suggestions Dropdown */}
                  <AnimatePresence>
                    {showSuggestions && filteredSuggestions.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-brand-olive/10 z-50 overflow-hidden"
                      >
                        <div className="max-h-60 overflow-y-auto custom-scrollbar">
                          {filteredSuggestions.map((member) => (
                            <button
                              key={member.id}
                              onClick={() => {
                                setSearchQuery(member.name);
                                setShowSuggestions(false);
                              }}
                              className="w-full flex flex-col items-start px-4 py-3 hover:bg-brand-cream/50 transition-colors border-b border-brand-olive/5 last:border-0 text-left"
                            >
                              <span className="text-xs font-bold text-brand-ink">{member.name}</span>
                              <span className="text-[10px] text-brand-ink/40">
                                {member.spouse && `Pasangan: ${member.spouse}`}
                                {member.address && ` • ${member.address}`}
                              </span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
              <div className="max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
                {data && renderEditor(data)}
              </div>
            </div>

            {userProfile?.role === 'admin' && (
              <div className="bg-white/50 p-6 rounded-3xl border border-brand-olive/10 shadow-sm">
                <h2 className="serif text-2xl mb-4">Edit Sejarah (Kisah Kami)</h2>
                <textarea
                  value={history}
                  onChange={(e) => setHistory(e.target.value)}
                  className="w-full h-64 p-4 rounded-xl border border-brand-olive/10 focus:ring-brand-olive focus:border-brand-olive bg-white/80"
                  placeholder="Tuliskan sejarah keluarga di sini..."
                />
              </div>
            )}
          </div>

          <div className="space-y-8">
            {userProfile?.role === 'admin' && (
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
                        <div className="space-y-2">
                          <FileUploadButton onUpload={(url) => updateGalleryItem(item.id, { imageUrl: url })} />
                          {item.imageUrl && (
                            <div className="relative h-48 rounded-xl overflow-hidden border border-brand-olive/10">
                              <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                              <button 
                                onClick={(e) => {
                                  e.preventDefault();
                                  updateGalleryItem(item.id, { imageUrl: '' });
                                }}
                                className="absolute top-2 right-2 p-1.5 bg-rose-500 text-white rounded-full hover:bg-rose-600 transition-colors shadow-lg z-10"
                                title="Hapus Foto"
                              >
                                <Trash2 size={12} />
                              </button>
                            </div>
                          )}
                        </div>
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
            )}
          </div>
        </div>
      </div>
    </div>
  </ErrorBoundary>
);
};
