import { createFileRoute } from "@tanstack/react-router";

function isFalHost(hostname: string): boolean {
  return hostname === "fal.media" || hostname.endsWith(".fal.media") || hostname === "fal.ai" || hostname.endsWith(".fal.ai");
}

function isAllowedHost(hostname: string): boolean {
  return (
    hostname === "imgen.x.ai" ||
    hostname === "vidgen.x.ai" ||
    hostname === "data.x.ai" ||
    hostname.endsWith(".x.ai") ||
    hostname === "replicate.delivery" ||
    hostname.endsWith(".replicate.delivery") ||
    isFalHost(hostname)
  );
}

function isReplicateHost(hostname: string): boolean {
  return hostname === "replicate.delivery" || hostname.endsWith(".replicate.delivery");
}

function safeFilename(name: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9._-]/g, "_").slice(0, 80);
  return cleaned || "imagine";
}

function authHeader(hostname: string): string | undefined {
  if (isReplicateHost(hostname)) {
    const token = process.env.REPLICATE_API_TOKEN?.trim();
    return token ? `Bearer ${token}` : undefined;
  }
  const apiKey = process.env.XAI_API_KEY?.trim();
  return apiKey ? `Bearer ${apiKey}` : undefined;
}

export const Route = createFileRoute("/api/media")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const params = new URL(request.url).searchParams;
        const target = params.get("url");
        if (!target) return new Response("Missing url", { status: 400 });
        let parsed: URL;
        try {
          parsed = new URL(target);
        } catch {
          return new Response("Bad url", { status: 400 });
        }
        if (parsed.protocol !== "https:" || !isAllowedHost(parsed.hostname)) {
          return new Response("Forbidden", { status: 403 });
        }

        const auth = isFalHost(parsed.hostname) ? undefined : authHeader(parsed.hostname);
        const upstream = await fetch(parsed.toString(), {
          headers: auth ? { Authorization: auth } : undefined,
        });
        if (!upstream.ok || !upstream.body) {
          return new Response("Upstream error", { status: upstream.status || 502 });
        }

        const headers = new Headers();
        headers.set(
          "content-type",
          upstream.headers.get("content-type") ?? "application/octet-stream",
        );
        headers.set("cache-control", "private, max-age=3600");
        if (params.get("download")) {
          const filename = safeFilename(params.get("filename") ?? "imagine");
          headers.set("content-disposition", `attachment; filename="${filename}"`);
        }
        return new Response(upstream.body, { status: 200, headers });
      },
    },
  },
});
