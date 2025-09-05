import { SearchEntry } from '../types';

export class SelectionManager {
  private selectedIndex = -1;

  get currentIndex(): number {
    return this.selectedIndex;
  }

  reset(): void {
    this.selectedIndex = -1;
  }

  setIndex(index: number): void {
    this.selectedIndex = index;
  }

  getSelectedBookmark(searchResults: SearchEntry[]): SearchEntry | null {
    return (
      (this.selectedIndex >= 0 && this.selectedIndex < searchResults.length
        ? searchResults[this.selectedIndex]
        : searchResults[0]) ?? null
    );
  }

  updateVisualSelection(container: HTMLElement): void {
    const items = container.querySelectorAll('.search-result-item');
    console.log(
      `updateVisualSelection: found ${items.length} items, selectedIndex: ${this.selectedIndex}`
    );

    items.forEach((item, index) => {
      const isSelected = index === this.selectedIndex;
      item.classList.toggle('selected', isSelected);

      // Scroll selected item into view
      if (isSelected) {
        // Use scrollIntoView with more specific options
        (item as HTMLElement).scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'nearest',
        });
      }
    });
  }

  moveWithContainer(direction: number, container: HTMLElement): void {
    const items = container.querySelectorAll('.search-result-item');
    const itemCount = items.length;
    console.log(
      `moveWithContainer: direction:${direction} itemCount:${itemCount} (from DOM)`
    );

    if (itemCount === 0) {
      this.selectedIndex = -1;
      return;
    }

    // Initialize selection if none exists
    if (this.selectedIndex === -1) {
      this.selectedIndex = direction > 0 ? 0 : itemCount - 1;
      this.updateVisualSelection(container);
      return;
    }

    let newIndex = this.selectedIndex + direction;

    // Handle wrapping
    if (newIndex >= itemCount) {
      newIndex = 0; // Wrap to first item
    } else if (newIndex < 0) {
      newIndex = itemCount - 1; // Wrap to last item
    }

    this.selectedIndex = newIndex;
    this.updateVisualSelection(container);
  }
}
