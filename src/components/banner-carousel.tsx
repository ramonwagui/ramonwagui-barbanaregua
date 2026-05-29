"use client"

import { useState, useEffect, useCallback } from "react"

type Banner = {
  id: string
  imageUrl: string
  clickUrl: string | null
}

type Props = {
  banners: Banner[]
  className?: string
}

export default function BannerCarousel({ banners, className = "" }: Props) {
  const [current, setCurrent] = useState(0)

  const next = useCallback(() => {
    setCurrent((i) => (i + 1) % banners.length)
  }, [banners.length])

  useEffect(() => {
    if (banners.length <= 1) return
    const id = setInterval(next, 4000)
    return () => clearInterval(id)
  }, [banners.length, next])

  if (banners.length === 0) return null

  const banner = banners[current]

  return (
    <div className={`w-full ${className}`}>
      <div className="relative w-full overflow-hidden rounded-xl" style={{ aspectRatio: "16/5" }}>
        {banners.map((b, i) => (
          <div
            key={b.id}
            className="absolute inset-0 transition-opacity duration-500"
            style={{ opacity: i === current ? 1 : 0, pointerEvents: i === current ? "auto" : "none" }}
          >
            {b.clickUrl ? (
              <a href={b.clickUrl} target="_blank" rel="noopener noreferrer" className="block w-full h-full">
                <img src={b.imageUrl} alt="Anúncio" className="w-full h-full object-cover" />
              </a>
            ) : (
              <img src={b.imageUrl} alt="Anúncio" className="w-full h-full object-cover" />
            )}
          </div>
        ))}

        {/* Dots */}
        {banners.length > 1 && (
          <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
            {banners.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrent(i)}
                className="rounded-full transition-all duration-300"
                style={{
                  width: i === current ? 16 : 6,
                  height: 6,
                  backgroundColor: i === current ? "#f59e0b" : "rgba(255,255,255,0.5)",
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
