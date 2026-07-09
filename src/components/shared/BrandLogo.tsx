import Image from "next/image";

const BRAND_LOGO_SRC = "/assets/logo.png";
const BRAND_LOGO_ALT = "dotore TOPIK";
const BRAND_LOGO_WIDTH = 491;
const BRAND_LOGO_HEIGHT = 173;

type BrandLogoProps = {
  className?: string;
  imageClassName?: string;
  decorative?: boolean;
  height?: number;
  loading?: "eager" | "lazy";
};

export function BrandLogo({
  className,
  imageClassName,
  decorative = true,
  height = 32,
  loading,
}: BrandLogoProps) {
  const width = Math.round((BRAND_LOGO_WIDTH / BRAND_LOGO_HEIGHT) * height);

  return (
    <span
      className={["brand-logo", className].filter(Boolean).join(" ")}
      aria-hidden={decorative ? true : undefined}
    >
      <Image
        src={BRAND_LOGO_SRC}
        alt={decorative ? "" : BRAND_LOGO_ALT}
        width={width}
        height={height}
        className={["brand-logo__image", imageClassName]
          .filter(Boolean)
          .join(" ")}
        draggable={false}
        loading={loading}
      />
    </span>
  );
}
