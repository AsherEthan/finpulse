import { z } from "zod";
import { CONTENT_NATURES, SOURCE_DIMENSIONS, VERIFICATION_STATUSES, type InformationProfile, type SourceDimension } from "@aihot/contracts/site";

/** Stored only by an explicit audited review, bound to the exact original revision. */
export const InformationProfileSchema = z.object({
  contentNature: z.enum(CONTENT_NATURES),
  verificationStatus: z.enum(VERIFICATION_STATUSES),
  sourceRevision: z.number().int().positive(),
  checkedAt: z.string().datetime({ offset: true }).optional(),
}).strict();

export function sourceDimension(value: unknown, firstParty: boolean): SourceDimension {
  return typeof value === "string" && SOURCE_DIMENSIONS.includes(value as SourceDimension)
    ? value as SourceDimension : firstParty ? "original" : "secondary";
}

export function informationProfile(value: unknown): InformationProfile | null {
  const parsed = InformationProfileSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Never expose raw fields, actors or an old original's check as a check of its new revision. */
export function publicInformationProfile(value: unknown, revision: number): InformationProfile | null {
  const profile = informationProfile(value);
  if (!profile) return null;
  return profile.sourceRevision === revision ? profile : {
    contentNature: "unknown", verificationStatus: "pending", sourceRevision: revision,
  };
}
