import { throwIfNull } from './error_handling';

interface UrlInfo {
  domain: string;
  subdomain: string;
  pathName: string;
  search: string;
}

export class TabManagement {
  constructor() {
    this.setupSortButton();
    this.setupDeduplicateButton();
    this.setupMergeButton();
  }

  private setupSortButton() {
    const sortButton =
      document.getElementById('sortTabs') ??
      throwIfNull('sortTabs cannot be null');

    const sortOrder: (keyof UrlInfo)[] = [
      'domain',
      'subdomain',
      'pathName',
      'search',
    ];
    sortButton.addEventListener('click', async () => {
      try {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        
        if (!tabs || tabs.length === 0) {
          console.log('No tabs found to sort');
          return;
        }

        const sortedTabs = tabs.sort((a, b) => {
          const urlA = this.getUrlInfo(a.url || '');
          const urlB = this.getUrlInfo(b.url || '');

          for (const key of sortOrder) {
            const compareResult = urlA[key].localeCompare(urlB[key]);
            if (compareResult !== 0) {
              return compareResult;
            }
          }
          return 0;
        });

        // Move tabs in reverse order to maintain correct positioning
        for (let i = sortedTabs.length - 1; i >= 0; i--) {
          const tab = sortedTabs[i];
          if (tab?.id !== undefined) {
            try {
              await chrome.tabs.move(tab.id, { index: i });
            } catch (moveError) {
              console.error(`Failed to move tab ${tab.id}:`, moveError);
            }
          }
        }
        
        console.log(`Successfully sorted ${sortedTabs.length} tabs`);
      } catch (error) {
        console.error('Error sorting tabs:', error);
      }
    });
  }

  private setupDeduplicateButton() {
    const deDuplicatesButton =
      document.getElementById('deDuplicates') ??
      throwIfNull('deDuplicates cannot be null');

    deDuplicatesButton.addEventListener('click', async () => {
      try {
        const tabs = await chrome.tabs.query({ currentWindow: true });
        
        if (!tabs || tabs.length === 0) {
          console.log('No tabs found to deduplicate');
          return;
        }

        const seenUrls = new Set<string>();
        const duplicateTabIds: number[] = [];

        for (const tab of tabs) {
          if (tab.url && typeof tab.url === 'string') {
            if (seenUrls.has(tab.url) && tab.id !== undefined) {
              duplicateTabIds.push(tab.id);
            } else {
              seenUrls.add(tab.url);
            }
          }
        }

        if (duplicateTabIds.length > 0) {
          await chrome.tabs.remove(duplicateTabIds);
          console.log(`Removed ${duplicateTabIds.length} duplicate tabs`);
        } else {
          console.log('No duplicate tabs found');
        }
      } catch (error) {
        console.error('Error removing duplicate tabs:', error);
      }
    });
  }

  private setupMergeButton(): void {
    const mergeWindowsButton =
      document.getElementById('mergeWindows') ??
      throwIfNull('mergeWindows cannot be null');

    mergeWindowsButton.addEventListener('click', async () => {
      try {
        const currentWindow = await chrome.windows.getCurrent();
        if (!currentWindow.id) {
          console.error('Could not get current window ID');
          return;
        }

        const allTabs = await chrome.tabs.query({});
        const tabsToMove = allTabs.filter(
          tab => tab.windowId !== currentWindow.id && tab.id !== undefined
        );

        if (tabsToMove.length === 0) {
          console.log('No tabs from other windows to merge');
          return;
        }

        let movedCount = 0;
        for (const tab of tabsToMove) {
          if (tab.id !== undefined) {
            try {
              await chrome.tabs.move(tab.id, {
                windowId: currentWindow.id,
                index: -1,
              });
              movedCount++;
            } catch (moveError) {
              console.error(`Failed to move tab ${tab.id}:`, moveError);
            }
          }
        }
        
        console.log(`Successfully merged ${movedCount} tabs from other windows`);
      } catch (error) {
        console.error('Error merging windows:', error);
      }
    });
  }

  private getUrlInfo(url: string): UrlInfo {
    try {
      if (!url || typeof url !== 'string') {
        return { domain: '', subdomain: '', pathName: '', search: '' };
      }

      const urlObj = new URL(url);
      const hostname = urlObj.hostname.split('.');

      const domain =
        hostname.length >= 2
          ? `${hostname[hostname.length - 2]}.${hostname[hostname.length - 1]}`
          : urlObj.hostname;
      const subdomain =
        hostname.length >= 3
          ? hostname.slice(0, hostname.length - 2).join('.')
          : '';
      const pathName = urlObj.pathname || '';
      const search = urlObj.search || '';

      return {
        domain,
        subdomain,
        pathName,
        search,
      };
    } catch (e) {
      console.error('Unable to parse URL:', url, e);
      return { domain: url || '', subdomain: '', pathName: '', search: '' };
    }
  }
}
