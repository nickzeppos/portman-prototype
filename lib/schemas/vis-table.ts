import { z } from 'zod';

// Mirrors the shape returned by lep-admin-mini's GET /vis/table?congress=N
// (see ../../cel/lep-admin-mini/src/db/schemas/vis-table.schema.ts).
//
// CEL effectiveness fields (les / benchmark / partyRank / partyTotal / iles)
// are preserved verbatim in our committed raw JSON so a future migration
// can use them — and especially the presence/absence pattern — as inputs to
// real Portman score generation.
export const VisTableRowSchema = z.object({
  congress: z.number().int(),
  chamber: z.string(),
  state: z.string(),
  bioguide: z.string(),
  name: z.string(),
  party: z.string(),
  district: z.number().int().nullable(),

  les: z.number().nullable().optional(),
  benchmark: z.number().nullable().optional(),
  partyRank: z.number().nullable().optional(),
  partyTotal: z.number().nullable().optional(),
  iles: z.record(z.string(), z.number().nullable()).optional(),
});
export type VisTableRow = z.infer<typeof VisTableRowSchema>;

export const VisTableResponseSchema = z.object({
  congress: z.number().int(),
  availableIssues: z.array(z.string()),
  data: z.array(VisTableRowSchema),
});
export type VisTableResponse = z.infer<typeof VisTableResponseSchema>;

export const CongressListSchema = z.array(z.number().int());
export type CongressList = z.infer<typeof CongressListSchema>;
