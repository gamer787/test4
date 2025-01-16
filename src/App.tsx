import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { usePresence } from './hooks/usePresence';
import { ThemeProvider } from './context/ThemeContext';
import Navbar from './components/Navbar';
import Feed from './components/Feed';
import Login from './components/Login';
import Profile from './components/Profile';
import CreatePost from './components/CreatePost';
import Connect from './components/Connect';
import Messages from './components/Messages';
import Notifications from './components/Notifications';
import AccountSettings from './components/AccountSettings';
import AccountMonetization from './components/AccountMonetization';

export default function App() {
  const { user, loading } = useAuth();
  usePresence(user?.id);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <ThemeProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-gray-50 dark:bg-dark-bg pb-20 md:pb-0 md:pt-16">
          {user && <Navbar />}
          <main className="p-4">
            <Routes>
              <Route
                path="/"
                element={user ? <Feed /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/login"
                element={!user ? <Login /> : <Navigate to="/" replace />}
              />
              <Route
                path="/profile/:id"
                element={user ? <Profile /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/create"
                element={user ? <CreatePost /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/connect"
                element={user ? <Connect /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/messages"
                element={user ? <Messages /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/messages/:chatId"
                element={user ? <Messages /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/notifications"
                element={user ? <Notifications /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/settings/account"
                element={user ? <AccountSettings /> : <Navigate to="/login" replace />}
              />
              <Route
                path="/settings/monetization"
                element={user ? <AccountMonetization /> : <Navigate to="/login" replace />}
              />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </ThemeProvider>
  );
}