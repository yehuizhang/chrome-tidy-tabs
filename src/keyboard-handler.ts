export class KeyboardHandler {
  constructor(
    private onEnter: () => void,
    private onArrowDown: () => void,
    private onArrowUp: () => void,
    private onEscape: () => void
  ) {}

  handleKeyDown = (e: KeyboardEvent): void => {
    const actions: Record<string, () => void> = {
      Enter: () => {
        e.preventDefault();
        this.onEnter();
      },
      ArrowDown: () => {
        e.preventDefault();
        this.onArrowDown();
      },
      ArrowUp: () => {
        e.preventDefault();
        this.onArrowUp();
      },
      Escape: this.onEscape,
    };

    actions[e.key]?.();
  };
}
