"use client"

import { useCallback, useEffect, useRef, useState } from "react"

import Image from "next/image"

import { AnimatePresence, LazyMotion, domAnimation, m, useReducedMotion } from "motion/react"

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
  const topIdRef = useRef<string | null>(null)
  const [topIdState, setTopIdState] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [imageDimensions, setImageDimensions] = useState<
    Record<string, { width: number; height: number }>
  >({})
  const translationsRef = useRef<Record<string, { x: number; y: number }>>({})
  const [translationsTick, setTranslationsTick] = useState(0)
  const prefersReducedMotion = useReducedMotion()

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768)
    checkMobile()
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [])

  const handleZoom = useCallback(
    (id: string | null) => {
      if (id) {
        topIdRef.current = id
        setTopIdState(id)

        const element = itemRefs.current.get(id)
        if (element) {
          const elementRect = element.getBoundingClientRect()
          const viewportCenterX = window.innerWidth / 2
          const viewportCenterY = window.innerHeight / 2
          const elementCenterX = elementRect.left + elementRect.width / 2
          const elementCenterY = elementRect.top + elementRect.height / 2
          translationsRef.current = {
            ...translationsRef.current,
            [id]: {
              x: viewportCenterX - elementCenterX,
              y: viewportCenterY - elementCenterY,
            },
          }
          setTranslationsTick((t) => t + 1)
        }
      } else {
        translationsRef.current = {}
        setTranslationsTick((t) => t + 1)
      }
      onZoom(id)
    },
    [onZoom]
  )

  const handleItemClick = useCallback(
    (item: ImageItem) => {
      if (zoomedId === item.id) {
        handleZoom(null)
      } else if (selectedId === item.id) {
        handleZoom(item.id)
      } else {
        onSelect(item.id)
      }
    },
    [zoomedId, selectedId, handleZoom, onSelect]
  )

  const handleBackdropClick = useCallback(() => {
    if (zoomedId) {
      handleZoom(null)
      if (isMobile) {
        onSelect(null)
      }
    }
  }, [zoomedId, isMobile, handleZoom, onSelect])

  const handleItemBlur = useCallback(
    (itemId: string, event: React.FocusEvent<HTMLButtonElement>) => {
      if (!isMobile) return

      const nextFocused = event.relatedTarget
      if (nextFocused instanceof Node && containerRef.current?.contains(nextFocused)) {
        return
      }

      if (zoomedId === itemId || selectedId === itemId) {
        handleZoom(null)
        onSelect(null)
      }
    },
    [isMobile, zoomedId, selectedId, handleZoom, onSelect]
  )

  const handleImageLoad = useCallback(
    (id: string, event: React.SyntheticEvent<HTMLImageElement>) => {
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
    },
    []
  )

  const springTransition = prefersReducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 300, damping: 35 }

  const fadeTransition = prefersReducedMotion ? { duration: 0 } : { duration: 0.3 }

  void translationsTick
  const currentTranslations = translationsRef.current

  return (
    <LazyMotion features={domAnimation}>
      <AnimatePresence>
        {zoomedId && (
          <m.div
            initial={{ opacity: 0, backdropFilter: isMobile ? "blur(0px)" : "none" }}
            animate={{ opacity: 1, backdropFilter: isMobile ? "blur(1px)" : "none" }}
            exit={{ opacity: 0, backdropFilter: isMobile ? "blur(0px)" : "none" }}
            transition={fadeTransition}
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
          const translation = currentTranslations[item.id] ?? { x: 0, y: 0 }
          const dimensions = imageDimensions[item.id]
          const resolutionText = dimensions ? `${dimensions.width} × ${dimensions.height}` : "—"
          const isTop = topIdState === item.id

          return (
            <m.button
              layout={!prefersReducedMotion}
              key={item.id}
              ref={(el) => {
                if (el) itemRefs.current.set(item.id, el)
                else itemRefs.current.delete(item.id)
              }}
              onMouseDown={() => handleItemClick(item)}
              onBlur={(event) => handleItemBlur(item.id, event)}
              onAnimationComplete={() => {
                if (!isZoomed && topIdRef.current === item.id) {
                  topIdRef.current = null
                  setTopIdState(null)
                }
              }}
              className={`flex flex-col gap-2 text-left transition-opacity cursor-pointer focus:outline-none motion-opacity-in-0 ${
                zoomedId && !isZoomed
                  ? "opacity-50"
                  : selectedId && selectedId !== item.id
                    ? "opacity-40"
                    : ""
              } ${isTop ? "relative z-100" : "relative z-0"}`}
              style={{ animationDelay: `${index * 0.02}s` }}
              animate={{
                scale: isZoomed ? (isMobile ? 1.05 : 2.5) : 1,
                x: isZoomed ? translation.x : 0,
                y: isZoomed ? translation.y : 0,
              }}
              transition={springTransition}
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
                <m.div
                  initial={false}
                  animate={{ opacity: isZoomed ? 1 : 0 }}
                  transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.2, ease: "easeOut" }}
                  style={{
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
                </m.div>
              </div>
              <span
                className="font-pp-supply-mono font-light text-[11px] text-muted-foreground/60 transition-opacity duration-100"
                style={{ opacity: zoomedId ? 0 : 1 }}
              >
                {(index + 1).toString().padStart(2, "0")}
              </span>
            </m.button>
          )
        })}
      </div>
    </LazyMotion>
  )
}
