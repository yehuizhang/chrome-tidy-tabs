import { IBookmark } from './types';

export class SelectionManager {
  private selectedIndex = -1;

  get currentIndex(): number {
    return this.selectedIndex;
  }

  reset(): void {
    this.selectedIndex = -1;
  }

  move(direction: number, itemCount: number): void {
    if (itemCount == 0) return;

    const newIndex = this.selectedIndex + direction;

    if (newIndex >= 0 && newIndex < itemCount) {
      this.selectedIndex = newIndex;
    } else if (direction > 0 && this.selectedIndex + 1 === itemCount) {
      this.selectedIndex = 0; // wrap to top
    } else if (direction < 0 && this.selectedIndex <= 0) {
      this.selectedIndex = itemCount - 1; // wrap to bottom
    }
  }

  setIndex(index: number): void {
    this.selectedIndex = index;
  }

  getSelectedBookmark(bookmarks: IBookmark[]): IBookmark | null {
    return (
      (this.selectedIndex >= 0 && this.selectedIndex < bookmarks.length
        ? bookmarks[this.selectedIndex]
        : bookmarks[0]) ?? null
    );
  }

  updateVisualSelection(container: HTMLElement): void {
    const items = container.querySelectorAll('.bookmark-item');
    items.forEach((item, index) => {
      item.classList.toggle('selected', index === this.selectedIndex);
    });
  }
}
