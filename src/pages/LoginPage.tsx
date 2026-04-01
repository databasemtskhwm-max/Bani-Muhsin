import React, { useState } from 'react';
import { motion } from 'motion/react';
import { TreeDeciduous, ArrowLeft, LogIn, Mail, Lock, UserPlus } from 'lucide-react';
import { loginWithGoogle, loginWithEmail, registerWithEmail } from '../firebase';
import { User as FirebaseUser, updateProfile } from 'firebase/auth';

interface LoginPageProps {
  onLogin: (user: FirebaseUser) => void;
  onBack: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, onBack }) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const result = await loginWithGoogle();
      onLogin(result.user);
    } catch (err: any) {
      console.error(err);
      setError('Gagal masuk dengan Google. Pastikan Anda menggunakan akun yang diizinkan.');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Email dan kata sandi wajib diisi.');
      return;
    }
    if (isRegister && !displayName) {
      setError('Nama lengkap wajib diisi.');
      return;
    }
    setError('');
    setLoading(true);
    const effectiveEmail = email.toLowerCase() === 'admin' ? 'admin@keluarga.com' : email;
    const effectivePassword = email.toLowerCase() === 'admin' ? 'admin2026' : password;

    try {
      if (isRegister) {
        const result = await registerWithEmail(effectiveEmail, effectivePassword);
        await updateProfile(result.user, { displayName });
        onLogin(result.user);
      } else {
        try {
          const result = await loginWithEmail(effectiveEmail, effectivePassword);
          onLogin(result.user);
        } catch (loginErr: any) {
          // Special case for the requested admin account: auto-register if not found
          const isAdminAccount = (effectiveEmail === 'databasemtskhwm@gmail.com' && effectivePassword === 'admin2026') || 
                               (effectiveEmail === 'admin@keluarga.com' && effectivePassword === 'admin2026');
          
          if (loginErr.code === 'auth/user-not-found' && isAdminAccount) {
            const result = await registerWithEmail(effectiveEmail, effectivePassword);
            await updateProfile(result.user, { displayName: 'Admin Utama' });
            onLogin(result.user);
          } else {
            throw loginErr;
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      if (isRegister) {
        setError('Gagal mendaftar. Email mungkin sudah terdaftar atau kata sandi terlalu lemah.');
      } else {
        setError('Gagal masuk. Periksa kembali email dan kata sandi Anda.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAdminLogin = async () => {
    setEmail('admin');
    setPassword('admin2026');
    setError('');
    setLoading(true);
    try {
      const effectiveEmail = 'admin@keluarga.com';
      const effectivePassword = 'admin2026';
      try {
        const result = await loginWithEmail(effectiveEmail, effectivePassword);
        onLogin(result.user);
      } catch (loginErr: any) {
        // Auto-register if not found
        if (loginErr.code === 'auth/user-not-found' || loginErr.code === 'auth/invalid-credential') {
          try {
            const result = await registerWithEmail(effectiveEmail, effectivePassword);
            await updateProfile(result.user, { displayName: 'Admin Utama' });
            onLogin(result.user);
          } catch (regErr) {
            throw loginErr;
          }
        } else {
          throw loginErr;
        }
      }
    } catch (err: any) {
      console.error(err);
      setError('Gagal masuk sebagai Admin. Pastikan kredensial benar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-brand-olive/10 p-8"
      >
        <button 
          onClick={onBack}
          className="flex items-center text-brand-olive/60 hover:text-brand-olive mb-8 text-sm transition-colors"
        >
          <ArrowLeft size={16} className="mr-1" /> Kembali
        </button>

        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-brand-olive/10 rounded-2xl flex items-center justify-center mx-auto mb-4 text-brand-olive">
            <TreeDeciduous size={32} />
          </div>
          <h1 className="serif text-3xl font-bold text-brand-ink">
            {isRegister ? 'Daftar Akun' : 'Admin Login'}
          </h1>
          <p className="text-brand-ink/60 mt-2">
            {isRegister ? 'Buat akun untuk mengajukan akses editor' : 'Masuk untuk mengelola silsilah keluarga'}
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-100 text-rose-600 p-3 rounded-xl text-sm mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4 mb-6">
          {isRegister && (
            <div>
              <label className="block text-xs font-bold text-brand-ink/60 uppercase mb-1 ml-1">Nama Lengkap</label>
              <div className="relative">
                <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-olive/40" size={18} />
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="Nama Anda"
                  className="w-full pl-10 pr-4 py-3 rounded-xl border border-brand-olive/10 focus:ring-2 focus:ring-brand-olive focus:border-transparent transition-all outline-none"
                />
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-bold text-brand-ink/60 uppercase mb-1 ml-1">Username / Email</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-olive/40" size={18} />
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin atau email@anda.com"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-brand-olive/10 focus:ring-2 focus:ring-brand-olive focus:border-transparent transition-all outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-brand-ink/60 uppercase mb-1 ml-1">Kata Sandi</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-brand-olive/40" size={18} />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-brand-olive/10 focus:ring-2 focus:ring-brand-olive focus:border-transparent transition-all outline-none"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-olive text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50"
            >
              {loading ? 'Memproses...' : isRegister ? 'Daftar Sekarang' : 'Masuk'}
            </button>
            {!isRegister && (
              <button
                type="button"
                onClick={handleQuickAdminLogin}
                disabled={loading}
                className="w-full bg-brand-ink text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <LogIn size={18} /> Masuk sebagai Admin Utama
              </button>
            )}
          </div>
        </form>

        <div className="text-center mb-6">
          <button 
            onClick={() => setIsRegister(!isRegister)}
            className="text-sm text-brand-olive font-medium hover:underline"
          >
            {isRegister ? 'Sudah punya akun? Masuk di sini' : 'Belum punya akun? Daftar di sini'}
          </button>
        </div>

        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-brand-olive/10"></div>
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-white px-2 text-brand-ink/40">Atau masuk dengan</span>
          </div>
        </div>

        <button
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white border border-brand-olive/20 text-brand-ink py-3 rounded-xl font-semibold hover:bg-brand-cream transition-all disabled:opacity-50"
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
          Masuk dengan Google
        </button>

        <div className="mt-8 text-center text-xs text-brand-ink/40">
          <p>Hanya admin terdaftar yang dapat melakukan perubahan data.</p>
        </div>
      </motion.div>
    </div>
  );
};
