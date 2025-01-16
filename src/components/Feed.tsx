import React, { useEffect, useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Heart, MessageCircle, Share2, Users, Video, Image, ListPlus, MapPin, Bluetooth, MoreVertical, Trash2, AlertTriangle, Send, X, Search, Loader, ExternalLink, ImagePlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { Link } from 'react-router-dom';
import ShareModal from './ShareModal';

type Connection = {
  id: string;
  user: {
    id: string;
    username: string;
    avatar_url: string;
  };
};

type Post = {
  id: string;
  type: 'post' | 'reel' | 'thread';
  image_url: string | null;
  video_url: string | null;
  caption: string;
  created_at: string;
  parent_id: string | null;
  thread_level: number;
  profiles: {
    username: string;
    avatar_url: string;
  };
  likes: { id: string }[];
  comments: { id: string }[];
  thread_group_id?: string;
  user_id: string;
};

type PostType = 'all' | 'post' | 'reel' | 'thread';

export default function Feed() {
  const { user } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasConnections, setHasConnections] = useState(false);
  const [activeType, setActiveType] = useState<PostType>('all');
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [postToDelete, setPostToDelete] = useState<Post | null>(null);
  const [menuOpenPostId, setMenuOpenPostId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<Post | null>(null);
  const [replyContent, setReplyContent] = useState('');
  const [replyImage, setReplyImage] = useState<File | null>(null);
  const [replyImagePreview, setReplyImagePreview] = useState('');
  const [commentingOnPost, setCommentingOnPost] = useState<string | null>(null);
  const [commentContent, setCommentContent] = useState('');
  const [comments, setComments] = useState<{[key: string]: any[]}>({});
  const [submittingComment, setSubmittingComment] = useState(false);
  const [threadReplies, setThreadReplies] = useState<{[key: string]: Post[]}>({});
  const [submittingReply, setSubmittingReply] = useState(false);
  const [expandedComments, setExpandedComments] = useState<{[key: string]: boolean}>({});
  const [replyingToThread, setReplyingToThread] = useState<string | null>(null);
  const [threadReplyContent, setThreadReplyContent] = useState('');
  const [threadReplyMedia, setThreadReplyMedia] = useState<File | null>(null);
  const [threadReplyPreview, setThreadReplyPreview] = useState('');
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [fetchingPosts, setFetchingPosts] = useState(true);
  const [error, setError] = useState('');
  const [fetchingConnections, setFetchingConnections] = useState(true);

  const fetchConnections = async () => {
    if (!user) return;

    try {
      // Fetch all accepted connections
      const { data, error } = await supabase
        .from('connections')
        .select(`
          id,
          user:connected_user_id (
            id,
            username,
            avatar_url
          )
        `)
        .eq('user_id', user.id)
        .eq('status', 'accepted');

      if (error) throw error;

      // Also fetch connections where the user is the connected_user_id
      const { data: reverseConnections, error: reverseError } = await supabase
        .from('connections')
        .select(`
          id,
          user:user_id (
            id,
            username,
            avatar_url
          )
        `)
        .eq('connected_user_id', user.id)
        .eq('status', 'accepted');

      if (reverseError) throw reverseError;

      // Combine and deduplicate connections
      const allConnections = [...(data || []), ...(reverseConnections || [])];
      const uniqueConnections = allConnections.filter((conn, index, self) =>
        index === self.findIndex((c) => c.user.id === conn.user.id)
      );

      setConnections(uniqueConnections);
    } catch (error) {
      console.error('Error fetching connections:', error);
    } finally {
      setFetchingConnections(false);
    }
  };

  const handleComment = async (postId: string) => {
    if (!user || !commentContent.trim()) return;
    
    setSubmittingComment(true);
    try {
      const { error } = await supabase
        .from('comments')
        .insert({
          post_id: postId,
          user_id: user.id,
          content: commentContent.trim()
        });

      if (error) throw error;

      // Clear input and refresh comments
      setCommentContent('');
      setCommentingOnPost(null);
      await fetchComments(postId);

      // Update local post state to increment comment count
      setPosts(prev => prev.map(p => 
        p.id === postId 
          ? { ...p, comments: [...p.comments, { id: 'temp' }] }
          : p
      ));
    } catch (error) {
      console.error('Error posting comment:', error);
      setError('Failed to post comment. Please try again.');
    } finally {
      setSubmittingComment(false);
    }
  };

  const fetchComments = async (postId: string) => {
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          *,
          profiles:user_id (
            username,
            avatar_url
          )
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      setComments(prev => ({
        ...prev,
        [postId]: data || []
      }));
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const handleThreadReplyMedia = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      setError('Please select an image or video file');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setThreadReplyMedia(file);
      setThreadReplyPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleThreadReply = async (threadId: string, groupId: string) => {
    if (!user || !threadReplyContent.trim()) return;
    
    setSubmittingReply(true);
    try {
      let mediaUrl = null;
      const timestamp = Date.now();
      const threadGroupId = `thread_${timestamp}`;

      if (threadReplyMedia) {
        mediaUrl = await uploadMedia(threadReplyMedia, 'thread');
      }

      const { error: replyError } = await supabase
        .from('posts')
        .insert({
          user_id: user.id,
          type: 'thread',
          caption: threadReplyContent.trim(),
          thread_group_id: groupId,
          parent_id: threadId,
          image_url: mediaUrl,
          created_at: new Date().toISOString()
        });

      if (replyError) throw replyError;

      // Clear form
      setThreadReplyContent('');
      setThreadReplyMedia(null);
      setThreadReplyPreview('');
      setReplyingToThread(null);

      // Refresh thread replies
      await fetchThreadReplies(groupId);
    } catch (error) {
      console.error('Error replying to thread:', error);
      setError('Failed to post reply. Please try again.');
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleLike = async (postId: string) => {
    try {
      if (!user?.id) return;

      // Check if user already liked the post
      const { data: existingLike, error: likeError } = await supabase
        .from('likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', user.id)
        .maybeSingle();

      if (likeError) throw likeError;

      if (existingLike) {
        // Unlike - delete the like
        await supabase
          .from('likes')
          .delete()
          .eq('id', existingLike.id);

        // Update local state
        setPosts(prev => prev.map(p => 
          p.id === postId 
            ? { ...p, likes: p.likes.filter(l => l.id !== existingLike.id) }
            : p
        ));
      } else {
        // Like - create new like
        const { data: newLike, error: insertError } = await supabase
          .from('likes')
          .insert({ post_id: postId, user_id: user.id })
          .select('id')
          .single();

        if (insertError) throw insertError;

        // Update local state
        setPosts(prev => prev.map(p => 
          p.id === postId 
            ? { ...p, likes: [...p.likes, newLike] }
            : p
        ));
      }
    } catch (error) {
      console.error('Error handling like:', error);
    }
  };

  const fetchPosts = async () => {
    try {
      if (!user?.id) {
        setFetchingPosts(false);
        return;
      }

      // First, get all connected users
      const { data: connections, error: connectionsError } = await supabase
        .from('connections')
        .select('connected_user_id, user_id')
        .or(`user_id.eq.${user.id},connected_user_id.eq.${user.id}`)
        .eq('status', 'accepted');

      if (connectionsError) throw connectionsError;

      // Get unique connected user IDs
      const connectedUserIds = connections?.reduce((acc: string[], conn) => {
        if (conn.user_id === user.id) {
          acc.push(conn.connected_user_id);
        } else {
          acc.push(conn.user_id);
        }
        return acc;
      }, []) || [];

      // Add the user's own ID to see their own posts
      connectedUserIds.push(user.id);

      setHasConnections(connectedUserIds.length > 1); // More than just their own ID

      // Fetch posts from connected users and own posts
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles (username, avatar_url),
          likes (id),
          comments (id)
        `)
        .in('user_id', connectedUserIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setPosts(data || []);
      setFetchingPosts(false);
    } catch (error) {
      console.error('Error fetching posts:', error);
      setFetchingPosts(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchPosts();
      fetchConnections();
    }
  }, [user]);

  // Rest of the code remains the same as in the original file...
  return (
    <div className="max-w-xl mx-auto space-y-6 px-4 sm:px-0 py-6">
      {/* Post Type Filter */}
      <div className="flex space-x-2">
        <button
          onClick={() => setActiveType('all')}
          className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-lg transition-colors ${
            activeType === 'all'
              ? 'bg-white/10 text-white'
              : 'text-white/60 hover:text-white hover:bg-white/5'
          }`}
        >
          <span>All</span>
        </button>
        <button
          onClick={() => setActiveType('post')}
          className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-lg transition-colors ${
            activeType === 'post'
              ? 'bg-neon-blue/20 text-neon-blue'
              : 'text-white/60 hover:text-neon-blue hover:bg-neon-blue/10'
          }`}
        >
          <Image className="w-4 h-4" />
          <span>Posts</span>
        </button>
        <button
          onClick={() => setActiveType('reel')}
          className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-lg transition-colors ${
            activeType === 'reel'
              ? 'bg-neon-pink/20 text-neon-pink'
              : 'text-white/60 hover:text-neon-pink hover:bg-neon-pink/10'
          }`}
        >
          <Video className="w-4 h-4" />
          <span>Reels</span>
        </button>
        <button
          onClick={() => setActiveType('thread')}
          className={`flex-1 flex items-center justify-center space-x-2 py-2 px-4 rounded-lg transition-colors ${
            activeType === 'thread'
              ? 'bg-neon-purple/20 text-neon-purple'
              : 'text-white/60 hover:text-neon-purple hover:bg-neon-purple/10'
          }`}
        >
          <ListPlus className="w-4 h-4" />
          <span>Threads</span>
        </button>
      </div>

      {/* Loading State */}
      {fetchingPosts && (
        <div className="flex justify-center items-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-blue"></div>
        </div>
      )}

      {/* No Posts State */}
      {!fetchingPosts && posts.length === 0 && (
        <div className="gradient-bg rounded-lg p-8 text-center border border-white/10">
          <div className="flex flex-col items-center space-y-4">
            <Users className="w-16 h-16 text-neon-blue" />
            <h2 className="text-xl font-semibold text-white">No Content Yet</h2>
            <p className="text-white/60 max-w-md mx-auto">
              {!hasConnections 
                ? "Go out there and meet new people! Use the Connect feature to link with people you meet in real life."
                : "Your connections haven't shared any content yet. Be the first one to post!"}
            </p>
            <Link
              to={hasConnections ? "/create" : "/connect"}
              className="mt-4 px-6 py-2 bg-neon-blue text-white rounded-lg hover:bg-neon-blue/90 transition-colors inline-flex items-center space-x-2"
            >
              {hasConnections ? (
                <>
                  <ImagePlus className="w-5 h-5" />
                  <span>Create Post</span>
                </>
              ) : (
                <>
                  <Bluetooth className="w-5 h-5" />
                  <span>Find Connections</span>
                </>
              )}
            </Link>
          </div>
        </div>
      )}

      {/* Posts List */}
      {posts
        .filter(post => activeType === 'all' || post.type === activeType)
        .map(post => (
          <div key={post.id} className="gradient-bg rounded-lg overflow-hidden border border-white/10">
            {/* Post Header */}
            <div className="flex items-center justify-between p-3">
              <Link to={`/profile/${post.user_id}`} className="flex items-center space-x-3">
                <img
                  src={post.profiles.avatar_url}
                  alt={post.profiles.username}
                  className="w-8 h-8 rounded-full"
                />
                <span className="font-medium text-white">{post.profiles.username}</span>
              </Link>
            </div>

            {/* Post Content */}
            {post.type === 'reel' && post.video_url && (
              <video
                src={post.video_url}
                className="w-full aspect-[9/16] object-cover"
                controls
                playsInline
              />
            )}
            
            {(post.type === 'post' || post.type === 'thread') && post.image_url && (
              <img
                src={post.image_url}
                alt="Post content"
                className="w-full aspect-square object-cover"
              />
            )}

            {/* Post Actions */}
            <div className="p-3">
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => handleLike(post.id)}
                  className="flex items-center space-x-1 text-white/80 hover:text-neon-pink transition-colors"
                >
                  <Heart className={`w-6 h-6 ${post.likes.some(like => like.id) ? 'fill-neon-pink text-neon-pink' : ''}`} />
                  <span>{post.likes.length}</span>
                </button>
                <button 
                  onClick={() => {
                    setCommentingOnPost(commentingOnPost === post.id ? null : post.id);
                    if (!comments[post.id]) {
                      fetchComments(post.id);
                    }
                  }}
                  className="flex items-center space-x-1 text-white/80 hover:text-neon-blue transition-colors"
                >
                  <MessageCircle className="w-6 h-6" />
                  <span>{post.comments.length}</span>
                </button>
                <button
                  onClick={() => {
                    setSelectedPost(post);
                    setShareModalOpen(true);
                  }}
                  className="flex items-center space-x-1 text-white/80 hover:text-neon-purple transition-colors"
                >
                  <Share2 className="w-6 h-6" />
                </button>

                {/* Comments Section */}
                {commentingOnPost === post.id && (
                  <div className="mt-4 space-y-4">
                    {/* Comment Input */}
                    <div className="flex space-x-2">
                      <input
                        type="text"
                        value={commentContent}
                        onChange={(e) => setCommentContent(e.target.value)}
                        placeholder="Write a comment..."
                        className="flex-1 bg-card-bg border border-white/10 rounded-lg px-4 py-2 text-white placeholder-white/30 focus:border-neon-blue focus:ring-1 focus:ring-neon-blue"
                      />
                      <button
                        onClick={() => handleComment(post.id)}
                        disabled={!commentContent.trim() || submittingComment}
                        className="px-4 py-2 bg-neon-blue/20 text-neon-blue rounded-lg hover:bg-neon-blue/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {submittingComment ? (
                          <Loader className="w-5 h-5 animate-spin" />
                        ) : (
                          <Send className="w-5 h-5" />
                        )}
                      </button>
                    </div>

                    {/* Comments List */}
                    {comments[post.id]?.slice(0, expandedComments[post.id] ? undefined : 3).map((comment) => (
                      <div key={comment.id} className="flex space-x-3">
                        <img
                          src={comment.profiles.avatar_url}
                          alt={comment.profiles.username}
                          className="w-8 h-8 rounded-full"
                        />
                        <div className="flex-1">
                          <div className="bg-card-bg rounded-lg p-3">
                            <p className="text-sm font-medium text-white">
                              {comment.profiles.username}
                            </p>
                            <p className="text-sm text-white/80 mt-1">
                              {comment.content}
                            </p>
                          </div>
                          <p className="text-xs text-white/40 mt-1">
                            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        {comment.user_id === user?.id && (
                          <button
                            onClick={async () => {
                              try {
                                await supabase
                                  .from('comments')
                                  .delete()
                                  .eq('id', comment.id);
                                
                                // Update local state
                                setComments(prev => ({
                                  ...prev,
                                  [post.id]: prev[post.id].filter(c => c.id !== comment.id)
                                }));
                                
                                // Update post comment count
                                setPosts(prev => prev.map(p => 
                                  p.id === post.id 
                                    ? { ...p, comments: p.comments.filter((_, i) => i !== 0) }
                                    : p
                                ));
                              } catch (error) {
                                console.error('Error deleting comment:', error);
                              }
                            }}
                            className="p-2 text-white/40 hover:text-neon-pink transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                    
                    {/* Show More Comments Button */}
                    {comments[post.id]?.length > 3 && !expandedComments[post.id] && (
                      <button
                        onClick={() => setExpandedComments(prev => ({ ...prev, [post.id]: true }))}
                        className="mt-2 text-sm text-neon-blue hover:text-neon-blue/80 transition-colors"
                      >
                        Show {comments[post.id].length - 3} more comments
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Caption */}
              {post.caption && (
                <p className="mt-2 text-white">
                  <span className="font-medium">{post.profiles.username}</span>{' '}
                  {post.caption}
                </p>
              )}

              {/* Timestamp */}
              <p className="mt-1 text-sm text-white/50">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
        ))}

      {/* Share Modal */}
      {shareModalOpen && selectedPost && (
        <ShareModal
          isOpen={shareModalOpen}
          onClose={() => {
            setShareModalOpen(false);
            setSelectedPost(null);
          }}
          postId={selectedPost.id}
          postType={selectedPost.type}
          connections={connections}
        />
      )}
    </div>
  );
}