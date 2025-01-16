import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, AlertCircle, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

type Profile = {
  username: string;
  email: string;
  occupation: string | null;
  location: string | null;
  website: string | null;
};

export default function AccountSettings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showDeleteWarning, setShowDeleteWarning] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [profile, setProfile] = useState<Profile>({
    username: '',
    email: '',
    occupation: '',
    location: '',
    website: ''
  });

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      // Fetch profile data
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('username, occupation, location, website')
        .eq('id', user?.id)
        .single();

      if (profileError) throw profileError;

      // Get user email from auth
      const { data: { user: userData }, error: userError } = await supabase.auth.getUser();
      if (userError) throw userError;

      setProfile({
        username: profileData.username || '',
        email: userData?.email || '',
        occupation: profileData.occupation || '',
        location: profileData.location || '',
        website: profileData.website || ''
      });
    } catch (error) {
      console.error('Error fetching profile:', error);
      setError('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      // Update profile data
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          username: profile.username,
          occupation: profile.occupation || null,
          location: profile.location || null,
          website: profile.website || null
        })
        .eq('id', user?.id);

      if (profileError) throw profileError;

      // Update email if changed
      if (user?.email !== profile.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: profile.email
        });

        if (emailError) throw emailError;
      }

      setSuccess('Profile updated successfully');
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setError(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    setDeleting(true);

    try {
      // Delete the user's auth account
      const { error } = await supabase.auth.admin.deleteUser(user.id);
      if (error) throw error;

      // Sign out after deletion
      await supabase.auth.signOut();
      navigate('/login');
    } catch (error: any) {
      console.error('Error deleting account:', error);
      setError('Failed to delete account. Please try again.');
      setDeleting(false);
      setShowDeleteWarning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-blue"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center mb-6">
        <button
          onClick={() => navigate(-1)}
          className="mr-4 p-2 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-bold text-white">Account Settings</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="gradient-bg rounded-lg border border-white/10 divide-y divide-white/10">
          {/* Basic Information */}
          <div className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Basic Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  Username
                </label>
                <input
                  type="text"
                  value={profile.username}
                  onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                  className="w-full px-4 py-2 bg-card-bg border border-white/10 rounded-lg text-white focus:border-neon-blue focus:ring-1 focus:ring-neon-blue"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  className="w-full px-4 py-2 bg-card-bg border border-white/10 rounded-lg text-white focus:border-neon-blue focus:ring-1 focus:ring-neon-blue"
                  required
                />
              </div>
            </div>
          </div>

          {/* Additional Information */}
          <div className="p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Additional Information</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  Occupation
                </label>
                <input
                  type="text"
                  value={profile.occupation || ''}
                  onChange={(e) => setProfile({ ...profile, occupation: e.target.value })}
                  className="w-full px-4 py-2 bg-card-bg border border-white/10 rounded-lg text-white focus:border-neon-blue focus:ring-1 focus:ring-neon-blue"
                  placeholder="What do you do?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  value={profile.location || ''}
                  onChange={(e) => setProfile({ ...profile, location: e.target.value })}
                  className="w-full px-4 py-2 bg-card-bg border border-white/10 rounded-lg text-white focus:border-neon-blue focus:ring-1 focus:ring-neon-blue"
                  placeholder="Where are you based?"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1">
                  Website
                </label>
                <input
                  type="url"
                  value={profile.website || ''}
                  onChange={(e) => setProfile({ ...profile, website: e.target.value })}
                  className="w-full px-4 py-2 bg-card-bg border border-white/10 rounded-lg text-white focus:border-neon-blue focus:ring-1 focus:ring-neon-blue"
                  placeholder="Your personal website"
                />
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="p-6">
            <h2 className="text-lg font-semibold text-neon-pink mb-4">Danger Zone</h2>
            <div className="bg-neon-pink/5 border border-neon-pink/20 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-medium">Delete Account</h3>
                  <p className="text-white/60 text-sm mt-1">
                    Permanently delete your account and all associated data
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDeleteWarning(true)}
                  className="px-4 py-2 bg-neon-pink/10 text-neon-pink rounded-lg hover:bg-neon-pink/20 transition-colors"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Error and Success Messages */}
        {error && (
          <div className="flex items-center space-x-2 text-neon-pink p-4 bg-neon-pink/10 rounded-lg">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {success && (
          <div className="flex items-center space-x-2 text-neon-green p-4 bg-neon-green/10 rounded-lg">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <p className="text-sm">{success}</p>
          </div>
        )}

        {/* Save Button */}
        <button
          type="submit"
          disabled={saving}
          className="w-full flex items-center justify-center space-x-2 py-3 bg-neon-blue text-white rounded-lg hover:bg-neon-blue/90 transition-colors disabled:opacity-50"
        >
          <Save className="w-5 h-5" />
          <span>{saving ? 'Saving...' : 'Save Changes'}</span>
        </button>
      </form>

      {/* Delete Account Warning Modal */}
      {showDeleteWarning && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="max-w-md w-full gradient-bg p-6 rounded-lg border border-neon-pink/20">
            <div className="flex items-center justify-center mb-4 text-neon-pink">
              <AlertCircle className="w-12 h-12" />
            </div>
            <h3 className="text-xl font-bold text-white text-center mb-2">Delete Account?</h3>
            <p className="text-white/80 text-center mb-6">
              This action cannot be undone. You will lose all your links and won't be able to recover them unless you meet those people again in real life.
            </p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => setShowDeleteWarning(false)}
                className="px-6 py-2 text-white/80 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleting}
                className="px-6 py-2 bg-neon-pink text-white rounded-lg hover:bg-neon-pink/90 transition-colors flex items-center space-x-2"
              >
                {deleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white"></div>
                    <span>Deleting...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Account</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}