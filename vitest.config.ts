import { defineConfig } from "vitest/config";
import viteConfig from "./vite.config";
import path from "node:path";

export default defineConfig({
  ...viteConfig,
  // Isolated AI Company workers may not write the control-plane dependency
  // directory. Their dispatcher supplies a per-work-item temp cache; normal
  // local runs retain Vite's default cache location.
  cacheDir: process.env.AI_COMPANY_VITEST_CACHE_DIR || path.join('/tmp', 'ai-company-vitest-control-plane'),
  test: {
    // Server tests intentionally share the SQLite schema and environment
    // boundary. Serial file execution prevents cross-worker SQLITE_BUSY/lock
    // races while retaining intra-file test isolation.
    fileParallelism: false,
    // Importing the full Express surface initializes the repository schema and
    // provider contracts; under the complete 67-file suite this can exceed
    // Vitest's 10s hook default without indicating a test failure.
    hookTimeout: 30_000,
    // Disposable AI Company worktrees contain snapshots of the repository;
    // they are execution artifacts, not independent test suites.
    exclude: ['**/node_modules/**', '**/.ai-company/worktrees/**', '**/dist/**'],
  },
});
