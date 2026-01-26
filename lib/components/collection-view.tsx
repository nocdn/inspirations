"use client"

import { useEffect, useState } from "react"

import { CollectionSidebar } from "@/lib/components/collection-sidebar"
import { ImageGrid } from "@/lib/components/image-grid"
import { getTweetData } from "@/lib/twitter"
import type { ImageItem } from "@/lib/types"

type CollectionViewProps = {
  collectionName: string
  items: ImageItem[]
}

export function CollectionView({ collectionName, items: initialItems }: CollectionViewProps) {
  const [items, setItems] = useState<ImageItem[]>(initialItems)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoomedId, setZoomedId] = useState<string | null>(null)
  const selectedItem = items.find((item) => item.id === selectedId) ?? null

  const handleCommentChange = (id: string, comment: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, comment } : item)))
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target instanceof HTMLInputElement)) {
        if (zoomedId) {
          setZoomedId(null)
        } else {
          setSelectedId(null)
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [zoomedId])

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      const files = e.clipboardData?.files
      if (files && files.length > 0) {
        const file = files[0]
        if (file.type.startsWith("image/")) {
          const objectUrl = URL.createObjectURL(file)
          const newItem: ImageItem = {
            id: `pasted-${Date.now()}`,
            imageUrl: objectUrl,
            title: file.name || "Pasted Image",
            dateCreated: new Date().toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            }),
          }
          setItems((prev) => [newItem, ...prev])
          return
        }
      }

      const text = e.clipboardData?.getData("text")
      if (!text) return

      const isTwitterUrl = /(?:twitter\.com|x\.com)\/\w+\/status\/\d+/.test(text)
      if (!isTwitterUrl) return

      console.log("Fetching tweet:", text)

      try {
        const tweet = await getTweetData(text)
        if (!tweet) {
          console.log("Tweet not found")
          return
        }

        console.log("Tweet text:", tweet.text)
        console.log("Image URLs:", tweet.imageUrls)

        const newItem: ImageItem = {
          id: `tweet-${Date.now()}`,
          imageUrl: tweet.imageUrls[0] ?? tweet.author.profileImageUrl,
          title: tweet.author.name,
          comment: tweet.text.slice(0, 100),
          dateCreated: new Date(tweet.createdAt).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
        }

        setItems((prev) => [newItem, ...prev])
      } catch (err) {
        console.error("Failed to fetch tweet:", err)
      }
    }

    window.addEventListener("paste", handlePaste)
    return () => window.removeEventListener("paste", handlePaste)
  }, [])

  return (
    <div className="flex gap-8">
      <CollectionSidebar
        collectionName={collectionName}
        itemCount={items.length}
        selectedItem={selectedItem}
        onCommentChange={
          selectedId ? (comment) => handleCommentChange(selectedId, comment) : undefined
        }
      />
      <div className="flex-1">
        <ImageGrid
          items={items}
          selectedId={selectedId}
          zoomedId={zoomedId}
          onSelect={setSelectedId}
          onZoom={setZoomedId}
        />
      </div>
    </div>
  )
}
