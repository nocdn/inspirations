import Link from "next/link"

import AnimationsSymbol from "@/app/symbols/animations"
import ComponentSymbol from "@/app/symbols/component"
import Typography from "@/app/symbols/typography"
import UncategorisedSymbol from "@/app/symbols/uncategorised"

type Row = {
  id: string
  collection: string
  count: number
  description: string
  displayComponent: React.ReactNode
}

const rows: Row[] = [
  {
    id: "1",
    collection: "typography",
    count: 17,
    description: "Fonts and typography studies.",
    displayComponent: <Typography />,
  },
  {
    id: "2",
    collection: "components",
    count: 8,
    description: "UI components and patterns.",
    displayComponent: <ComponentSymbol />,
  },
  {
    id: "3",
    collection: "animations",
    count: 25,
    description: "Ambitious animations and transitions.",
    displayComponent: <AnimationsSymbol className="text-[#BBB]" />,
  },
  {
    id: "0",
    collection: "uncategorized",
    count: 14,
    description: "Items not yet categorized.",
    displayComponent: <UncategorisedSymbol />,
  },
]

// Add rows for:
// - OpenGraph Images
// - Colours
// - Logos

export default function Table() {
  return (
    <div className="w-full max-w-[567px]">
      <table className="w-full text-[14px] border-collapse">
        <thead>
          <tr className="text-left border-b text-muted-foreground/60 ">
            <th className="py-2 pl-[3px] pr-4 font-[330] text-[13px]">#</th>
            <th className="py-2 pr-4 font-[330] text-[13px]">Collection</th>
            <th className="py-2 pr-[5px] font-[330] text-right text-[13px]">Count</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id} className="border-b">
              <td className="py-2 pl-[5px] pr-4 opacity-70">
                {row.collection !== "uncategorized" ? (
                  index + 1
                ) : (
                  <span className="text-[#a7a5a5]">0</span>
                )}
              </td>
              <td className="py-2 pr-4 flex gap-5 items-center">
                <div className="w-[40px] h-[30px] border-shadow rounded-lg supports-[corner-shape:squircle]:rounded-[30px] supports-[corner-shape:squircle]:[corner-shape:squircle] grid place-content-center">
                  {row.displayComponent}
                </div>
                <div className="flex flex-col gap-0.5 capitalize">
                  <Link
                    prefetch={true}
                    href={`/collections/${row.collection}`}
                    className="hover:underline decoration-dotted"
                  >
                    {row.collection}
                  </Link>
                  <div className="text-[12px] text-muted-foreground/60 font-[320]">
                    {row.description}
                  </div>
                </div>
              </td>
              <td className="py-2 pr-[5px] text-right tabular-nums">
                {row.count.toString().padStart(2, "0")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
