import React, { useState } from 'react';
import { Share2, X, MessageCircle, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

type Connection = {
  id: string;
  user: {
    id: string;
    username: string;
    avatar_url: string;
  };
};

type ShareModalProps = {
  isOpen: boolean;
  onClose: () => void;
  postId: string;
  postType: 'post' | 'reel' | 'thread';
  connections: Connection[];
};

export default function ShareModal({ isOpen, onClose, postId, postType, connections }: ShareModalProps) {
  const { user } = useAuth();
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [sharing, setSharing] = useState(false);

  if (!isOpen) return null;

  const handleShare = async (platform?: string) => {
    if (!user) return;
    setSharing(true);

    try {
      if (platform) {
        // External share
        await supabase
          .from('shares')
          .insert({
            user_id: user.id,
            post_id: postId,
            external_platform: platform
          });

        // Open external share
        const shareUrl = `${window.location.origin}/share/${postId}`;
        switch (platform) {
          case 'whatsapp':
            window.open(`https://wa.me/?text=${encodeURIComponent(shareUrl)}`);
            break;
          case 'telegram':
            window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}`);
            break;
          case 'messenger':
            window.open(`https://www.facebook.com/dialog/send?link=${encodeURIComponent(shareUrl)}&app_id=YOUR_FB_APP_ID`);
            break;
        }
      } else {
        // Internal share with selected users
        const shares = selectedUsers.map(userId => ({
          user_id: user.id,
          post_id: postId,
          shared_with_id: userId
        }));

        await supabase.from('shares').insert(shares);

        // Create notifications for shared users
        const notifications = selectedUsers.map(userId => ({
          user_id: userId,
          sender_id: user.id,
          type: 'share',
          content: `shared a ${postType} with you`,
          read: false
        }));

        await supabase.from('notifications').insert(notifications);
      }

      onClose();
    } catch (error) {
      console.error('Error sharing:', error);
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="max-w-md w-full gradient-bg rounded-lg border border-white/10">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center space-x-2">
            <Share2 className="w-5 h-5 text-neon-blue" />
            <h3 className="text-lg font-semibold text-white">Share {postType}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-white/60 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Share with connections */}
        <div className="p-4">
          <h4 className="text-sm font-medium text-white/80 mb-3">Share with connections</h4>
          <div className="max-h-48 overflow-y-auto space-y-2">
            {connections.map((connection) => (
              <label
                key={connection.id}
                className="flex items-center space-x-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedUsers.includes(connection.user.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedUsers([...selectedUsers, connection.user.id]);
                    } else {
                      setSelectedUsers(selectedUsers.filter(id => id !== connection.user.id));
                    }
                  }}
                  className="rounded border-white/20 text-neon-blue focus:ring-neon-blue"
                />
                <img
                  src={connection.user.avatar_url}
                  alt={connection.user.username}
                  className="w-8 h-8 rounded-full"
                />
                <span className="text-white">{connection.user.username}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Share buttons */}
        <div className="p-4 border-t border-white/10">
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handleShare()}
              disabled={selectedUsers.length === 0 || sharing}
              className="flex items-center justify-center space-x-2 py-2 px-4 bg-neon-blue/20 text-neon-blue rounded-lg hover:bg-neon-blue/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Share with selected</span>
            </button>
            <button
              onClick={() => handleShare('whatsapp')}
              className="flex items-center justify-center space-x-2 py-2 px-4 bg-green-500/20 text-green-500 rounded-lg hover:bg-green-500/30 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Share on WhatsApp</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}