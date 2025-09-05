import { IBookmarkTreeNode } from '../src/types';

/**
 * Helper function to create mock bookmark nodes with all required properties
 */
export function createMockBookmark(
  id: string, 
  title: string, 
  url?: string,
  children?: IBookmarkTreeNode[]
): IBookmarkTreeNode {
  return {
    id,
    title,
    url,
    children,
    index: 0,
    dateAdded: Date.now(),
    dateGroupModified: Date.now(),
    parentId: 'root',
    syncing: false,
  } as IBookmarkTreeNode;
}

/**
 * Helper to create mock bookmark arrays
 */
export function createMockBookmarks(count: number, urlPrefix = 'https://example'): IBookmarkTreeNode[] {
  return Array.from({ length: count }, (_, i) => 
    createMockBookmark(`${i}`, `Bookmark ${i}`, `${urlPrefix}${i}.com`)
  );
}