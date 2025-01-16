import React, { useState, useEffect } from 'react';
import { MessageCircle, UserPlus, Check, X, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';

type Notification = {
  id: string;
  type: 'message' | 'connection_request' | 'connection_accepted';
  content: string;
  read: boolean;
  created_at: string;
  sender: {
    id: string;
    username: string;
    avatar_url: string;
  };
};

export default function Notifications() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      fetchNotifications();
      setupNotificationsSubscription();
    }
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('notifications')
        .select(`
          *,
          sender:sender_id (
            id,
            username,
            avatar_url
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNotifications(data || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setLoading(false);
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
          fetchNotifications(); // Refresh notifications on any change
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const markAsRead = async (notificationId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      );
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('notifications')
        .delete()
        .eq('id', notificationId);

      if (error) throw error;

      setNotifications(prev =>
        prev.filter(n => n.id !== notificationId)
      );
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  const handleConnectionRequest = async (notificationId: string, senderId: string, accept: boolean) => {
    if (!user) return;

    try {
      if (accept) {
        // First update the incoming connection request to accepted
        const { error: updateError } = await supabase
          .from('connections')
          .update({ status: 'accepted' })
          .match({ user_id: senderId, connected_user_id: user.id });

        if (updateError) throw updateError;

        // Create a reciprocal connection to establish the link
        const { error: createError } = await supabase
          .from('connections')
          .insert({
            user_id: user.id,
            connected_user_id: senderId,
            status: 'accepted',
            created_at: new Date().toISOString()
          });

        if (createError) throw createError;

        // Create a notification for the sender
        const { error: notificationError } = await supabase
          .from('notifications')
          .insert({
            user_id: senderId,
            sender_id: user.id,
            type: 'connection_accepted',
            content: 'accepted your connection request',
            read: false,
            created_at: new Date().toISOString()
          });

        if (notificationError) throw notificationError;
      } else {
        // If declining, delete the connection request
        const { error: deleteError } = await supabase
          .from('connections')
          .delete()
          .match({ user_id: senderId, connected_user_id: user.id });

        if (deleteError) throw deleteError;
      }

      // Mark the notification as read
      await markAsRead(notificationId);

      // Refresh notifications
      fetchNotifications();
    } catch (error) {
      console.error('Error handling connection request:', error);
    }
  };

  const handleNotificationClick = async (notification: Notification) => {
    await markAsRead(notification.id);

    if (notification.type === 'message') {
      navigate(`/messages/${notification.sender.id}`);
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
      <h1 className="text-2xl font-bold text-white mb-6">Notifications</h1>

      {notifications.length === 0 ? (
        <div className="gradient-bg rounded-lg p-8 text-center border border-white/10">
          <p className="text-white/50">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-4">
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`gradient-bg rounded-lg border ${
                notification.read ? 'border-white/10' : 'border-neon-purple'
              }`}
            >
              <div className="p-4">
                <div className="flex items-start space-x-4">
                  <img
                    src={notification.sender.avatar_url}
                    alt={notification.sender.username}
                    className="w-12 h-12 rounded-full"
                  />
                  <div className="flex-1 min-w-0">
                    <div 
                      className="cursor-pointer"
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-white">
                            <span className="font-medium">{notification.sender.username}</span>{' '}
                            {notification.content}
                          </p>
                          <p className="text-sm text-white/40 mt-1">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                          className="text-white/40 hover:text-neon-pink transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {notification.type === 'connection_request' && !notification.read && (
                      <div className="flex space-x-3 mt-3">
                        <button
                          onClick={() => handleConnectionRequest(notification.id, notification.sender.id, true)}
                          className="flex items-center space-x-1 px-4 py-2 bg-neon-green/20 text-neon-green rounded-lg hover:bg-neon-green/30 transition-colors"
                        >
                          <Check className="w-4 h-4" />
                          <span>Accept</span>
                        </button>
                        <button
                          onClick={() => handleConnectionRequest(notification.id, notification.sender.id, false)}
                          className="flex items-center space-x-1 px-4 py-2 bg-neon-pink/20 text-neon-pink rounded-lg hover:bg-neon-pink/30 transition-colors"
                        >
                          <X className="w-4 h-4" />
                          <span>Decline</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}