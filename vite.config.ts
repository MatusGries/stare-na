import { defineConfig, loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Dev-server twin of api/arena.js (Vercel functions don't run under `vite dev`).
// Same contract, same token env var; kept tiny so the two can't drift far.
const arenaProxy = (token: string | undefined): Plugin => ({
  name: "arena-proxy-dev",
  configureServer(server) {
    server.middlewares.use("/api/arena", async (req, res) => {
      const url = new URL(req.url ?? "", "http://localhost");
      const kind = url.searchParams.get("kind");
      const id = url.searchParams.get("id");
      const page = url.searchParams.get("page") ?? "1";
      const per = Math.min(parseInt(url.searchParams.get("per") ?? "25", 10) || 25, 25);
      res.setHeader("Content-Type", "application/json");
      if ((kind !== "channels" && kind !== "following") || !/^[a-z0-9_-]+$/i.test(id ?? "")) {
        res.statusCode = 400;
        return res.end(JSON.stringify({ error: "bad kind or id" }));
      }
      if (!token) {
        res.statusCode = 500;
        return res.end(JSON.stringify({ error: "ARENA_ACCESS_TOKEN not configured (.env.local)" }));
      }
      try {
        const upstream = await fetch(
          `https://api.are.na/v2/users/${id}/${kind}?per=${per}&page=${page}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        res.statusCode = upstream.status;
        res.end(await upstream.text());
      } catch {
        res.statusCode = 502;
        res.end(JSON.stringify({ error: "upstream fetch failed" }));
      }
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    server: {
      host: "::",
      port: 8080,
      hmr: {
        overlay: false,
      },
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      mode === "development" && arenaProxy(env.ARENA_ACCESS_TOKEN),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
    },
  };
});
