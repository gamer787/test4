import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

const PRESENCE_UPDATE_INTERVAL = 30000; // 30 seconds
const BLUETOOTH_SCAN_INTERVAL = 60000; // 1 minute

export function usePresence(userId: string | undefined) {
  useEffect(() => {
    if (!userId) return;

    // Update presence immediately
    updatePresence(userId);
    startBluetoothScanning(userId);

    // Set up interval for regular updates
    const presenceInterval = setInterval(() => updatePresence(userId), PRESENCE_UPDATE_INTERVAL);
    const bluetoothInterval = setInterval(() => startBluetoothScanning(userId), BLUETOOTH_SCAN_INTERVAL);

    // Set up presence channel subscription
    const channel = supabase
      .channel('presence-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=neq.${userId}`
        },
        () => {
          // Presence change detected
        }
      )
      .subscribe();

    // Set up cleanup
    const handleBeforeUnload = () => {
      updateOfflineStatus(userId);
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        updateOfflineStatus(userId);
      } else {
        updatePresence(userId);
      }
    });

    return () => {
      clearInterval(presenceInterval);
      clearInterval(bluetoothInterval);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      supabase.removeChannel(channel);
      updateOfflineStatus(userId);
    };
  }, [userId]);
}

async function updatePresence(userId: string) {
  try {
    await supabase
      .from('profiles')
      .update({
        last_seen: new Date().toISOString(),
        status: 'online'
      })
      .eq('id', userId);
  } catch (error) {
    console.error('Error updating presence:', error);
  }
}

async function updateOfflineStatus(userId: string) {
  try {
    await supabase
      .from('profiles')
      .update({
        last_seen: new Date().toISOString(),
        status: 'offline'
      })
      .eq('id', userId);
  } catch (error) {
    console.error('Error updating offline status:', error);
  }
}

async function startBluetoothScanning(userId: string) {
  if (!navigator.bluetooth) return;

  try {
    // Request Bluetooth permissions if not already granted
    const permissionStatus = await navigator.permissions.query({ name: 'bluetooth' as PermissionName });
    
    if (permissionStatus.state === 'granted') {
      const device = await navigator.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: []
      });

      if (device) {
        // Update nearby users in database
        await supabase.rpc('update_nearby_users', {
          current_user_id: userId,
          discovery_method: 'bluetooth'
        });
      }
    }
  } catch (error) {
    // Silently handle errors in background scanning
    console.debug('Background Bluetooth scan:', error);
  }
}