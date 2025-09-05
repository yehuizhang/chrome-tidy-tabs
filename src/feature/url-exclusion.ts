export class UrlExclusion {
  private static readonly STORAGE_KEY = 'url_exclusion_rules';

  private excludedUrlPrefixes: Set<string>;
  private isRuleLoaded: boolean;

  constructor() {
    this.excludedUrlPrefixes = new Set();
    this.isRuleLoaded = false;
  }

  async loadFromStorage(): Promise<void> {
    try {
      const storedRules = await chrome.storage.local.get(
        UrlExclusion.STORAGE_KEY
      );
      if (storedRules[UrlExclusion.STORAGE_KEY]) {
        this.excludedUrlPrefixes = new Set(
          storedRules[UrlExclusion.STORAGE_KEY]
        );
      }
      this.isRuleLoaded = true;
      console.log(
        'URL exclusion excludedUrlPrefixes loaded from storage:',
        this.excludedUrlPrefixes
      );
    } catch (error) {
      console.error(
        'Error loading URL exclusion excludedUrlPrefixes from storage:',
        error
      );
    }
  }

  validateRuleIsLoaded(): void {
    if (!this.isRuleLoaded) {
      throw new Error(
        'URL exclusion excludedUrlPrefixes have not been loaded yet'
      );
    }
  }

  async addUrls(urlString: string) {
    this.validateRuleIsLoaded();
    urlString
      .split(',')
      .map(url => url.trim())
      .filter(url => url.length > 0)
      .forEach(url => {
        try {
          if (!url.startsWith('http://') && !url.startsWith('https://')) {
            url = `https://${url}`;
          }
          const u = new URL(url);
          this.excludedUrlPrefixes.add(`${u.hostname}${u.pathname}`);
        } catch (e) {
          console.error('Error adding url prefix url:', url, e);
        }
      });
    await chrome.storage.local.set({
      [UrlExclusion.STORAGE_KEY]: Array.from(this.excludedUrlPrefixes),
    });
  }

  isUrlExcluded(url: string): boolean {
    this.validateRuleIsLoaded();
    for (const rule of this.excludedUrlPrefixes) {
      if (url.startsWith(rule)) {
        return true;
      }
    }
    return false;
  }
}
