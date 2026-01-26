"use client"

import Image from "next/image"

import type { ImageItem } from "@/lib/types"

type ImageGridProps = {
  items: ImageItem[]
  selectedId: string | null
  onSelect: (id: string | null) => void
}

export function ImageGrid({ items, selectedId, onSelect }: ImageGridProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
      {items.map((item, index) => (
        <button
          key={item.id}
          onMouseDown={() => onSelect(selectedId === item.id ? null : item.id)}
          className={`flex flex-col gap-2 text-left transition-opacity cursor-pointer ${
            selectedId && selectedId !== item.id ? "opacity-50" : ""
          }`}
        >
          <div className="relative aspect-[4/3] overflow-hidden border-shadow">
            <Image
              src={item.imageUrl}
              alt={item.title}
              fill
              sizes="(max-width: 768px) 50vw, 25vw"
              className="object-cover"
            />
          </div>
          <span className="font-pp-supply-mono text-[12px] text-muted-foreground/60">
            {(index + 1).toString().padStart(2, "0")}
          </span>
        </button>
      ))}
    </div>
  )
}
