import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FamilyTreeInteractive } from './components/FamilyTreeInteractive';
import { AdminPage } from './pages/AdminPage';
import { LoginPage } from './pages/LoginPage';
import { generateSpeech } from './services/ttsService';
import { Volume2, TreeDeciduous, Users, History, Heart, Settings, Download, LogIn, Newspaper, Calendar, User as UserIcon, Flower2, ChevronLeft, ChevronRight, Image as ImageIcon, ArrowLeft, LogOut, X } from 'lucide-react';
import { FamilyMember, NewsItem, GalleryItem, UserProfile } from './types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { auth, db, doc, collection, onSnapshot, logout, handleFirestoreError, OperationType, setDoc, getDoc } from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

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
            <h2 className="serif text-2xl text-brand-ink mb-4">Ups! Terjadi kesalahan</h2>
            <p className="text-brand-ink/60 mb-6">Aplikasi mengalami kendala teknis. Silakan muat ulang halaman.</p>
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

export default function App() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [familyData, setFamilyData] = useState<FamilyMember | null>(null);
  const [historyText, setHistoryText] = useState<string>('');
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(window.location.pathname === '/admin');
  const [isLogin, setIsLogin] = useState(window.location.pathname === '/login');
  const [isGallery, setIsGallery] = useState(window.location.pathname === '/gallery');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const getStats = (node: FamilyMember | null) => {
    if (!node) return { total: 0, gen2: 0, gen3: 0, gen4: 0, gen5: 0, deceased: 0 };
    
    let total = 0;
    let gen2 = 0; // Anak
    let gen3 = 0; // Cucu
    let gen4 = 0; // Cicit
    let gen5 = 0; // Buyut+
    let deceased = 0;

    const traverse = (n: FamilyMember, depth: number) => {
      // Count the member
      total++;
      if (n.isDeceased) deceased++;
      
      // Count the spouse if exists
      if (n.spouse && n.spouse.trim() !== '') {
        total++;
        if (n.spouseIsDeceased) deceased++;
      }

      if (depth === 2) gen2++;
      else if (depth === 3) gen3++;
      else if (depth === 4) gen4++;
      else if (depth >= 5) gen5++;

      if (n.children) {
        n.children.forEach(child => traverse(child, depth + 1));
      }
    };

    traverse(node, 0);
    return { total, gen2, gen3, gen4, gen5, deceased };
  };

  const stats = getStats(familyData);
  const [pdfStats, setPdfStats] = useState(stats);
  const [pdfData, setPdfData] = useState<FamilyMember | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDownloadModalOpen, setIsDownloadModalOpen] = useState(false);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FamilyMember[]>([]);
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);

  const scrollToMember = (memberId: string) => {
    // Wait for potential expansion in FamilyTreeInteractive
    setTimeout(() => {
      const element = document.getElementById(`member-${memberId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Add a temporary highlight effect
        element.classList.add('ring-offset-4', 'ring-brand-olive', 'ring-4');
        setTimeout(() => {
          element.classList.remove('ring-offset-4');
        }, 3000);
      }
    }, 300);
  };

  const handleSearch = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim()) return;

    setSearchTerm(searchQuery);

    // Find all matching members in the data
    const findAllMatches = (node: FamilyMember, term: string, gen: number = 1): FamilyMember[] => {
      let matches: FamilyMember[] = [];
      const lowerTerm = term.toLowerCase();
      
      if (node.name.toLowerCase().includes(lowerTerm) || (node.spouse?.toLowerCase().includes(lowerTerm))) {
        matches.push({ ...node, generation: gen });
      }
      
      if (node.children) {
        for (const child of node.children) {
          matches = [...matches, ...findAllMatches(child, term, gen + 1)];
        }
      }
      return matches;
    };

    if (familyData) {
      const matches = findAllMatches(familyData, searchQuery);
      
      if (matches.length === 0) {
        alert(`Maaf, kata kunci "${searchQuery}" tidak ditemukan dalam silsilah keluarga.`);
      } else if (matches.length === 1) {
        scrollToMember(matches[0].id);
      } else {
        setSearchResults(matches);
        setIsSearchModalOpen(true);
      }
    }
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setIsAuthReady(true);
      if (firebaseUser) {
        // Sync User Profile
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          let profile = userSnap.data() as UserProfile;
          // Force admin role for the specific admin emails
          const isMainAdmin = firebaseUser.email === 'databasemtskhwm@gmail.com' || firebaseUser.email === 'admin@keluarga.com';
          if (isMainAdmin && (profile.role !== 'admin' || profile.status !== 'approved')) {
            const updatedProfile = { ...profile, role: 'admin' as const, status: 'approved' as const };
            await setDoc(userRef, updatedProfile);
            profile = updatedProfile;
          }
          setUserProfile(profile);
        } else {
          // Create default profile
          const isMainAdmin = firebaseUser.email === 'databasemtskhwm@gmail.com' || firebaseUser.email === 'admin@keluarga.com';
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || (isMainAdmin ? 'Admin Utama' : ''),
            role: isMainAdmin ? 'admin' : 'viewer',
            status: isMainAdmin ? 'approved' : 'pending',
            requestedAt: new Date().toISOString()
          };
          await setDoc(userRef, newProfile);
          setUserProfile(newProfile);
        }
      } else {
        setUserProfile(null);
      }
    });

    // Listen to Global Settings (Family Tree, History, Last Update)
    const unsubscribeSettings = onSnapshot(doc(db, 'settings', 'global'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        setFamilyData(data.familyTree);
        setHistoryText(data.history);
        setLastUpdate(data.lastUpdate);
      } else {
        // Fallback to API if Firebase is empty (for migration)
        fetch('/api/family').then(res => res.json()).then(fData => setFamilyData(fData));
        fetch('/api/history').then(res => res.json()).then(hData => setHistoryText(hData.history));
        fetch('/api/last-update').then(res => res.json()).then(uData => setLastUpdate(uData.lastUpdate));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'settings/global');
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

    const handlePopState = () => {
      setIsAdmin(window.location.pathname === '/admin');
      setIsLogin(window.location.pathname === '/login');
      setIsGallery(window.location.pathname === '/gallery');
    };
    window.addEventListener('popstate', handlePopState);

    return () => {
      unsubscribeAuth();
      unsubscribeSettings();
      unsubscribeGallery();
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  const navigateTo = (path: string) => {
    window.history.pushState({}, '', path);
    setIsAdmin(path === '/admin');
    setIsLogin(path === '/login');
    setIsGallery(path === '/gallery');
  };

  const handleLogin = (userData: FirebaseUser) => {
    setUser(userData);
    navigateTo('/admin');
  };

  const handleLogout = async () => {
    await logout();
    setUser(null);
    navigateTo('/');
  };

  const handleTTS = async () => {
    if (isSpeaking) return;
    setIsSpeaking(true);
    try {
      await generateSpeech("Selamat datang di silsilah keluarga K H Zaenal Muhsin. Sebuah warisan kasih sayang dan persatuan yang melintasi generasi.");
    } catch (err) {
      console.error("TTS Playback failed:", err);
      alert("Maaf, suara sambutan tidak dapat diputar saat ini.");
    } finally {
      setIsSpeaking(false);
    }
  };

  const downloadPDF = async (filteredData?: FamilyMember) => {
    const element = document.getElementById('pdf-content');
    if (!element) return;

    // Update PDF state
    const dataToUse = filteredData || familyData;
    setPdfData(dataToUse);
    setPdfStats(getStats(dataToUse));

    // Wait for state update and re-render
    await new Promise(resolve => setTimeout(resolve, 100));

    // Show the hidden content temporarily
    element.style.display = 'block';
    
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#fdfcfb'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      
      const bottomMargin = 25; // 2.5cm bottom margin
      const topMarginRest = 25; // 2.5cm top margin for page 2+
      const topMargin1 = 0; // No top margin for page 1
      
      const imgProps = pdf.getImageProperties(imgData);
      const imgWidth = pdfWidth;
      const imgHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      let heightLeft = imgHeight;
      let currentPage = 1;
      let canvasOffset = 0;

      while (heightLeft > 0) {
        if (currentPage > 1) {
          pdf.addPage();
        }
        
        const currentTopMargin = currentPage === 1 ? topMargin1 : topMarginRest;
        const currentEffectiveHeight = pdfHeight - bottomMargin - currentTopMargin;
        
        // The y position for addImage is where the TOP of the whole image should be.
        // We want the part of the image at 'canvasOffset' to be at 'currentTopMargin'.
        const yPos = currentTopMargin - canvasOffset;
        
        pdf.addImage(imgData, 'PNG', 0, yPos, imgWidth, imgHeight);
        
        // Masking to ensure clean margins
        pdf.setFillColor(253, 252, 251); // Match background color #fdfcfb
        
        // Top mask (only if there is a top margin)
        if (currentTopMargin > 0) {
          pdf.rect(0, 0, pdfWidth, currentTopMargin, 'F');
        }
        
        // Bottom mask
        pdf.rect(0, pdfHeight - bottomMargin, pdfWidth, bottomMargin, 'F');
        
        // Footer with page number
        pdf.setFontSize(10);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`Halaman ${currentPage}`, pdfWidth / 2, pdfHeight - 10, { align: 'center' });

        canvasOffset += currentEffectiveHeight;
        heightLeft -= currentEffectiveHeight;
        currentPage++;
      }
      
      pdf.save(`Silsilah_Bani_Muhsin_${new Date().getTime()}.pdf`);
    } catch (err) {
      console.error("PDF Generation Error:", err);
      alert("Gagal mengunduh PDF.");
    } finally {
      element.style.display = 'none';
    }
  };

  const requestEditorAccess = async () => {
    if (!user || !userProfile) return;
    try {
      const userRef = doc(db, 'users', user.uid);
      const updatedProfile: UserProfile = {
        ...userProfile,
        role: 'editor',
        status: 'pending',
        requestedAt: new Date().toISOString()
      };
      await setDoc(userRef, updatedProfile);
      setUserProfile(updatedProfile);
      alert('Permintaan akses editor telah dikirim. Tunggu persetujuan admin.');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'users/' + user.uid);
      alert('Gagal mengirim permintaan.');
    }
  };

  if (isLogin) {
    return <LoginPage onLogin={handleLogin} onBack={() => navigateTo('/')} />;
  }

  if (isAdmin) {
    if (!user) {
      navigateTo('/login');
      return null;
    }
    return <AdminPage user={user} userProfile={userProfile} onLogout={handleLogout} />;
  }

  if (isGallery) {
    // Group gallery by head of family
    const groupedGallery = gallery.reduce((acc, item) => {
      const groupKey = item.headOfFamilyId || 'umum';
      const groupName = item.headOfFamilyName || 'Lainnya / Umum';
      
      if (!acc[groupKey]) {
        acc[groupKey] = {
          name: groupName,
          items: []
        };
      }
      acc[groupKey].items.push(item);
      return acc;
    }, {} as Record<string, { name: string, items: GalleryItem[] }>);

    return (
      <ErrorBoundary>
        <div className="min-h-screen bg-brand-cream p-6 md:p-12">
          <div className="max-w-7xl mx-auto">
            <div className="flex justify-between items-center mb-12">
              <div>
                <button onClick={() => navigateTo('/')} className="flex items-center text-brand-olive hover:underline mb-2 text-sm">
                  <ArrowLeft size={16} className="mr-1" /> Kembali
                </button>
                <h1 className="serif text-5xl font-bold">Galeri Keluarga</h1>
                <p className="text-brand-ink/60 mt-2 italic">Momen berharga Bani Muhsin perkepala keluarga</p>
              </div>
              <ImageIcon size={48} className="text-brand-olive/20" />
            </div>

            {Object.keys(groupedGallery).length === 0 ? (
              <div className="text-center py-20 bg-white/50 rounded-3xl border border-brand-olive/10">
                <ImageIcon size={48} className="mx-auto text-brand-olive/20 mb-4" />
                <p className="serif text-2xl text-brand-olive/40 italic">Belum ada foto di galeri.</p>
              </div>
            ) : (
              <div className="space-y-16">
                {Object.entries(groupedGallery).map(([id, group]) => (
                  <div key={id} className="space-y-6">
                    <div className="flex items-center gap-4">
                      <h2 className="serif text-3xl font-semibold text-brand-olive">{group.name}</h2>
                      <div className="flex-grow h-px bg-brand-olive/10"></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                      {group.items.map((item) => (
                        <motion.div
                          key={item.id}
                          initial={{ opacity: 0, scale: 0.95 }}
                          whileInView={{ opacity: 1, scale: 1 }}
                          viewport={{ once: true }}
                          className="bg-white p-4 rounded-3xl shadow-sm border border-brand-olive/5 group hover:shadow-xl transition-all"
                        >
                          <div className="aspect-[4/3] rounded-2xl overflow-hidden mb-4">
                            <img 
                              src={item.imageUrl} 
                              alt={item.caption} 
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          <h3 className="font-bold text-brand-ink mb-1">{item.caption}</h3>
                          <div className="flex justify-between items-center text-[10px] text-brand-ink/40 uppercase tracking-widest">
                            <span>{new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                            <span>Oleh: {item.uploadedBy}</span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex flex-col selection:bg-brand-olive selection:text-white relative">
        {/* Global Background Image */}
        <div className="fixed inset-0 z-[-1]">
          <img 
            src="https://lh3.googleusercontent.com/d/1qHSjo3QC70Y0qO0wXVunqFfafaQAfXTo" 
            alt="" 
            className="w-full h-full object-cover opacity-40"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-brand-cream/60 backdrop-blur-[2px]"></div>
        </div>

        {/* Navigation */}
      <nav className="sticky top-0 z-50 p-6 flex justify-between items-center border-b border-brand-olive/10 bg-white/40 backdrop-blur-md">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigateTo('/')}>
          <TreeDeciduous className="text-brand-olive" size={24} />
          <span className="serif text-2xl font-semibold tracking-tight">Bani Muhsin</span>
        </div>
        <div className="hidden md:flex gap-8 text-sm uppercase tracking-widest font-medium opacity-70 items-center">
          <a href="#history" className="hover:opacity-100 transition-opacity">Sejarah</a>
          <a href="#tree" className="hover:opacity-100 transition-opacity">Silsilah</a>
          <button onClick={() => navigateTo('/gallery')} className="hover:opacity-100 transition-opacity">Galeri</button>
          {user && userProfile && (userProfile.role === 'admin' || (userProfile.role === 'editor' && userProfile.status === 'approved')) ? (
            <div className="flex items-center gap-4">
              <button onClick={() => navigateTo('/admin')} className="hover:opacity-100 transition-opacity flex items-center gap-1">
                <Settings size={14} /> {userProfile.role === 'admin' ? 'Admin' : 'Editor'}
              </button>
              <button onClick={handleLogout} className="hover:text-rose-600 transition-colors flex items-center gap-1 text-rose-500/80">
                <LogOut size={14} /> Keluar
              </button>
            </div>
          ) : user && userProfile && userProfile.role === 'viewer' ? (
            <div className="flex items-center gap-4">
              <button 
                onClick={requestEditorAccess}
                className="flex items-center gap-2 px-3 py-1 bg-brand-olive/10 text-brand-olive rounded-full text-[10px] font-bold hover:bg-brand-olive/20 transition-all"
              >
                <Settings size={12} /> Ajukan Jadi Editor
              </button>
              <button onClick={handleLogout} className="hover:text-rose-600 transition-colors flex items-center gap-1 text-rose-500/80">
                <LogOut size={14} /> Keluar
              </button>
            </div>
          ) : !user ? (
            <button onClick={() => navigateTo('/login')} className="hover:opacity-100 transition-opacity flex items-center gap-1">
              <LogIn size={14} /> Masuk
            </button>
          ) : (
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 px-3 py-1 bg-amber-50 text-amber-600 rounded-full text-[10px] font-bold">
                <Settings size={12} className="animate-spin" /> Menunggu Persetujuan
              </div>
              <button onClick={handleLogout} className="hover:text-rose-600 transition-colors flex items-center gap-1 text-rose-500/80">
                <LogOut size={14} /> Keluar
              </button>
            </div>
          )}
        </div>
        <button 
          onClick={handleTTS}
          disabled={isSpeaking}
          className="p-2 rounded-full border border-brand-olive/20 hover:bg-brand-olive hover:text-white transition-all disabled:opacity-50"
          title="Dengarkan Sambutan"
        >
          <Volume2 size={20} className={isSpeaking ? "animate-pulse" : ""} />
        </button>
      </nav>

      <main className="flex-grow">
        {/* Hero Section */}
        <section className="relative h-[600px] md:h-[700px] flex items-center justify-center overflow-hidden">
          <div className="absolute inset-0 z-0">
            <img 
              src="https://lh3.googleusercontent.com/d/1qHSjo3QC70Y0qO0wXVunqFfafaQAfXTo" 
              alt="Family Background" 
              className="w-full h-full object-cover hover:scale-105 transition-all duration-1000"
              referrerPolicy="no-referrer"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-brand-ink/40 via-transparent to-brand-ink/60"></div>
          </div>

          <div className="relative z-10 text-center px-6 max-w-4xl">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
            >
              <div className="inline-block px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-bold uppercase tracking-widest mb-6 shadow-xl">
                Keluarga Besar Bani KH. Wahab Muhsin
              </div>
              <h1 className="serif text-5xl md:text-8xl text-white font-bold leading-tight mb-8 drop-shadow-2xl">
                Menjaga Silaturahmi, <br/>
                <span className="italic font-light">Merajut Masa Depan</span>
              </h1>
              
              <div className="inline-block bg-white/10 backdrop-blur-lg border border-white/20 rounded-3xl px-8 py-4 max-w-2xl mx-auto mb-12 shadow-2xl relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-50"></div>
                <p className="relative z-10 text-white text-lg md:text-xl leading-relaxed font-light drop-shadow-sm">
                  Platform digital untuk mempererat tali persaudaraan dan melestarikan sejarah keluarga besar Bani KH. Wahab Muhsin.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <a href="#tree" className="bg-brand-olive text-white px-8 py-4 rounded-full text-sm font-medium hover:shadow-lg hover:shadow-brand-olive/20 transition-all">
                  Lihat Silsilah Keluarga
                </a>
                <a href="#history" className="border border-white/20 text-white px-8 py-4 rounded-full text-sm font-medium hover:bg-white/5 transition-all">
                  Baca Sejarah
                </a>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Dashboard Stats */}
        <section className="px-6 py-20 md:py-32 max-w-7xl mx-auto text-center">
          <div className="max-w-6xl mx-auto">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="grid grid-cols-2 md:grid-cols-6 gap-6"
            >
              <div className="bg-white/40 backdrop-blur-lg p-8 rounded-[2rem] border border-white/40 shadow-xl shadow-brand-olive/5 hover:shadow-2xl hover:-translate-y-1 transition-all group">
                <div className="text-brand-olive mb-4 group-hover:scale-110 transition-transform flex justify-center">
                  <Users size={32} />
                </div>
                <div className="text-4xl font-bold serif text-brand-ink mb-1">{stats.total}</div>
                <div className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40">Total Anggota</div>
              </div>
              
              <div className="bg-white/40 backdrop-blur-lg p-8 rounded-[2rem] border border-white/40 shadow-xl shadow-brand-olive/5 hover:shadow-2xl hover:-translate-y-1 transition-all group">
                <div className="text-blue-600 mb-4 group-hover:scale-110 transition-transform flex justify-center">
                  <TreeDeciduous size={32} />
                </div>
                <div className="text-4xl font-bold serif text-brand-ink mb-1">{stats.gen2}</div>
                <div className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40">Anak</div>
              </div>

              <div className="bg-white/40 backdrop-blur-lg p-8 rounded-[2rem] border border-white/40 shadow-xl shadow-brand-olive/5 hover:shadow-2xl hover:-translate-y-1 transition-all group">
                <div className="text-emerald-600 mb-4 group-hover:scale-110 transition-transform flex justify-center">
                  <Heart size={32} />
                </div>
                <div className="text-4xl font-bold serif text-brand-ink mb-1">{stats.gen3}</div>
                <div className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40">Cucu</div>
              </div>

              <div className="bg-white/40 backdrop-blur-lg p-8 rounded-[2rem] border border-white/40 shadow-xl shadow-brand-olive/5 hover:shadow-2xl hover:-translate-y-1 transition-all group">
                <div className="text-amber-600 mb-4 group-hover:scale-110 transition-transform flex justify-center">
                  <History size={32} />
                </div>
                <div className="text-4xl font-bold serif text-brand-ink mb-1">{stats.gen4}</div>
                <div className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40">Cicit</div>
              </div>

              <div className="bg-white/40 backdrop-blur-lg p-8 rounded-[2rem] border border-white/40 shadow-xl shadow-brand-olive/5 hover:shadow-2xl hover:-translate-y-1 transition-all group">
                <div className="text-rose-600 mb-4 group-hover:scale-110 transition-transform flex justify-center">
                  <Users size={32} />
                </div>
                <div className="text-4xl font-bold serif text-brand-ink mb-1">{stats.gen5}</div>
                <div className="text-[10px] uppercase tracking-[0.2em] font-bold opacity-40">Buyut+</div>
              </div>

              <div className="bg-emerald-900/10 backdrop-blur-lg p-8 rounded-[2rem] border border-emerald-900/20 shadow-xl shadow-emerald-900/5 hover:shadow-2xl hover:-translate-y-1 transition-all group col-span-2 md:col-span-1">
                <div className="text-emerald-800 mb-4 group-hover:scale-110 transition-transform flex justify-center">
                  <Flower2 size={32} />
                </div>
                <div className="text-4xl font-bold serif text-emerald-950 mb-1">{stats.deceased}</div>
                <div className="text-[10px] uppercase tracking-[0.2em] font-bold text-emerald-900/40">Almarhum/ah</div>
              </div>
            </motion.div>

            <div className="flex flex-wrap justify-center gap-4">
              <a href="#tree" className="bg-brand-olive text-white px-8 py-4 rounded-full text-sm font-medium hover:shadow-lg transition-all">
                Lihat Silsilah
              </a>
            </div>
          </div>
        </section>

        {/* Spiritual Foundation Section */}
        <section className="px-6 py-32 relative overflow-hidden">
          <div className="absolute inset-0 bg-white/30 backdrop-blur-sm"></div>
          <div className="max-w-5xl mx-auto text-center relative z-10">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.2 }}
              className="space-y-16 p-12 rounded-[3rem] border border-white/50 bg-white/20 backdrop-blur-xl shadow-2xl"
            >
              <div className="serif text-4xl md:text-5xl text-brand-olive opacity-90 tracking-widest">
                بسم الله الرحمن الرحيم
              </div>
              
              <div className="space-y-8">
                <p className="serif text-3xl md:text-5xl leading-[1.6] text-brand-ink" dir="rtl">
                  وَالَّذِيْنَ يَنْقُضُوْنَ عَهْدَ اللّٰهِ مِنْ ۢ بَعْدِ مِيْثَاقِهٖ وَيَقْطَعُوْنَ مَآ اَمَرَ اللّٰهُ بِهٖٓ اَنْ يُّوصَلَ وَيُفْسِدُوْنَ فِى الْاَرْضِۙ اُولٰۤىِٕكَ لَهُمُ اللَّعْنَةُ وَلَهُمْ سُوْۤءُ الدَّارِ
                </p>
                <p className="italic text-brand-ink/80 text-xl md:text-2xl leading-relaxed max-w-4xl mx-auto font-light">
                  “ Orang-orang yang melanggar perjanjian (dengan) Allah setelah diteguhkan, memutuskan apa yang diperintahkan Allah untuk disambungkan (seperti silaturahmi), dan berbuat kerusakan di bumi; mereka itulah orang-orang yang mendapat laknat dan bagi mereka tempat kediaman yang buruk (Jahanam) ”
                </p>
              </div>

              <div className="w-24 h-px bg-brand-olive/30 mx-auto"></div>

              <div className="space-y-8">
                <p className="serif text-2xl md:text-4xl text-brand-ink" dir="rtl">
                  قال رسول الله ﷺ : لا يدخل الجنة قاطع ( متفق عليه )
                </p>
                <p className="italic text-brand-ink/80 text-xl md:text-2xl leading-relaxed font-light">
                  “Tidak akan masuk surga orang yang memutuskan silaturahmi”
                </p>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Stats/Features */}
        <section className="bg-white/40 py-20 border-y border-brand-olive/5">
          <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-3 gap-12">
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-brand-olive/10 flex items-center justify-center mb-6">
                <Users className="text-brand-olive" size={24} />
              </div>
              <h3 className="serif text-2xl mb-2">Ratusan Anggota</h3>
              <p className="text-sm text-brand-ink/60">Tersebar di berbagai penjuru, namun tetap satu dalam doa.</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-brand-olive/10 flex items-center justify-center mb-6">
                <History className="text-brand-olive" size={24} />
              </div>
              <h3 className="serif text-2xl mb-2">7 Generasi</h3>
              <p className="text-sm text-brand-ink/60">Menelusuri jejak langkah leluhur dari masa ke masa.</p>
            </div>
            <div className="flex flex-col items-center text-center">
              <div className="w-12 h-12 rounded-full bg-brand-olive/10 flex items-center justify-center mb-6">
                <Heart className="text-brand-olive" size={24} />
              </div>
              <h3 className="serif text-2xl mb-2">Satu Visi</h3>
              <p className="text-sm text-brand-ink/60">Membangun keluarga yang bertaqwa dan bermanfaat.</p>
            </div>
          </div>
        </section>

        {/* Family Tree Section */}
        <section id="tree" className="px-6 py-32 max-w-7xl mx-auto relative">
          <div className="mb-20 text-center">
            <h2 className="serif text-5xl md:text-7xl mb-6 tracking-tight">Pohon Silsilah</h2>
            <div className="w-32 h-1 bg-brand-olive/20 mx-auto mb-8 rounded-full"></div>
            <p className="text-brand-ink/60 text-lg mb-4 font-light">Klik dan telusuri garis keturunan Bani Muhsin</p>
            
            {lastUpdate && (
              <p className="text-[11px] uppercase tracking-[0.3em] text-brand-olive/60 font-bold mb-10">
                Terakhir diperbarui: {new Date(lastUpdate).toLocaleString('id-ID', { 
                  day: 'numeric', 
                  month: 'long', 
                  year: 'numeric', 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })} WIB
              </p>
            )}
            
            <button 
              onClick={() => setIsDownloadModalOpen(true)}
              className="inline-flex items-center gap-3 bg-white/60 backdrop-blur-md border border-brand-olive/20 text-brand-olive px-10 py-4 rounded-full text-sm font-bold hover:bg-brand-olive hover:text-white transition-all shadow-xl shadow-brand-olive/5 hover:shadow-2xl"
            >
              <Download size={18} /> Unduh Dokumen Silsilah (PDF)
            </button>
          </div>
          <div className="bg-white/30 backdrop-blur-md p-4 md:p-12 rounded-[3rem] border border-white/50 shadow-2xl">
            <div className="max-w-md mx-auto mb-10 relative">
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-grow">
                  <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-brand-olive/40">
                    <Users size={18} />
                  </div>
                  <input 
                    type="text" 
                    placeholder="Cari nama anggota keluarga..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white/50 backdrop-blur-md border border-brand-olive/20 rounded-full py-4 pl-12 pr-6 text-sm focus:outline-none focus:ring-2 focus:ring-brand-olive/30 transition-all shadow-lg"
                  />
                </div>
                <button 
                  type="submit"
                  className="bg-brand-olive text-white px-6 py-4 rounded-full text-sm font-bold hover:shadow-lg transition-all"
                >
                  Cari
                </button>
              </form>
            </div>
            <FamilyTreeInteractive data={familyData} searchTerm={searchTerm} />
          </div>
        </section>

        {/* Download Modal */}
        <AnimatePresence>
          {isDownloadModalOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white rounded-[2.5rem] overflow-hidden shadow-2xl max-w-lg w-full relative border border-brand-olive/10 p-8 md:p-10"
              >
                <button 
                  onClick={() => setIsDownloadModalOpen(false)}
                  className="absolute top-6 right-6 p-2 rounded-full bg-brand-cream text-brand-ink/60 hover:text-brand-olive transition-colors"
                >
                  <X size={20} />
                </button>

                <h2 className="serif text-3xl mb-4">Unduh Silsilah</h2>
                <p className="text-brand-ink/60 text-sm mb-8">Pilih cabang keluarga yang ingin Anda sertakan dalam dokumen PDF.</p>

                <div className="space-y-4 max-h-[40vh] overflow-y-auto mb-8 pr-2 custom-scrollbar">
                  <label className="flex items-center gap-4 p-4 rounded-2xl bg-brand-cream/50 border border-brand-olive/10 cursor-pointer hover:bg-brand-cream transition-colors">
                    <input 
                      type="checkbox" 
                      checked={selectedBranches.length === (familyData?.children?.flatMap(w => w.children || [])?.length || 0)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const allIds = familyData?.children?.flatMap(w => w.children || [])?.map(c => c.id) || [];
                          setSelectedBranches(allIds);
                        } else {
                          setSelectedBranches([]);
                        }
                      }}
                      className="w-5 h-5 rounded border-brand-olive/20 text-brand-olive focus:ring-brand-olive"
                    />
                    <span className="font-bold text-brand-ink">Pilih Semua Keluarga</span>
                  </label>

                  <div className="grid grid-cols-1 gap-3">
                    {familyData?.children?.map(wife => (
                      <div key={wife.id} className="space-y-3">
                        <div className="text-[10px] uppercase tracking-widest font-bold text-brand-olive/40 mt-4 px-2">Keluarga {wife.name}</div>
                        {wife.children?.map(child => (
                          <label key={child.id} className="flex items-center gap-4 p-4 rounded-2xl border border-brand-olive/5 hover:border-brand-olive/20 cursor-pointer transition-all">
                            <input 
                              type="checkbox" 
                              checked={selectedBranches.includes(child.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedBranches([...selectedBranches, child.id]);
                                } else {
                                  setSelectedBranches(selectedBranches.filter(id => id !== child.id));
                                }
                              }}
                              className="w-5 h-5 rounded border-brand-olive/20 text-brand-olive focus:ring-brand-olive"
                            />
                            <div className="flex flex-col">
                              <span className="font-medium text-brand-ink">{child.name}</span>
                              <span className="text-[10px] text-brand-ink/40 italic">Keturunan {child.name}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={() => {
                      if (selectedBranches.length === 0) {
                        alert('Silakan pilih minimal satu cabang keluarga.');
                        return;
                      }
                      
                      // Filter family data
                      if (!familyData) return;
                      const filtered: FamilyMember = {
                        ...familyData,
                        children: familyData.children?.map(wife => ({
                          ...wife,
                          children: wife.children?.filter(child => selectedBranches.includes(child.id))
                        })).filter(wife => (wife.children?.length || 0) > 0)
                      };
                      
                      downloadPDF(filtered);
                      setIsDownloadModalOpen(false);
                    }}
                    className="flex-grow bg-brand-olive text-white py-4 rounded-full font-bold hover:shadow-xl transition-all flex items-center justify-center gap-2"
                  >
                    <Download size={18} /> Unduh Sekarang
                  </button>
                  <button
                    onClick={() => setIsDownloadModalOpen(false)}
                    className="px-8 py-4 rounded-full border border-brand-olive/10 text-brand-ink/60 hover:bg-brand-cream transition-all"
                  >
                    Batal
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Search Results Modal */}
        <AnimatePresence>
          {isSearchModalOpen && (
            <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white rounded-[2.5rem] overflow-hidden shadow-2xl max-w-lg w-full relative border border-brand-olive/10 p-8 md:p-10"
              >
                <button 
                  onClick={() => setIsSearchModalOpen(false)}
                  className="absolute top-6 right-6 p-2 rounded-full bg-brand-cream text-brand-ink/60 hover:text-brand-olive transition-colors"
                >
                  <X size={20} />
                </button>

                <h2 className="serif text-3xl mb-4">Hasil Pencarian</h2>
                <p className="text-brand-ink/60 text-sm mb-8">Ditemukan {searchResults.length} anggota keluarga yang cocok dengan kata kunci "{searchTerm}". Silakan pilih salah satu:</p>

                <div className="space-y-3 max-h-[50vh] overflow-y-auto mb-8 pr-2 custom-scrollbar">
                  {searchResults.map((member) => (
                    <button
                      key={member.id}
                      onClick={() => {
                        scrollToMember(member.id);
                        setIsSearchModalOpen(false);
                      }}
                      className="w-full flex items-center gap-4 p-4 rounded-2xl bg-brand-cream/30 border border-brand-olive/5 hover:border-brand-olive/30 hover:bg-brand-cream transition-all text-left group"
                    >
                      <div className="w-10 h-10 rounded-full bg-brand-olive/10 flex items-center justify-center text-brand-olive group-hover:bg-brand-olive group-hover:text-white transition-colors">
                        <Users size={18} />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-brand-ink">{member.name}</span>
                        <span className="text-[10px] text-brand-ink/40 italic">
                          {member.type === 'ancestor' ? 'Leluhur Utama' : 
                           member.type === 'spouse' ? `Pasangan dari ${member.name}` : 
                           `Generasi ke-${member.generation || '?'}`}
                          {member.spouse && ` • Pasangan: ${member.spouse}`}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setIsSearchModalOpen(false)}
                  className="w-full py-4 rounded-full border border-brand-olive/10 text-brand-ink/60 hover:bg-brand-cream transition-all font-bold"
                >
                  Tutup
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Hidden PDF Template */}
        <div id="pdf-content" style={{ display: 'none', width: '850px', padding: '60px', background: '#fdfcfb', color: '#1a1a1a', fontFamily: 'serif' }}>
          {/* Modern Header */}
          <div style={{ textAlign: 'center', marginBottom: '50px' }}>
            <div style={{ fontSize: '10px', letterSpacing: '4px', textTransform: 'uppercase', color: '#6b705c', marginBottom: '10px', fontWeight: 'bold' }}>Arsip Keluarga Besar</div>
            <h1 style={{ fontSize: '36px', margin: '0', color: '#3d4a3e', fontWeight: '300', letterSpacing: '-1px' }}>Silsilah Bani Muhsin</h1>
            <div style={{ width: '40px', height: '2px', background: '#3d4a3e', margin: '20px auto' }}></div>
            <p style={{ fontSize: '14px', fontStyle: 'italic', opacity: 0.6 }}>"Menjaga Akar, Menumbuhkan Masa Depan"</p>
          </div>

          {/* Stats Grid - Modern Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', marginBottom: '50px' }}>
            {[
              { label: 'Total', val: pdfStats.total, color: '#3d4a3e' },
              { label: 'Anak', val: pdfStats.gen2, color: '#2563eb' },
              { label: 'Cucu', val: pdfStats.gen3, color: '#059669' },
              { label: 'Cicit', val: pdfStats.gen4, color: '#d97706' },
              { label: 'Buyut+', val: pdfStats.gen5, color: '#e11d48' },
              { label: 'Alm/Almh', val: pdfStats.deceased, color: '#6b705c' }
            ].map((s, i) => (
              <div key={i} style={{ background: 'white', padding: '15px 5px', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', textAlign: 'center', border: '1px solid rgba(61,74,62,0.05)' }}>
                <div style={{ fontSize: '20px', fontWeight: 'bold', color: s.color, marginBottom: '4px' }}>{s.val}</div>
                <div style={{ fontSize: '8px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.5, fontWeight: 'bold' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Metadata Section */}
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', opacity: 0.5, marginBottom: '40px', padding: '0 10px' }}>
            <div>Update Terakhir: {lastUpdate ? new Date(lastUpdate).toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-'} WIB</div>
            <div>Dicetak Pada: {new Date().toLocaleString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })} WIB</div>
          </div>

          {/* Full Tree Recursive Rendering */}
          <div style={{ background: 'white', padding: '40px', borderRadius: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.02)', border: '1px solid rgba(61,74,62,0.05)' }}>
            <h2 style={{ fontSize: '20px', marginBottom: '30px', color: '#3d4a3e', textAlign: 'center' }}>Struktur Lengkap Garis Keturunan</h2>
            
            {/* Recursive Function for PDF */}
            {(() => {
              const renderPdfNode = (node: FamilyMember, depth: number): React.ReactNode => {
                const getFontSize = (d: number) => {
                  const sizes = ['18pt', '16pt', '14pt', '12pt', '11pt'];
                  return sizes[Math.min(d, sizes.length - 1)];
                };

                const isBold = depth <= 3;
                const displayName = (depth === 2 || depth === 3) ? node.name.toUpperCase() : node.name;

                return (
                  <div key={node.id} style={{ marginLeft: depth > 0 ? '25px' : '0', marginTop: depth === 1 ? '20px' : '8px', position: 'relative' }}>
                    {depth > 0 && (
                      <div style={{ position: 'absolute', left: '-15px', top: '12px', width: '10px', height: '1px', background: 'rgba(0,0,0,0.1)' }}></div>
                    )}
                    <div style={{ 
                      fontSize: getFontSize(depth),
                      fontWeight: isBold ? 'bold' : 'normal',
                      color: node.isDeceased ? '#6b705c' : '#1a1a1a',
                      display: 'flex',
                      alignItems: 'center'
                    }}>
                      {(depth === 1 || node.type === 'spouse') && <span style={{ marginRight: '6px', color: '#be123c' }}>♥</span>}
                      {depth >= 2 && node.type !== 'spouse' && <span style={{ marginRight: '6px', opacity: 0.3 }}>•</span>}
                      {displayName}
                      {node.isDeceased ? (
                        <span style={{ fontSize: '9pt', color: '#6b705c', marginLeft: '6px', fontStyle: 'italic' }}>(Alm/Almh)</span>
                      ) : (
                        <span style={{ fontSize: '8pt', color: '#059669', marginLeft: '6px', opacity: 0.4 }}>(Hidup)</span>
                      )}
                      {node.spouse && (
                        <span style={{ fontSize: '10pt', opacity: 0.5, fontStyle: 'italic', marginLeft: '8px', fontWeight: 'normal' }}> 
                          (Pasangan: {node.spouse} {node.spouseIsDeceased ? <span style={{ color: '#6b705c' }}>[Alm/Almh]</span> : <span style={{ color: '#059669' }}>[Hidup]</span>})
                        </span>
                      )}
                    </div>
                    {node.children && node.children.map(child => renderPdfNode(child, depth + 1))}
                  </div>
                );
              };
              return pdfData ? renderPdfNode(pdfData, 0) : null;
            })()}
          </div>

          <div style={{ marginTop: '60px', textAlign: 'center', fontSize: '10px', opacity: 0.3, letterSpacing: '1px' }}>
            DOKUMEN RESMI KELUARGA BANI MUHSIN • GENERATED BY DIGITAL GENEALOGY SYSTEM
          </div>
        </div>

        {/* History Section */}
        <section id="history" className="px-6 py-32 relative overflow-hidden">
          <div className="absolute inset-0 bg-brand-olive/90 backdrop-blur-md"></div>
          <div className="max-w-5xl mx-auto relative z-10 text-white">
            <span className="text-xs uppercase tracking-[0.5em] font-bold text-white/50 mb-6 block">
              Kisah Kami
            </span>
            <h2 className="serif text-5xl md:text-8xl mb-16 italic font-light">Asal Usul Bani Muhsin</h2>
            <div className="space-y-10 text-xl md:text-2xl text-white/90 leading-[1.8] font-light whitespace-pre-wrap">
              {historyText || "Memuat sejarah..."}
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="p-12 border-t border-brand-olive/10 text-center">
        <div className="flex items-center justify-center gap-2 mb-6">
          <TreeDeciduous className="text-brand-olive" size={20} />
          <span className="serif text-xl font-semibold">Bani Muhsin</span>
        </div>
        <p className="text-xs uppercase tracking-widest opacity-50">
          &copy; {new Date().getFullYear()} Keluarga Besar Bani Muhsin. Dibuat dengan cinta.
        </p>
      </footer>
      </div>
    </ErrorBoundary>
  );
}

