import Image from "next/image";

const GOOGLE_MARK_SRC = "/assets/brands/google-g.png";

export function GoogleMark({ size = 18 }: { size?: number }) {
  return (
    <Image
      src={GOOGLE_MARK_SRC}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className="h-auto"
      draggable={false}
    />
  );
}
