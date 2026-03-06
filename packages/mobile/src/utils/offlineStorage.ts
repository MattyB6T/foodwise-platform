import AsyncStorage from "@react-native-async-storage/async-storage";

const OFFLINE_QUEUE_KEY = "foodwise_offline_queue";
const OFFLINE_CACHE_PREFIX = "foodwise_cache_";

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
