// ============================================================
// SABARISH FOODS — Google Sheet Sync Service
// ============================================================
// This service handles all communication between the React Native app
// and the Google Apps Script Web App endpoint.
//
// Architecture:
//   React Native → Supabase (success) → GoogleSheetService → Google Apps Script → Sheet
//
// Features:
//   ✅ Sync sales, expenses, inventory, staff salary, credit
//   ✅ Offline queue with AsyncStorage persistence
//   ✅ Automatic retry with exponential backoff
//   ✅ Network status monitoring
//   ✅ Connection health check
// ============================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

// ── Constants ─────────────────────────────────────────────────
const GOOGLE_SCRIPT_URL = process.env.EXPO_PUBLIC_GOOGLE_SCRIPT_URL ?? '';
const SYNC_QUEUE_KEY = '@sabarish_sync_queue';
const LAST_SYNC_KEY  = '@sabarish_last_sync';
const MAX_RETRIES    = 3;
const RETRY_DELAY_MS = 2000; // Base delay (doubles each retry)
const REQUEST_TIMEOUT_MS = 30000; // 30 seconds

// ── Types ─────────────────────────────────────────────────────
export type SyncAction = 'CREATE' | 'UPDATE' | 'DELETE';

export interface SyncPayload {
  action: SyncAction;
  data: Record<string, string | number | boolean | undefined>;
  date: string; // YYYY-MM-DD
}

export interface SyncQueueItem {
  id: string;
  payload: SyncPayload;
  retries: number;
  createdAt: string;
  lastAttempt?: string;
  error?: string;
}

export interface SyncResponse {
  success: boolean;
  message: string;
  sheet?: string;
  row?: number;
  error?: string;
}

export type ConnectionStatus = 'connected' | 'syncing' | 'failed' | 'offline' | 'unconfigured';

export interface SyncState {
  status: ConnectionStatus;
  lastSyncTime: string | null;
  pendingCount: number;
  lastError: string | null;
}

// ── State Listeners ───────────────────────────────────────────
type SyncStateListener = (state: SyncState) => void;
const listeners: SyncStateListener[] = [];
let currentSyncState: SyncState = {
  status: 'unconfigured',
  lastSyncTime: null,
  pendingCount: 0,
  lastError: null,
};

function notifyListeners() {
  listeners.forEach((fn) => fn({ ...currentSyncState }));
}

function updateSyncState(partial: Partial<SyncState>) {
  currentSyncState = { ...currentSyncState, ...partial };
  notifyListeners();
}

// ── Public API: Subscribe to sync state changes ───────────────
export function subscribeSyncState(listener: SyncStateListener): () => void {
  listeners.push(listener);
  // Immediately emit current state
  listener({ ...currentSyncState });
  return () => {
    const idx = listeners.indexOf(listener);
    if (idx >= 0) listeners.splice(idx, 1);
  };
}

export function getSyncState(): SyncState {
  return { ...currentSyncState };
}

// ── Initialization ────────────────────────────────────────────
/**
 * Initialize the sync service: load persisted queue, restore last sync time,
 * and start processing any pending items.
 */
export async function initGoogleSheetSync(): Promise<void> {
  if (!GOOGLE_SCRIPT_URL) {
    updateSyncState({ status: 'unconfigured' });
    return;
  }

  try {
    const [queueStr, lastSync] = await Promise.all([
      AsyncStorage.getItem(SYNC_QUEUE_KEY),
      AsyncStorage.getItem(LAST_SYNC_KEY),
    ]);

    const queue: SyncQueueItem[] = queueStr ? JSON.parse(queueStr) : [];
    updateSyncState({
      status: queue.length > 0 ? 'syncing' : 'connected',
      lastSyncTime: lastSync,
      pendingCount: queue.length,
      lastError: null,
    });

    // Process any pending queue items
    if (queue.length > 0) {
      processQueue();
    }
  } catch {
    updateSyncState({ status: 'failed', lastError: 'Failed to initialize sync service' });
  }
}

// ============================================================
// Core Sync Functions
// ============================================================

// ============================================================
// Core Sync Functions
// ============================================================

/**
 * Sync daily totals to Google Sheets.
 * Overwrites the exact absolute values for a given date.
 */
export async function gsSyncDailyTotals(
  totals: Record<string, any>,
  date: string,
  action: 'CREATE' | 'UPDATE' | 'DELETE'
): Promise<SyncResponse> {
  return enqueueAndSync({
    action, // 'CREATE', 'UPDATE', or 'DELETE' - Code.gs handles these generically now
    data: totals,
    date,
  });
}

// ============================================================
// Connection / Health Check
// ============================================================

/**
 * Check if the Google Apps Script endpoint is reachable.
 */
export async function checkConnection(): Promise<{
  connected: boolean;
  message: string;
}> {
  if (!GOOGLE_SCRIPT_URL) {
    return { connected: false, message: 'Google Script URL not configured' };
  }

  try {
    const url = `${GOOGLE_SCRIPT_URL}?action=health`;
    const response = await fetchWithTimeout(url, { method: 'GET' }, 10000);
    
    if (!response.ok) {
      throw new Error(`HTTP Error Status: ${response.status}`);
    }

    const text = await response.text();
    let json: SyncResponse;
    try {
      json = JSON.parse(text);
    } catch (parseErr) {
      console.error(`Connection check JSON parse failed. Raw response: ${text.substring(0, 200)}`);
      return { connected: false, message: 'Google Script Web App returned invalid response. Check access/permissions.' };
    }

    if (json.success) {
      updateSyncState({ status: 'connected', lastError: null });
      return { connected: true, message: json.message };
    }

    updateSyncState({ status: 'failed', lastError: json.error || 'Unknown error' });
    return { connected: false, message: json.error || 'Unknown error' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Connection failed';
    updateSyncState({ status: 'failed', lastError: msg });
    return { connected: false, message: msg };
  }
}

// ============================================================
// Queue Management
// ============================================================

/**
 * Enqueue a payload and attempt immediate sync.
 * If offline or sync fails, the item stays in the queue for retry.
 */
async function enqueueAndSync(payload: SyncPayload): Promise<SyncResponse> {
  if (!GOOGLE_SCRIPT_URL) {
    return { success: false, message: 'Google Script URL not configured' };
  }

  const queueItem: SyncQueueItem = {
    id: generateQueueId(),
    payload,
    retries: 0,
    createdAt: new Date().toISOString(),
  };

  // Add to queue
  await addToQueue(queueItem);

  // Check network
  const netState = await NetInfo.fetch();
  if (!netState.isConnected) {
    updateSyncState({
      status: 'offline',
      pendingCount: currentSyncState.pendingCount,
    });
    return { success: false, message: 'Offline — queued for sync' };
  }

  // Attempt sync immediately
  return attemptSync(queueItem);
}

/**
 * Attempt to sync a single queue item with retry logic.
 */
async function attemptSync(item: SyncQueueItem): Promise<SyncResponse> {
  updateSyncState({ status: 'syncing' });

  console.log(`[GoogleSheetSync] Sending ${item.payload.action} request to Google Apps Script for date: ${item.payload.date}`);
  console.log(`[GoogleSheetSync] Request payload:`, JSON.stringify(item.payload, null, 2));

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(
        GOOGLE_SCRIPT_URL,
        {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(item.payload),
        },
        REQUEST_TIMEOUT_MS
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      // Read response as text first to handle redirect or HTML error pages
      const text = await response.text();
      console.log(`[GoogleSheetSync] Raw response received:`, text);

      let json: SyncResponse & { rowData?: any };
      try {
        json = JSON.parse(text);
      } catch (parseErr) {
        console.error(`Sync JSON parse failed. Raw response: ${text.substring(0, 200)}`);
        throw new Error('Sync Web App returned invalid response. Check deployment permissions.');
      }

      if (json.success) {
        console.log(`[GoogleSheetSync] Success! Sheet: ${json.sheet}, Row: ${json.row}`);

        // VERIFICATION LOGIC (Requirement 12 & 13)
        if (json.rowData && item.payload.data) {
          const sent = item.payload.data as Record<string, any>;
          const received = json.rowData;
          let hasMismatch = false;

          for (const key of Object.keys(sent)) {
            const sentValue = Number(sent[key]);
            const receivedValue = Number(received[key]);

            if (!isNaN(sentValue) && !isNaN(receivedValue)) {
              if (sentValue !== receivedValue) {
                console.error(`[GoogleSheetSync] VERIFICATION FAILED for column: ${key}`);
                console.error(`[GoogleSheetSync] - Sent: ${sentValue} | Received: ${receivedValue}`);
                hasMismatch = true;
              }
            } else if (typeof sent[key] === 'string' && sent[key] !== received[key]) {
              console.error(`[GoogleSheetSync] VERIFICATION FAILED for column: ${key}`);
              console.error(`[GoogleSheetSync] - Sent: '${sent[key]}' | Received: '${received[key]}'`);
              hasMismatch = true;
            }
          }

          if (!hasMismatch) {
            console.log(`[GoogleSheetSync] Verification passed. All columns match Supabase data exactly.`);
          }
        }

        // Remove from queue
        await removeFromQueue(item.id);
        const now = new Date().toISOString();
        await AsyncStorage.setItem(LAST_SYNC_KEY, now);

        const queue = await getQueue();
        updateSyncState({
          status: queue.length > 0 ? 'syncing' : 'connected',
          lastSyncTime: now,
          pendingCount: queue.length,
          lastError: null,
        });

        return json;
      }

      // Server returned error — don't retry
      item.error = json.error || json.message;
      item.lastAttempt = new Date().toISOString();
      await updateQueueItem(item);

      updateSyncState({
        status: 'failed',
        lastError: item.error,
      });

      return json;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Network error';
      item.retries = attempt + 1;
      item.lastAttempt = new Date().toISOString();
      item.error = msg;

      if (attempt < MAX_RETRIES) {
        // Wait before retrying (exponential backoff)
        await delay(RETRY_DELAY_MS * Math.pow(2, attempt));
        continue;
      }

      // All retries exhausted — keep in queue
      await updateQueueItem(item);
      updateSyncState({
        status: 'failed',
        lastError: `Sync failed after ${MAX_RETRIES + 1} attempts: ${msg}`,
      });

      return { success: false, message: msg, error: msg };
    }
  }

  return { success: false, message: 'Max retries exceeded' };
}

/**
 * Process all pending items in the queue.
 * Called on app init and when network reconnects.
 */
export async function processQueue(): Promise<void> {
  if (!GOOGLE_SCRIPT_URL) return;

  const netState = await NetInfo.fetch();
  if (!netState.isConnected) {
    updateSyncState({ status: 'offline' });
    return;
  }

  const queue = await getQueue();
  if (queue.length === 0) {
    updateSyncState({ status: 'connected', pendingCount: 0 });
    return;
  }

  updateSyncState({ status: 'syncing', pendingCount: queue.length });

  // Process items sequentially to maintain order
  for (const item of queue) {
    await attemptSync(item);
  }
}

/**
 * Clear all pending items from the sync queue.
 */
export async function clearQueue(): Promise<void> {
  await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify([]));
  updateSyncState({ pendingCount: 0 });
}

// ── Queue Persistence Helpers ─────────────────────────────────

async function getQueue(): Promise<SyncQueueItem[]> {
  const raw = await AsyncStorage.getItem(SYNC_QUEUE_KEY);
  return raw ? JSON.parse(raw) : [];
}

async function addToQueue(item: SyncQueueItem): Promise<void> {
  const queue = await getQueue();
  queue.push(item);
  await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  updateSyncState({ pendingCount: queue.length });
}

async function removeFromQueue(id: string): Promise<void> {
  const queue = await getQueue();
  const filtered = queue.filter((q) => q.id !== id);
  await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(filtered));
}

async function updateQueueItem(item: SyncQueueItem): Promise<void> {
  const queue = await getQueue();
  const idx = queue.findIndex((q) => q.id === item.id);
  if (idx >= 0) {
    queue[idx] = item;
    await AsyncStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
  }
}

// ── Network Monitoring ────────────────────────────────────────
let unsubscribeNet: (() => void) | null = null;

/**
 * Start listening for network changes.
 * Automatically process the queue when network reconnects.
 */
export function startNetworkMonitor(): void {
  if (unsubscribeNet) return; // Already listening

  unsubscribeNet = NetInfo.addEventListener((state) => {
    if (state.isConnected && currentSyncState.pendingCount > 0) {
      processQueue();
    } else if (!state.isConnected) {
      updateSyncState({ status: 'offline' });
    }
  });
}

/**
 * Stop listening for network changes.
 */
export function stopNetworkMonitor(): void {
  if (unsubscribeNet) {
    unsubscribeNet();
    unsubscribeNet = null;
  }
}

// ── Utility Functions ─────────────────────────────────────────

function generateQueueId(): string {
  return `sq_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with timeout support.
 */
function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Request timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    fetch(url, options)
      .then((response) => {
        clearTimeout(timer);
        resolve(response);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}
