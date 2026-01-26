export default function Typography({ className }: { className?: string }) {
  return (
    <div className="translate-x-0.25">
      <span
        className={`text-[12px] text-[#BBB] font-[600] font-pp-neue-montreal tracking-widest ${className}`}
      >
        Aa
      </span>
    </div>
  )
}
