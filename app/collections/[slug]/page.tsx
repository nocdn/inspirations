import { Suspense } from "react"

import Link from "next/link"

import { CollectionView } from "@/lib/components/collection-view"
import type { ImageItem } from "@/lib/types"

const dummyData: Record<string, ImageItem[]> = {
  typography: [
    {
      id: "1",
      imageUrl: "https://picsum.photos/seed/typ1/400/300",
      title: "Helvetica Study",
      comment: "Classic swiss design",
      dateCreated: "Jan 15, 2026",
    },
    {
      id: "2",
      imageUrl: "https://picsum.photos/seed/typ2/400/300",
      title: "Variable Fonts",
      comment: "Weight axis exploration",
      dateCreated: "Jan 12, 2026",
    },
    {
      id: "3",
      imageUrl: "https://picsum.photos/seed/typ3/400/300",
      title: "Kinetic Type",
      dateCreated: "Jan 10, 2026",
    },
    {
      id: "4",
      imageUrl: "https://picsum.photos/seed/typ4/400/300",
      title: "Editorial Layout",
      comment: "Magazine spread",
      dateCreated: "Jan 8, 2026",
    },
    {
      id: "5",
      imageUrl: "https://picsum.photos/seed/typ5/400/300",
      title: "Monospace Grid",
      dateCreated: "Jan 5, 2026",
    },
    {
      id: "6",
      imageUrl: "https://picsum.photos/seed/typ6/400/300",
      title: "Serif Contrast",
      comment: "High contrast study",
      dateCreated: "Jan 3, 2026",
    },
  ],
  components: [
    {
      id: "1",
      imageUrl: "https://picsum.photos/seed/comp1/400/300",
      title: "Button States",
      comment: "Hover, active, disabled",
      dateCreated: "Jan 18, 2026",
    },
    {
      id: "2",
      imageUrl: "https://picsum.photos/seed/comp2/400/300",
      title: "Card Patterns",
      dateCreated: "Jan 14, 2026",
    },
    {
      id: "3",
      imageUrl: "https://picsum.photos/seed/comp3/400/300",
      title: "Modal Design",
      comment: "Overlay patterns",
      dateCreated: "Jan 11, 2026",
    },
    {
      id: "4",
      imageUrl: "https://picsum.photos/seed/comp4/400/300",
      title: "Navigation",
      dateCreated: "Jan 9, 2026",
    },
  ],
  animations: [
    {
      id: "1",
      imageUrl: "https://picsum.photos/seed/anim1/400/300",
      title: "Page Transition",
      comment: "Smooth fade-slide",
      dateCreated: "Jan 19, 2026",
    },
    {
      id: "2",
      imageUrl: "https://picsum.photos/seed/anim2/400/300",
      title: "Micro-interactions",
      dateCreated: "Jan 16, 2026",
    },
    {
      id: "3",
      imageUrl: "https://picsum.photos/seed/anim3/400/300",
      title: "Scroll Effects",
      comment: "Parallax layers",
      dateCreated: "Jan 13, 2026",
    },
    {
      id: "4",
      imageUrl: "https://picsum.photos/seed/anim4/400/300",
      title: "Loading States",
      dateCreated: "Jan 7, 2026",
    },
  ],
}

async function getCollectionData(slug: string): Promise<ImageItem[]> {
  return dummyData[slug] ?? []
}

export async function generateStaticParams() {
  return Object.keys(dummyData).map((slug) => ({ slug }))
}

type PageProps = {
  params: Promise<{ slug: string }>
}

export default async function CollectionPage({ params }: PageProps) {
  const { slug } = await params
  const items = await getCollectionData(slug)

  return (
    <div className="w-screen pt-24 flex flex-col items-center px-6">
      <div className="w-full max-w-6xl">
        <div className="mb-8">
          <Link
            href="/"
            prefetch={true}
            className="text-[13px] text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            ← Back
          </Link>
        </div>
        <Suspense fallback={<div className="text-[14px] text-muted-foreground/70">Loading...</div>}>
          <CollectionView collectionName={slug} items={items} />
        </Suspense>
      </div>
    </div>
  )
}
