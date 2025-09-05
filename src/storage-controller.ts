import { IBookmarkTreeNode, IVisitData } from './types';
import {
  MAX_BROWSER_HISTORY_AGE_IN_DAYS,
  MAX_BROWSER_HISTORY_COUNT,
  StorageKeys,
} from './utils/constants';
import { timeAsync, timeSync } from './utils/performance';
import { VisitStorageManager } from './searching/visit-storage-manager';

export class StorageController {
  async initialize() {
    await this.cleanUpStorage();

    const visitStorageManager = await VisitStorageManager.getInstance();

    const historyDataMap = await timeAsync('fn:loadHistory', {}, async () =>
      this.loadHistory(visitStorageManager)
    );

    const bookmarkDataMap = await timeAsync('fn:loadBookmarks', {}, async () =>
      this.loadBookmarks(visitStorageManager)
    );

    await timeAsync('fn:aggregateDataAndSave', {}, async () => {
      await visitStorageManager.aggregateDataAndSave(
        bookmarkDataMap,
        historyDataMap
      );
    });
  }

  private async cleanUpStorage() {
    for (const key of Object.values(StorageKeys)) {
      await chrome.storage.local.remove(key);
    }
  }

  private async loadHistory(visitStorageManager: VisitStorageManager) {
    const maxAge = MAX_BROWSER_HISTORY_AGE_IN_DAYS * 24 * 60 * 60 * 1000; // Convert days to milliseconds
    const startTime = Date.now() - maxAge;
    const historyDataMap: IVisitData = {};

    const historyItems = await timeAsync('readChromeHistory', {}, async () => {
      return await chrome.history.search({
        text: '', // Empty text to get all items
        startTime: startTime,
        maxResults: MAX_BROWSER_HISTORY_COUNT,
      });
    });

    if (historyItems.length === 0) {
      console.log(
        `No history items found in the last ${MAX_BROWSER_HISTORY_COUNT} days`
      );
      return historyDataMap;
    }

    return timeSync('process history data and save to map', {}, () => {
      let skippedCount = 0;
      let processedCount = 0;

      for (const item of historyItems) {
        if (
          visitStorageManager.addsVisitDataToMap(historyDataMap, {
            rawUrl: item.url,
            visitCount: item.visitCount,
            lastVisitTime: item.lastVisitTime,
            title: item.title,
          })
        ) {
          processedCount++;
        } else {
          skippedCount++;
        }
      }

      console.log(
        `History data processing completed: ${processedCount} processed, ${skippedCount} skipped. Resulted in ${Object.keys(historyDataMap).length} unique URLs.`
      );
      return historyDataMap;
    });
  }

  private async loadBookmarks(visitStorageManager: VisitStorageManager) {
    const bookmarkDataMap: IVisitData = {};
    const bookmarkTree = await chrome.bookmarks.getTree();
    const bookmarks = this.flattenBookmarks(bookmarkTree);
    let skippedCount = 0;
    let processedCount = 0;
    for (const bookmark of bookmarks) {
      if (
        visitStorageManager.addsVisitDataToMap(bookmarkDataMap, {
          rawUrl: bookmark.url,
          lastVisitTime: bookmark.dateLastUsed,
          customTitle: bookmark.title,
        })
      ) {
        processedCount++;
      } else {
        skippedCount++;
      }
    }

    console.log(
      `Bookmark data processing completed: ${processedCount} processed, ${skippedCount} skipped. Resulted in ${Object.keys(bookmarkDataMap).length} unique URLs.`
    );
    return bookmarkDataMap;
  }

  private flattenBookmarks(bookmarks: chrome.bookmarks.BookmarkTreeNode[]) {
    return bookmarks.reduce<IBookmarkTreeNode[]>((acc, b) => {
      if (b.children) acc.push(...this.flattenBookmarks(b.children));
      else if (b.url) acc.push(b);
      return acc;
    }, []);
  }
}
