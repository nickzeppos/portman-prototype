// Crosswalk from CEL's PAP-derived issue slugs to human-readable display
// names. Ported from cel-vis/src/lib/display.ts; "Goverment Operations" typo
// fixed.
export const ISSUE_DISPLAY_NAMES = {
  agriculture: 'Agriculture',
  civilrights: 'Civil Rights and Liberties',
  commerce: 'Banking and Commerce',
  defense: 'Defense',
  education: 'Education',
  energy: 'Energy',
  environment: 'Environment',
  governmentops: 'Government Operations',
  health: 'Health',
  housing: 'Housing',
  immigration: 'Immigration',
  internationalaffairs: 'International Affairs',
  labor: 'Labor and Employment',
  lawcrime: 'Law, Crime, and Family',
  macro: 'Macroeconomics and Budget',
  nativeamericans: 'Native Americans',
  publiclands: 'Public Lands',
  technology: 'Science and Technology',
  trade: 'Foreign Trade',
  transportation: 'Transportation',
  welfare: 'Social Welfare',
} as const satisfies Record<string, string>;

export type IssueSlug = keyof typeof ISSUE_DISPLAY_NAMES;

export const ISSUE_SLUGS = Object.keys(ISSUE_DISPLAY_NAMES) as IssueSlug[];

export function getIssueDisplayName(slug: string): string {
  return slug in ISSUE_DISPLAY_NAMES
    ? ISSUE_DISPLAY_NAMES[slug as IssueSlug]
    : slug;
}
