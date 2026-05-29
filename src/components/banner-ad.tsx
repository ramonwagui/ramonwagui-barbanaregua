type BannerAdProps = {
  imageUrl: string
  clickUrl: string | null
}

export default function BannerAd({ imageUrl, clickUrl }: BannerAdProps) {
  const img = (
    <img
      src={imageUrl}
      alt="Anúncio"
      className="w-40 rounded-xl object-cover shadow-lg shadow-black/40 border border-zinc-800/40"
      style={{ maxHeight: 480 }}
    />
  )

  if (clickUrl) {
    return (
      <a href={clickUrl} target="_blank" rel="noopener noreferrer" className="block opacity-90 hover:opacity-100 transition-opacity">
        {img}
      </a>
    )
  }

  return img
}
