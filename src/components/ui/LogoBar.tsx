/** White letterhead-style bar at the top of the Projects and Project
 * screens — the only two screens that don't use the dark AppBar. */
export function LogoBar() {
  return (
    <div className="flex items-center justify-between border-b border-wr-taupe-200 bg-white px-4 pb-3 pt-[18px]">
      <img
        src={`${import.meta.env.BASE_URL}logo/wr-full-logo.png`}
        alt="Wiseman+Rohy"
        className="h-[22px] w-auto"
      />
      <span className="font-eyebrow text-[13px] font-semibold tracking-[0.14em] text-wr-brown-700 uppercase">
        Field Reports
      </span>
    </div>
  )
}
