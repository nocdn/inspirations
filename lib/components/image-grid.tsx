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
  const [isMobile, setIsMobile] = useState(false)
  const [imageDimensions, setImageDimensions] = useState<
    Record<string, { width: number; height: number }>
  >({})

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

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
      if (isMobile) {
        onSelect(null)
      }
    }
  }

  const handleItemBlur = (itemId: string, event: React.FocusEvent<HTMLButtonElement>) => {
    if (!isMobile) return

    const nextFocused = event.relatedTarget
    if (nextFocused instanceof Node && containerRef.current?.contains(nextFocused)) {
      return
    }

    if (zoomedId === itemId || selectedId === itemId) {
      onZoom(null)
      onSelect(null)
    }
  }

  const handleImageLoad = (id: string, event: React.SyntheticEvent<HTMLImageElement>) => {
    const { naturalWidth, naturalHeight } = event.currentTarget
    if (!naturalWidth || !naturalHeight) return

    setImageDimensions((prev) => {
      const existing = prev[id]
      if (existing && existing.width === naturalWidth && existing.height === naturalHeight) {
        return prev
      }

      return {
        ...prev,
        [id]: { width: naturalWidth, height: naturalHeight },
      }
    })
  }

  return (
    <>
      <AnimatePresence>
        {zoomedId && (
          <motion.div
            initial={{ opacity: 0, backdropFilter: isMobile ? "blur(0px)" : "none" }}
            animate={{ opacity: 1, backdropFilter: isMobile ? "blur(1px)" : "none" }}
            exit={{ opacity: 0, backdropFilter: isMobile ? "blur(0px)" : "none" }}
            transition={{ duration: 0.3 }}
            onMouseDown={(e) => {
              e.stopPropagation()
              handleBackdropClick()
            }}
            className="fixed inset-0 bg-black/50 z-50"
          />
        )}
      </AnimatePresence>
      <div ref={containerRef} className="flex flex-col md:flex-row md:flex-wrap gap-6">
        {items.map((item, index) => {
          const isZoomed = zoomedId === item.id
          const translation = isZoomed ? getTranslation(item.id) : { x: 0, y: 0 }
          const dimensions = imageDimensions[item.id]
          const resolutionText = dimensions ? `${dimensions.width} × ${dimensions.height}` : "—"

          return (
            <motion.button
              layout
              key={item.id}
              ref={(el) => {
                if (el) itemRefs.current.set(item.id, el)
                else itemRefs.current.delete(item.id)
              }}
              onMouseDown={() => handleItemClick(item)}
              onBlur={(event) => handleItemBlur(item.id, event)}
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
                scale: isZoomed ? (isMobile ? 1.05 : 2.5) : 1,
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
                  onLoad={(event) => handleImageLoad(item.id, event)}
                  className="h-auto w-full md:w-auto md:max-h-[150px]"
                  unoptimized
                />
                <motion.div
                  initial={false}
                  animate={{ opacity: isZoomed ? 1 : 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  style={{
                    willChange: "opacity",
                    fontFamily: isMobile
                      ? "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, Liberation Mono, Courier New, monospace"
                      : "SF Mono",
                  }}
                  className="absolute top-full left-0 mt-2 text-white text-[10px] md:text-[5px] uppercase tracking-wide z-60 pointer-events-none origin-top-left text-left md:top-0 md:left-full md:mt-0.5 md:ml-2"
                >
                  <div className="flex flex-row gap-7 items-start md:flex-col md:gap-2 md:w-48">
                    <div className="shrink-0">
                      <div className="text-white/50 mb-px font-medium">Resolution</div>
                      <div>{resolutionText}</div>
                    </div>
                    <div className="min-w-0">
                      <div className="text-white/50 mb-px font-medium">Filename</div>
                      <div className="break-all">{item.title}</div>
                    </div>
                    <div className="shrink-0">
                      <div className="text-white/50 mb-px font-medium">Date Created</div>
                      <div>{item.dateCreated}</div>
                    </div>
                  </div>
                </motion.div>
              </div>
              <span
                className="font-pp-supply-mono font-light text-[11px] text-muted-foreground/60 transition-opacity duration-100"
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
