"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"

import { Loader } from "lucide-react"
import {
  AnimatePresence,
  LazyMotion,
  type Variants,
  domAnimation,
  m,
  useReducedMotion,
} from "motion/react"

import type { ImageItem } from "@/lib/types"

type UploadingState = {
  type: "image" | "tweet" | "url"
  title: string
  tempId: string
} | null

const variants: Variants = {
  enter: {
    x: 20,
    opacity: 0,
  },
  center: {
    x: 0,
    opacity: 1,
  },
  exit: {
    x: -20,
    opacity: 0,
    scale: 0.98,
    transition: { duration: 0.075 },
  },
}

const reducedMotionVariants: Variants = {
  enter: {
    x: 0,
    opacity: 1,
  },
  center: {
    x: 0,
    opacity: 1,
  },
  exit: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: { duration: 0 },
  },
}

type CollectionSidebarProps = {
  collectionName: string
  itemCount: number
  selectedItem: ImageItem | null
  uploadingState?: UploadingState
  onCommentChange?: (comment: string) => void
  onCommentCancel?: () => void
  onDelete?: (immediate?: boolean) => void
  onCancelUpload?: () => void
  autoFocusComment?: boolean
  onAutoFocusHandled?: () => void
}

export function CollectionSidebar({
  collectionName,
  itemCount,
  selectedItem,
  uploadingState,
  onCommentChange,
  onCommentCancel,
  onDelete,
  onCancelUpload,
  autoFocusComment,
  onAutoFocusHandled,
}: CollectionSidebarProps) {
  const [isEditingComment, setIsEditingComment] = useState(false)
  const [editedComment, setEditedComment] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)
  const prefersReducedMotion = useReducedMotion()
  const prevSelectedIdRef = useRef<string | undefined>(selectedItem?.id)
  const autoFocusHandledIdRef = useRef<string | null>(null)

  useLayoutEffect(() => {
    if (!isEditingComment) return
    inputRef.current?.focus()
  }, [isEditingComment, selectedItem?.id])

  useEffect(() => {
    if (prevSelectedIdRef.current !== selectedItem?.id) {
      prevSelectedIdRef.current = selectedItem?.id
      if (isEditingComment) {
        setIsEditingComment(false)
      }
    }
  }, [selectedItem?.id, isEditingComment])

  useEffect(() => {
    if (!selectedItem || !autoFocusComment) return
    if (autoFocusHandledIdRef.current === selectedItem.id) return

    autoFocusHandledIdRef.current = selectedItem.id
    setEditedComment(selectedItem.comment || "")
    setIsEditingComment(true)
    onAutoFocusHandled?.()
  }, [autoFocusComment, selectedItem?.id])

  const startEditing = (comment: string) => {
    setEditedComment(comment)
    setIsEditingComment(true)
  }

  const handleCommentClick = (e: React.MouseEvent) => {
    // IMPORTANT: Keep `preventDefault()` here.
    // We intentionally open comment editing from `onMouseDown` (project-wide UX choice
    // for snappier interactions). Without preventing the default mousedown behavior,
    // the browser performs an immediate focus transition that can trigger the input's
    // `onBlur` right after it mounts. In this component, blur saves + exits edit mode,
    // so removing this line causes the classic "input flashes for a split second and
    // collapses back" bug for both empty and existing comments.
    //
    // Symptom if removed/regressed:
    // 1) Click "Add comment..." or an existing comment.
    // 2) Input appears briefly, then instantly reverts to read mode.
    //
    // If this area is refactored, preserve the invariant:
    // entering edit mode must not trigger an immediate blur in the same pointer cycle.
    e.preventDefault()
    e.stopPropagation()
    startEditing(selectedItem?.comment || "")
  }

  const handleCommentSave = () => {
    onCommentChange?.(editedComment)
    setIsEditingComment(false)
  }

  const handleDeleteMouseDown = (e: React.MouseEvent<HTMLButtonElement>) => {
    onDelete?.(e.shiftKey)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleCommentSave()
    } else if (e.key === "Escape") {
      setIsEditingComment(false)
      onCommentCancel?.()
    }
  }

  const isUploading = !!uploadingState
  const showUploadingPane = isUploading && !selectedItem
  const activeVariants = prefersReducedMotion ? reducedMotionVariants : variants

  return (
    <LazyMotion features={domAnimation}>
      <div className="w-full md:w-[240px] shrink-0 md:sticky md:top-24 h-fit">
        <AnimatePresence mode="popLayout" custom={1} initial={false}>
          {showUploadingPane ? (
            <m.div
              key="uploading"
              custom={1}
              variants={activeVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2 text-[16px] font-medium">
                  <Loader className="h-4 w-4 animate-spin" />
                  <span>Uploading {uploadingState.type === "url" ? "URL" : uploadingState.type}</span>
                </div>
                <p className="text-[12px] text-muted-foreground/50">
                  {new Date().toLocaleDateString("en-GB")}
                </p>
                <button
                  type="button"
                  onMouseDown={onCancelUpload}
                  className="text-[12px] text-muted-foreground/50 text-left bg-transparent border-none p-0 w-fit hover:underline hover:text-red-400/70 transition-colors duration-150 cursor-pointer"
                  aria-label="Cancel upload"
                >
                  Cancel
                </button>
              </div>
            </m.div>
          ) : selectedItem ? (
            <m.div
              key={selectedItem.id}
              custom={1}
              variants={activeVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-2">
                <h2 className="text-[16px] font-medium">{selectedItem.title}</h2>
                {isEditingComment ? (
                  <input
                    ref={inputRef}
                    type="text"
                    value={editedComment}
                    onChange={(e) => setEditedComment(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={handleCommentSave}
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    className="text-[14px] text-muted-foreground/70 bg-transparent border-none outline-none p-0 m-0 w-full"
                  />
                ) : selectedItem.comment ? (
                  <button
                    type="button"
                    onMouseDown={handleCommentClick}
                    className="text-[14px] text-muted-foreground/70 cursor-text text-left bg-transparent border-none p-0"
                    aria-label="Edit comment"
                  >
                    {selectedItem.comment}
                  </button>
                ) : (
                  <button
                    type="button"
                    onMouseDown={handleCommentClick}
                    className="text-[14px] text-muted-foreground/40 cursor-text italic text-left bg-transparent border-none p-0"
                    aria-label="Add comment"
                  >
                    Add comment...
                  </button>
                )}
                <p className="text-[12px] text-muted-foreground/50">{selectedItem.dateCreated}</p>
                <button
                  type="button"
                  onMouseDown={handleDeleteMouseDown}
                  className="text-[12px] text-muted-foreground/50 text-left bg-transparent border-none p-0 w-fit hover:underline hover:text-red-400/70 transition-colors duration-150 cursor-pointer"
                  aria-label="Delete item"
                >
                  Delete
                </button>
              </div>
            </m.div>
          ) : (
            <m.div
              key="collection-info"
              custom={1}
              variants={activeVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-2">
                <h2 className="text-[16px] font-medium capitalize">{collectionName}</h2>
                <p className="text-[14px] text-muted-foreground/70">
                  {itemCount} {itemCount === 1 ? "item" : "items"}
                </p>
                <p className="text-[12px] text-muted-foreground/50 leading- mt-1">
                  Click an item to view details then
                  <br /> press again to zoom in and{" "}
                  <span className="text-[10px] font-inter font-medium border-shadow leading-none px-[3px] pt-[1.75px] pb-[1.5px] ml-px rounded-[3px]">
                    ESC
                  </span>{" "}
                  <br /> to de-select.
                </p>
              </div>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </LazyMotion>
  )
}
