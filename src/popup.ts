import Fuse from 'fuse.js';
import { IBookmark } from './types';
import { flattenBookmarks } from './utils';
import { BookmarkRenderer } from './bookmark-renderer';
import { KeyboardHandler } from './keyboard-handler';
import { SelectionManager } from './selection-manager';

interface DomainInfo {
    domain: string;
    subdomain: string;
}

class BookmarkSearch {
    private readonly searchBox: HTMLInputElement;
    private readonly resultsContainer: HTMLElement;
    private readonly selectionManager = new SelectionManager();
    private readonly keyboardHandler: KeyboardHandler;

    private allBookmarks: IBookmark[] = [];
    private filteredBookmarks: IBookmark[] = [];
    private fuse: Fuse<IBookmark> | null = null;

    constructor() {
        this.searchBox = document.getElementById('searchBox') as HTMLInputElement;
        this.resultsContainer = document.getElementById('results') as HTMLElement;

        this.keyboardHandler = new KeyboardHandler(
            () => this.openSelectedBookmark(),
            () => this.moveSelection(1),
            () => this.moveSelection(-1),
            () => window.close()
        );

        this.init();
    }

    private async init(): Promise<void> {
        await this.loadBookmarks();
        this.setupEventListeners();
        this.setupTabManagementButtons();
        this.hideResults();
        this.searchBox.focus();
    }

    private async loadBookmarks(): Promise<void> {
        try {
            const bookmarkTree = await chrome.bookmarks.getTree();
            this.allBookmarks = flattenBookmarks(bookmarkTree);

            this.fuse = new Fuse<IBookmark>(this.allBookmarks, {
                keys: [
                    { name: 'title', weight: 0.7 },
                    { name: 'url', weight: 0.3 },
                ],
                threshold: 0.4,
                distance: 100,
                minMatchCharLength: 1,
                includeScore: true,
                shouldSort: true,
            });

            console.log('Loaded bookmarks:', this.allBookmarks.length);
        } catch (error) {
            console.error('Error loading bookmarks:', error);
            this.showError('Failed to load bookmarks');
        }
    }

    private setupEventListeners(): void {
        this.searchBox.addEventListener('input', () => {
            const query = this.searchBox.value.trim();
            if (query) {
                this.searchBookmarks(query);
            } else {
                this.hideResults();
            }
        });

        this.searchBox.addEventListener(
            'keydown',
            this.keyboardHandler.handleKeyDown
        );
    }

    private searchBookmarks(query: string): void {
        if (!this.fuse) {
            this.filteredBookmarks = [];
            this.selectionManager.reset();
            this.displayBookmarks();
            return;
        }

        const results = this.fuse.search(query);
        this.filteredBookmarks = results.map(result => result.item);
        this.selectionManager.reset();
        this.displayBookmarks();
    }

    private hideResults(): void {
        this.resultsContainer.innerHTML = '';
        this.filteredBookmarks = [];
        this.selectionManager.reset();
        this.adjustPopupSize();
    }

    private displayBookmarks(): void {
        this.resultsContainer.innerHTML = BookmarkRenderer.renderBookmarks(
            this.filteredBookmarks
        );
        this.attachEventListeners();
        this.selectionManager.updateVisualSelection(this.resultsContainer);
        this.adjustPopupSize();
    }

    private attachEventListeners(): void {
        this.resultsContainer
            .querySelectorAll('.bookmark-item')
            .forEach((item, index) => {
                item.addEventListener('click', () => {
                    const url = item.getAttribute('data-url');
                    if (url) this.openBookmark(url);
                });

                item.addEventListener('mouseenter', () => {
                    this.selectionManager.setIndex(index);
                    this.selectionManager.updateVisualSelection(this.resultsContainer);
                });
            });
    }

    private adjustPopupSize(): void {
        setTimeout(() => {
            const searchHeight = this.searchBox.offsetHeight + 32;
            const resultsHeight = this.resultsContainer.scrollHeight;
            const totalHeight = Math.max(
                80,
                Math.min(600, searchHeight + resultsHeight)
            );
            document.body.style.height = `${totalHeight}px`;
        }, 0);
    }

    private moveSelection(direction: number): void {
        this.selectionManager.moveWithContainer(direction, this.resultsContainer);
    }

    private openSelectedBookmark(): void {
        const bookmark = this.selectionManager.getSelectedBookmark(
            this.filteredBookmarks
        );
        if (bookmark?.url) this.openBookmark(bookmark.url);
    }

    private openBookmark(url: string): void {
        chrome.tabs.create({ url });
        window.close();
    }

    private showError(message: string): void {
        this.resultsContainer.innerHTML = `<div class="no-results">${message}</div>`;
        this.adjustPopupSize();
    }

    private getDomainAndSubdomain(url: string): DomainInfo {
        try {
            const urlObj = new URL(url);
            const hostnameParts = urlObj.hostname.split('.');
            if (hostnameParts.length > 2) {
                return {
                    domain:
                        hostnameParts[hostnameParts.length - 2] +
                        '.' +
                        hostnameParts[hostnameParts.length - 1],
                    subdomain: hostnameParts.slice(0, hostnameParts.length - 2).join('.'),
                };
            } else {
                return {
                    domain: urlObj.hostname,
                    subdomain: '',
                };
            }
        } catch (e) {
            console.error('Invalid URL:', url, e);
            return { domain: '', subdomain: '' };
        }
    }

    private async sortTabsByDomainAndSubdomain(
        tabs: chrome.tabs.Tab[]
    ): Promise<void> {
        const sortedTabs = tabs.sort((a, b) => {
            const urlA = this.getDomainAndSubdomain(a.url || '');
            const urlB = this.getDomainAndSubdomain(b.url || '');

            const domainCompare = urlA.domain.localeCompare(urlB.domain);
            if (domainCompare !== 0) {
                return domainCompare;
            }

            return urlA.subdomain.localeCompare(urlB.subdomain);
        });

        for (let i = sortedTabs.length - 1; i >= 0; i--) {
            const tab = sortedTabs[i];
            if (tab?.id) {
                await chrome.tabs.move(tab.id, { index: i });
            }
        }
    }

    private setupTabManagementButtons(): void {
        const sortButton = document.getElementById('sortTabs');
        const removeDuplicatesButton = document.getElementById('removeDuplicates');
        const mergeWindowsButton = document.getElementById('mergeWindows');

        sortButton?.addEventListener('click', async () => {
            try {
                const tabs = await chrome.tabs.query({ currentWindow: true });
                await this.sortTabsByDomainAndSubdomain(tabs);
            } catch (error) {
                console.error('Error sorting tabs:', error);
            }
        });

        removeDuplicatesButton?.addEventListener('click', async () => {
            try {
                const tabs = await chrome.tabs.query({ currentWindow: true });
                const seenUrls = new Set<string>();
                const duplicateTabIds: number[] = [];

                for (const tab of tabs) {
                    if (tab.url && seenUrls.has(tab.url)) {
                        if (tab.id) duplicateTabIds.push(tab.id);
                    } else if (tab.url) {
                        seenUrls.add(tab.url);
                    }
                }

                if (duplicateTabIds.length > 0) {
                    await chrome.tabs.remove(duplicateTabIds);
                }
            } catch (error) {
                console.error('Error removing duplicate tabs:', error);
            }
        });

        mergeWindowsButton?.addEventListener('click', async () => {
            try {
                const currentWindow = await chrome.windows.getCurrent();
                if (!currentWindow.id) return;

                const allTabs = await chrome.tabs.query({});
                const tabsToMove = allTabs.filter(
                    tab => tab.windowId !== currentWindow.id
                );

                for (const tab of tabsToMove) {
                    if (tab.id) {
                        await chrome.tabs.move(tab.id, {
                            windowId: currentWindow.id,
                            index: -1,
                        });
                    }
                }
            } catch (error) {
                console.error('Error merging windows:', error);
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', () => new BookmarkSearch());
