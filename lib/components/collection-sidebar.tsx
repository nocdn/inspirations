"use client"

import { useEffect, useLayoutEffect, useRef, useState } from "react"

import { CornerDownRight, Loader, Plus } from "lucide-react"
import {
  AnimatePresence,
  LazyMotion,
  type Variants,
  domAnimation,
  m,
  useReducedMotion,
} from "motion/react"

import { isValidCollection, VALID_COLLECTIONS } from "@/lib/collection-config"
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
  onTitleChange?: (title: string) => void
  onCommentChange?: (comment: string) => void
  onCommentCancel?: () => void
  onDelete?: (immediate?: boolean) => void
  onCancelUpload?: () => void
  autoFocusComment?: boolean
  onAutoFocusHandled?: () => void
  onAddCollection?: (collection: string) => void
  onRemoveCollection?: (collection: string) => void
}

export function CollectionSidebar({
  collectionName,
  itemCount,
  selectedItem,
  uploadingState,
  onTitleChange,
  onCommentChange,
  onCommentCancel,
  onDelete,
  onCancelUpload,
  autoFocusComment,
  onAutoFocusHandled,
  onAddCollection,
  onRemoveCollection,
}: CollectionSidebarProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const [editedTitle, setEditedTitle] = useState("")
  const [isEditingComment, setIsEditingComment] = useState(false)
  const [editedComment, setEditedComment] = useState("")
  const [isAddingCollection, setIsAddingCollection] = useState(false)
  const [newCollectionName, setNewCollectionName] = useState("")
  const [invalidCollection, setInvalidCollection] = useState(false)
  const [focusedSuggestionIndex, _setFocusedSuggestionIndex] = useState(-1)
  const focusedSuggestionIndexRef = useRef(-1)
  const setFocusedSuggestionIndex = (v: number | ((prev: number) => number)) => {
    _setFocusedSuggestionIndex((prev) => {
      const next = typeof v === "function" ? v(prev) : v
      focusedSuggestionIndexRef.current = next
      return next
    })
  }
  const invalidTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const commentRef = useRef<HTMLTextAreaElement>(null)
  const addCollectionRef = useRef<HTMLInputElement>(null)
  const tabTransitionRef = useRef(false)
  const prefersReducedMotion = useReducedMotion()
  const prevSelectedIdRef = useRef<string | undefined>(selectedItem?.id)
  const autoFocusHandledIdRef = useRef<string | null>(null)

  useEffect(() => {
    return () => {
      if (invalidTimerRef.current) clearTimeout(invalidTimerRef.current)
    }
  }, [])

  useLayoutEffect(() => {
    if (!isEditingTitle || !titleRef.current) return
    const el = titleRef.current
    el.focus()
    el.selectionStart = el.selectionEnd = el.value.length
  }, [isEditingTitle, selectedItem?.id])

  useLayoutEffect(() => {
    if (!isEditingComment || !commentRef.current) return
    const el = commentRef.current
    el.focus()
    el.selectionStart = el.selectionEnd = el.value.length
  }, [isEditingComment, selectedItem?.id])

  useLayoutEffect(() => {
    if (!isAddingCollection || !addCollectionRef.current) return
    addCollectionRef.current.focus()
  }, [isAddingCollection, selectedItem?.id])

  useEffect(() => {
    if (prevSelectedIdRef.current !== selectedItem?.id) {
      prevSelectedIdRef.current = selectedItem?.id
      if (isEditingTitle) setIsEditingTitle(false)
      if (isEditingComment) setIsEditingComment(false)
      if (isAddingCollection) setIsAddingCollection(false)
    }
  }, [selectedItem?.id, isEditingTitle, isEditingComment, isAddingCollection])

  useEffect(() => {
    if (!selectedItem || !autoFocusComment) return
    if (autoFocusHandledIdRef.current === selectedItem.id) return

    autoFocusHandledIdRef.current = selectedItem.id
    setEditedComment(selectedItem.comment || "")
    setIsEditingComment(true)
    onAutoFocusHandled?.()
  }, [autoFocusComment, selectedItem?.id])

  const handleTitleClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setEditedTitle(selectedItem?.title || "")
    setIsEditingTitle(true)
  }

  const handleTitleSave = () => {
    onTitleChange?.(editedTitle)
    setIsEditingTitle(false)
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleTitleSave()
    } else if (e.key === "Escape") {
      e.stopPropagation()
      setIsEditingTitle(false)
    }
  }

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleCommentSave()
    } else if (e.key === "Tab") {
      e.preventDefault()
      tabTransitionRef.current = true
      handleCommentSave()
      setIsAddingCollection(true)
    } else if (e.key === "Escape") {
      e.stopPropagation()
      setIsEditingComment(false)
    }
  }

  const isUploading = !!uploadingState
  const showUploadingPane = isUploading && !selectedItem
  const activeVariants = prefersReducedMotion ? reducedMotionVariants : variants

  return (
    <LazyMotion features={domAnimation}>
      <div className="w-full md:w-[240px] shrink-0 md:sticky md:top-24 md:self-start h-fit">
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
                  <span>
                    Uploading {uploadingState.type === "url" ? "URL" : uploadingState.type}
                  </span>
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
                {isEditingTitle ? (
                  <textarea
                    ref={titleRef}
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onKeyDown={handleTitleKeyDown}
                    onBlur={() => setIsEditingTitle(false)}
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    className="text-[16px] font-medium text-foreground bg-transparent border-none outline-none p-0 m-0 w-full resize-none [field-sizing:content]"
                  />
                ) : (
                  <button
                    type="button"
                    onMouseDown={handleTitleClick}
                    className="text-[16px] font-medium cursor-text text-left bg-transparent border-none p-0"
                    aria-label="Edit title"
                  >
                    {selectedItem.title}
                  </button>
                )}
                {isEditingComment ? (
                  <textarea
                    ref={commentRef}
                    value={editedComment}
                    onChange={(e) => setEditedComment(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onBlur={() => {
                      if (tabTransitionRef.current) {
                        tabTransitionRef.current = false
                        return
                      }
                      setIsEditingComment(false)
                      onCommentCancel?.()
                    }}
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck="false"
                    className="text-[14px] text-foreground bg-transparent border-none outline-none p-0 m-0 w-full resize-none [field-sizing:content]"
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
                  className="text-[12px] text-muted-foreground/50 text-left bg-transparent border-none p-0 w-fit hover:underline hover:text-red-400/70 transition-colors duration-150 cursor-pointer mb-6"
                  aria-label="Remove from collection"
                >
                  Delete
                </button>
              </div>
              <div className="flex flex-col gap-1.5">
                <h3 className="text-[16px] font-medium">Collections</h3>
                <div className="flex flex-col gap-1">
                  {selectedItem.collections.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        onRemoveCollection?.(col)
                      }}
                      className="text-[13px] text-muted-foreground/70 text-left bg-transparent border-none p-0 w-fit hover:line-through hover:text-red-400/70 capitalize cursor-pointer"
                    >
                      {col}
                    </button>
                  ))}
                  {isAddingCollection
                    ? (() => {
                        const query = newCollectionName.trim().toLowerCase()
                        const suggestions = query
                          ? VALID_COLLECTIONS.filter(
                              (c) => c.startsWith(query) && !selectedItem.collections.includes(c)
                            )
                          : []

                        const selectSuggestion = (name: string) => {
                          onAddCollection?.(name)
                          setNewCollectionName("")
                          setFocusedSuggestionIndex(-1)
                          setIsAddingCollection(false)
                        }

                        return (
                          <>
                            <input
                              ref={addCollectionRef}
                              value={newCollectionName}
                              onChange={(e) => {
                                setNewCollectionName(e.target.value)
                                setFocusedSuggestionIndex(-1)
                              }}
                              onKeyDown={(e) => {
                                if (e.key === "ArrowDown" && suggestions.length > 0) {
                                  e.preventDefault()
                                  setFocusedSuggestionIndex((prev) =>
                                    prev < suggestions.length - 1 ? prev + 1 : prev
                                  )
                                  return
                                }
                                if (e.key === "ArrowUp" && suggestions.length > 0) {
                                  e.preventDefault()
                                  setFocusedSuggestionIndex((prev) => (prev > 0 ? prev - 1 : prev))
                                  return
                                }
                                if (
                                  (e.key === "Enter" || e.key === "Tab") &&
                                  focusedSuggestionIndex >= 0 &&
                                  suggestions[focusedSuggestionIndex]
                                ) {
                                  e.preventDefault()
                                  selectSuggestion(suggestions[focusedSuggestionIndex])
                                  return
                                }
                                if (e.key === "Enter" && query) {
                                  e.preventDefault()
                                  if (isValidCollection(query)) {
                                    selectSuggestion(query)
                                  } else {
                                    setNewCollectionName("")
                                    setInvalidCollection(true)
                                    if (invalidTimerRef.current)
                                      clearTimeout(invalidTimerRef.current)
                                    invalidTimerRef.current = setTimeout(
                                      () => setInvalidCollection(false),
                                      1000
                                    )
                                  }
                                  return
                                }
                                if (e.key === "Escape") {
                                  setIsAddingCollection(false)
                                  setNewCollectionName("")
                                  setFocusedSuggestionIndex(-1)
                                  setInvalidCollection(false)
                                }
                              }}
                              onBlur={() => {
                                setIsAddingCollection(false)
                                setNewCollectionName("")
                                setFocusedSuggestionIndex(-1)
                              }}
                              autoCorrect="off"
                              autoCapitalize="off"
                              spellCheck="false"
                              className="text-[13px] text-foreground bg-transparent border-none outline-none p-0 m-0 w-full placeholder:text-muted-foreground/40"
                              placeholder="Name..."
                            />
                            {suggestions.length > 0 && (
                              <div className="flex flex-col -translate-x-[1.5px]">
                                {suggestions.map((name, i) => (
                                  <button
                                    key={name}
                                    type="button"
                                    onMouseDown={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      selectSuggestion(name)
                                    }}
                                    className={`flex items-center gap-1.5 text-[13px] text-muted-foreground/70 text-left border-none p-0 pl-1 pr-1.5 py-0.5 rounded-sm cursor-pointer capitalize w-fit ${
                                      i === focusedSuggestionIndex ? "bg-muted" : ""
                                    }`}
                                  >
                                    <CornerDownRight className="size-3 shrink-0 text-muted-foreground/40" />
                                    <span>
                                      <span className="text-foreground/80">
                                        {name.slice(0, query.length)}
                                      </span>
                                      <span>{name.slice(query.length)}</span>
                                    </span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </>
                        )
                      })()
                    : null}
                  {invalidCollection && (
                    <span className="text-[12px] text-red-400/90 motion-opacity-out-0 motion-delay-700 motion-duration-150">
                      Invalid collection
                    </span>
                  )}
                  {!isAddingCollection && (
                    <button
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        setIsAddingCollection(true)
                      }}
                      className="text-[13px] text-gray-300 cursor-text text-left bg-transparent border-none p-0 flex items-center gap-2"
                    >
                      Add Another
                    </button>
                  )}
                </div>
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
