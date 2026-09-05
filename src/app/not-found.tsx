import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex h-full w-full items-center justify-center p-8">
      <div className="flex max-w-sm flex-col items-center text-center">
        <span className="tnum text-2xl font-semibold text-fg-subtle">404</span>
        <h2 className="mt-2 text-[13px] font-semibold text-fg">Page not found</h2>
        <p className="mt-1.5 text-[12px] text-fg-muted">
          That view does not exist in this app.
        </p>
        <Link
          href="/"
          className="mt-4 inline-flex h-7 items-center rounded-md border border-line bg-surface px-3 text-[12px] font-medium text-fg transition-colors hover:bg-sunken"
        >
          Back to Datasets
        </Link>
      </div>
    </div>
  )
}
