// This component streams immediately on page load during server-side data fetches,
// preventing layout shift before the actual content arrives.

export default function Loading() {
  return (
    <div className="animate-pulse" aria-hidden role="status" aria-label="Loading">
      {/* Header zone */}
      <header className="border-b border-line px-6 pb-6 pt-8 md:px-10 md:pt-10">
        <div className="bg-fg/[0.06] rounded h-3 w-24"></div>
        <div className="mt-3 bg-fg/[0.06] rounded h-9 w-64 max-w-full"></div>
        <div className="mt-3 bg-fg/[0.06] rounded h-4 w-96 max-w-full"></div>
      </header>

      {/* Tiles strip */}
      <div className="grid grid-cols-1 gap-px border-b border-line bg-line sm:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="bg-bg px-6 py-6 md:px-10">
            <div className="bg-fg/[0.06] rounded h-3 w-28"></div>
            <div className="mt-3 bg-fg/[0.06] rounded h-8 w-36"></div>
          </div>
        ))}
      </div>

      {/* List zone */}
      <div className="px-6 py-8 md:px-10">
        <div className="bg-fg/[0.06] rounded h-3 w-32"></div>
        <ul className="divide-y divide-line border-y border-line mt-6">
          {[...Array(5)].map((_, i) => (
            <li key={i} className="flex items-center justify-between gap-6 px-2 py-4">
              <div>
                <div className="bg-fg/[0.06] rounded h-4 w-48 max-w-[60%]"></div>
                <div className="mt-2 bg-fg/[0.06] rounded h-3 w-32"></div>
              </div>
              <div className="bg-fg/[0.06] rounded-full h-6 w-20"></div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
