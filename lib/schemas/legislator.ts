import { z } from 'zod';

// What the Portman app actually consumes. Identity/roster fields come from
// the CEL API; bipartisanship scores are SYNTHESIZED for now and will be
// replaced with real Portman scores later. The shape stays put when that
// happens — only the values change.

export const ChamberSchema = z.enum(['house', 'senate']);
export type Chamber = z.infer<typeof ChamberSchema>;

export const IssueScoresSchema = z.record(
  z.string(),
  z.object({
    attract: z.number().min(0).max(1),
    offer: z.number().min(0).max(1),
    // Per-issue sponsorship counts. Optional because they're absent for
    // legislators without LES (the legislator-level totals are also null in
    // that case). When present, each per-issue series sums exactly to the
    // legislator-level total — invariant enforced by the synthesizer.
    billsSponsored: z.number().int().optional(),
    billsCosponsored: z.number().int().optional(),
    outPartyCosponsored: z.number().int().optional(),
  }),
);
export type IssueScores = z.infer<typeof IssueScoresSchema>;

export const LegislatorSchema = z.object({
  congress: z.number().int(),
  chamber: ChamberSchema,
  state: z.string(),
  bioguide: z.string(),
  name: z.string(),
  party: z.string(),
  district: z.number().int().nullable(),  // null for senators

  // Null when the source roster had no LES for this legislator (e.g., partial
  // term, non-voting delegate). Missingness is preserved deliberately.
  attractScore: z.number().min(0).max(1).nullable(),
  offerScore: z.number().min(0).max(1).nullable(),

  // Sponsorship counts. billsSponsored counts only bills that picked up at
  // least one cosponsor (per slide 5 of inspo/Portman_Website.pptx). All
  // three are null whenever the scores are null, on the same hadLes signal.
  billsSponsored: z.number().int().nullable(),
  billsCosponsored: z.number().int().nullable(),
  outPartyCosponsored: z.number().int().nullable(),

  // Per-issue scores; only present for issues the source had iles values for.
  issueScores: IssueScoresSchema,
});
export type Legislator = z.infer<typeof LegislatorSchema>;

export const ScoresFileSchema = z.object({
  congress: z.number().int(),
  legislators: z.array(LegislatorSchema),
});
export type ScoresFile = z.infer<typeof ScoresFileSchema>;
