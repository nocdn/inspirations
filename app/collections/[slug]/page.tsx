import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { getAllCollectionSlugs, getCollectionItems } from "@/lib/collections"
import { CollectionView } from "@/lib/components/collection-view"

const EMPTY_COLLECTION_PLACEHOLDER = "__placeholder__"

export async function generateStaticParams() {
  const slugs = await getAllCollectionSlugs()

  if (slugs.length === 0) {
    return [{ slug: EMPTY_COLLECTION_PLACEHOLDER }]
  }

  return slugs.map((slug) => ({ slug }))
}

type PageProps = {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  return {
    title: `${slug} — inspirations`,
    description: `Design inspiration collection: ${slug}`,
  }
}

export default async function CollectionPage({ params }: PageProps) {
  const { slug } = await params

  if (slug === EMPTY_COLLECTION_PLACEHOLDER) {
    notFound()
  }

  const items = await getCollectionItems(slug)

  return (
    <div className="w-screen pt-24 flex flex-col items-center px-6">
      <div className="w-full max-w-5xl">
        <div className="mb-8">
          <Link
            href="/"
            prefetch={true}
            className="text-[13px] text-muted-foreground/60 hover:text-foreground transition-colors"
          >
            ← Back
          </Link>
        </div>
        <CollectionView collectionName={slug} items={items} />
      </div>
    </div>
  )
}
