import { defineConfig, loadEnv } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";

import {
  ACTIVE_SUPABASE_URL,
  ACTIVE_SUPABASE_PUBLISHABLE_KEY,
  ACTIVE_SUPABASE_PROJECT_ID,
} from "./src/lib/supabase-target";

const isSandbox =
  process.env.LOVABLE_SANDBOX === "1" || !!process.env.DEV_SERVER__PROJECT_PATH;

export default defineConfig(async ({ mode, command }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const envDefine: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    envDefine[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  const { tanstackStart } = await import("@tanstack/react-start/plugin/vite");

  const plugins = [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
    }),
    react(),
  ];

  if (command === "build") {
    plugins.push(
      nitro({
        preset: "cloudflare-module",
        cloudflare: {
          nodeCompat: true,
          deployConfig: true,
        },
        output: {
          dir: "dist",
          serverDir: "dist/server",
          publicDir: "dist/client",
        },
      }),
    );
  }

  const config: ReturnType<typeof defineConfig> = {
    plugins,
    define: {
      ...envDefine,
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(ACTIVE_SUPABASE_URL),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(
        ACTIVE_SUPABASE_PUBLISHABLE_KEY,
      ),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(
        ACTIVE_SUPABASE_PUBLISHABLE_KEY,
      ),
      "import.meta.env.VITE_SUPABASE_PROJECT_ID": JSON.stringify(
        ACTIVE_SUPABASE_PROJECT_ID,
      ),
      ...(command === "build" && mode === "development"
        ? { "process.env.NODE_ENV": JSON.stringify("development") }
        : {}),
    },
    resolve: {
      alias: {
        "@": `${process.cwd()}/src`,
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    css: {
      transformer: "lightningcss",
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
      ignoreOutdatedRequests: true,
    },
    server: isSandbox
      ? {
          host: "::",
          port: 8080,
          strictPort: true,
          watch: {
            ignored: [
              "**/.workspace/**",
              "**/.agents/**",
              "**/.claude/**",
              "**/.tanstack/tmp/**",
            ],
          },
          hmr: { overlay: false },
        }
      : {
          host: "::",
          port: 8080,
        },
  };

  return config;
});
