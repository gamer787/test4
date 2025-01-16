import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ImagePlus, Loader, Video, ListPlus, X, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

type PostType = 'post' | 'reel' | 'thread';
type ThreadItem = {
  id: string;
  content: string;
  media: {
    file: File | null;
    preview: string;
    type: 'image' | 'video' | null;
  };
};

const STORAGE_BUCKET = 'media';

export default function CreatePost() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [postType, setPostType] = useState<PostType>('post');
  const [image, setImage] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>('');
  const [caption, setCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [threadItems, setThreadItems] = useState<ThreadItem[]>([{ 
    id: '1', 
    content: '',
    media: {
      file: null,
      preview: '',
      type: null
    }
  }]);

  const handleMediaChange = (e: React.ChangeEvent<HTMLInputElement>, threadItemId?: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');

    if (!isVideo && !isImage) {
      setError('Please select an image or video file');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (threadItemId) {
        // Update thread item image
        setThreadItems(prev => prev.map(item => 
          item.id === threadItemId
            ? { 
                ...item, 
                media: {
                  file,
                  preview: reader.result as string,
                  type: isImage ? 'image' : 'video'
                }
              }
            : item
        ));
      } else {
        // Update main post image
        setPreview(reader.result as string);
        if (postType === 'reel') {
          setVideo(file);
          setImage(null);
        } else {
          setImage(file);
          setVideo(null);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleThreadItemChange = (id: string, content: string) => {
    setThreadItems(prev =>
      prev.map(item =>
        item.id === id ? { ...item, content } : item
      )
    );
  };

  const addThreadItem = () => {
    setThreadItems(prev => [
      ...prev,
      { 
        id: Math.random().toString(),
        content: '',
        media: {
          file: null,
          preview: '',
          type: null
        }
      }
    ]);
  };

  const removeThreadItem = (id: string) => {
    setThreadItems(prev => prev.filter(item => item.id !== id));
  };

  const removeThreadItemImage = (id: string) => {
    setThreadItems(prev => prev.map(item =>
      item.id === id ? { 
        ...item, 
        media: { file: null, preview: '', type: null }
      } : item
    ));
  };

  const uploadMedia = async (file: File, type: 'post' | 'reel' | 'thread') => {
    if (!user) throw new Error('User not authenticated');

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${type}_${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(fileName, file, {
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    setError('');

    try {
      let mediaUrl = '';
      const timestamp = Date.now();
      const threadGroupId = `thread_${timestamp}`;

      if (postType !== 'thread') {
        const file = postType === 'reel' ? video : image;
        if (!file) {
          throw new Error(`Please select a ${postType === 'reel' ? 'video' : 'photo'}`);
        }

        mediaUrl = await uploadMedia(file, postType);
      }

      if (postType === 'thread') {
        // Create multiple posts for thread items
        for (const item of threadItems) {
          if (!item.content.trim()) continue;

          let threadImageUrl = null;
          if (item.media.file) {
            threadImageUrl = await uploadMedia(item.media.file, 'thread');
          }

          const { error: postError } = await supabase
            .from('posts')
            .insert({
              user_id: user.id,
              type: 'thread',
              caption: item.content,
              thread_group_id: threadGroupId,
              image_url: item.media.type === 'image' ? threadImageUrl : null,
              video_url: item.media.type === 'video' ? threadImageUrl : null
            });

          if (postError) throw postError;
        }
      } else {
        // Create single post/reel
        const { error: postError } = await supabase
          .from('posts')
          .insert({
            user_id: user.id,
            type: postType,
            caption: caption.trim(),
            image_url: postType === 'post' ? mediaUrl : null,
            video_url: postType === 'reel' ? mediaUrl : null,
            thread_group_id: null
          });

        if (postError) throw postError;
      }

      navigate('/');
    } catch (error: any) {
      console.error('Error creating post:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-darker-bg">
      <div className="max-w-xl mx-auto p-6">
        {/* Header with Icon */}
        <div className="flex items-center justify-center mb-8">
          <Shield className="w-12 h-12 text-neon-blue" />
          <h1 className="text-2xl font-bold text-white ml-3">Create New Content</h1>
        </div>

        {/* Content Type Selection */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { type: 'post', icon: ImagePlus, label: 'Post', color: 'neon-blue' },
            { type: 'reel', icon: Video, label: 'Reel', color: 'neon-pink' },
            { type: 'thread', icon: ListPlus, label: 'Thread', color: 'neon-purple' }
          ].map(({ type, icon: Icon, label, color }) => (
            <button
              key={type}
              onClick={() => setPostType(type as PostType)}
              className={`relative p-6 rounded-lg border transition-all duration-200 ${
                postType === type
                  ? `border-${color} bg-${color}/10 shadow-lg`
                  : 'border-white/10 hover:border-white/30 bg-card-bg'
              }`}
            >
              <div className="flex flex-col items-center">
                <Icon className={`w-8 h-8 mb-2 ${postType === type ? `text-${color}` : 'text-white/60'}`} />
                <span className={`text-sm font-medium ${postType === type ? 'text-white' : 'text-white/60'}`}>
                  {label}
                </span>
              </div>
              {postType === type && (
                <div className={`absolute inset-0 border-2 border-${color} rounded-lg animate-pulse opacity-20`} />
              )}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Upload Area for Posts and Reels */}
          {postType !== 'thread' && (
            <div className="relative rounded-lg overflow-hidden">
              {preview ? (
                <div className="relative aspect-square">
                  {postType === 'reel' ? (
                    <video
                      src={preview}
                      className="w-full h-full object-cover rounded-lg"
                      controls
                    />
                  ) : (
                    <img
                      src={preview}
                      alt="Preview"
                      className="w-full h-full object-cover rounded-lg"
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setImage(null);
                      setVideo(null);
                      setPreview('');
                    }}
                    className="absolute top-4 right-4 bg-black/50 text-white rounded-full p-2 hover:bg-black/70 backdrop-blur-sm"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-80 rounded-lg border-2 border-dashed border-white/20 bg-card-bg cursor-pointer hover:border-white/40 transition-colors">
                  <div className="flex flex-col items-center">
                    {postType === 'reel' ? (
                      <Video className="w-16 h-16 text-neon-pink mb-4" />
                    ) : (
                      <ImagePlus className="w-16 h-16 text-neon-blue mb-4" />
                    )}
                    <span className="text-lg font-medium text-white/80">
                      Drop your {postType === 'reel' ? 'video' : 'image'} here
                    </span>
                    <span className="mt-2 text-sm text-white/50">
                      or click to select
                    </span>
                  </div>
                  <input
                    type="file"
                    accept={postType === 'reel' ? 'video/*' : 'image/*'}
                    onChange={handleMediaChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          )}

          {/* Thread Items */}
          {postType === 'thread' && (
            <div className="space-y-4">
              {threadItems.map((item, index) => (
                <div key={item.id} className="relative space-y-2">
                  {index > 0 && (
                    <div className="absolute left-4 -top-4 w-0.5 h-8 bg-neon-purple/20"></div>
                  )}
                  <textarea
                    value={item.content}
                    onChange={(e) => handleThreadItemChange(item.id, e.target.value)}
                    className="w-full rounded-lg bg-card-bg border border-white/10 p-4 text-white placeholder-white/30 focus:border-neon-purple focus:ring-1 focus:ring-neon-purple"
                    placeholder={index === 0 ? "What's happening?" : "Add to thread..."}
                    rows={3}
                  />
                  
                  {/* Image upload for thread item */}
                  {item.media.preview ? (
                    <div className="relative w-full aspect-video">
                      {item.media.type === 'image' ? (
                        <img
                          src={item.media.preview}
                          alt="Thread item preview"
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <video
                          src={item.media.preview}
                          className="w-full h-full object-cover rounded-lg"
                          controls
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => removeThreadItemImage(item.id)}
                        className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-2 hover:bg-black/70 backdrop-blur-sm"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  ) : (
                    <label className="block w-full p-4 rounded-lg border border-dashed border-white/20 bg-card-bg cursor-pointer hover:border-white/40 transition-colors">
                      <div className="flex items-center justify-center">
                        <ImagePlus className="w-6 h-6 text-white/60 mr-2" />
                        <span className="text-sm text-white/60">Add media</span>
                      </div>
                      <input
                        type="file"
                        accept="image/*,video/*"
                        onChange={(e) => handleMediaChange(e, item.id)}
                        className="hidden"
                      />
                    </label>
                  )}

                  {(threadItems.length > 1 || item.level > 0) && (
                    <button
                      type="button"
                      onClick={() => removeThreadItem(item.id)}
                      className="absolute top-3 right-3 text-white/50 hover:text-white"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addThreadItem}
                className="w-full py-3 px-4 rounded-lg border border-neon-purple/30 bg-neon-purple/10 text-neon-purple hover:bg-neon-purple/20 transition-colors"
              >
                <ListPlus className="w-5 h-5 inline-block mr-2" />
                Add to thread
              </button>
            </div>
          )}

          {/* Caption for Posts and Reels */}
          {postType !== 'thread' && (
            <div>
              <textarea
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                className="w-full rounded-lg bg-card-bg border border-white/10 p-4 text-white placeholder-white/30 focus:border-neon-blue focus:ring-1 focus:ring-neon-blue"
                placeholder="Write a caption..."
                rows={4}
              />
            </div>
          )}

          {error && (
            <div className="p-4 rounded-lg bg-neon-pink/10 border border-neon-pink/30">
              <p className="text-neon-pink text-sm">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full flex justify-center items-center py-4 px-6 rounded-lg text-white font-medium transition-all ${
              loading
                ? 'bg-gray-600 cursor-not-allowed'
                : postType === 'post'
                ? 'bg-neon-blue hover:bg-neon-blue/90'
                : postType === 'reel'
                ? 'bg-neon-pink hover:bg-neon-pink/90'
                : 'bg-neon-purple hover:bg-neon-purple/90'
            }`}
          >
            {loading ? (
              <>
                <Loader className="w-5 h-5 animate-spin mr-2" />
                Creating {postType}...
              </>
            ) : (
              `Share ${postType}`
            )}
          </button>
        </form>
      </div>
    </div>
  );
}