import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, PlusSquare, User, Bluetooth, Settings, LogOut, Moon, Sun, MessageCircle, Bell, UserCog, DollarSign } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';

export default function Navbar() {
  const [showSettings, setShowSettings] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);
  const { isDarkMode, toggleDarkMode } = useTheme();
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (user) {
      fetchUnreadCount();
      setupNotificationsSubscription();
    }
  }, [user]);

  const fetchUnreadCount = async () => {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user?.id)
        .eq('read', false);

      if (error) throw error;
      setUnreadCount(count || 0);
    } catch (error) {
      console.error('Error fetching unread count:', error);
    }
  };

  const setupNotificationsSubscription = () => {
    if (!user) return;

    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`
        },
        () => {
          fetchUnreadCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setShowSettings(false);
  };

  return (
    <nav className={`glass-effect fixed w-full z-50 border-white/10 ${
      isMobile ? 'bottom-0 border-t' : 'top-0 border-b'
    }`}>
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-14">
          <Link to="/" className="text-lg sm:text-xl font-bold text-neon-blue neon-text hidden md:block">
            RealLink
          </Link>
          
          <div className="flex items-center justify-around w-full md:w-auto md:space-x-4">
            <Link to="/" className="p-2 text-white/80 hover:text-neon-blue transition-colors">
              <div className="flex flex-col items-center">
                <Home className="w-6 h-6" />
                <span className="text-xs mt-1 md:hidden">Home</span>
              </div>
            </Link>
            <Link to="/create" className="p-2 text-white/80 hover:text-neon-pink transition-colors">
              <div className="flex flex-col items-center">
                <PlusSquare className="w-6 h-6" />
                <span className="text-xs mt-1 md:hidden">Create</span>
              </div>
            </Link>
            <Link to="/connect" className="p-2 text-white/80 hover:text-neon-purple transition-colors">
              <div className="flex flex-col items-center">
                <Bluetooth className="w-6 h-6" />
                <span className="text-xs mt-1 md:hidden">Connect</span>
              </div>
            </Link>
            <Link to="/messages" className="p-2 text-white/80 hover:text-neon-green transition-colors">
              <div className="flex flex-col items-center">
                <MessageCircle className="w-6 h-6" />
                <span className="text-xs mt-1 md:hidden">Messages</span>
              </div>
            </Link>
            <Link to="/notifications" className="relative p-2 text-white/80 hover:text-neon-purple transition-colors">
              <div className="flex flex-col items-center">
                <div className="relative">
                  <Bell className="w-6 h-6" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-neon-pink rounded-full flex items-center justify-center text-xs text-white">
                      {unreadCount}
                    </span>
                  )}
                </div>
                <span className="text-xs mt-1 md:hidden">Alerts</span>
              </div>
            </Link>
            <Link to="/profile/me" className="p-2 text-white/80 hover:text-neon-blue transition-colors">
              <div className="flex flex-col items-center">
                <User className="w-6 h-6" />
                <span className="text-xs mt-1 md:hidden">Profile</span>
              </div>
            </Link>
            <div className="relative hidden md:block">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="p-2 text-white/80 hover:text-neon-green transition-colors"
              >
                <Settings className="w-6 h-6" />
              </button>

              {showSettings && (
                <div className="absolute right-0 mt-2 w-48 rounded-lg gradient-bg border border-white/10 shadow-lg py-1 z-50">
                  <button
                    onClick={toggleDarkMode}
                    className="flex items-center w-full px-4 py-2 text-sm text-white/80 hover:text-neon-blue hover:bg-white/5"
                  >
                    {isDarkMode ? (
                      <>
                        <Sun className="w-4 h-4 mr-2" />
                        Light Mode
                      </>
                    ) : (
                      <>
                        <Moon className="w-4 h-4 mr-2" />
                        Dark Mode
                      </>
                    )}
                  </button>
                  <Link
                    to="/settings/account"
                    className="flex items-center w-full px-4 py-2 text-sm text-white/80 hover:text-neon-purple hover:bg-white/5"
                    onClick={() => setShowSettings(false)}
                  >
                    <UserCog className="w-4 h-4 mr-2" />
                    Account Settings
                  </Link>
                  <Link
                    to="/settings/monetization"
                    className="flex items-center w-full px-4 py-2 text-sm text-white/80 hover:text-neon-green hover:bg-white/5"
                    onClick={() => setShowSettings(false)}
                  >
                    <DollarSign className="w-4 h-4 mr-2" />
                    Monetization
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="flex items-center w-full px-4 py-2 text-sm text-white/80 hover:text-neon-pink hover:bg-white/5"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}