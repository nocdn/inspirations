"use client"

import { useEffect, useState } from "react"

import { AnimatePresence, type Variants, motion } from "motion/react"

import type { ImageItem } from "@/lib/types"

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

type CollectionSidebarProps = {
  collectionName: string
  itemCount: number
  selectedItem: ImageItem | null
  onCommentChange?: (comment: string) => void
  autoFocusComment?: boolean
  onAutoFocusHandled?: () => void
}

export function CollectionSidebar({
  collectionName,
  itemCount,
  selectedItem,
  onCommentChange,
  autoFocusComment,
  onAutoFocusHandled,
}: CollectionSidebarProps) {
  const [isEditingComment, setIsEditingComment] = useState(false)
  const [editedComment, setEditedComment] = useState("")

  useEffect(() => {
    setIsEditingComment(false)
  }, [selectedItem?.id])

  useEffect(() => {
    if (autoFocusComment && selectedItem) {
      setEditedComment(selectedItem.comment || "")
      setIsEditingComment(true)
      onAutoFocusHandled?.()
    }
  }, [autoFocusComment, selectedItem, onAutoFocusHandled])

  const handleCommentClick = () => {
    setEditedComment(selectedItem?.comment || "")
    setIsEditingComment(true)
  }

  const handleCommentSave = () => {
    onCommentChange?.(editedComment)
    setIsEditingComment(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleCommentSave()
    } else if (e.key === "Escape") {
      setIsEditingComment(false)
    }
  }

  return (
    <div className="w-[240px] shrink-0 sticky top-24 h-fit">
      <AnimatePresence mode="popLayout" custom={1}>
        {selectedItem ? (
          <motion.div
            key={selectedItem.id}
            custom={1}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            className="flex flex-col gap-4"
          >
            {/* <div className="text-[12px] text-muted-foreground/60 font-pp-supply-mono">
              Item Details
            </div> */}
            <div className="flex flex-col gap-2">
              <h2 className="text-[16px] font-medium">{selectedItem.title}</h2>
              {isEditingComment ? (
                <input
                  type="text"
                  value={editedComment}
                  onChange={(e) => setEditedComment(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleCommentSave}
                  autoFocus
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck="false"
                  className="text-[14px] text-muted-foreground/70 bg-transparent border-none outline-none p-0 m-0 w-full"
                />
              ) : selectedItem.comment ? (
                <button
                  type="button"
                  onClick={handleCommentClick}
                  className="text-[14px] text-muted-foreground/70 cursor-text text-left bg-transparent border-none p-0"
                  aria-label="Edit comment"
                >
                  {selectedItem.comment}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCommentClick}
                  className="text-[14px] text-muted-foreground/40 cursor-text italic text-left bg-transparent border-none p-0"
                  aria-label="Add comment"
                >
                  Add comment...
                </button>
              )}
              <p className="text-[12px] text-muted-foreground/50">{selectedItem.dateCreated}</p>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="collection-info"
            custom={1}
            variants={variants}
            initial="enter"
            animate="center"
            exit="exit"
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <h2 className="text-[16px] font-medium capitalize">{collectionName}</h2>
              <p className="text-[14px] text-muted-foreground/70">{itemCount} items</p>
              <p className="text-[12px] text-muted-foreground/50 leading-">
                Click an item to view details
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
