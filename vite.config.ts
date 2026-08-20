// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import {
  ACTIVE_SUPABASE_URL,
  ACTIVE_SUPABASE_PUBLISHABLE_KEY,
  ACTIVE_SUPABASE_PROJECT_ID,
} from "./src/lib/supabase-target";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    // Pin the browser client to the external Supabase project, overriding the
    // managed VITE_SUPABASE_* values injected for the built-in project.
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(ACTIVE_SUPABASE_URL),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        ACTIVE_SUPABASE_PUBLISHABLE_KEY,
      ),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(ACTIVE_SUPABASE_PUBLISHABLE_KEY),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(ACTIVE_SUPABASE_PROJECT_ID),
    },
  },
});

