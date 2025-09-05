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

export const addProtocalToUrl = (url: string) =>
  url.startsWith('http://') || url.startsWith('https://')
    ? url
    : `https://${url}`;

export const validateUrl = (url: string | undefined) => {
  if (url === undefined) {
    return null;
  }
  try {
    const urlObj = new URL(url);
    return urlObj.protocol === 'http:' || urlObj.protocol === 'https:'
      ? urlObj
      : null;
  } catch {
    return null;
  }
};

export const normalizeUrl = (url: URL) => {
  return url.origin + url.pathname;
};
