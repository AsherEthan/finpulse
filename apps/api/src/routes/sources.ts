import type { FastifyInstance } from "fastify";
import { loadSourceCatalog } from "@aihot/backend/publication/sources";
import { sendJsonWithEtag } from "../http/respond.ts";

export function registerSources(app: FastifyInstance) {
  app.get("/api/site/sources", async (req, reply) => {
    const data = await loadSourceCatalog();
    return sendJsonWithEtag(req, reply, data, {
      etagPrefix: "sources", cacheControl: "public, max-age=30, s-maxage=30", etagOf: data.sources,
    });
  });
}
