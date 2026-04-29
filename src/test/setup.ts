import "@testing-library/jest-dom/vitest";
import { beforeEach } from "vitest";

beforeEach(() => {
  // Fresh localStorage per test so persisted zustand stores don't bleed.
  localStorage.clear();
});
