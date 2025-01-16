import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Grid, Link as LinkIcon, AlertTriangle, Upload, Edit2, Check, X, Trash2, MoreVertical, Image, Video, ListPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

type Profile = {
  id: string;
  username: string;
  avatar_url: string;
  bio: string | null;
};

type Post = {
  id: string;
  image_url: string;
  video_url: string;
  type: 'post' | 'reel' | 'thread';
  likes: { id: string }[];
  comments: { id: string }[];
};

type Link = {
  id: string;
  user: {
    id: string;
    username: string;
    avatar_url: string;
    bio: string | null;
  };
};

type Tab = 'posts' | 'links' | 'reels' | 'threads';

export default function Profile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [links, setLinks] = useState<Link[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>('posts');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showUnlinkWarning, setShowUnlinkWarning] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [editingBio, setEditingBio] = useState(false);
  const [bio, setBio] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showDeletePostModal, setShowDeletePostModal] = useState(false);
  const [postToDelete, setPostToDelete] = useState<Post | null>(null);
  const [menuOpenPostId, setMenuOpenPostId] = useState<string | null>(null);
  
  const isOwnProfile = id === 'me' || id === user?.id;
  const profileId = isOwnProfile ? user?.id : id;
  const [postFilter, setPostFilter] = useState<'all' | 'post' | 'reel' | 'thread'>('all');

  const filteredPosts = posts.filter(post => 
    postFilter === 'all' ? true : post.type === postFilter
  );

  const postCounts = {
    all: posts.length,
    post: posts.filter(p => p.type === 'post').length,
    reel: posts.filter(p => p.type === 'reel').length,
    thread: posts.filter(p => p.type === 'thread').length
  };

  useEffect(() => {
    if (profileId) {
      fetchProfile();
      fetchPosts();
      fetchLinks();
    }
  }, [profileId]);

  useEffect(() => {
    if (profile?.bio) {
      setBio(profile.bio);
    }
  }, [profile?.bio]);

  async function fetchProfile() {
    if (!profileId) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, bio')
        .eq('id', profileId)
        .single();

      if (error) throw error;
      if (data) {
        setProfile(data);
        setBio(data.bio || '');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setError('Failed to load profile');
    }
  }

  async function fetchPosts() {
    if (!profileId) return;
    
    try {
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          likes ( id ),
          comments ( id )
        `)
        .eq('user_id', profileId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (error) {
      console.error('Error fetching posts:', error);
      setError('Failed to load posts');
    } finally {
      setLoading(false);
    }
  }

  async function fetchLinks() {
    if (!profileId) return;

    try {
      // Only fetch accepted connections
      const { data, error } = await supabase
        .from('connections')
        .select(`
          id,
          status,
          user:connected_user_id (
            id,
            username,
            avatar_url,
            bio
          )
        `)
        .eq('user_id', profileId)
        .eq('status', 'accepted');

      if (error) throw error;

      // Also fetch reverse connections
      const { data: reverseData, error: reverseError } = await supabase
        .from('connections')
        .select(`
          id,
          status,
          user:user_id (
            id,
            username,
            avatar_url,
            bio
          )
        `)
        .eq('connected_user_id', profileId)
        .eq('status', 'accepted');

      if (reverseError) throw reverseError;

      // Combine and deduplicate connections
      const allLinks = [...(data || []), ...(reverseData || [])];
      const uniqueLinks = allLinks.filter((link, index, self) =>
        index === self.findIndex((l) => l.user.id === link.user.id)
      );

      setLinks(uniqueLinks);
    } catch (error) {
      console.error('Error fetching links:', error);
    }
  }

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setUploading(true);
      if (!event.target.files || !event.target.files[0]) return;

      const file = event.target.files[0];
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}-${Math.random()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user?.id);

      if (updateError) throw updateError;

      fetchProfile();
    } catch (error) {
      console.error('Error uploading avatar:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleBioUpdate = async () => {
    if (!user?.id) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ bio })
        .eq('id', user.id);

      if (error) throw error;
      setEditingBio(false);
      fetchProfile();
    } catch (error) {
      console.error('Error updating bio:', error);
    }
  };

  const handleDeletePost = async () => {
    if (!postToDelete || !user) return;

    setError('');
    try {
      // Delete media from storage if it exists
      if (postToDelete.video_url || postToDelete.image_url) {
        const mediaUrl = postToDelete.video_url || postToDelete.image_url;
        const mediaPath = mediaUrl?.split('/').pop();
        const { error: storageError } = await supabase.storage
          .from('media')
          .remove([mediaPath || '']);

        if (storageError) throw storageError;
      }

      // Delete the main post
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postToDelete.id)
        .eq('user_id', user.id);

      if (error) throw error;

      // Remove post from local state
      setPosts(prev => prev.filter(p => p.id !== postToDelete.id));
      setShowDeletePostModal(false);
      setPostToDelete(null);
    } catch (error) {
      console.error('Error deleting post:', error);
      setError('Failed to delete post. Please try again.');
    }
  };

  const openDeletePostModal = (post: Post) => {
    setPostToDelete(post);
    setShowDeletePostModal(true);
    setMenuOpenPostId(null);
  };

  const handleUnlink = async (userId: string) => {
    setSelectedUserId(userId);
    setShowUnlinkWarning(true);
  };

  const confirmUnlink = async () => {
    if (!selectedUserId || !user) return;

    setError('');
    try {
      // Delete messages between users first
      const { error: messagesError } = await supabase
        .from('messages')
        .delete()
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedUserId}),and(sender_id.eq.${selectedUserId},receiver_id.eq.${user.id})`);

      if (messagesError) throw messagesError;

      // Then delete the connection (trigger will handle both directions)
      const { error: deleteError } = await supabase
        .from('connections')
        .delete()
        .eq('user_id', user.id)
        .eq('connected_user_id', selectedUserId);

      if (deleteError) throw deleteError;

      // Refetch links to ensure state is in sync with server
      await fetchLinks();

      // Create notification for the other user
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert([
          {
            user_id: selectedUserId,
            sender_id: user.id,
            type: 'connection_request',
            content: 'has unlinked with you',
            created_at: new Date().toISOString(),
            read: false
          },
          {
            user_id: user.id,
            sender_id: selectedUserId,
            type: 'connection_request',
            content: 'You have unlinked with this user',
            created_at: new Date().toISOString(),
            read: false
          }
        ]);

      if (notificationError) throw notificationError;

      // Update local state immediately
      setLinks(prev => prev.filter(link => link.user.id !== selectedUserId));
    } catch (error) {
      console.error('Error unlinking user:', error);
      setError('Failed to unlink user. Please try again.');
    } finally {
      setShowUnlinkWarning(false);
      setSelectedUserId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-blue"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-8">
        <p className="text-white/50">Profile not found</p>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4">
      {/* Profile Header */}
      <div className="flex flex-col sm:flex-row items-center sm:justify-between py-6">
        <div className="flex flex-col sm:flex-row items-center sm:space-x-8">
          <div className="relative group">
            <div className="h-20 w-20 rounded-full bg-card-bg overflow-hidden mb-4 sm:mb-0 ring-2 ring-neon-blue/30">
              {profile?.avatar_url && (
                <img
                  src={profile.avatar_url}
                  alt={profile.username}
                  className="h-full w-full object-cover"
                />
              )}
            </div>
            {isOwnProfile && (
              <label className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 cursor-pointer rounded-full transition-opacity">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarUpload}
                  className="hidden"
                />
                {uploading ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                ) : (
                  <Upload className="w-6 h-6 text-white" />
                )}
              </label>
            )}
          </div>
          <div className="text-center sm:text-left">
            <h1 className="text-xl sm:text-2xl font-semibold text-white">{profile?.username}</h1>
            
            {/* Bio Section */}
            <div className="mt-2 max-w-md">
              {editingBio ? (
                <div className="flex flex-col space-y-2">
                  <textarea
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    className="w-full px-3 py-2 bg-card-bg border border-white/10 rounded-lg text-white resize-none focus:border-neon-blue focus:ring-1 focus:ring-neon-blue"
                    placeholder="Write your bio..."
                    rows={3}
                  />
                  <div className="flex justify-end space-x-2">
                    <button
                      onClick={() => {
                        setBio(profile?.bio || '');
                        setEditingBio(false);
                      }}
                      className="p-1 text-white/80 hover:text-neon-pink"
                    >
                      <X className="w-5 h-5" />
                    </button>
                    <button
                      onClick={handleBioUpdate}
                      className="p-1 text-white/80 hover:text-neon-green"
                    >
                      <Check className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="group relative">
                  <p className="text-white/80 text-sm">
                    {profile?.bio || (isOwnProfile ? 'Add a bio...' : '')}
                  </p>
                  {isOwnProfile && (
                    <button
                      onClick={() => setEditingBio(true)}
                      className="absolute -right-6 top-0 p-1 opacity-0 group-hover:opacity-100 transition-opacity text-white/80 hover:text-neon-blue"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="mt-4 flex justify-center sm:justify-start space-x-6">
              <button 
                onClick={() => setActiveTab('posts')}
                className={`flex items-center space-x-2 ${activeTab === 'posts' ? 'text-white' : 'text-white/50'}`}
              >
                <Grid className="w-4 h-4" />
                <span className="font-semibold">{postCounts.all}</span>
                <span className="ml-1">posts</span>
              </button>
              <button 
                onClick={() => setActiveTab('reels')}
                className={`flex items-center space-x-2 ${activeTab === 'reels' ? 'text-white' : 'text-white/50'}`}
              >
                <Video className="w-4 h-4" />
                <span className="font-semibold">{postCounts.reel}</span>
                <span className="ml-1">reels</span>
              </button>
              <button 
                onClick={() => setActiveTab('threads')}
                className={`flex items-center space-x-2 ${activeTab === 'threads' ? 'text-white' : 'text-white/50'}`}
              >
                <ListPlus className="w-4 h-4" />
                <span className="font-semibold">{postCounts.thread}</span>
                <span className="ml-1">threads</span>
              </button>
              <button
                onClick={() => setActiveTab('links')}
                className={`flex items-center space-x-2 ${activeTab === 'links' ? 'text-white' : 'text-white/50'}`}
              >
                <LinkIcon className="w-4 h-4" />
                <span className="font-semibold">{links.length}</span>
                <span className="ml-1">links</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Content Tabs */}
      <div className="border-t border-white/10 pt-6">
        <div className="flex items-center justify-center mb-6 space-x-8">
          {activeTab === 'posts' && (
            <>
              <button
                onClick={() => setPostFilter('all')}
                className={`flex items-center space-x-1 text-sm font-medium pb-2 border-b-2 transition-colors ${
                  postFilter === 'all'
                    ? 'border-neon-blue text-neon-blue'
                    : 'border-transparent text-white/50 hover:text-white/80'
                }`}
              >
                <Grid className="w-4 h-4" />
                <span>ALL</span>
              </button>
              <button
                onClick={() => setPostFilter('post')}
                className={`flex items-center space-x-1 text-sm font-medium pb-2 border-b-2 transition-colors ${
                  postFilter === 'post'
                    ? 'border-neon-blue text-neon-blue'
                    : 'border-transparent text-white/50 hover:text-white/80'
                }`}
              >
                <Image className="w-4 h-4" />
                <span>PHOTOS</span>
              </button>
              <button
                onClick={() => setPostFilter('reel')}
                className={`flex items-center space-x-1 text-sm font-medium pb-2 border-b-2 transition-colors ${
                  postFilter === 'reel'
                    ? 'border-neon-pink text-neon-pink'
                    : 'border-transparent text-white/50 hover:text-white/80'
                }`}
              >
                <Video className="w-4 h-4" />
                <span>REELS</span>
              </button>
              <button
                onClick={() => setPostFilter('thread')}
                className={`flex items-center space-x-1 text-sm font-medium pb-2 border-b-2 transition-colors ${
                  postFilter === 'thread'
                    ? 'border-neon-purple text-neon-purple'
                    : 'border-transparent text-white/50 hover:text-white/80'
                }`}
              >
                <ListPlus className="w-4 h-4" />
                <span>THREADS</span>
              </button>
            </>
          )}
        </div>

        {/* Posts Grid */}
        {activeTab === 'posts' && (
          <div className="grid grid-cols-3 gap-0.5 sm:gap-1">
            {filteredPosts.map((post) => (
              <div key={post.id} className="relative group">
                <div className="relative pb-[100%] bg-card-bg">
                  {post.type === 'reel' ? (
                    <video
                      src={post.video_url}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <img
                      src={post.image_url}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}
                  <div className={`absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity duration-200 ${
                    post.type === 'reel' ? 'border-2 border-neon-pink' :
                    post.type === 'thread' ? 'border-2 border-neon-purple' : ''
                  }`}>
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="flex space-x-4 text-white">
                        <div className="flex items-center space-x-2">
                          {post.type === 'reel' && <Video className="w-4 h-4 text-neon-pink" />}
                          {post.type === 'thread' && <ListPlus className="w-4 h-4 text-neon-purple" />}
                          {post.type === 'post' && <Image className="w-4 h-4 text-neon-blue" />}
                        </div>
                        <div className="flex items-center">
                          <span className="text-sm font-semibold">{post.likes.length}</span>
                        </div>
                        <div className="flex items-center">
                          <span className="text-sm font-semibold">{post.comments.length}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {isOwnProfile && (
                  <button
                    onClick={() => openDeletePostModal(post)}
                    className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-black/70 transition-all duration-200 backdrop-blur-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Reels Tab */}
        {activeTab === 'reels' && (
          <div className="grid grid-cols-3 gap-0.5 sm:gap-1">
            {posts.filter(post => post.type === 'reel').map((post) => (
              <div key={post.id} className="relative group">
                <div className="relative pb-[100%] bg-card-bg border-2 border-neon-pink">
                  <video
                    src={post.video_url}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity duration-200">
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="flex space-x-4 text-white">
                        <div className="flex items-center">
                          <span className="text-sm font-semibold">{post.likes.length}</span>
                        </div>
                        <div className="flex items-center">
                          <span className="text-sm font-semibold">{post.comments.length}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {isOwnProfile && (
                  <button
                    onClick={() => openDeletePostModal(post)}
                    className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-black/70 transition-all duration-200 backdrop-blur-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Threads Tab */}
        {activeTab === 'threads' && (
          <div className="grid grid-cols-3 gap-0.5 sm:gap-1">
            {posts.filter(post => post.type === 'thread').map((post) => (
              <div key={post.id} className="relative group">
                <div className="relative pb-[100%] bg-card-bg border-2 border-neon-purple">
                  {post.image_url && (
                    <img
                      src={post.image_url}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  )}
                  <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-30 transition-opacity duration-200">
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <div className="flex space-x-4 text-white">
                        <div className="flex items-center">
                          <span className="text-sm font-semibold">{post.likes.length}</span>
                        </div>
                        <div className="flex items-center">
                          <span className="text-sm font-semibold">{post.comments.length}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                {isOwnProfile && (
                  <button
                    onClick={() => openDeletePostModal(post)}
                    className="absolute top-2 right-2 p-2 bg-black/50 text-white rounded-full opacity-0 group-hover:opacity-100 hover:bg-black/70 transition-all duration-200 backdrop-blur-sm"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Links List */}
        {activeTab === 'links' && (
          <div className="space-y-4">
            {links.map((link) => (
              <div 
                key={link.id} 
                className="gradient-bg p-4 rounded-lg border border-white/10 hover:border-neon-blue/30 transition-all duration-200 cursor-pointer"
                onClick={() => navigate(`/profile/${link.user.id}`)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <img
                      src={link.user.avatar_url}
                      alt={link.user.username}
                      className="w-10 h-10 rounded-full bg-card-bg"
                    />
                    <div>
                      <span className="font-medium text-white hover:text-neon-blue transition-colors">
                        {link.user.username}
                      </span>
                      {link.user.bio && (
                        <p className="text-sm text-white/50 mt-1 line-clamp-1">
                          {link.user.bio}
                        </p>
                      )}
                    </div>
                  </div>
                  {isOwnProfile && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleUnlink(link.user.id);
                      }}
                      className="px-4 py-1.5 text-sm text-neon-pink border border-neon-pink rounded-full hover:bg-neon-pink/10 transition-colors"
                    >
                      Unlink
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Unlink Warning Modal */}
      {showUnlinkWarning && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="max-w-md w-full gradient-bg p-6 rounded-lg border border-white/10">
            {error && (
              <div className="mb-4 p-3 bg-neon-pink/10 border border-neon-pink/20 rounded-lg text-neon-pink text-sm">
                {error}
              </div>
            )}
            <div className="flex items-center justify-center mb-4 text-neon-pink">
              <AlertTriangle className="w-12 h-12" />
            </div>
            <h3 className="text-xl font-bold text-white text-center mb-2">Warning</h3>
            <p className="text-white/80 text-center mb-6">
              If you unlink this user, you won't be able to link with them again until you meet them in real life.
            </p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => setShowUnlinkWarning(false)}
                className="px-6 py-2 text-white/80 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={confirmUnlink}
                className="px-6 py-2 bg-neon-pink text-white rounded-lg hover:bg-neon-pink/90 transition-colors"
              >
                Unlink
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Post Confirmation Modal */}
      {showDeletePostModal && postToDelete && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="max-w-md w-full gradient-bg p-6 rounded-lg border border-neon-pink/20">
            <div className="flex items-center justify-center mb-4 text-neon-pink">
              <AlertTriangle className="w-12 h-12" />
            </div>
            <h3 className="text-xl font-bold text-white text-center mb-2">
              Delete {postToDelete.type}?
            </h3>
            <p className="text-white/80 text-center mb-6">
              This action cannot be undone. The {postToDelete.type} will be permanently deleted.
            </p>
            <div className="flex justify-center space-x-4">
              <button
                onClick={() => {
                  setShowDeletePostModal(false);
                  setPostToDelete(null);
                }}
                className="px-6 py-2 text-white/80 hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePost}
                className="px-6 py-2 bg-neon-pink text-white rounded-lg hover:bg-neon-pink/90 transition-colors flex items-center space-x-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}