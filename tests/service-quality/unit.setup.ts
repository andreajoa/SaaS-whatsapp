import "@testing-library/jest-dom/vitest";

// Radix mede os controles em layout effects; jsdom não oferece essa API.
if (typeof globalThis.ResizeObserver === "undefined") {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
