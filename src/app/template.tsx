/**
 * Route transition — CSS, not JS, so a hydration stall can never blank the
 * page. Remounts per navigation, replaying the `page-in` fade.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-in">{children}</div>;
}
