import { IBookmark } from './types';

export const escapeHtml = (text: string): string => {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
};

export const getFaviconUrl = (url: string): string => {
  try {
    const { hostname } = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=16`;
  } catch {
    return 'data:image/svg+xml;base64, PD94bWwgdmVyc2lvbj0iMS4wIj8+CjxzdmcgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB4bWxuczp4bGluaz0iaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGluayIgdmVyc2lvbj0iMS4xIiBpZD0iQ2FwYV8xIiB4PSIwcHgiIHk9IjBweCIgdmlld0JveD0iMCAwIDMzMCAzMzAiIHN0eWxlPSJlbmFibGUtYmFja2dyb3VuZDpuZXcgMCAwIDMzMCAzMzA7IiB4bWw6c3BhY2U9InByZXNlcnZlIiB3aWR0aD0iMjdweCIgaGVpZ2h0PSIyN3B4IiBjbGFzcz0iIj48Zz48Zz4KCTxwYXRoIGQ9Ik0xNjUsMEM3NC4wMTksMCwwLDc0LjAyLDAsMTY1LjAwMUMwLDI1NS45ODIsNzQuMDE5LDMzMCwxNjUsMzMwczE2NS03NC4wMTgsMTY1LTE2NC45OTlDMzMwLDc0LjAyLDI1NS45ODEsMCwxNjUsMHogICAgTTE2NSwzMDBjLTc0LjQ0LDAtMTM1LTYwLjU2LTEzNS0xMzQuOTk5QzMwLDkwLjU2Miw5MC41NiwzMCwxNjUsMzBzMTM1LDYwLjU2MiwxMzUsMTM1LjAwMUMzMDAsMjM5LjQ0LDIzOS40MzksMzAwLDE2NSwzMDB6IiBkYXRhLW9yaWdpbmFsPSIjMDAwMDAwIiBjbGFzcz0iYWN0aXZlLXBhdGgiIGRhdGEtb2xkX2NvbG9yPSIjMDA4OUZGIiBmaWxsPSIjMDA5MUZGIi8+Cgk8cGF0aCBkPSJNMTY0Ljk5OCw3MGMtMTEuMDI2LDAtMTkuOTk2LDguOTc2LTE5Ljk5NiwyMC4wMDljMCwxMS4wMjMsOC45NywxOS45OTEsMTkuOTk2LDE5Ljk5MSAgIGMxMS4wMjYsMCwxOS45OTYtOC45NjgsMTkuOTk2LTE5Ljk5MUMxODQuOTk0LDc4Ljk3NiwxNzYuMDI0LDcwLDE2NC45OTgsNzB6IiBkYXRhLW9yaWdpbmFsPSIjMDAwMDAwIiBjbGFzcz0iYWN0aXZlLXBhdGgiIGRhdGEtb2xkX2NvbG9yPSIjMDA4OUZGIiBmaWxsPSIjMDA5MUZGIi8+Cgk8cGF0aCBkPSJNMTY1LDE0MGMtOC4yODQsMC0xNSw2LjcxNi0xNSwxNXY5MGMwLDguMjg0LDYuNzE2LDE1LDE1LDE1YzguMjg0LDAsMTUtNi43MTYsMTUtMTV2LTkwQzE4MCwxNDYuNzE2LDE3My4yODQsMTQwLDE2NSwxNDB6ICAgIiBkYXRhLW9yaWdpbmFsPSIjMDAwMDAwIiBjbGFzcz0iYWN0aXZlLXBhdGgiIGRhdGEtb2xkX2NvbG9yPSIjMDA4OUZGIiBmaWxsPSIjMDA5MUZGIi8+CjwvZz48L2c+IDwvc3ZnPgo=';
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

export const flattenBookmarks = (bookmarks: IBookmark[]) =>
  bookmarks.reduce<IBookmark[]>((acc, b) => {
    if (b.url) acc.push(b);
    if (b.children) acc.push(...flattenBookmarks(b.children));
    return acc;
  }, []);
