import type { FastifyInstance } from "fastify";
import { loadPolicySources } from "@aihot/backend/publication/policy-sources";
import { sendJsonWithEtag } from "../http/respond.ts";

export function registerPolicySources(app: FastifyInstance) {
  app.get("/api/site/policy-sources", async (req, reply) => {
    const data = await loadPolicySources();
    const { generatedAt: _, ...content } = data;
    return sendJsonWithEtag(req, reply, data, { etagPrefix: "policy-sources", cacheControl: "public, max-age=30, s-maxage=30", etagOf: content });
  });
}
