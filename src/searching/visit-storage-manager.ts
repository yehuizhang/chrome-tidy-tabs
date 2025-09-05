import { IVisitData } from '../types';
import { StorageKeys } from '../utils/constants';
import { normalizeUrl, validateUrl } from './utils';

export class VisitStorageManager {
  private visitData: IVisitData = {};
  private static instance: VisitStorageManager;

  private constructor() {}

  static async getInstance(): Promise<VisitStorageManager> {
    if (!VisitStorageManager.instance) {
      VisitStorageManager.instance = new VisitStorageManager();
      await VisitStorageManager.instance.loadVisitDataIfAvailable();
    }
    return VisitStorageManager.instance;
  }

  async loadVisitDataIfAvailable(): Promise<void> {
    const result = await chrome.storage.local.get([StorageKeys.VISIT_DATA]);

    const visitData = result[StorageKeys.VISIT_DATA] as IVisitData;

    if (visitData) {
      this.visitData = visitData;
    }
  }

  async aggregateDataAndSave(...datasets: IVisitData[]) {
    for (const dataset of datasets) {
      for (const [url, data] of Object.entries(dataset)) {
        if (!this.visitData[url]) {
          this.visitData[url] = data;
        } else {
          this.visitData[url].count += data.count;
          this.visitData[url].lastVisited = Math.max(
            this.visitData[url].lastVisited,
            data.lastVisited
          );
          if (data.customTitle) {
            this.visitData[url].customTitle = data.customTitle;
          }
          if (data.title) {
            this.visitData[url].title = data.title;
          }
        }
      }
    }

    await this.saveVisitData();
  }

  /**
   * Saves visit data to Chrome storage
   */
  async saveVisitData(attempts: number = 3): Promise<void> {
    try {
      await chrome.storage.local.set({
        [StorageKeys.VISIT_DATA]: this.visitData,
      });
    } catch (error) {
      if (
        attempts > 0 &&
        error instanceof Error &&
        error.message.includes('QUOTA_BYTES')
      ) {
        console.warn('Storage quota exceeded - cleaning up old data');
        await this.cleanupOldData();
        await this.saveVisitData(attempts - 1);
      } else {
        console.error('Failed to save aggregated visit data:', error);
        throw error;
      }
    }
  }

  private async cleanupOldData() {
    const entries = Object.entries(this.visitData);

    if (entries.length === 0) {
      return;
    }

    // Sort by the lastVisited timestamp (oldest first)
    entries.sort(([, a], [, b]) => a.lastVisited - b.lastVisited);

    // Remove the oldest 30% of entries
    const entriesToRemove = Math.max(1, Math.floor(entries.length * 0.3));
    const entriesToKeep = entries.slice(entriesToRemove);

    // Rebuild visit data with remaining entries
    const cleanedData: IVisitData = {};
    for (const [url, data] of entriesToKeep) {
      cleanedData[url] = data;
    }

    console.log(
      `Cleaned up ${entriesToRemove} old visit entries due to storage quota`
    );

    this.visitData = cleanedData;
  }

  /**
   * Records a visit for the given URL
   */
  async recordVisit(url: string | undefined, title?: string): Promise<void> {
    const wasAdded = this.addsVisitDataToMap(this.visitData, {
      rawUrl: url,
      title: title,
      lastVisitTime: Date.now(),
    });

    if (wasAdded) {
      console.log('Visit recorded in visitData map:', { url, title });
    }
  }

  addsVisitDataToMap(
    map: IVisitData,
    o: {
      rawUrl: string | undefined;
      visitCount?: number | undefined;
      lastVisitTime?: number | undefined;
      title?: string | undefined;
      customTitle?: string | undefined;
    }
  ) {
    const url = validateUrl(o.rawUrl);
    if (!url) return false;

    const normalizedUrl = normalizeUrl(url);

    const visitCount = o.visitCount || 1;
    const lastVisited = o.lastVisitTime || 0;
    const title = (o.title || '').trim() || null;

    if (map[normalizedUrl]) {
      map[normalizedUrl].count += visitCount;
      if (lastVisited > map[normalizedUrl].lastVisited) {
        map[normalizedUrl].lastVisited = lastVisited;
      }
    } else {
      map[normalizedUrl] = {
        count: visitCount,
        lastVisited: lastVisited,
      };
    }
    if (o.customTitle) {
      map[normalizedUrl].customTitle = o.customTitle;
    }
    if (title) {
      map[normalizedUrl].title = title;
    }
    return true;
  }

  /**
   * Gets the visit count for a specific URL
   */
  getVisitCount(url: string): number {
    return this.visitData[url]?.count || 0;
  }

  /**
   * Returns all visit data
   */
  getAllVisitData(): IVisitData {
    return { ...this.visitData };
  }
}
