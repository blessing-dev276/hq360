import { defineConfig, loadEnv } from "vite";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import viteReact from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";

// Standalone TanStack Start + Vite config. Mirrors the plugin stack the
// previous @lovable.dev/vite-tanstack-config assembled (Tailwind, tsconfig
// paths, TanStack Start, React, and — build only — nitro). Deploy target is
// Vercel; nitro's "vercel" preset emits .vercel/output (Build Output API v3),
// which Vercel deploys directly. Change the preset for another host.
export default defineConfig(async ({ command, mode, isPreview }) => {
  // Inline VITE_-prefixed env into the client bundle (import.meta.env.*).
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const define: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    define[`import.meta.env.${key}`] = JSON.stringify(value);
  }

  const plugins = [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
      // Route the bundled server entry through src/server.ts (SSR error wrapper).
      server: { entry: "server" },
    }),
    viteReact(),
  ];

  if (command === "build" || isPreview) {
    const { nitro } = await import("nitro/vite");
    plugins.push(
      nitro({
        preset: "vercel",
        // _headers is not consumed by Vercel; emit actual CDN routing headers.
        routeRules: {
          "/fonts/**": { headers: { "cache-control": "public, max-age=86400, must-revalidate" } },
          "/logo-text.webp": {
            headers: { "cache-control": "public, max-age=86400, must-revalidate" },
          },
          "/logo-abstract.webp": {
            headers: { "cache-control": "public, max-age=86400, must-revalidate" },
          },
          "/robots.txt": { headers: { "cache-control": "public, max-age=3600, must-revalidate" } },
        },
        // @resvg/resvg-js (native .node binary loader) and fontkit (a
        // @react-pdf/renderer dependency; its shapers load a .trie binary
        // resource) are genuine CommonJS that reference `__dirname` at
        // module load — legitimate under Node's real per-module CJS, but
        // undefined once Rollup inlines that code into the ESM server
        // bundle. Nitro's built-in externals+trace plugin (driven by
        // traceDeps, since noExternals isn't set for this preset) keeps
        // them as real `require()`d CJS *and* copies their files (native
        // binaries included, via the trailing `*` for a full-package
        // trace) into the deployed function — a hand-rolled
        // rollupConfig.external here would only do the first half, since
        // it intercepts before Nitro's own plugin can trace the files.
        // PDFKit's #standard-fonts imports require its original package scope
        // and the font modules declared by package.json's imports map.
        traceDeps: ["pdfkit*", "fontkit*", "harfbuzzjs*", "@resvg/resvg-js*"],
      }),
    );
  }

  return {
    define,
    css: { transformer: "lightningcss" as const },
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    optimizeDeps: {
      include: [
        "react",
        "react-dom",
        "react-dom/client",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
      ],
    },
    server: { host: "::", port: 8080 },
    plugins,
  };
});
