'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../contexts/AuthContext';

export default function Header({ minimal = false }) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [userName, setUserName] = useState('');
  const [userInitials, setUserInitials] = useState('');
  const router = useRouter();
  
  // Get authentication state from AuthContext
  const { user, session, loading, signOut } = useAuth();
  
  // Derive isLoggedIn from Supabase session
  const isLoggedIn = !!user && !!session;

  useEffect(() => {
    // Set user name and initials based on Supabase user data
    if (user) {
      console.log('Header: User data from Supabase:', user);
      
      // Try to get the name from different sources
      let name = '';
      
      // First check user metadata
      if (user.user_metadata) {
        name = user.user_metadata.name || 
               user.user_metadata.full_name || 
               user.user_metadata.first_name || 
               '';
      }
      
      // If no name in metadata, use email
      if (!name && user.email) {
        name = user.email.split('@')[0];
      }
      
      setUserName(name);
      
      // Generate initials
      if (name) {
        const nameParts = name.split(' ');
        if (nameParts.length > 1 && nameParts[0][0] && nameParts[1][0]) {
          // Get first letter of first and last name
          setUserInitials(`${nameParts[0][0]}${nameParts[1][0]}`.toUpperCase());
        } else if (name.length > 0) {
          // Get first two letters of single name
          setUserInitials(name.substring(0, 2).toUpperCase());
        } else {
          setUserInitials('?');
        }
      } else if (user.email) {
        // Use first two letters of email if no name
        setUserInitials(user.email.substring(0, 2).toUpperCase());
      } else {
        setUserInitials('?');
      }
    } else {
      setUserName('');
      setUserInitials('?');
    }
  }, [user]);

  const handleLogout = async () => {
    try {
      // Use Supabase signOut method from AuthContext
      await signOut();
      console.log('User signed out successfully');
      router.push('/auth/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };
  const toggleProfileMenu = () => {
    setShowProfileMenu(!showProfileMenu);
  };

  // Show loading placeholder while auth state is being determined
  if (loading) {
    return (
      <header className="bg-gradient-to-r from-[#121212] to-[#1a1a1a] text-white shadow-lg backdrop-blur-lg sticky top-0 z-50 transition-all duration-300 ease-in-out">
        <div className="container mx-auto px-4 flex justify-between items-center py-4">
          <div className="flex items-center space-x-3">
            <div>
              <img
                src="/images/ZIMMR_Logo_transparent.png"
                alt="ZIMMR Logo"
                className="h-7 w-auto md:h-8 max-w-[96px] md:max-w-[120px] object-contain drop-shadow-lg transition-all duration-300"
                style={{ minWidth: '48px', maxHeight: '2.25rem' }}
                loading="eager"
              />
            </div>
          </div>
          <div className="animate-pulse w-24 h-10 bg-white/5 rounded-full"></div>
        </div>
      </header>
    );
  }
  
  // --- MINIMAL HEADER FOR PUBLIC/LANDING PAGE ---
  if (minimal || !isLoggedIn) {
    return (
      <header className="bg-gradient-to-r from-[#121212] to-[#1a1a1a] text-white shadow-lg backdrop-blur-lg sticky top-0 z-50 transition-all duration-300 ease-in-out">
        <div className="container mx-auto px-4 flex justify-between items-center py-4">
          <div className="flex items-center space-x-3">
            <div>
              <img
                src="/images/ZIMMR_Logo_transparent.png"
                alt="ZIMMR Logo"
                className="h-7 w-auto md:h-8 max-w-[96px] md:max-w-[120px] object-contain drop-shadow-lg transition-all duration-300"
                style={{ minWidth: '48px', maxHeight: '2.25rem' }}
                loading="eager"
                decoding="async"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <a href="/auth/login" className="px-4 py-2 rounded-full text-white/90 hover:text-white hover:bg-[#ffcb00]/10 transition-all duration-200 font-medium">Anmelden</a>
            <a href="/auth/register" className="px-4 py-2 rounded-full bg-[#ffcb00] hover:bg-[#e6b800] text-black transition-all duration-200 font-medium">Registrieren</a>
          </div>
        </div>
      </header>
    );
  }

  // --- FULL HEADER FOR LOGGED-IN USERS ---
  return (
    <header className="bg-gradient-to-r from-[#121212] to-[#1a1a1a] text-white shadow-lg backdrop-blur-lg sticky top-0 z-50 transition-all duration-300 ease-in-out">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center py-4">
          <div className="flex items-center space-x-3">
            <div>
              <img
                src="/images/ZIMMR_Logo_transparent.png"
                alt="ZIMMR Logo"
                className="h-7 w-auto md:h-8 max-w-[96px] md:max-w-[120px] object-contain drop-shadow-lg transition-all duration-300"
                style={{ minWidth: '48px', maxHeight: '2.25rem' }}
                loading="eager"
                decoding="async"
              />
            </div>
          </div>
          <button 
            className="md:hidden flex items-center justify-center w-10 h-10 rounded-full bg-[#2a2a2a]/40 backdrop-blur-md text-white hover:bg-[#2a2a2a]/80 transition-all duration-300"
            onClick={toggleMenu}
            aria-label="Toggle menu"
          >
            <svg 
              className="w-5 h-5 transition-transform duration-200 ease-in-out"
              style={{ transform: isMenuOpen ? 'rotate(90deg)' : 'rotate(0)' }}
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              {isMenuOpen ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" />
              )}
            </svg>
          </button>
          {/* Desktop navigation */}
          <nav className="hidden md:block">
            <ul className="flex items-center space-x-1">
              <li>
                <a 
                  href="/dashboard" 
                  className="px-4 py-2 rounded-full text-white/90 hover:text-white hover:bg-[#ffcb00]/10 transition-all duration-200"
                >
                  Dashboard
                </a>
              </li>
              <li>
                <a 
                  href="/appointments" 
                  className="px-4 py-2 rounded-full text-white/90 hover:text-white hover:bg-[#ffcb00]/10 transition-all duration-200"
                >
                  Termine
                </a>
              </li>
              <li>
                <a 
                  href="/customers" 
                  className="px-4 py-2 rounded-full text-white/90 hover:text-white hover:bg-[#ffcb00]/10 transition-all duration-200"
                >
                  Kunden
                </a>
              </li>
              <li>
                <a 
                  href="/invoices" 
                  className="px-4 py-2 rounded-full text-white/90 hover:text-white hover:bg-[#ffcb00]/10 transition-all duration-200"
                >
                  Rechnungen
                </a>
              </li>
              <li>
                <a 
                  href="/quotes" 
                  className="px-4 py-2 rounded-full text-white/90 hover:text-white hover:bg-[#ffcb00]/10 transition-all duration-200"
                >
                  Angebote
                </a>
              </li>
              <li>
                <a 
                  href="/finances"
                  className="px-4 py-2 rounded-full text-white/90 hover:text-white hover:bg-[#ffcb00]/10 transition-all duration-200"
                >
                  Finanzen
                </a>
              </li>
              <li>
                <a 
                  href="/notes"
                  className="px-4 py-2 rounded-full text-white/90 hover:text-white hover:bg-[#ffcb00]/10 transition-all duration-200"
                >
                  Notizen
                </a>
              </li>
              {isLoggedIn ? (
                <>
                  <li className="relative ml-2">
                    <button 
                      className="flex items-center space-x-2 rounded-full pl-2 pr-3 py-1 hover:bg-[#ffcb00]/10 transition-all duration-200"
                      onClick={toggleProfileMenu}
                      aria-expanded={showProfileMenu}
                      aria-haspopup="true"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#ffcb00] flex items-center justify-center text-black font-medium text-sm shadow-lg">
                        {userInitials}
                      </div>
                      <span className="text-sm text-white/90 hidden md:inline">
                        {userName}
                      </span>
                      <svg 
                        className={`w-4 h-4 text-white/70 transition-transform duration-200 ${showProfileMenu ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24" 
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                    
                    {/* Profile dropdown menu */}
                    {showProfileMenu && (
                      <div className="absolute right-0 mt-2 w-48 bg-[#121212]/90 backdrop-blur-lg rounded-xl shadow-xl py-1 z-10 ring-1 ring-[#ffcb00]/20 animate-fade-in">
                        <a 
                          href="/profile" 
                          className="flex items-center px-4 py-2 text-sm text-white/90 hover:text-white hover:bg-[#ffcb00]/10 transition-all"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                          </svg>
                          Mein Profil
                        </a>
                        <a 
                          href="/onboarding" 
                          className="flex items-center px-4 py-2 text-sm text-white/90 hover:text-white hover:bg-[#ffcb00]/10 transition-all"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                          </svg>
                          Einstellungen
                        </a>
                        <div className="border-t border-[#ffcb00]/20 my-1"></div>
                        <button 
                          onClick={handleLogout}
                          className="flex items-center w-full text-left px-4 py-2 text-sm text-white/90 hover:text-white hover:bg-[#ffcb00]/10 transition-all"
                        >
                          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                          </svg>
                          Abmelden
                        </button>
                      </div>
                    )}
                  </li>
                </>
              ) : (
                <li>
                  <a 
                    href="/auth/login"
                    className="ml-2 bg-gradient-to-r from-[#0070f3] to-[#0050d3] hover:from-[#0060df] hover:to-[#0040c0] text-white px-5 py-2 rounded-full text-sm font-medium shadow-md hover:shadow-lg transition-all duration-300 flex items-center"
                  >
                    <span>Anmelden</span>
                    <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                    </svg>
                  </a>
                </li>
              )}
            </ul>
          </nav>
        </div>
        
        {/* Mobile navigation */}
        {isMenuOpen && (
          <nav className="md:hidden py-3 px-2 border-t border-white/10 mt-2 animate-fade-in">
            <ul className="space-y-1 mb-4">
              <li>
                <a 
                  href="/" 
                  className="flex items-center px-4 py-2.5 rounded-xl text-white/90 hover:text-white hover:bg-white/10 transition-all"
                >
                  <svg className="w-5 h-5 mr-3 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h2a1 1 0 001-1v-7m-6 0a1 1 0 001-1v-2a1 1 0 011-1h2a1 1 0 011 1v2a1 1 0 001 1h1"></path>
                  </svg>
                  Dashboard
                </a>
              </li>
              <li>
                <a 
                  href="/appointments" 
                  className="flex items-center px-4 py-2.5 rounded-xl text-white/90 hover:text-white hover:bg-white/10 transition-all"
                >
                  <svg className="w-5 h-5 mr-3 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 012-2h-5l-5 5v-5z"></path>
                  </svg>
                  Termine
                </a>
              </li>
              <li>
                <a 
                  href="/customers" 
                  className="flex items-center px-4 py-2.5 rounded-xl text-white/90 hover:text-white hover:bg-white/10 transition-all"
                >
                  <svg className="w-5 h-5 mr-3 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path>
                  </svg>
                  Kunden
                </a>
              </li>
              <li>
                <a 
                  href="/invoices" 
                  className="flex items-center px-4 py-2.5 rounded-xl text-white/90 hover:text-white hover:bg-white/10 transition-all"
                >
                  <svg className="w-5 h-5 mr-3 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                  Rechnungen
                </a>
              </li>
              <li>
                <a 
                  href="/quotes"
                  className="flex items-center px-4 py-2.5 rounded-xl text-white/90 hover:text-white hover:bg-white/10 transition-all"
                >
                  <svg className="w-5 h-5 mr-3 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path>
                  </svg>
                  Angebote
                </a>
              </li>
              <li>
                <a 
                  href="/finances"
                  className="flex items-center px-4 py-2.5 rounded-xl text-white/90 hover:text-white hover:bg-white/10 transition-all"
                >
                  <svg className="w-5 h-5 mr-3 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                  </svg>
                  Finanzen
                </a>
              </li>
              <li>
                <a 
                  href="/notes"
                  className="flex items-center px-4 py-2.5 rounded-xl text-white/90 hover:text-white hover:bg-white/10 transition-all"
                >
                  <svg className="w-5 h-5 mr-3 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
                  </svg>
                  Notizen
                </a>
              </li>
            </ul>
            
            {isLoggedIn ? (
              <div className="border-t border-white/10 pt-3 space-y-1">
                <div className="flex items-center px-4 py-2">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#0070f3] to-[#7928ca] flex items-center justify-center text-white font-medium shadow-lg">
                    {userInitials}
                  </div>
                  <div className="ml-3">
                    <p className="text-sm font-medium text-white">{userName}</p>
                    <p className="text-xs text-white/70">Handwerker</p>
                  </div>
                </div>
                <a 
                  href="/profile" 
                  className="flex items-center px-4 py-2.5 rounded-xl text-white/90 hover:text-white hover:bg-white/10 transition-all"
                >
                  <svg className="w-5 h-5 mr-3 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path>
                  </svg>
                  Mein Profil
                </a>
                <a 
                  href="/onboarding" 
                  className="flex items-center px-4 py-2.5 rounded-xl text-white/90 hover:text-white hover:bg-white/10 transition-all"
                >
                  <svg className="w-5 h-5 mr-3 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                  </svg>
                  Einstellungen
                </a>
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center px-4 py-2.5 rounded-xl text-white/90 hover:text-white hover:bg-white/10 transition-all"
                >
                  <svg className="w-5 h-5 mr-3 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path>
                  </svg>
                  Abmelden
                </button>
              </div>
            ) : (
              <div className="mt-6 px-4">
                <a 
                  href="/auth/login"
                  className="w-full flex items-center justify-center bg-gradient-to-r from-[#0070f3] to-[#0050d3] hover:from-[#0060df] hover:to-[#0040c0] text-white px-4 py-2.5 rounded-xl text-sm font-medium shadow-md hover:shadow-lg transition-all duration-300"
                >
                  Anmelden
                  <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M14 5l7 7m0 0l-7 7m7-7H3"></path>
                  </svg>
                </a>
              </div>
            )}
          </nav>
        )}
      </div>
    </header>
  );
}
