import { Link } from 'react-router-dom'

interface AppBarProps {
  backLabel: string
  backTo: string
  title: string
  subtitle?: string
}

/** The dark app bar every screen but Projects/Project uses (those get the
 * white logo bar instead — see ProjectListPage/ProjectPage). */
export function AppBar({ backLabel, backTo, title, subtitle }: AppBarProps) {
  return (
    <div className="bg-wr-blue-800 px-4 pb-4 pt-3.5 text-white">
      <Link to={backTo} className="inline-flex min-h-10 items-center font-body text-[13px] text-wr-taupe-200">
        ← {backLabel}
      </Link>
      <div className="mt-0.5 font-heading text-[22px] font-semibold leading-tight">{title}</div>
      {subtitle && <div className="mt-0.5 text-sm text-wr-blue-100">{subtitle}</div>}
    </div>
  )
}
