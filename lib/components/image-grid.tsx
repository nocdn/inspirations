"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import Image from "next/image"

import { AnimatePresence, motion } from "motion/react"

import type { ImageItem } from "@/lib/types"

type ImageGridProps = {
  items: ImageItem[]
  selectedId: string | null
  zoomedId: string | null
  onSelect: (id: string | null) => void
  onZoom: (id: string | null) => void
}

export function ImageGrid({ items, selectedId, zoomedId, onSelect, onZoom }: ImageGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const itemRefs = useRef<Map<string, HTMLButtonElement>>(new Map())
  const [topId, setTopId] = useState<string | null>(null)
  useEffect(() => {
    if (zoomedId) {
      setTopId(zoomedId)
    }
  }, [zoomedId])

  const getTranslation = useCallback((id: string) => {
    const element = itemRefs.current.get(id)
    if (!element) return { x: 0, y: 0 }

    const elementRect = element.getBoundingClientRect()

    const viewportCenterX = window.innerWidth / 2
    const viewportCenterY = window.innerHeight / 2
    const elementCenterX = elementRect.left + elementRect.width / 2
    const elementCenterY = elementRect.top + elementRect.height / 2

    return {
      x: viewportCenterX - elementCenterX,
      y: viewportCenterY - elementCenterY,
    }
  }, [])

  const handleItemClick = (item: ImageItem) => {
    if (zoomedId === item.id) {
      onZoom(null)
    } else if (selectedId === item.id) {
      onZoom(item.id)
    } else {
      onSelect(item.id)
    }
  }

  const handleBackdropClick = () => {
    if (zoomedId) {
      onZoom(null)
    }
  }

  return (
    <>
      <AnimatePresence>
        {zoomedId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onMouseDown={(e) => {
              e.stopPropagation()
              handleBackdropClick()
            }}
            className="fixed inset-0 bg-black/50 z-50"
          />
        )}
      </AnimatePresence>
      <div ref={containerRef} className="flex flex-wrap gap-6">
        {items.map((item, index) => {
          const isZoomed = zoomedId === item.id
          const translation = isZoomed ? getTranslation(item.id) : { x: 0, y: 0 }

          return (
            <motion.button
              key={item.id}
              ref={(el) => {
                if (el) itemRefs.current.set(item.id, el)
                else itemRefs.current.delete(item.id)
              }}
              onMouseDown={() => handleItemClick(item)}
              onAnimationComplete={() => {
                if (!isZoomed && topId === item.id) {
                  setTopId(null)
                }
              }}
              className={`flex flex-col gap-2 text-left transition-opacity cursor-pointer focus:outline-none motion-opacity-in-0 ${
                zoomedId && !isZoomed
                  ? "opacity-50"
                  : selectedId && selectedId !== item.id
                    ? "opacity-40"
                    : ""
              } ${topId === item.id ? "relative z-100" : "relative z-0"}`}
              style={{ animationDelay: `${index * 0.02}s` }}
              animate={{
                scale: isZoomed ? 2.5 : 1,
                x: translation.x,
                y: translation.y,
              }}
              transition={{ type: "spring", stiffness: 300, damping: 35 }}
            >
              <div className="relative border-shadow">
                <Image
                  src={item.imageUrl}
                  alt={item.title}
                  width={300}
                  height={300}
                  className="h-auto w-auto max-h-[150px]"
                  unoptimized
                />
                <AnimatePresence>
                  {isZoomed && (
                    <>
                      <motion.div
                        initial={{ opacity: 0, scale: 0.3, x: -20 }}
                        animate={{ opacity: 1, scale: 0.4, x: 0 }}
                        exit={{ opacity: 0, scale: 0.3, x: -20 }}
                        transition={{ type: "spring", stiffness: 300, damping: 35 }}
                        style={{ willChange: "transform, opacity", fontFamily: "SF Mono" }}
                        className="absolute left-full top-0 ml-2 text-white text-[12px] uppercase tracking-wide z-60 pointer-events-none origin-top-left mt-0.5"
                      >
                        <div className="flex flex-col gap-4 w-48">
                          <div>
                            <div className="text-white/50 mb-1 font-medium">Resolution</div>
                            <div>300 × 300</div>
                          </div>
                          <div>
                            <div className="text-white/50 mb-1 font-medium">Filename</div>
                            <div className="break-all">{item.title}</div>
                          </div>
                          <div>
                            <div className="text-white/50 mb-1 font-medium">Date Created</div>
                            <div>{item.dateCreated}</div>
                          </div>
                          <div>
                            <div className="text-white/50 mb-1 font-medium">Index</div>
                            <div>{(index + 1).toString().padStart(2, "0")}</div>
                          </div>
                        </div>
                      </motion.div>
                      {item.comment && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.2, y: -20 }}
                          animate={{ opacity: 1, scale: 0.4, y: 0 }}
                          exit={{ opacity: 0, scale: 0.2, y: -20 }}
                          transition={{ type: "spring", stiffness: 300, damping: 35 }}
                          style={{ fontFamily: "SF Mono", willChange: "transform, opacity" }}
                          className="absolute top-full left-0 mt-2 text-white text-[12px] uppercase tracking-wide z-60 pointer-events-none origin-top-left"
                        >
                          <div className="flex flex-col gap-4 w-48">
                            <div>
                              <div className="text-white/50 mb-1 font-medium">Notes</div>
                              <div className="normal-case tracking-normal">{item.comment}</div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </>
                  )}
                </AnimatePresence>
              </div>
              <span
                className="font-pp-supply-mono font-light text-[12px] text-muted-foreground/60 transition-opacity duration-100"
                style={{ opacity: zoomedId ? 0 : 1 }}
              >
                {(index + 1).toString().padStart(2, "0")}
              </span>
            </motion.button>
          )
        })}
      </div>
    </>
  )
}
