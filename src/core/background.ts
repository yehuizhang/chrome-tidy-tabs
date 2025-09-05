import { StorageController } from '../storage-controller';
import { timeAsync } from '../utils/performance';
import { VisitStorageManager } from '../searching/visit-storage-manager';

chrome.runtime.onInstalled.addListener(async details => {
  console.log('Extension installed:', details);
  if (details.reason === 'install') {
    console.log('Extension installed. Starting setup process...');

    await timeAsync('setup', {}, async () => {
      const storageController = new StorageController();
      await storageController.initialize();
    });
  }
});

// Track recent visits to prevent duplicate counting
const recentVisits = new Map<string, number>();
const VISIT_DEBOUNCE_TIME = 5000; // 5 seconds

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, updatedTab) => {
  try {
    if (changeInfo.status === 'complete' && updatedTab.url) {
      const url = updatedTab.url;

      // Skip chrome internal pages and new tab pages
      if (
        url.startsWith('chrome://') ||
        url.startsWith('chrome-extension://')
      ) {
        return;
      }

      // Create a unique key for this visit (tab + url combination)
      const visitKey = `${tabId}:${url}`;
      const now = Date.now();

      // Check if we've recently recorded a visit for this tab/url combination
      const lastVisitTime = recentVisits.get(visitKey);
      if (lastVisitTime && now - lastVisitTime < VISIT_DEBOUNCE_TIME) {
        console.log('Skipping duplicate visit recording for:', url);
        return;
      }

      // Record this visit time
      recentVisits.set(visitKey, now);

      // Clean up old entries to prevent memory leaks
      cleanupOldVisits();

      const visitStorageManager = await VisitStorageManager.getInstance();
      await visitStorageManager.recordVisit(updatedTab.url, updatedTab.title);

      // Save the visit data to storage
      await visitStorageManager.saveVisitData();

      console.log('Visit recorded and saved:', {
        url: updatedTab.url,
        title: updatedTab.title,
      });
    }
  } catch (error) {
    console.error('Failed to record visit:', error);
  }
});

// Simple cleanup function - only removes entries older than debounce time
function cleanupOldVisits(): void {
  const now = Date.now();
  const cutoffTime = now - VISIT_DEBOUNCE_TIME * 2; // Keep entries for twice the debounce time

  for (const [key, timestamp] of recentVisits.entries()) {
    if (timestamp < cutoffTime) {
      recentVisits.delete(key);
    }
  }
}
