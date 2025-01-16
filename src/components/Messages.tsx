import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Search, Send, ArrowLeft, MessageCircle, ImagePlus, X, Loader } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';

type Connection = {
  id: string;
  user: {
    id: string;
    username: string;
    avatar_url: string;
    status: string;
  };
};

type Message = {
  id: string;
  content: string;
  media_url: string | null;
  media_type: 'image' | 'video' | null;
  created_at: string;
  sender_id: string;
  receiver_id: string;
};

type MediaUpload = {
  file: File;
  type: 'image' | 'video';
  previewUrl: string;
};

export default function Messages() {
  const { user } = useAuth();
  const { chatId } = useParams();
  const navigate = useNavigate();
  const [connections, setConnections] = useState<Connection[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [mediaUpload, setMediaUpload] = useState<MediaUpload | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentChat, setCurrentChat] = useState<Connection | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const messageCache = useRef<Record<string, Message[]>>({});

  useEffect(() => {
    if (user) {
      fetchConnections();
      setupMessagesSubscription();
    }
  }, [user]);

  useEffect(() => {
    if (chatId && connections.length > 0) {
      const chat = connections.find(c => c.user.id === chatId);
      if (chat) {
        setCurrentChat(chat);
        if (!messageCache.current[chatId]) {
          fetchMessages(chatId);
        } else {
          setMessages(messageCache.current[chatId]);
          fetchRecentMessages(chatId);
        }
      }
    }
  }, [chatId, connections]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchRecentMessages = async (receiverId: string) => {
    if (!user) return;
    
    try {
      const lastMessage = messages[messages.length - 1];
      if (!lastMessage) return;

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user.id})`)
        .gt('created_at', lastMessage.created_at)
        .order('created_at', { ascending: true });

      if (error) throw error;
      if (data && data.length > 0) {
        setMessages(prev => [...prev, ...data]);
        messageCache.current[receiverId] = [...messages, ...data];
      }
    } catch (error) {
      console.error('Error fetching recent messages:', error);
    }
  };
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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
            avatar_url,
            status
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
            avatar_url,
            status
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
      setLoading(false);
    } catch (error) {
      console.error('Error fetching connections:', error);
      setLoading(false);
    }
  };

  const fetchMessages = async (receiverId: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .or(`and(sender_id.eq.${user.id},receiver_id.eq.${receiverId}),and(sender_id.eq.${receiverId},receiver_id.eq.${user.id})`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    }
  };

  const setupMessagesSubscription = () => {
    if (!user) return;

    const channel = supabase
      .channel('messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`
        },
        (payload) => {
          const newMessage = payload.new as Message;
          setMessages(prev => [...prev, newMessage]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };
  const handleMediaUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const isImage = file.type.startsWith('image/');
    const isVideo = file.type.startsWith('video/');

    if (!isImage && !isVideo) {
      alert('Please upload an image or video file');
      return;
    }

    const previewUrl = URL.createObjectURL(file);
    setMediaUpload({
      file,
      type: isImage ? 'image' : 'video',
      previewUrl
    });
  };

  const uploadMedia = async (file: File): Promise<string> => {
    if (!user) throw new Error('User not authenticated');

    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/messages/${Date.now()}.${fileExt}`;

    const { error: uploadError } = await supabase.storage
      .from('media')
      .upload(fileName, file);

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('media')
      .getPublicUrl(fileName);

    return publicUrl;
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !currentChat || (!newMessage.trim() && !mediaUpload)) return;

    setSending(true);
    const optimisticId = `temp-${Date.now()}`;

    try {
      let mediaUrl = null;
      let mediaType = null;

      // Upload media first if present
      if (mediaUpload) {
        mediaUrl = await uploadMedia(mediaUpload.file);
        mediaType = mediaUpload.type;
      }

      const messageContent = newMessage.trim();
      
      // Create optimistic message
      const optimisticMessage = {
        id: optimisticId,
        content: messageContent,
        media_url: mediaUpload?.previewUrl || null,
        media_type: mediaUpload?.type || null,
        sender_id: user.id,
        receiver_id: currentChat.user.id,
        created_at: new Date().toISOString()
      };

      // Update UI immediately
      setMessages(prev => [...prev, optimisticMessage]);
      scrollToBottom();

      // Send actual message
      const { error: messageError } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          receiver_id: currentChat.user.id,
          content: messageContent,
          media_url: mediaUrl,
          media_type: mediaType,
          created_at: new Date().toISOString()
        });

      if (messageError) throw messageError;

      // Send notification
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: currentChat.user.id,
          sender_id: user.id,
          type: 'message',
          content: 'sent you a message',
          read: false,
          created_at: new Date().toISOString()
        });

      if (notificationError) throw notificationError;

      // Clear form
      setNewMessage('');
      setMediaUpload(null);
      setSending(false);

      // Update message cache
      if (currentChat) {
        messageCache.current[currentChat.user.id] = messages;
      }
    } catch (error) {
      console.error('Error sending message:', error);
      // Remove failed optimistic message
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      alert('Failed to send message. Please try again.');
      setSending(false);
    }
  };

  const filteredConnections = connections.filter(connection =>
    connection.user.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-blue"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto h-[calc(100vh-5rem)] flex">
      {/* Sidebar */}
      <div className={`w-full md:w-80 border-r border-white/10 ${currentChat ? 'hidden md:block' : 'block'}`}>
        <div className="p-4">
          <div className="relative mb-4">
            <input
              type="text"
              placeholder="Search connections..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-card-bg border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white placeholder-white/30 focus:border-neon-blue focus:ring-1 focus:ring-neon-blue"
            />
            <Search className="absolute left-3 top-2.5 w-5 h-5 text-white/30" />
          </div>

          <div className="space-y-2">
            {filteredConnections.map((connection) => (
              <button
                key={connection.id}
                onClick={() => {
                  setCurrentChat(connection);
                  navigate(`/messages/${connection.user.id}`);
                }}
                className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                  currentChat?.user.id === connection.user.id
                    ? 'bg-neon-blue/10 border border-neon-blue/30'
                    : 'hover:bg-white/5'
                }`}
              >
                <div className="relative">
                  <img
                    src={connection.user.avatar_url}
                    alt={connection.user.username}
                    className="w-10 h-10 rounded-full bg-card-bg"
                  />
                  <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-darker-bg ${
                    connection.user.status === 'online' ? 'bg-neon-green' : 'bg-white/30'
                  }`} />
                </div>
                <span className="text-white font-medium">{connection.user.username}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chat Area */}
      {currentChat ? (
        <div className="flex-1 flex flex-col">
          {/* Chat Header */}
          <div className="p-4 border-b border-white/10 flex items-center sticky top-0 bg-darker-bg/95 backdrop-blur-sm z-10">
            <button
              onClick={() => {
                setCurrentChat(null);
                navigate('/messages');
              }}
              className="md:hidden mr-3 text-white/80 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
            <img
              src={currentChat.user.avatar_url}
              alt={currentChat.user.username}
              className="w-10 h-10 rounded-full bg-card-bg"
            />
            <div className="ml-3">
              <h2 className="text-white font-medium">{currentChat.user.username}</h2>
              <p className="text-sm text-white/50">
                {currentChat.user.status === 'online' ? 'Online' : 'Offline'}
              </p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-20 md:pb-4">
            {messages.map((message) => {
              const isOwnMessage = message.sender_id === user?.id;
              return (
                <div
                  key={message.id}
                  className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[70%] rounded-lg px-4 py-2 ${
                      isOwnMessage
                        ? 'bg-neon-blue/20 text-white'
                        : 'bg-card-bg text-white'
                    }`}
                  >
                    {message.media_url && message.media_type === 'image' && (
                      <img
                        src={message.media_url}
                        alt="Message attachment"
                        className="rounded-lg max-h-64 object-cover mb-2"
                      />
                    )}
                    {message.media_url && message.media_type === 'video' && (
                      <video
                        src={message.media_url}
                        controls
                        className="rounded-lg max-h-64 object-cover mb-2"
                      />
                    )}
                    {message.content && <p>{message.content}</p>}
                    <p className="text-xs text-white/40 mt-1">
                      {formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Message Input */}
          <form onSubmit={sendMessage} className="p-4 border-t border-white/10 fixed bottom-14 md:bottom-0 left-0 right-0 md:relative bg-darker-bg/95 backdrop-blur-sm">
            {mediaUpload && (
              <div className="mb-4 relative">
                {mediaUpload.type === 'image' ? (
                  <img
                    src={mediaUpload.previewUrl}
                    alt="Upload preview"
                    className="w-32 h-32 object-cover rounded-lg"
                  />
                ) : (
                  <video
                    src={mediaUpload.previewUrl}
                    className="w-32 h-32 object-cover rounded-lg"
                    controls
                  />
                )}
                <button
                  type="button"
                  onClick={() => setMediaUpload(null)}
                  className="absolute top-2 right-2 p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <div className="flex space-x-2">
              <label className="p-2 bg-card-bg border border-white/10 rounded-lg cursor-pointer hover:bg-white/5 transition-colors">
                <input
                  type="file"
                  accept="image/*,video/*"
                  onChange={handleMediaUpload}
                  className="hidden"
                />
                <ImagePlus className="w-5 h-5 text-white/80" />
              </label>
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className={`flex-1 bg-card-bg border border-white/10 rounded-lg px-4 py-2 text-white placeholder-white/30 focus:border-neon-blue focus:ring-1 focus:ring-neon-blue focus:outline-none ${sending ? 'opacity-50' : ''}`}
                disabled={sending}
              />
              <button
                type="submit"
                disabled={(!newMessage.trim() && !mediaUpload) || sending}
                className="px-4 py-2 bg-neon-blue/20 text-neon-blue rounded-lg hover:bg-neon-blue/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
              >
                {sending ? (
                  <Loader className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center p-4">
            <MessageCircle className="w-12 h-12 text-white/20 mx-auto mb-4" />
            <p className="text-white/50">Select a connection to start messaging</p>
          </div>
        </div>
      )}
    </div>
  );
}