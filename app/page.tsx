// this page will be server rendered
// it does not contain 'use client' and so can be fully rendered on server
import { Suspense } from "react"

import Table from "./Table"

// make sure to pass other elements as children to keep them server rendered
export default function Home() {
  return (
    <div id="content" className="w-screen pt-24 flex flex-col items-center">
      {/* this descriptive content will be fully static, only the table below will be dynamic (fetched from db) */}
      <div className="w-full max-w-140 flex flex-col items-start mb-12">
        <div id="header" className="font-[450] antialiased max-w-100 flex flex-col gap-5">
          <div className="text-[15px]">
            This is a collection for @
            <a href="https://x.com/nocdns" className="underline decoration-dotted">
              nocdns
            </a>
            's design inspirations. Taken from all across the internet. Saved here to refer to and
            get inspired by later.
          </div>
          <div className="text-[14px] text-muted-foreground/70">
            <p>8 collections, 194 items</p>
            <p>Last updated 19 Jan, 2026</p>
            <p>
              View{" "}
              <a href="https://bartoszbak.org" className="underline decoration-dotted">
                portfolio
              </a>
            </p>
          </div>
        </div>
      </div>
      {/* this table will be dynamic, fetched from db */}
      <Suspense fallback={<div>Loading...</div>}>
        <Table />
      </Suspense>
    </div>
  )
}
