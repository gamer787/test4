import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { AlertCircle, Loader } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLogin, setIsLogin] = useState(true);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const validateUsername = async (username: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .eq('username', username)
      .single();

    if (error && error.code === 'PGRST116') {
      return true; // Username is available
    }
    return false; // Username is taken
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/reset-password',
      });

      if (error) throw error;
      setSuccess('Password reset instructions have been sent to your email');
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      } else { // Sign up
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }

        if (username.length < 3) {
          throw new Error('Username must be at least 3 characters long');
        }

        const isUsernameAvailable = await validateUsername(username);
        if (!isUsernameAvailable) {
          throw new Error('Username is already taken');
        }

        const { data: authData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });
        if (signUpError) throw signUpError;

        if (authData.user) {
          const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
              id: authData.user.id,
              username,
              avatar_url: `https://api.dicebear.com/7.x/avatars/svg?seed=${username}`
            }, {
              onConflict: 'id'
            });
          if (profileError) throw profileError;
        }
      }
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-10 px-4">
      <div className="max-w-md mx-auto gradient-bg p-8 rounded-lg border border-white/10 mb-12">
        <h2 className="text-2xl font-bold text-center mb-8 text-neon-blue neon-text">
          {isLogin ? 'Login to RealLink' : 'Join RealLink'}
        </h2>
        
        <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-white/80">Email</label>
          <input 
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 block w-full rounded-md bg-darker-bg border border-white/10 text-white px-3 py-2 focus:ring-neon-blue focus:border-neon-blue"
            required
          />
        </div>

        {!isLogin && (
          <div>
            <label className="block text-sm font-medium text-white/80">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="mt-1 block w-full rounded-md bg-darker-bg border border-white/10 text-white px-3 py-2 focus:ring-neon-blue focus:border-neon-blue"
              required
            />
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-white/80">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-md bg-darker-bg border border-white/10 text-white px-3 py-2 focus:ring-neon-blue focus:border-neon-blue"
            required
          />
        </div>

        {!isLogin && (
          <div>
            <label className="block text-sm font-medium text-white/80">Confirm Password</label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="mt-1 block w-full rounded-md bg-darker-bg border border-white/10 text-white px-3 py-2 focus:ring-neon-blue focus:border-neon-blue"
              required
            />
          </div>
        )}

        {error && (
          <div className="flex items-center space-x-2 text-neon-pink text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="flex items-center space-x-2 text-neon-green text-sm">
            <AlertCircle className="w-4 h-4" />
            <span>{success}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md text-sm font-medium text-white bg-neon-blue hover:bg-neon-blue/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neon-blue disabled:opacity-50 transition-colors shadow-neon"
        >
          {loading ? (
            <>
              <Loader className="w-4 h-4 mr-2 animate-spin" />
              <span>Loading...</span>
            </>
          ) : (
            <span>{isLogin ? 'Login' : 'Sign Up'}</span>
          )}
        </button>
        </form>

        {isLogin && !showForgotPassword && (
          <button
            onClick={() => setShowForgotPassword(true)}
            className="mt-4 w-full text-center text-sm text-neon-purple hover:text-neon-pink transition-colors"
          >
            Forgot your password?
          </button>
        )}

        {showForgotPassword && (
        <div className="mt-6 p-4 rounded-lg bg-card-bg border border-white/10">
          <h3 className="text-lg font-medium text-white mb-4">Reset Password</h3>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-white/80">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md bg-darker-bg border border-white/10 text-white px-3 py-2 focus:ring-neon-purple focus:border-neon-purple"
                required
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-2 px-4 border border-transparent rounded-md text-sm font-medium text-white bg-neon-purple hover:bg-neon-purple/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neon-purple disabled:opacity-50 transition-colors"
            >
              Send Reset Instructions
            </button>
          </form>
        </div>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm text-neon-purple hover:text-neon-pink transition-colors"
          >
            {isLogin ? "Don't have an account? Sign Up" : 'Already have an account? Login'}
          </button>
        </div>
      </div>

      {/* Features Section */}
      <div className="max-w-6xl mx-auto mb-16">
        <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-8">
          More reasons to join
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="gradient-bg p-6 rounded-lg border border-white/10">
            <h3 className="text-xl font-semibold text-white mb-3">Real Connections</h3>
            <p className="text-white/70">
              Connect with people you meet in real life and build authentic relationships.
            </p>
          </div>
          <div className="gradient-bg p-6 rounded-lg border border-white/10">
            <h3 className="text-xl font-semibold text-white mb-3">Share Moments</h3>
            <p className="text-white/70">
              Share photos, videos, and stories with your real-world connections.
            </p>
          </div>
          <div className="gradient-bg p-6 rounded-lg border border-white/10">
            <h3 className="text-xl font-semibold text-white mb-3">Instant Connect</h3>
            <p className="text-white/70">
              Use Bluetooth or NFC to instantly connect with people nearby.
            </p>
          </div>
          <div className="gradient-bg p-6 rounded-lg border border-white/10">
            <h3 className="text-xl font-semibold text-white mb-3">Monetize Links</h3>
            <p className="text-white/70">
              Turn your authentic connections into opportunities and earn revenue.
            </p>
          </div>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="max-w-3xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-bold text-white text-center mb-8">
          Frequently Asked Questions
        </h2>
        <div className="space-y-4">
          <div className="gradient-bg p-6 rounded-lg border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-2">What is RealLink?</h3>
            <p className="text-white/70">
              RealLink is a social platform that focuses on authentic connections made in the real world.
              Unlike traditional social media, connections can only be made when people meet in person.
            </p>
          </div>
          <div className="gradient-bg p-6 rounded-lg border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-2">How does it work?</h3>
            <p className="text-white/70">
              When you meet someone in real life, you can use Bluetooth or NFC to create a link.
              Once linked, you can share content, message each other, and build meaningful connections.
            </p>
          </div>
          <div className="gradient-bg p-6 rounded-lg border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-2">Is it free to use?</h3>
            <p className="text-white/70">
              Yes, RealLink is free to use! We also offer monetization opportunities for users who build
              strong authentic networks.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}