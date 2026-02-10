
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api/client';
import { createPageUrl } from '../utils';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Home,
  Target,
  Zap,
  Trophy,
  Sparkles,
  List,
  Activity,
  User,
  Settings,
  ChevronRight,
  Menu,
  X,
  LogOut,
  LogIn
} from 'lucide-react';

const navItems = [
  { id: 'Home', icon: Home, label: 'Home' },
  { id: 'ParBets', icon: Target, label: 'Par' },
  { id: 'BirdieBets', icon: Zap, label: 'Birdie' },
  { id: 'EagleBets', icon: Trophy, label: 'Eagle' },
  { id: 'LongShots', icon: Sparkles, label: 'The Long Shots' },
  { id: 'MyBets', icon: List, label: 'My Bets' },
  { id: 'LiveBetTracking', icon: Activity, label: 'Live Bet Tracking' }
];

export default function Layout({ children, currentPageName }) {
  const [user, setUser] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');

  useEffect(() => {
    const loadUser = async () => {
      try {
        const authData = JSON.parse(localStorage.getItem('betcaddies_auth') || 'null');
        if (authData?.isLoggedIn && authData?.user) {
          setUser(authData.user);
          setIsAdmin(authData.user?.role === 'admin');
          return;
        }
        const userData = await api.auth.me();
        if (userData?.email) {
          localStorage.setItem('betcaddies_auth', JSON.stringify({
            isLoggedIn: true,
            user: userData
          }));
          setUser(userData);
          setIsAdmin(userData?.role === 'admin');
        }
      } catch (e) {
        // Not logged in
      }
    };
    loadUser();
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await api.auth.login(loginEmail, loginPassword);
      const userData = response?.user;
      if (!userData) {
        setLoginError('Invalid email or password');
        return;
      }
      localStorage.setItem('betcaddies_auth', JSON.stringify({
        isLoggedIn: true,
        user: userData
      }));
      setUser(userData);
      setIsAdmin(userData?.role === 'admin');
      setShowLoginModal(false);
      setLoginEmail('');
      setLoginPassword('');
      setLoginError('');
    } catch (error) {
      setLoginError('Login failed');
    }
  };

  const handleLogout = async () => {
    localStorage.removeItem('betcaddies_auth');
    api.auth.logout();
    setUser(null);
    setIsAdmin(false);
  };

  const isActive = (pageName) => currentPageName === pageName;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-teal-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 right-0 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-slate-900/70 border-b border-slate-800/50">
        <div className="max-w-7xl mx-auto px-4 h-32 flex items-center justify-between">
          <Link to={createPageUrl('Home')} className="flex items-center">
            <img
              src="/brand/logo.png"
              alt="Bet Caddies"
              className="h-32 w-auto object-contain"
            />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => (
              <Link
                key={item.id}
                to={createPageUrl(item.id)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive(item.id)
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                {item.label}
              </Link>
            ))}
            <Link
              to={createPageUrl('HIOChallenge')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive('HIOChallenge')
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              HIO Challenge
            </Link>
            <Link
              to={createPageUrl('Results')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive('Results')
                  ? 'bg-emerald-500/20 text-emerald-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              Results
            </Link>
            <Link
              to={createPageUrl('Memberships')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive('Memberships')
                  ? 'bg-amber-500/20 text-amber-400'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
              }`}
            >
              Membership
            </Link>
          </nav>

          <div className="flex items-center gap-3">
            {user ? (
              <div className="flex items-center gap-2">
                <Link
                  to={createPageUrl('Profile')}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-800/50 transition-all"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
                    <span className="text-sm font-bold text-white">
                      {user.name?.[0] || user.email?.[0] || 'U'}
                    </span>
                  </div>
                  <span className="text-sm text-slate-300 hidden sm:block">
                    {user.name || user.email}
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-500 hidden sm:block" />
                </Link>
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowLoginModal(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium transition-all"
              >
                <LogIn className="w-4 h-4" />
                Login
              </button>
            )}

            {isAdmin && (
              <Link
                to={createPageUrl('Admin')}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all hidden md:flex"
              >
                <Settings className="w-5 h-5" />
              </Link>
            )}

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all md:hidden"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-16 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-xl border-b border-slate-800/50 md:hidden"
          >
            <nav className="p-4 space-y-2">
              {navItems.map((item) => (
                <Link
                  key={item.id}
                  to={createPageUrl(item.id)}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    isActive(item.id)
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                  }`}
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </Link>
              ))}
              <Link
                to={createPageUrl('HIOChallenge')}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive('HIOChallenge')
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Trophy className="w-5 h-5" />
                HIO Challenge
              </Link>
              <Link
                to={createPageUrl('Results')}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  isActive('Results')
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Target className="w-5 h-5" />
                Results
              </Link>
              {isAdmin && (
                <Link
                  to={createPageUrl('Admin')}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all"
                >
                  <Settings className="w-5 h-5" />
                  Admin Dashboard
                </Link>
              )}
              
              {/* Auth options */}
              <div className="border-t border-slate-800/50 pt-2 mt-2">
                {user ? (
                  <div className="space-y-2">
                    <Link
                      to={createPageUrl('Profile')}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all"
                    >
                      <User className="w-5 h-5" />
                      Profile
                    </Link>
                    <button
                      onClick={() => {
                        handleLogout();
                        setMobileMenuOpen(false);
                      }}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800/50 transition-all w-full text-left"
                    >
                      <LogOut className="w-5 h-5" />
                      Logout
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setShowLoginModal(true);
                      setMobileMenuOpen(false);
                    }}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-all w-full text-left"
                  >
                    <LogIn className="w-5 h-5" />
                    Login
                  </button>
                )}
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="relative pt-[136px] min-h-screen">
        {children}
      </main>

      {/* Bottom Nav - Mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/90 backdrop-blur-xl border-t border-slate-800/50 md:hidden">
        <div className="flex items-center justify-around py-2 px-2">
          {navItems.map((item) => (
            <Link
              key={item.id}
              to={createPageUrl(item.id)}
              className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${
                isActive(item.id)
                  ? 'text-emerald-400'
                  : 'text-slate-500'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="text-xs">{item.label}</span>
            </Link>
          ))}
        </div>
      </nav>

      {/* Bottom padding for mobile nav */}
      <div className="h-20 md:hidden" />

      {/* Login Modal */}
      <AnimatePresence>
        {showLoginModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setShowLoginModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-xl p-6 w-full max-w-md mx-4"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-white mb-4">Login to BetCaddies</h2>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Email
                  </label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Enter your email"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Password
                  </label>
                  <input
                    type="password"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    placeholder="Enter your password"
                    required
                  />
                </div>
                {loginError && (
                  <div className="text-red-400 text-sm">{loginError}</div>
                )}
                <div className="flex gap-3">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-medium transition-all"
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowLoginModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg font-medium transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
