import Image from "next/image"
import Link from "next/link"

type Row = {
  id: string
  collection: string
  count: number
  description: string
  imageUrl: string
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function fetchRowsSimulated(): Promise<Row[]> {
  await delay(200) // simulate DB latency
  return [
    {
      id: "1",
      imageUrl: "https://picsum.photos/200/150?random=1",
      collection: "Typography",
      count: 17,
      description: "Fonts and typography studies.",
    },
    {
      id: "2",
      imageUrl: "https://picsum.photos/200/150?random=2",
      collection: "Components",
      count: 8,
      description: "UI components and patterns.",
    },
    {
      id: "3",
      imageUrl: "https://picsum.photos/200/150?random=3",
      collection: "Animations",
      count: 25,
      description: "Ambitious animations and transitions.",
    },
  ]
}

export default async function Table() {
  const rows = await fetchRowsSimulated()

  return (
    <div className="w-full max-w-[570px]">
      <table className="w-full text-[14px] border-collapse">
        <thead>
          <tr className="text-left border-b text-muted-foreground/60">
            <th className="py-2 pl-[5px] pr-4 font-[330] text-[13px]">#</th>
            <th className="py-2 pr-4 font-[330] text-[13px]">Collection</th>
            <th className="py-2 pr-[5px] font-[330] text-right text-[13px]">Count</th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row, index) => (
            <tr
              key={row.id}
              className="border-b motion-opacity-in-0"
              style={{ animationDelay: `${index * 0.05}s` }}
            >
              <td className="py-2 pl-[5px] pr-4">{index + 1}</td>
              <td className="py-2 pr-4 flex gap-5 items-center">
                <img src={row.imageUrl} alt={row.collection} className="w-[34px] h-[25.5px]" />
                <div className="flex flex-col gap-0.5">
                  <Link
                    href={`/collections/${row.id}`}
                    className="hover:underline decoration-dotted"
                  >
                    {row.collection}
                  </Link>
                  <div className="text-[12px] text-muted-foreground/60 font-[320]">
                    {row.description}
                  </div>
                </div>
              </td>
              <td className="py-2 pr-[5px] text-right">{row.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
