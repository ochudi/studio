/**
 * A project's lifecycle timestamps follow its status, one direction of
 * truth: setting the status stamps or clears the dates, never the reverse.
 */
export function statusTimestamps(status: string): {
  delivered_at?: string | null;
  closed_at?: string | null;
} {
  const now = new Date().toISOString();
  if (status === "delivered") return { delivered_at: now, closed_at: null };
  if (status === "closed" || status === "lost") return { closed_at: now };
  return { delivered_at: null, closed_at: null };
}
