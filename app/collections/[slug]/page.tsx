import Link from "next/link"

import { CollectionView } from "@/lib/components/collection-view"
import { getAllCollectionSlugs, getCollectionItems } from "@/lib/collections"

export async function generateStaticParams() {
  const slugs = await getAllCollectionSlugs()
  return slugs.map((slug) => ({ slug }))
}

type PageProps = {
  params: Promise<{ slug: string }>
}

export default async function CollectionPage({ params }: PageProps) {
  const { slug } = await params
  const items = await getCollectionItems(slug)

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
        <CollectionView collectionName={slug} items={items} />
      </div>
    </div>
  )
}
