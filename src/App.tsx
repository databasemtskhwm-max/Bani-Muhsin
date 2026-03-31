import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { FamilyTreeInteractive } from './components/FamilyTreeInteractive';
import { AdminPage } from './pages/AdminPage';
import { LoginPage } from './pages/LoginPage';
import { generateSpeech } from './services/ttsService';
import { Volume2, TreeDeciduous, Users, History, Heart, Settings, Download, LogIn, Newspaper, Calendar, User as UserIcon, Flower2, ChevronLeft, ChevronRight, Image as ImageIcon, ArrowLeft, LogOut } from 'lucide-react';
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
  const [news, setNews] = useState<NewsItem[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [isAdmin, setIsAdmin] = useState(window.location.pathname === '/admin');
  const [isLogin, setIsLogin] = useState(window.location.pathname === '/login');
  const [isGallery, setIsGallery] = useState(window.location.pathname === '/gallery');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setIsAuthReady(true);
      if (firebaseUser) {
        // Sync User Profile
        const userRef = doc(db, 'users', firebaseUser.uid);
        const userSnap = await getDoc(userRef);
        
        if (userSnap.exists()) {
          setUserProfile(userSnap.data() as UserProfile);
        } else {
          // Create default profile
          const newProfile: UserProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || '',
            role: 'viewer',
            status: 'pending',
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

    // Listen to News
    const unsubscribeNews = onSnapshot(collection(db, 'news'), (snapshot) => {
      const newsData = snapshot.docs.map(doc => doc.data() as NewsItem);
      if (newsData.length > 0) {
        setNews(newsData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
      } else {
        fetch('/api/news').then(res => res.json()).then(nData => setNews(nData));
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'news');
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

    // Auto-advance news slides
    const slideInterval = setInterval(() => {
      if (news.length > 0) {
        setCurrentSlide(prev => (prev + 1) % news.length);
      }
    }, 5000);

    return () => {
      unsubscribeAuth();
      unsubscribeSettings();
      unsubscribeNews();
      unsubscribeGallery();
      window.removeEventListener('popstate', handlePopState);
      clearInterval(slideInterval);
    };
  }, [news.length]);

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

  const getStats = (node: FamilyMember | null) => {
    if (!node) return { total: 0, gen2: 0, gen3: 0, gen4: 0, gen5: 0, deceased: 0 };
    
    let total = 0;
    let gen2 = 0; // Anak
    let gen3 = 0; // Cucu
    let gen4 = 0; // Cicit
    let gen5 = 0; // Buyut+
    let deceased = 0;

    const traverse = (n: FamilyMember, depth: number) => {
      total++;
      if (n.isDeceased) deceased++;
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

  const downloadPDF = async () => {
    const element = document.getElementById('pdf-content');
    if (!element) return;

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
      <div className="min-h-screen flex flex-col selection:bg-brand-olive selection:text-white">
      {/* Navigation */}
      <nav className="p-6 flex justify-between items-center border-b border-brand-olive/10">
        <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigateTo('/')}>
          <TreeDeciduous className="text-brand-olive" size={24} />
          <span className="serif text-2xl font-semibold tracking-tight">Bani Muhsin</span>
        </div>
        <div className="hidden md:flex gap-8 text-sm uppercase tracking-widest font-medium opacity-70 items-center">
          <a href="#history" className="hover:opacity-100 transition-opacity">Sejarah</a>
          <a href="#news" className="hover:opacity-100 transition-opacity">Berita</a>
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
        {/* Hero Slideshow Section */}
        <section className="w-full bg-brand-olive/5 pt-12 px-6 pb-12">
          <div className="max-w-4xl mx-auto">
            <div className="relative group h-[400px] md:h-[500px] rounded-3xl overflow-hidden shadow-2xl border border-brand-olive/10 bg-white">
              <AnimatePresence mode="wait">
                {news.length > 0 ? (
                  <motion.div
                    key={currentSlide}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.6 }}
                    className="absolute inset-0"
                  >
                    <div className="relative w-full h-full">
                      <img 
                        src={news[currentSlide].imageUrl || "https://picsum.photos/seed/family/1200/800"} 
                        alt={news[currentSlide].title}
                        className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-1000"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                      <div className="absolute bottom-0 left-0 right-0 p-8 md:p-12 text-white">
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.3 }}
                        >
                          <span className="text-[10px] uppercase tracking-[0.3em] font-bold opacity-70 mb-2 block">
                            {news[currentSlide].category === 'upcoming' ? 'Kegiatan Mendatang' : 'Kegiatan Terlaksana'}
                          </span>
                          <h2 className="serif text-3xl md:text-5xl font-light mb-4 leading-tight">
                            {news[currentSlide].title}
                          </h2>
                          <p className="text-sm md:text-base opacity-80 max-w-xl line-clamp-2 md:line-clamp-3">
                            {news[currentSlide].content}
                          </p>
                          <div className="mt-6 flex items-center gap-4">
                            <div className="w-12 h-px bg-white/30"></div>
                            <span className="text-xs opacity-60 tracking-widest uppercase">{new Date(news[currentSlide].date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                          </div>
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="fallback"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 flex items-center justify-center bg-brand-olive/5"
                  >
                    <div className="text-center p-12">
                      <TreeDeciduous size={48} className="mx-auto text-brand-olive/20 mb-4" />
                      <h2 className="serif text-3xl text-brand-olive/40 italic">Silsilah Bani Muhsin</h2>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Navigation Arrows */}
              {news.length > 1 && (
                <>
                  <button 
                    onClick={() => setCurrentSlide(prev => (prev - 1 + news.length) % news.length)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/20 transition-all z-10 opacity-0 group-hover:opacity-100"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button 
                    onClick={() => setCurrentSlide(prev => (prev + 1) % news.length)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-white/10 backdrop-blur-md text-white border border-white/20 hover:bg-white/20 transition-all z-10 opacity-0 group-hover:opacity-100"
                  >
                    <ChevronRight size={24} />
                  </button>
                </>
              )}

              {/* Indicators */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
                {news.map((_, i) => (
                  <button
                    key={i}
                    onClick={() => setCurrentSlide(i)}
                    className={`h-1 transition-all duration-500 rounded-full ${i === currentSlide ? 'w-8 bg-white' : 'w-2 bg-white/30'}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Hero Section */}
        <section className="px-6 py-20 md:py-32 max-w-7xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <span className="text-xs uppercase tracking-[0.3em] font-semibold text-brand-olive/60 mb-4 block">
              Warisan & Tradisi
            </span>
            <h1 className="serif text-6xl md:text-8xl font-light leading-tight mb-8">
              Menjaga Akar, <br />
              <span className="italic">Menumbuhkan Masa Depan</span>
            </h1>
            <p className="max-w-2xl mx-auto text-lg text-brand-ink/70 leading-relaxed mb-12">
              Selamat datang di kediaman digital keluarga Bani Muhsin. Tempat di mana sejarah bertemu masa kini, dan setiap nama adalah sebuah cerita tentang cinta dan keteguhan.
            </p>

            {/* Dashboard Stats */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="max-w-6xl mx-auto mb-16 grid grid-cols-2 md:grid-cols-6 gap-4 px-4"
            >
              <div className="bg-white/80 backdrop-blur-sm p-6 rounded-3xl border border-brand-olive/10 shadow-sm hover:shadow-md transition-all group">
                <div className="text-brand-olive mb-2 group-hover:scale-110 transition-transform flex justify-center">
                  <Users size={24} />
                </div>
                <div className="text-3xl font-bold serif text-brand-ink">{stats.total}</div>
                <div className="text-[10px] uppercase tracking-widest font-semibold opacity-50">Total Anggota</div>
              </div>
              
              <div className="bg-white/80 backdrop-blur-sm p-6 rounded-3xl border border-brand-olive/10 shadow-sm hover:shadow-md transition-all group">
                <div className="text-blue-600 mb-2 group-hover:scale-110 transition-transform flex justify-center">
                  <TreeDeciduous size={24} />
                </div>
                <div className="text-3xl font-bold serif text-brand-ink">{stats.gen2}</div>
                <div className="text-[10px] uppercase tracking-widest font-semibold opacity-50">Anak</div>
              </div>

              <div className="bg-white/80 backdrop-blur-sm p-6 rounded-3xl border border-brand-olive/10 shadow-sm hover:shadow-md transition-all group">
                <div className="text-emerald-600 mb-2 group-hover:scale-110 transition-transform flex justify-center">
                  <Heart size={24} />
                </div>
                <div className="text-3xl font-bold serif text-brand-ink">{stats.gen3}</div>
                <div className="text-[10px] uppercase tracking-widest font-semibold opacity-50">Cucu</div>
              </div>

              <div className="bg-white/80 backdrop-blur-sm p-6 rounded-3xl border border-brand-olive/10 shadow-sm hover:shadow-md transition-all group">
                <div className="text-amber-600 mb-2 group-hover:scale-110 transition-transform flex justify-center">
                  <History size={24} />
                </div>
                <div className="text-3xl font-bold serif text-brand-ink">{stats.gen4}</div>
                <div className="text-[10px] uppercase tracking-widest font-semibold opacity-50">Cicit</div>
              </div>

              <div className="bg-white/80 backdrop-blur-sm p-6 rounded-3xl border border-brand-olive/10 shadow-sm hover:shadow-md transition-all group">
                <div className="text-rose-600 mb-2 group-hover:scale-110 transition-transform flex justify-center">
                  <Users size={24} />
                </div>
                <div className="text-3xl font-bold serif text-brand-ink">{stats.gen5}</div>
                <div className="text-[10px] uppercase tracking-widest font-semibold opacity-50">Buyut+</div>
              </div>

              <div className="bg-emerald-50/80 backdrop-blur-sm p-6 rounded-3xl border border-emerald-200/50 shadow-sm hover:shadow-md transition-all group col-span-2 md:col-span-1">
                <div className="text-emerald-800 mb-2 group-hover:scale-110 transition-transform flex justify-center">
                  <Flower2 size={24} />
                </div>
                <div className="text-3xl font-bold serif text-emerald-900">{stats.deceased}</div>
                <div className="text-[10px] uppercase tracking-widest font-semibold text-emerald-900/50">Almarhum/ah</div>
              </div>
            </motion.div>

            <div className="flex flex-wrap justify-center gap-4">
              <a href="#tree" className="bg-brand-olive text-white px-8 py-4 rounded-full text-sm font-medium hover:shadow-lg transition-all">
                Lihat Silsilah
              </a>
              <a href="#news" className="border border-brand-olive/20 px-8 py-4 rounded-full text-sm font-medium hover:bg-brand-olive/5 transition-all">
                Berita & Kegiatan
              </a>
            </div>
          </motion.div>
        </section>

        {/* News Section */}
        <section id="news" className="px-6 py-24 bg-brand-cream/50">
          <div className="max-w-7xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-end mb-12 gap-6">
              <div className="max-w-2xl">
                <span className="text-xs uppercase tracking-[0.3em] font-semibold text-brand-olive/60 mb-4 block">
                  Informasi Terkini
                </span>
                <h2 className="serif text-4xl md:text-5xl">Berita & Kegiatan Keluarga</h2>
              </div>
              <div className="flex gap-2">
                <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-brand-olive/10 text-xs">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div> Akan Datang
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-brand-olive/10 text-xs">
                  <div className="w-2 h-2 rounded-full bg-brand-ink/20"></div> Sudah Lewat
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {news.length === 0 ? (
                <div className="col-span-full py-20 text-center text-brand-ink/40 italic">
                  Belum ada berita atau kegiatan yang diposting.
                </div>
              ) : (
                news.map((item, idx) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: idx * 0.1 }}
                    className="bg-white p-8 rounded-[2rem] border border-brand-olive/10 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden flex flex-col"
                  >
                    {item.imageUrl && (
                      <div className="absolute inset-0 opacity-0 group-hover:opacity-5 transition-opacity duration-700">
                        <img src={item.imageUrl} alt="" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full opacity-10 transition-transform group-hover:scale-110 ${item.category === 'upcoming' ? 'bg-emerald-500' : 'bg-brand-ink'}`}></div>
                    
                    {item.imageUrl && (
                      <div className="mb-6 h-48 -mx-8 -mt-8 overflow-hidden">
                        <img 
                          src={item.imageUrl} 
                          alt={item.title} 
                          className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    )}
                    
                    <div className="flex items-center gap-3 mb-6">
                      <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${item.category === 'upcoming' ? 'bg-emerald-100 text-emerald-700' : 'bg-brand-cream text-brand-ink/60'}`}>
                        {item.category === 'upcoming' ? 'Akan Datang' : 'Kegiatan Lalu'}
                      </div>
                      <div className="flex items-center text-[10px] text-brand-ink/40 font-medium">
                        <Calendar size={12} className="mr-1" />
                        {new Date(item.date).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                      </div>
                    </div>

                    <h3 className="serif text-2xl mb-4 group-hover:text-brand-olive transition-colors leading-tight">
                      {item.title}
                    </h3>
                    
                    <p className="text-brand-ink/60 text-sm leading-relaxed mb-8 line-clamp-3">
                      {item.content}
                    </p>

                    <div className="flex items-center justify-between pt-6 border-t border-brand-olive/5">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-brand-cream flex items-center justify-center text-brand-olive">
                          <UserIcon size={14} />
                        </div>
                        <span className="text-[10px] font-semibold text-brand-ink/60 uppercase tracking-wider">{item.author}</span>
                      </div>
                      <Newspaper size={18} className="text-brand-olive/20 group-hover:text-brand-olive/40 transition-colors" />
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </section>

        {/* Spiritual Foundation Section */}
        <section className="px-6 py-24 bg-white/60 border-y border-brand-olive/10">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1 }}
              className="space-y-12"
            >
              <div className="serif text-3xl md:text-4xl text-brand-olive opacity-80">
                بسم الله الرحمن الرحيم
              </div>
              
              <div className="space-y-6">
                <p className="serif text-2xl md:text-3xl leading-loose text-brand-ink" dir="rtl">
                  وَالَّذِيْنَ يَنْقُضُوْنَ عَهْدَ اللّٰهِ مِنْ ۢ بَعْدِ مِيْثَاقِهٖ وَيَقْطَعُوْنَ مَآ اَمَرَ اللّٰهُ بِهٖٓ اَنْ يُّوصَلَ وَيُفْسِدُوْنَ فِى الْاَرْضِۙ اُولٰۤىِٕكَ لَهُمُ اللَّعْنَةُ وَلَهُمْ سُوْۤءُ الدَّارِ
                </p>
                <p className="italic text-brand-ink/70 leading-relaxed max-w-3xl mx-auto">
                  “ Orang-orang yang melanggar perjanjian (dengan) Allah setelah diteguhkan, memutuskan apa yang diperintahkan Allah untuk disambungkan (seperti silaturahmi), dan berbuat kerusakan di bumi; mereka itulah orang-orang yang mendapat laknat dan bagi mereka tempat kediaman yang buruk (Jahanam) ”
                </p>
              </div>

              <div className="w-16 h-px bg-brand-olive/20 mx-auto"></div>

              <div className="space-y-6">
                <p className="serif text-xl md:text-2xl text-brand-ink" dir="rtl">
                  قال رسول الله ﷺ : لا يدخل الجنة قاطع ( متفق عليه )
                </p>
                <p className="italic text-brand-ink/70 leading-relaxed">
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
        <section id="tree" className="px-6 py-24 max-w-7xl mx-auto">
          <div className="mb-16 text-center">
            <h2 className="serif text-4xl md:text-5xl mb-4">Pohon Silsilah</h2>
            <div className="w-24 h-px bg-brand-olive/30 mx-auto mb-6"></div>
            <p className="text-brand-ink/60 mb-2">Klik dan telusuri garis keturunan Bani Muhsin</p>
            {lastUpdate && (
              <p className="text-[10px] uppercase tracking-widest text-brand-olive/50 font-medium mb-6">
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
              onClick={downloadPDF}
              className="inline-flex items-center gap-2 bg-white border border-brand-olive/20 text-brand-olive px-6 py-3 rounded-full text-sm font-medium hover:bg-brand-olive hover:text-white transition-all shadow-sm hover:shadow-md"
            >
              <Download size={16} /> Unduh Dokumen Silsilah (PDF)
            </button>
          </div>
          <FamilyTreeInteractive data={familyData} />
        </section>

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
              { label: 'Total', val: stats.total, color: '#3d4a3e' },
              { label: 'Anak', val: stats.gen2, color: '#2563eb' },
              { label: 'Cucu', val: stats.gen3, color: '#059669' },
              { label: 'Cicit', val: stats.gen4, color: '#d97706' },
              { label: 'Buyut+', val: stats.gen5, color: '#e11d48' },
              { label: 'Alm/Almh', val: stats.deceased, color: '#6b705c' }
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
                      {node.spouse && <span style={{ fontSize: '10pt', opacity: 0.5, fontStyle: 'italic', marginLeft: '8px', fontWeight: 'normal' }}> (Pasangan: {node.spouse})</span>}
                    </div>
                    {node.children && node.children.map(child => renderPdfNode(child, depth + 1))}
                  </div>
                );
              };
              return familyData ? renderPdfNode(familyData, 0) : null;
            })()}
          </div>

          <div style={{ marginTop: '60px', textAlign: 'center', fontSize: '10px', opacity: 0.3, letterSpacing: '1px' }}>
            DOKUMEN RESMI KELUARGA BANI MUHSIN • GENERATED BY DIGITAL GENEALOGY SYSTEM
          </div>
        </div>

        {/* History Section */}
        <section id="history" className="px-6 py-24 bg-brand-olive text-white">
          <div className="max-w-4xl mx-auto">
            <span className="text-xs uppercase tracking-[0.3em] font-semibold opacity-60 mb-4 block">
              Kisah Kami
            </span>
            <h2 className="serif text-4xl md:text-6xl mb-12 italic">Asal Usul Bani Muhsin</h2>
            <div className="space-y-8 text-lg opacity-90 leading-relaxed whitespace-pre-wrap">
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

