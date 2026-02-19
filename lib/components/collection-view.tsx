"use client"

import { useCallback, useEffect, useReducer, useRef } from "react"

import {
  addTweetToCollection,
  addUrlToCollection,
  deleteItem,
  getUploadUrl,
  saveImageToCollection,
  updateItemComment,
} from "@/lib/actions"
import { CollectionSidebar } from "@/lib/components/collection-sidebar"
import { ImageGrid } from "@/lib/components/image-grid"
import { getTweetData } from "@/lib/twitter"
import type { ImageItem } from "@/lib/types"

function getNormalizedHttpUrl(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) {
    return null
  }

  const maybeUrl = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`

  try {
    const parsed = new URL(maybeUrl)
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null
    }

    if (!parsed.hostname.includes(".")) {
      return null
    }

    return parsed.toString()
  } catch {
    return null
  }
}

type UploadingState = {
  type: "image" | "tweet" | "url"
  title: string
  tempId: string
} | null

type CollectionViewProps = {
  collectionName: string
  items: ImageItem[]
}

type State = {
  items: ImageItem[]
  selectedId: string | null
  zoomedId: string | null
  autoFocusComment: boolean
  uploadingState: UploadingState
  pendingDeletions: ImageItem[]
  newlyUploadedId: string | null
}

type Action =
  | { type: "SELECT"; id: string | null }
  | { type: "ZOOM"; id: string | null }
  | { type: "START_UPLOAD"; uploadingState: UploadingState; tempId: string }
  | { type: "UPLOAD_SUCCESS"; item: ImageItem }
  | { type: "UPLOAD_FAIL" }
  | { type: "CANCEL_UPLOAD" }
  | { type: "DELETE_ITEM"; item: ImageItem }
  | { type: "UNDO_DELETE"; item: ImageItem }
  | { type: "CONFIRM_DELETE"; id: string }
  | { type: "RESTORE_ITEM"; item: ImageItem; id: string }
  | { type: "UPDATE_COMMENT"; id: string; comment: string }
  | { type: "AUTO_FOCUS_HANDLED" }
  | { type: "COMMENT_DONE"; id: string }
  | { type: "COMMENT_CANCEL" }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SELECT":
      return { ...state, selectedId: action.id }
    case "ZOOM":
      return { ...state, zoomedId: action.id }
    case "START_UPLOAD":
      return {
        ...state,
        uploadingState: action.uploadingState,
        selectedId: action.tempId,
      }
    case "UPLOAD_SUCCESS":
      return {
        ...state,
        items: [action.item, ...state.items],
        selectedId: action.item.id,
        newlyUploadedId: action.item.id,
        uploadingState: null,
        autoFocusComment: true,
      }
    case "UPLOAD_FAIL":
      return {
        ...state,
        uploadingState: null,
        selectedId: null,
      }
    case "CANCEL_UPLOAD":
      return {
        ...state,
        uploadingState: null,
        selectedId: null,
      }
    case "DELETE_ITEM":
      return {
        ...state,
        selectedId: null,
        items: state.items.filter((item) => item.id !== action.item.id),
        pendingDeletions: [action.item, ...state.pendingDeletions],
      }
    case "UNDO_DELETE":
      return {
        ...state,
        items: [action.item, ...state.items],
        pendingDeletions: state.pendingDeletions.filter((item) => item.id !== action.item.id),
      }
    case "CONFIRM_DELETE":
      return {
        ...state,
        pendingDeletions: state.pendingDeletions.filter((item) => item.id !== action.id),
      }
    case "RESTORE_ITEM":
      return {
        ...state,
        items: [action.item, ...state.items],
        pendingDeletions: state.pendingDeletions.filter((item) => item.id !== action.id),
      }
    case "UPDATE_COMMENT":
      return {
        ...state,
        items: state.items.map((item) =>
          item.id === action.id ? { ...item, comment: action.comment } : item
        ),
      }
    case "AUTO_FOCUS_HANDLED":
      if (!state.autoFocusComment) {
        return state
      }
      return { ...state, autoFocusComment: false }
    case "COMMENT_DONE":
      return {
        ...state,
        newlyUploadedId: state.newlyUploadedId === action.id ? null : state.newlyUploadedId,
        selectedId: state.newlyUploadedId === action.id ? null : state.selectedId,
      }
    case "COMMENT_CANCEL":
      return {
        ...state,
        newlyUploadedId:
          state.newlyUploadedId && state.selectedId === state.newlyUploadedId
            ? null
            : state.newlyUploadedId,
        selectedId:
          state.newlyUploadedId && state.selectedId === state.newlyUploadedId
            ? null
            : state.selectedId,
      }
    default:
      return state
  }
}

export function CollectionView({ collectionName, items: initialItems }: CollectionViewProps) {
  const [state, dispatch] = useReducer(reducer, {
    items: initialItems,
    selectedId: null,
    zoomedId: null,
    autoFocusComment: false,
    uploadingState: null,
    pendingDeletions: [],
    newlyUploadedId: null,
  })

  const { items, selectedId, zoomedId, autoFocusComment, uploadingState, pendingDeletions } = state
  const deleteTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())
  const selectedItem = items.find((item) => item.id === selectedId) ?? null

  const uploadImageFile = useCallback(
    async (file: File) => {
      const tempId = `temp-${Date.now()}`
      dispatch({
        type: "START_UPLOAD",
        uploadingState: { type: "image", title: file.name, tempId },
        tempId,
      })

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
          console.error(`Upload failed: ${uploadResponse.status}`)
          dispatch({ type: "UPLOAD_FAIL" })
          return
        }

        const newItem = await saveImageToCollection(collectionName, publicUrl, file.name)
        dispatch({ type: "UPLOAD_SUCCESS", item: newItem })
      } catch (err) {
        console.error("Failed to upload image:", err)
        dispatch({ type: "UPLOAD_FAIL" })
      }
    },
    [collectionName]
  )

  const handleCommentChange = async (id: string, comment: string) => {
    dispatch({ type: "UPDATE_COMMENT", id, comment })

    const wasNewlyUploaded = state.newlyUploadedId === id
    if (wasNewlyUploaded) {
      dispatch({ type: "COMMENT_DONE", id })
    }

    try {
      await updateItemComment(id, collectionName, comment)
    } catch (err) {
      console.error("Failed to save comment:", err)
      const originalItem = initialItems.find((item) => item.id === id)
      if (originalItem) {
        dispatch({ type: "UPDATE_COMMENT", id, comment: originalItem.comment ?? "" })
      }
    }
  }

  const handleCommentCancel = () => {
    dispatch({ type: "COMMENT_CANCEL" })
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !(e.target instanceof HTMLInputElement)) {
        if (zoomedId) {
          dispatch({ type: "ZOOM", id: null })
        } else {
          dispatch({ type: "SELECT", id: null })
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [zoomedId])

  useEffect(() => {
    const handleUndo = (e: KeyboardEvent) => {
      const latestPending = pendingDeletions[pendingDeletions.length - 1]

      if ((e.metaKey || e.ctrlKey) && e.key === "z" && latestPending) {
        e.preventDefault()

        const timer = deleteTimeoutsRef.current.get(latestPending.id)
        if (timer) {
          clearTimeout(timer)
          deleteTimeoutsRef.current.delete(latestPending.id)
        }

        dispatch({ type: "UNDO_DELETE", item: latestPending })
        console.log(`[UNDO] Restored item ${latestPending.id}`)
      }
    }
    window.addEventListener("keydown", handleUndo)
    return () => window.removeEventListener("keydown", handleUndo)
  }, [pendingDeletions])

  useEffect(() => {
    return () => {
      for (const timer of deleteTimeoutsRef.current.values()) {
        clearTimeout(timer)
      }
      deleteTimeoutsRef.current.clear()
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

      const normalizedUrl = getNormalizedHttpUrl(text)
      if (!normalizedUrl) return

      const isTwitterUrl = /(?:twitter\.com|x\.com)\/\w+\/status\/\d+/.test(normalizedUrl)

      if (!isTwitterUrl) {
        const tempId = `temp-${Date.now()}`
        dispatch({
          type: "START_UPLOAD",
          uploadingState: { type: "url", title: normalizedUrl.slice(0, 50), tempId },
          tempId,
        })

        try {
          const newItem = await addUrlToCollection(collectionName, normalizedUrl)
          dispatch({ type: "UPLOAD_SUCCESS", item: newItem })
        } catch (err) {
          console.error("Failed to fetch URL metadata:", err)
          dispatch({ type: "UPLOAD_FAIL" })
        }
        return
      }

      const tempId = `temp-${Date.now()}`
      dispatch({
        type: "START_UPLOAD",
        uploadingState: { type: "tweet", title: normalizedUrl.slice(0, 50), tempId },
        tempId,
      })

      try {
        const tweet = await getTweetData(normalizedUrl)
        if (!tweet) {
          console.log("Tweet not found")
          dispatch({ type: "UPLOAD_FAIL" })
          return
        }

        const firstImage = tweet.imageUrls[0]
        const imageUrl = firstImage !== undefined ? firstImage : tweet.author.profileImageUrl
        const newItem = await addTweetToCollection(
          collectionName,
          normalizedUrl,
          imageUrl,
          tweet.author.name,
          tweet.text.slice(0, 100)
        )
        dispatch({ type: "UPLOAD_SUCCESS", item: newItem })
      } catch (err) {
        console.error("Failed to fetch tweet:", err)
        dispatch({ type: "UPLOAD_FAIL" })
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
    dispatch({ type: "CANCEL_UPLOAD" })
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
                dispatch({ type: "DELETE_ITEM", item: itemToDelete })

                const timeout = setTimeout(async () => {
                  try {
                    await deleteItem(idToDelete, collectionName)
                    dispatch({ type: "CONFIRM_DELETE", id: idToDelete })
                  } catch (err) {
                    console.error("Failed to delete item:", err)
                    dispatch({ type: "RESTORE_ITEM", item: itemToDelete, id: idToDelete })
                  }

                  deleteTimeoutsRef.current.delete(idToDelete)
                }, 3000)

                deleteTimeoutsRef.current.set(idToDelete, timeout)
              }
            : undefined
        }
        onCancelUpload={uploadingState ? handleCancelUpload : undefined}
        autoFocusComment={autoFocusComment}
        onAutoFocusHandled={() => dispatch({ type: "AUTO_FOCUS_HANDLED" })}
      />
      <div className="flex-1">
        <ImageGrid
          items={items}
          selectedId={selectedId}
          zoomedId={zoomedId}
          onSelect={(id) => dispatch({ type: "SELECT", id })}
          onZoom={(id) => dispatch({ type: "ZOOM", id })}
        />
      </div>
    </div>
  )
}
