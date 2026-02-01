"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import {
  addTweetToCollection,
  deleteItem,
  getUploadUrl,
  saveImageToCollection,
  updateItemComment,
} from "@/lib/actions"
import { CollectionSidebar } from "@/lib/components/collection-sidebar"
import { ImageGrid } from "@/lib/components/image-grid"
import { getTweetData } from "@/lib/twitter"
import type { ImageItem } from "@/lib/types"

type UploadingState = {
  type: "image" | "tweet" | "url"
  title: string
  tempId: string
} | null

type CollectionViewProps = {
  collectionName: string
  items: ImageItem[]
}

export function CollectionView({ collectionName, items: initialItems }: CollectionViewProps) {
  const [items, setItems] = useState<ImageItem[]>(initialItems)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zoomedId, setZoomedId] = useState<string | null>(null)
  const [autoFocusComment, setAutoFocusComment] = useState(false)
  const [uploadingState, setUploadingState] = useState<UploadingState>(null)
  const [pendingDeletion, setPendingDeletion] = useState<ImageItem | null>(null)
  const [newlyUploadedId, setNewlyUploadedId] = useState<string | null>(null)
  const deleteTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const selectedItem = items.find((item) => item.id === selectedId) ?? null

  const uploadImageFile = useCallback(
    async (file: File) => {
      const tempId = `temp-${Date.now()}`
      setUploadingState({ type: "image", title: file.name, tempId })
      setSelectedId(tempId)

      try {
        const { uploadUrl, publicUrl } = await getUploadUrl(file.name, file.type)

        const headers: HeadersInit = {}
        if (file.type) {
          headers["Content-Type"] = file.type
        }

        const uploadResponse = await fetch(uploadUrl, {
          method: "PUT",
          body: file,
          headers,
        })

        if (!uploadResponse.ok) {
          throw new Error(`Upload failed: ${uploadResponse.status}`)
        }

        const newItem = await saveImageToCollection(collectionName, publicUrl, file.name)

        setItems((prev) => [newItem, ...prev])
        setSelectedId(newItem.id)
        setNewlyUploadedId(newItem.id)
        setUploadingState(null)
        setAutoFocusComment(true)
      } catch (err) {
        console.error("Failed to upload image:", err)
        setUploadingState(null)
        setSelectedId(null)
      }
    },
    [collectionName]
  )

  const handleCommentChange = async (id: string, comment: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, comment } : item)))

    const wasNewlyUploaded = newlyUploadedId === id
    if (wasNewlyUploaded) {
      setNewlyUploadedId(null)
      setSelectedId(null)
    }

    try {
      await updateItemComment(id, collectionName, comment)
    } catch (err) {
      console.error("Failed to save comment:", err)
      const originalItem = initialItems.find((item) => item.id === id)
      if (originalItem) {
        setItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, comment: originalItem.comment } : item))
        )
      }
    }
  }

  const handleCommentCancel = () => {
    if (newlyUploadedId && selectedId === newlyUploadedId) {
      setNewlyUploadedId(null)
      setSelectedId(null)
    }
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
    const handleUndo = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "z" && pendingDeletion) {
        e.preventDefault()
        if (deleteTimeoutRef.current) {
          clearTimeout(deleteTimeoutRef.current)
          deleteTimeoutRef.current = null
        }
        setItems((prev) => [pendingDeletion, ...prev])
        setPendingDeletion(null)
        console.log(`[UNDO] Restored item ${pendingDeletion.id}`)
      }
    }
    window.addEventListener("keydown", handleUndo)
    return () => window.removeEventListener("keydown", handleUndo)
  }, [pendingDeletion])

  useEffect(() => {
    return () => {
      if (deleteTimeoutRef.current) {
        clearTimeout(deleteTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      if (uploadingState) return

      const files = e.clipboardData?.files
      if (files && files.length > 0) {
        const file = files[0]
        if (file.type.startsWith("image/")) {
          uploadImageFile(file)
          return
        }
      }

      const text = e.clipboardData?.getData("text")
      if (!text) return

      const isTwitterUrl = /(?:twitter\.com|x\.com)\/\w+\/status\/\d+/.test(text)
      if (!isTwitterUrl) return

      const tempId = `temp-${Date.now()}`
      setUploadingState({ type: "tweet", title: text.slice(0, 50), tempId })
      setSelectedId(tempId)

      try {
        const tweet = await getTweetData(text)
        if (!tweet) {
          console.log("Tweet not found")
          setUploadingState(null)
          setSelectedId(null)
          return
        }

        const imageUrl = tweet.imageUrls[0] ?? tweet.author.profileImageUrl
        const newItem = await addTweetToCollection(
          collectionName,
          text,
          imageUrl,
          tweet.author.name,
          tweet.text.slice(0, 100)
        )

        setItems((prev) => [newItem, ...prev])
        setSelectedId(newItem.id)
        setNewlyUploadedId(newItem.id)
        setUploadingState(null)
        setAutoFocusComment(true)
      } catch (err) {
        console.error("Failed to fetch tweet:", err)
        setUploadingState(null)
        setSelectedId(null)
      }
    }

    window.addEventListener("paste", handlePaste)
    return () => window.removeEventListener("paste", handlePaste)
  }, [collectionName, uploadingState, uploadImageFile])

  useEffect(() => {
    const handleDragOver = (e: DragEvent) => {
      e.preventDefault()
    }

    const handleDrop = (e: DragEvent) => {
      e.preventDefault()
      if (uploadingState) return

      const files = e.dataTransfer?.files
      if (files && files.length > 0) {
        const file = files[0]
        if (file.type.startsWith("image/")) {
          uploadImageFile(file)
        }
      }
    }

    window.addEventListener("dragover", handleDragOver)
    window.addEventListener("drop", handleDrop)
    return () => {
      window.removeEventListener("dragover", handleDragOver)
      window.removeEventListener("drop", handleDrop)
    }
  }, [uploadingState, uploadImageFile])

  const handleCancelUpload = () => {
    setUploadingState(null)
    setSelectedId(null)
  }

  return (
    <div className="flex flex-col md:flex-row gap-8">
      <CollectionSidebar
        collectionName={collectionName}
        itemCount={items.length}
        selectedItem={selectedItem}
        uploadingState={uploadingState}
        onCommentChange={
          selectedId ? (comment) => handleCommentChange(selectedId, comment) : undefined
        }
        onCommentCancel={handleCommentCancel}
        onDelete={
          selectedId && !uploadingState
            ? () => {
                const itemToDelete = items.find((item) => item.id === selectedId)
                if (!itemToDelete) return

                const idToDelete = selectedId
                setSelectedId(null)
                setItems((prev) => prev.filter((item) => item.id !== idToDelete))
                setPendingDeletion(itemToDelete)

                if (deleteTimeoutRef.current) {
                  clearTimeout(deleteTimeoutRef.current)
                }

                deleteTimeoutRef.current = setTimeout(async () => {
                  try {
                    await deleteItem(idToDelete, collectionName)
                    setPendingDeletion(null)
                  } catch (err) {
                    console.error("Failed to delete item:", err)
                    setItems((prev) => [itemToDelete, ...prev])
                    setPendingDeletion(null)
                  }
                  deleteTimeoutRef.current = null
                }, 4000)
              }
            : undefined
        }
        onCancelUpload={uploadingState ? handleCancelUpload : undefined}
        autoFocusComment={autoFocusComment}
        onAutoFocusHandled={() => setAutoFocusComment(false)}
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
