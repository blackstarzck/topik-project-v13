// Global vitest setup (wired via vitest.config.ts `test.setupFiles`).
//
// jsdom does not implement ResizeObserver or matchMedia, but several antd /
// rc-component widgets (Tabs, TimePicker, Select, etc.) call them on mount.
// Without these stubs those components throw "ResizeObserver is not defined"
// during render. Standard no-op polyfills are correct for unit tests: layout
// measurement is not asserted, only behavior.

class ResizeObserverStub {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}

if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver =
    ResizeObserverStub as unknown as typeof ResizeObserver;
}

if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => undefined,
      removeListener: () => undefined,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      dispatchEvent: () => false,
    }),
  });
}
