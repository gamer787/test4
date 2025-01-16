import React, { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Bluetooth, Smartphone, UserPlus, Loader, Wifi, Check, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

type ConnectionAnimation = {
  userId: string;
  username: string;
  avatar: string;
};

type NearbyUser = {
  id: string;
  username: string;
  avatar_url: string;
  last_seen: string;
  status: 'online' | 'offline';
  connection_status?: 'pending' | 'accepted' | 'incoming';
};

export default function Connect() {
  const { user } = useAuth();
  const [isBluetoothScanning, setIsBluetoothScanning] = useState(false);
  const [isNfcScanning, setIsNfcScanning] = useState(false);
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
  const [bluetoothUsers, setBluetoothUsers] = useState<NearbyUser[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [error, setError] = useState('');
  const [showConnectionAnimation, setShowConnectionAnimation] = useState<ConnectionAnimation | null>(null);
  const [unconnectedUsers, setUnconnectedUsers] = useState<NearbyUser[]>([]);
  const [userTimeouts, setUserTimeouts] = useState<{[key: string]: NodeJS.Timeout}>({});
  const NEARBY_RANGE = 15 * 60 * 1000; // 15 minutes in milliseconds
  const UNCONNECTED_RANGE = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  const SCAN_INTERVAL = 15000; // Scan every 15 seconds

  useEffect(() => {
    if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        setNotificationsEnabled(permission === 'granted');
      });
    }

    // Clear all timeouts on unmount
    return () => {
      Object.values(userTimeouts).forEach(timeout => clearTimeout(timeout));
    };
  }, []);

  useEffect(() => {
    if (user) {
      scanForUsers(); // Initial scan
      
      // Set up regular scanning intervals
      const scanInterval = setInterval(scanForUsers, SCAN_INTERVAL);
      
      // Subscribe to presence changes
      const channel = supabase
        .channel('online-users')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'profiles',
            filter: `id=neq.${user.id}`
          },
          () => {
            // Trigger a scan when any user's status changes
            scanForUsers(false, true);
          }
        )
        .subscribe();

      return () => {
        clearInterval(scanInterval);
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const scanForUsers = async (onlyUnconnected = false, presenceUpdate = false) => {
    try {
      if (!user) return;
      
      // Don't update nearby users if we're scanning for unconnected only
      if (!onlyUnconnected) {
        // Keep existing Bluetooth users in the nearby section
        const updatedBluetoothUsers = await Promise.all(
          bluetoothUsers.map(async (user) => {
            const { data } = await supabase
              .from('profiles')
              .select('connection_status')
              .eq('id', user.id)
              .single();
            return { ...user, connection_status: data?.connection_status };
          })
        );
        setNearbyUsers(updatedBluetoothUsers);
      }

      // Get all users except current user
      const { data: nearbyData, error: nearbyError } = await supabase
        .from('profiles')
        .select('*')
        .neq('id', user.id);
      
      if (nearbyError) throw nearbyError;

      // Get outgoing connection requests
      const { data: outgoingConnections, error: outgoingError } = await supabase
        .from('connections')
        .select('*')
        .eq('user_id', user.id);

      if (outgoingError) throw outgoingError;

      // Get incoming connection requests
      const { data: incomingConnections, error: incomingError } = await supabase
        .from('connections')
        .select('*')
        .eq('connected_user_id', user.id);

      if (incomingError) throw incomingError;

      // Update nearby users with connection status
      const updatedNearbyUsers = nearbyData?.map(nearbyUser => {
        // Check outgoing connections
        const outgoingConnection = outgoingConnections?.find(c => 
          c.connected_user_id === nearbyUser.id
        );

        // Check incoming connections
        const incomingConnection = incomingConnections?.find(c => 
          c.user_id === nearbyUser.id
        );

        let connectionStatus;
        if (outgoingConnection) {
          connectionStatus = outgoingConnection.status;
        } else if (incomingConnection) {
          connectionStatus = incomingConnection.status === 'pending' ? 'incoming' : incomingConnection.status;
        }

        return {
          ...nearbyUser,
          connection_status: connectionStatus
        };
      });
      
      // Get current timestamp once for consistent comparisons
      const currentTime = Date.now();
      
      // Only update nearby users if this is a presence update or regular scan
      if (!onlyUnconnected || presenceUpdate) {
        // Keep only Bluetooth-discovered users in nearby section
        setNearbyUsers(bluetoothUsers);
      }
      
      const unconnectedUsers = updatedNearbyUsers?.filter(u => {
        const lastSeenTime = new Date(u.last_seen).getTime();
        // Include users who:
        // 1. Were seen within the last 24 hours
        // 2. Have no existing connection
        // 3. Are not already shown in nearby users
        const hasNoConnection = !u.connection_status;
        const wasWithin24Hours = lastSeenTime > currentTime - UNCONNECTED_RANGE;
        const isNotNearby = !bluetoothUsers.some(nearby => nearby.id === u.id);

        return (
          wasWithin24Hours &&
          hasNoConnection &&
          isNotNearby
        );
      }) || [];

      setUnconnectedUsers(unconnectedUsers);
    } catch (error) {
      console.error('Error scanning for users:', error);
      if (error.message !== 'Failed to fetch') {
        setError('Error scanning for users. Please try again.');
      }
    }
  };

  const startBluetoothScan = async () => {
    setError('');
    setIsBluetoothScanning(true);
    setBluetoothUsers([]);
    setNearbyUsers([]);

    try {
      if (!navigator.bluetooth) {
        throw new Error('Bluetooth is not supported. Please make sure Bluetooth is enabled on your device.');
      }

      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [] // Required for scanning
      });

      if (device) {
        // Get users who were active in the last 15 minutes
        const { data: nearbyUsers } = await supabase
          .rpc('get_nearby_users_with_status', {
            current_user_id: user.id,
            time_range: new Date(Date.now() - NEARBY_RANGE).toISOString()
          });

        if (nearbyUsers && nearbyUsers.length > 0) {
          const updatedBluetoothUsers = nearbyUsers.map(u => ({
            ...u,
            status: 'online', // Force online status for Bluetooth-discovered users
            last_seen: new Date().toISOString() // Update last seen to now
          }));
          
          // Update both lists
          setBluetoothUsers(updatedBluetoothUsers);
          setNearbyUsers(updatedBluetoothUsers);
          
          // Update user presence in database
          await Promise.all(updatedBluetoothUsers.map(async (u) => {
            await supabase
              .from('profiles')
              .update({
                last_seen: new Date().toISOString(),
                status: 'online'
              })
              .eq('id', u.id);
          }));

          if (notificationsEnabled) {
            new Notification('Users Found!', {
              body: `Found ${updatedBluetoothUsers.length} nearby users via Bluetooth`,
              icon: '/vite.svg'
            });
          }
        } else {
          setError('No nearby users found via Bluetooth');
        }
      }
    } catch (error: any) {
      if (error.name === 'NotFoundError') {
        setError('No Bluetooth devices found. Please make sure Bluetooth is enabled.');
      } else if (error.name === 'SecurityError') {
        setError('Bluetooth permission denied. Please allow Bluetooth access.');
      } else {
        setError(error.message);
      }
    } finally {
      setIsBluetoothScanning(false);
    }
  };

  const startNfcScan = async () => {
    setError('');
    setIsNfcScanning(true);

    try {
      if (!('NDEFReader' in window)) {
        throw new Error('NFC is not supported on this device');
      }

      const ndef = new NDEFReader();
      await ndef.scan();

      setError('Tap your phone against another device to connect');

      ndef.addEventListener("reading", ({ message }) => {
        for (const record of message.records) {
          if (record.recordType === "text") {
            const decoder = new TextDecoder();
            const userId = decoder.decode(record.data);
            
            if (userId !== user?.id) {
              connectWithUser(userId, true);
            }
          }
        }
      });

      // Write current user's ID to NFC
      if (user) {
        try {
          await ndef.write({
            records: [{ 
              recordType: "text",
              data: user.id
            }]
          });
        } catch (writeError) {
          console.warn('NFC write not supported:', writeError);
        }
      }
    } catch (error: any) {
      if (error.name === 'NotSupportedError') {
        setError('NFC is not supported on this device');
      } else if (error.name === 'NotAllowedError') {
        setError('NFC permission denied. Please enable NFC access.');
      } else {
        setError(error.message);
      }
      setIsNfcScanning(false);
    }
  };

  const connectWithUser = async (userId: string, autoAccept = false) => {
    if (!user) return;

    setError('');
    try {
      // Check for existing connection
      const { data: existingConnection, error: connectionCheckError } = await supabase
        .from('connections')
        .select('*')
        .or(`and(user_id.eq.${user.id},connected_user_id.eq.${userId}),and(user_id.eq.${userId},connected_user_id.eq.${user.id})`)
        .maybeSingle();

      if (connectionCheckError && connectionCheckError.code !== 'PGRST116') {
        throw connectionCheckError;
      }

      if (existingConnection) {
        throw new Error('A connection already exists with this user');
      }

      const status = autoAccept ? 'accepted' : 'pending';
      
      // Create connection request
      const { error: connectionError } = await supabase
        .from('connections')
        .insert({
          user_id: user.id,
          connected_user_id: userId,
          status,
          created_at: new Date().toISOString()
        });

      if (connectionError) throw connectionError;

      // If auto-accepting (NFC), create reverse connection
      if (autoAccept) {
        await supabase
          .from('connections')
          .insert({
            user_id: userId,
            connected_user_id: user.id,
            status: 'accepted',
            created_at: new Date().toISOString()
          });

        // Get user info for animation
        const { data: connectedUser } = await supabase
          .from('profiles')
          .select('username, avatar_url')
          .eq('id', userId)
          .single();

        if (connectedUser) {
          setShowConnectionAnimation({
            userId,
            username: connectedUser.username,
            avatar: connectedUser.avatar_url
          });
          
          setTimeout(() => {
            setShowConnectionAnimation(null);
          }, 3000);
        }
      }

      // Create notification
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          sender_id: user.id,
          type: autoAccept ? 'connection_accepted' : 'connection_request',
          content: autoAccept ? 'connected with you via NFC' : 'wants to connect with you',
          created_at: new Date().toISOString(),
          read: false
        });

      if (notificationError) throw notificationError;

      // Update UI
      setNearbyUsers(prev =>
        prev.map(u =>
          u.id === userId
            ? { ...u, connection_status: status }
            : u
        )
      );

      if (autoAccept) {
        setError('Connected successfully!');
      } else {
        setError('Connection request sent!');
      }
    } catch (error) {
      console.error('Error connecting with user:', error);
      setError(error.message || 'Failed to send connection request');
    }
  };

  const handleAcceptRequest = async (userId: string) => {
    if (!user) return;

    setError('');
    try {
      // Update the incoming connection request to accepted
      const { error: updateError } = await supabase
        .from('connections')
        .update({ status: 'accepted' })
        .eq('user_id', userId)
        .eq('connected_user_id', user.id);

      if (updateError) throw updateError;

      // Create reciprocal connection
      const { error: createError } = await supabase
        .from('connections')
        .insert({
          user_id: user.id,
          connected_user_id: userId,
          status: 'accepted',
          created_at: new Date().toISOString()
        });

      if (createError) throw createError;

      // Create notification
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          sender_id: user.id,
          type: 'connection_accepted',
          content: 'accepted your connection request',
          created_at: new Date().toISOString(),
          read: false
        });

      if (notificationError) throw notificationError;

      // Update UI
      setNearbyUsers(prev =>
        prev.map(u =>
          u.id === userId
            ? { ...u, connection_status: 'accepted' }
            : u
        )
      );

      setError('Connection accepted!');
    } catch (error) {
      console.error('Error accepting connection:', error);
      setError('Failed to accept connection request');
    }
  };

  const handleDeclineRequest = async (userId: string) => {
    if (!user) return;

    try {
      // Delete the connection request
      const { error: deleteError } = await supabase
        .from('connections')
        .delete()
        .eq('user_id', userId)
        .eq('connected_user_id', user.id);

      if (deleteError) throw deleteError;

      // Create notification
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          sender_id: user.id,
          type: 'connection_request',
          content: 'declined your connection request',
          created_at: new Date().toISOString(),
          read: false
        });

      if (notificationError) throw notificationError;

      // Update UI
      setNearbyUsers(prev =>
        prev.map(u =>
          u.id === userId
            ? { ...u, connection_status: undefined }
            : u
        )
      );

      setError('Request declined');
    } catch (error) {
      console.error('Error declining connection:', error);
      setError('Failed to decline connection request');
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <h1 className="text-xl sm:text-2xl font-bold mb-6 text-neon-blue">Discover Nearby</h1>
      
      {/* Scanning Status */}
      <div className="mb-6 gradient-bg p-4 rounded-lg border border-white/10">
        <div className="flex items-center space-x-2">
          <Wifi className="w-5 h-5 text-neon-purple animate-pulse" />
          <span className="text-white/80">Scanning for nearby users...</span>
        </div>
        {!notificationsEnabled && (
          <p className="mt-2 text-sm text-neon-pink">
            Enable notifications to get alerts when users become available
          </p>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        {/* Bluetooth Scanning */}
        <button
          onClick={startBluetoothScan}
          disabled={isBluetoothScanning}
          className="flex flex-col items-center justify-center p-4 sm:p-6 gradient-bg rounded-lg border border-white/10 hover:border-neon-blue/50 transition-colors disabled:opacity-50"
        >
          {isBluetoothScanning ? (
            <Loader className="w-6 h-6 sm:w-8 sm:h-8 text-neon-blue animate-spin" />
          ) : (
            <Bluetooth className="w-6 h-6 sm:w-8 sm:h-8 text-neon-blue" />
          )}
          <span className="mt-2 text-sm sm:text-base font-medium text-white/80">
            {isBluetoothScanning ? 'Scanning...' : 'Scan with Bluetooth'}
          </span>
        </button>

        {/* NFC Scanning */}
        <button
          onClick={startNfcScan}
          disabled={isNfcScanning}
          className="flex flex-col items-center justify-center p-4 sm:p-6 gradient-bg rounded-lg border border-white/10 hover:border-neon-purple/50 transition-colors disabled:opacity-50"
        >
          {isNfcScanning ? (
            <Loader className="w-6 h-6 sm:w-8 sm:h-8 text-neon-purple animate-spin" />
          ) : (
            <Smartphone className="w-6 h-6 sm:w-8 sm:h-8 text-neon-purple" />
          )}
          <span className="mt-2 text-sm sm:text-base font-medium text-white/80">
            {isNfcScanning ? 'Scanning...' : 'Scan with NFC'}
          </span>
        </button>
      </div>

      {error && (
        <div className={`mb-6 p-3 gradient-bg border rounded-lg ${
          error.includes('success') ? 'border-neon-green/50 text-neon-green' : 'border-neon-pink/50 text-neon-pink'
        }`}>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Nearby Users List */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-white/90">Nearby Users</h2>
        {Array.from(new Map([...bluetoothUsers, ...nearbyUsers].map(user => [user.id, user])).values())
          .map((user) => (
            <div
              key={user.id}
              className="gradient-bg p-4 rounded-lg border border-white/10 hover:border-neon-blue/20 transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <img
                      src={user.avatar_url}
                      alt={user.username}
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-darker-bg"
                    />
                    <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ${
                      bluetoothUsers.some(bu => bu.id === user.id)
                        ? 'bg-neon-blue shadow-neon'
                        : user.status === 'online'
                          ? 'bg-neon-green shadow-neon'
                          : 'bg-white/30'
                    }`} />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-medium text-white">
                      {user.username}
                    </h3>
                    <p className="text-xs text-white/50">
                      {bluetoothUsers.some(bu => bu.id === user.id)
                        ? 'Found via Bluetooth'
                        : user.status === 'online'
                          ? 'Online now'
                          : 'Recently active'}
                    </p>
                  </div>
                </div>
                {!user.connection_status && (
                  <button
                    onClick={() => connectWithUser(user.id)}
                    className="flex items-center space-x-1 px-3 py-1.5 bg-neon-blue/10 text-neon-blue rounded-full hover:bg-neon-blue/20 transition-colors disabled:opacity-50"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span className="hidden sm:inline text-sm">Connect</span>
                  </button>
                )}
                {user.connection_status === 'incoming' && (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => handleAcceptRequest(user.id)}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-neon-green/10 text-neon-green rounded-full hover:bg-neon-green/20 transition-colors"
                    >
                      <Check className="w-4 h-4" />
                      <span className="hidden sm:inline text-sm">Accept</span>
                    </button>
                    <button
                      onClick={() => handleDeclineRequest(user.id)}
                      className="flex items-center space-x-1 px-3 py-1.5 bg-neon-pink/10 text-neon-pink rounded-full hover:bg-neon-pink/20 transition-colors"
                    >
                      <X className="w-4 h-4" />
                      <span className="hidden sm:inline text-sm">Decline</span>
                    </button>
                  </div>
                )}
                {user.connection_status === 'pending' && (
                  <span className="text-sm text-neon-purple">Request Sent</span>
                )}
                {user.connection_status === 'accepted' && (
                  <span className="text-sm text-neon-green">Connected</span>
                )}
              </div>
            </div>
          ))}
      </div>

      {/* Unconnected Users Section */}
      <div className="space-y-4 mt-8">
        <h2 className="text-lg font-semibold text-white/90">
          Recent Users You May Know
        </h2>
        <p className="text-sm text-white/60">
          These users were active in the last 24 hours. Send them a connection request if you met them!
        </p>
        {unconnectedUsers.length > 0 ? unconnectedUsers.map((user) => (
            <div
              key={user.id}
              className="gradient-bg p-4 rounded-lg border border-white/10 hover:border-neon-purple/20 transition-all duration-200"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <img
                      src={user.avatar_url}
                      alt={user.username}
                      className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-darker-bg"
                    />
                    <div className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-white/30" />
                  </div>
                  <div>
                    <h3 className="text-sm sm:text-base font-medium text-white">
                      {user.username}
                    </h3>
                    <p className="text-xs text-white/50">
                      Last seen {formatDistanceToNow(new Date(user.last_seen), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => connectWithUser(user.id)}
                  className="flex items-center space-x-1 px-3 py-1.5 bg-neon-purple/10 text-neon-purple rounded-full hover:bg-neon-purple/20 transition-colors"
                >
                  <UserPlus className="w-4 h-4" />
                  <span className="hidden sm:inline text-sm">Connect</span>
                </button>
              </div>
            </div>
          )) : (
          <div className="gradient-bg p-6 rounded-lg border border-white/10 text-center">
            <div className="flex flex-col items-center space-y-2">
              <UserPlus className="w-8 h-8 text-white/30" />
              <p className="text-white/50">
                No unconnected users found nearby in the last 24 hours
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Connection Success Animation */}
      {showConnectionAnimation && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/80 z-50">
          <div className="gradient-bg p-8 rounded-lg border border-neon-green animate-bounce">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full overflow-hidden mb-4 ring-4 ring-neon-green">
                <img
                  src={showConnectionAnimation.avatar}
                  alt={showConnectionAnimation.username}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="bg-neon-green/20 p-2 rounded-full mb-4">
                <Check className="w-8 h-8 text-neon-green" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">
                Connected with {showConnectionAnimation.username}!
              </h3>
              <p className="text-white/60">
                You can now message each other and see each other's posts
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}