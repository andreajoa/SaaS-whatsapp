import "@testing-library/jest-dom/vitest";

// Testes de componente usam o mesmo DOM que a suíte principal, sem ler .env.
globalThis.ResizeObserver ??= class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
