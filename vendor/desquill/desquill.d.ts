export interface MathFieldApi {
  latex(): string;
  latex(value: string): this;
  focus(): this;
  blur(): this;
  select(): this;
  typedText(value: string): this;
  write(value: string): this;
  keystroke(keys: string, event?: KeyboardEvent): this;
  moveToLeftEnd(): this;
  moveToRightEnd(): this;
  selection(): { latex: string; startIndex: number; endIndex: number };
  subscribeToChanges(callback: () => void): () => void;
  setAriaLabel(label: string): this;
  setAriaPostLabel(label: string): this;
}
export function MathField(element: HTMLElement, config: Record<string, unknown>): MathFieldApi;
export const bundledLocalize: unknown;
