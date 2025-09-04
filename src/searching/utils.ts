import { IBookmarkTreeNode } from './types';

export const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

export const removeUrlParams = (url: string): string => {
  try {
    const urlObj = new URL(url);
    return `${urlObj.origin}${urlObj.pathname}`;
  } catch (err) {
    console.error(`failed to parse URL: ${url}`, err);
    return url;
  }
};

export const getFaviconUrl = (url: string): string => {
  try {
    const faviconUrl = `chrome-extension://${chrome.runtime.id}/_favicon/?pageUrl=${encodeURIComponent(url)}&size=64`;
    return faviconUrl;
  } catch (error) {
    console.error('Failed to get FavIcon url for url', url, error);
    return `data:image/svg+xml;base64,${btoa(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'><rect width='16' height='16' fill='#ddd'/><text x='8' y='12' text-anchor='middle' font-size='12' fill='#666'>?</text></svg>`)}`;
  }
};

export const truncateUrl = (url: string, maxLength = 50): string => {
  if (url.length <= maxLength) return url;

  try {
    const { hostname, pathname } = new URL(url);
    const displayUrl = hostname + pathname;
    if (displayUrl.length <= maxLength) return displayUrl;
    return displayUrl.substring(0, maxLength - 3) + '...';
  } catch {
    return url.substring(0, maxLength - 3) + '...';
  }
};

export const flattenBookmarks = (
  bookmarks: chrome.bookmarks.BookmarkTreeNode[]
) =>
  bookmarks.reduce<IBookmarkTreeNode[]>((acc, b) => {
    if (b.children) acc.push(...flattenBookmarks(b.children));
    else if (b.url) acc.push(b);
    return acc;
  }, []);

export const addProtocalToUrl = (url: string) =>
  url.startsWith('http://') || url.startsWith('https://')
    ? url
    : `https://${url}`;

export const normalizeUrl = (url: string): string => {
  try {
    const urlObj = new URL(addProtocalToUrl(url));
    let normalized = urlObj.hostname;

    // Include port if it's not the default port
    if (
      urlObj.port &&
      !(
        (urlObj.protocol === 'https:' && urlObj.port === '443') ||
        (urlObj.protocol === 'http:' && urlObj.port === '80')
      )
    ) {
      normalized += ':' + urlObj.port;
    }

    // Add pathname, ensuring root path has trailing slash
    let pathname = urlObj.pathname;
    if (pathname === '/') {
      pathname = '/';
    } else if (pathname.endsWith('/')) {
      // Keep trailing slash as-is
    } else {
      // No trailing slash for non-root paths
    }

    normalized += pathname;

    // Ensure root URLs have trailing slash
    if (pathname === '/') {
      if (!normalized.endsWith('/')) {
        normalized += '/';
      }
    }

    return normalized;
  } catch {
    console.warn('Invalid URL for normalization:', url);
    return url; // Fallback to original URL if parsing fails
  }
};
