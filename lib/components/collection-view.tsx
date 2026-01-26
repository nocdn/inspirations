"use client"

import { useEffect, useState } from "react"

import { CollectionSidebar } from "@/lib/components/collection-sidebar"
import { ImageGrid } from "@/lib/components/image-grid"
import type { ImageItem } from "@/lib/types"

type CollectionViewProps = {
  collectionName: string
  items: ImageItem[]
}

export function CollectionView({ collectionName, items }: CollectionViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selectedItem = items.find((item) => item.id === selectedId) ?? null

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedId(null)
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <div className="flex gap-12">
      <CollectionSidebar
        collectionName={collectionName}
        itemCount={items.length}
        selectedItem={selectedItem}
      />
      <div className="flex-1">
        <ImageGrid items={items} selectedId={selectedId} onSelect={setSelectedId} />
      </div>
    </div>
  )
}
