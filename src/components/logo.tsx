import Image from "next/image"
import Link from "next/link"

type Props = {
  href?: string
  size?: "sm" | "md" | "lg" | "fill"
}

const FIXED_SIZES = { sm: 44, md: 64, lg: 96 }

export function Logo({ href, size = "md" }: Props) {
  const isFill = size === "fill"
  const px = isFill ? 400 : FIXED_SIZES[size]

  const logoImg = isFill ? (
    <div className="relative w-full" style={{ paddingBottom: "100%" }}>
      <Image
        src="/logo.png"
        alt="Barba na Regua"
        fill
        className="object-contain"
        sizes="(max-width: 768px) 50vw, 240px"
      />
    </div>
  ) : (
    <Image
      src="/logo.png"
      alt="Barba na Regua"
      width={px}
      height={px}
      className="object-contain"
      style={{ width: px, height: px }}
    />
  )

  if (href) {
    return <Link href={href} className={isFill ? "block w-full" : ""}>{logoImg}</Link>
  }
  return logoImg
}
