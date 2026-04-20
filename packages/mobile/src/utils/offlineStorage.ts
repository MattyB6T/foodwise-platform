import AsyncStorage from "@react-native-async-storage/async-storage";

const OFFLINE_QUEUE_KEY = "leantable_offline_queue";
const OFFLINE_CACHE_PREFIX = "leantable_cache_";

interface OfflineAction {
  id: string;
  method: string;
  path: string;
  body?: any;
  timestamp: string;
}

export const offlineStorage = {
  // Queue an action for later sync
  queueAction: async (method: string, path: string, body?: any) => {
    const queue = await offlineStorage.getQueue();
    const action: OfflineAction = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      method,
      path,
      body,
      timestamp: new Date().toISOString(),
    };
    queue.push(action);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    return action;
  },

  // Get all queued actions
  getQueue: async (): Promise<OfflineAction[]> => {
    const data = await AsyncStorage.getItem(OFFLINE_QUEUE_KEY);
    return data ? JSON.parse(data) : [];
  },

  // Remove a synced action
  removeFromQueue: async (id: string) => {
    const queue = await offlineStorage.getQueue();
    const filtered = queue.filter((a) => a.id !== id);
    await AsyncStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(filtered));
  },

  // Clear the queue
  clearQueue: async () => {
    await AsyncStorage.removeItem(OFFLINE_QUEUE_KEY);
  },

  // Cache API response
  cacheResponse: async (key: string, data: any, ttlMs: number = 5 * 60 * 1000) => {
    const cacheEntry = {
      data,
      cachedAt: Date.now(),
      expiresAt: Date.now() + ttlMs,
    };
    await AsyncStorage.setItem(OFFLINE_CACHE_PREFIX + key, JSON.stringify(cacheEntry));
  },

  // Get cached response
  getCachedResponse: async <T>(key: string): Promise<T | null> => {
    const raw = await AsyncStorage.getItem(OFFLINE_CACHE_PREFIX + key);
    if (!raw) return null;

    const entry = JSON.parse(raw);
    if (Date.now() > entry.expiresAt) {
      await AsyncStorage.removeItem(OFFLINE_CACHE_PREFIX + key);
      return null;
    }
    return entry.data as T;
  },

  // Get queue count for badge
  getQueueCount: async (): Promise<number> => {
    const queue = await offlineStorage.getQueue();
    return queue.length;
  },
};

// --- Sync Manager with conflict resolution ---

interface SyncResult {
  synced: number;
  failed: number;
  conflicts: OfflineAction[];
}

export const syncManager = {
  /**
   * Sync all queued offline actions to the server.
   * Uses last-write-wins: if a 409 Conflict is returned, the server version wins
   * and the local action is discarded. Other failures are kept in queue for retry.
   */
  syncAll: async (
    apiFn: (method: string, path: string, body?: any) => Promise<Response>
  ): Promise<SyncResult> => {
    const queue = await offlineStorage.getQueue();
    if (queue.length === 0) return { synced: 0, failed: 0, conflicts: [] };

    // Sort by timestamp to replay in order
    const sorted = [...queue].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    let synced = 0;
    let failed = 0;
    const conflicts: OfflineAction[] = [];

    for (const action of sorted) {
      try {
        const response = await apiFn(action.method, action.path, action.body);

        if (response.ok) {
          await offlineStorage.removeFromQueue(action.id);
          synced++;
        } else if (response.status === 409) {
          // Conflict: server version wins (last-write-wins)
          await offlineStorage.removeFromQueue(action.id);
          conflicts.push(action);
        } else if (response.status >= 400 && response.status < 500) {
          // Client error (bad data) — discard, don't retry
          await offlineStorage.removeFromQueue(action.id);
          failed++;
        } else {
          // Server error — keep in queue for retry
          failed++;
        }
      } catch {
        // Network error — keep in queue
        failed++;
      }
    }

    return { synced, failed, conflicts };
  },

  /**
   * Check if device is online and trigger sync if so.
   * Call this on app foreground, network restore, etc.
   */
  trySyncIfOnline: async (
    apiFn: (method: string, path: string, body?: any) => Promise<Response>
  ): Promise<SyncResult | null> => {
    const count = await offlineStorage.getQueueCount();
    if (count === 0) return null;

    try {
      return await syncManager.syncAll(apiFn);
    } catch {
      return null;
    }
  },
};
