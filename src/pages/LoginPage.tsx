import React, { useState } from 'react';
import { motion } from 'motion/react';
import { TreeDeciduous, ArrowLeft, Lock, Mail, User as UserIcon } from 'lucide-react';
import { User } from '../types';

interface LoginPageProps {
  onLogin: (user: User) => void;
  onBack: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, onBack }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isRegistering ? '/api/auth/register' : '/api/auth/login';
    const body = isRegistering ? { email, password, name } : { email, password };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Terjadi kesalahan');
      }

      onLogin(data.user);
    } catch (err: any) {
      setError(err.message);
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
          <h1 className="serif text-3xl font-bold text-brand-ink">Admin Login</h1>
          <p className="text-brand-ink/60 mt-2">
            {isRegistering ? 'Daftar sebagai editor silsilah' : 'Masuk untuk mengelola silsilah keluarga'}
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-100 text-rose-600 p-3 rounded-xl text-sm mb-6">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegistering && (
            <div className="relative">
              <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-olive/40" size={18} />
              <input
                type="text"
                placeholder="Nama Lengkap"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-brand-olive/10 focus:ring-2 focus:ring-brand-olive/20 focus:border-brand-olive outline-none transition-all"
              />
            </div>
          )}
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-olive/40" size={18} />
            <input
              type="email"
              placeholder="Alamat Email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-brand-olive/10 focus:ring-2 focus:ring-brand-olive/20 focus:border-brand-olive outline-none transition-all"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-brand-olive/40" size={18} />
            <input
              type="password"
              placeholder="Kata Sandi"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl border border-brand-olive/10 focus:ring-2 focus:ring-brand-olive/20 focus:border-brand-olive outline-none transition-all"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-olive text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 mt-4"
          >
            {loading ? 'Memproses...' : (isRegistering ? 'Daftar' : 'Masuk')}
          </button>
        </form>

        <div className="mt-8 text-center text-sm">
          <button 
            onClick={() => setIsRegistering(!isRegistering)}
            className="text-brand-olive hover:underline font-medium"
          >
            {isRegistering ? 'Sudah punya akun? Masuk' : 'Belum punya akun? Daftar'}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
