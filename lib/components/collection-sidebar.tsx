"use client"

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
}

export function CollectionSidebar({
  collectionName,
  itemCount,
  selectedItem,
}: CollectionSidebarProps) {
  return (
    <div className="w-[280px] shrink-0 sticky top-24 h-fit">
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
            <div className="text-[12px] text-muted-foreground/60 font-pp-supply-mono">
              Item Details
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="text-[16px] font-medium">{selectedItem.title}</h2>
              {selectedItem.comment && (
                <p className="text-[14px] text-muted-foreground/70">{selectedItem.comment}</p>
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
            <div className="text-[12px] text-muted-foreground/60 font-pp-supply-mono">
              Collection
            </div>
            <div className="flex flex-col gap-2">
              <h2 className="text-[16px] font-medium capitalize">{collectionName}</h2>
              <p className="text-[14px] text-muted-foreground/70">{itemCount} items</p>
              <p className="text-[12px] text-muted-foreground/50">Click an item to view details</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
