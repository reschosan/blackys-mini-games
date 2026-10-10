import { CHostComponent } from './base';

/** Scrollable, left-aligned area for long content inside a menu: `<c-scroll>…</c-scroll>`. The scrollbar is always
 *  visible so that cut-off content shows there is more to scroll to. */
export class CScroll extends CHostComponent {
  protected override hostClasses(): string {
    return 'flex max-h-[62vh] w-full max-w-[44rem] flex-col gap-4 overflow-y-auto px-2 text-left [&>*]:shrink-0 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/40 [&::-webkit-scrollbar-map]:rounded-full [&::-webkit-scrollbar-map]:bg-white/10';
  }
}

customElements.define('c-scroll', CScroll);

declare global {
  interface HTMLElementTagNameMap {
    'c-scroll': CScroll;
  }
}
