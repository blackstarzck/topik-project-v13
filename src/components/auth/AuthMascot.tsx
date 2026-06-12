"use client";

// Shared auth/landing mascot region.
//
// Spec (A-01 §2, A-02 §2, X-06 §5, X-12 §1): a friendly study mascot lowers
// the tension of auth/security flows. Constraints across those docs:
//   - 대체 텍스트 필수 (alt text required)
//   - 입력 영역/CTA를 가리지 않음 (must not cover inputs/CTA)
//   - 이미지 로드 실패 시 기본 캐릭터(텍스트/이모지)로 대체
//
// No mascot raster asset ships in /public yet, so the default renders the
// emoji fallback directly. When a real illustration lands, pass `src` and the
// <img> will render with an onError fallback to the same emoji — honest now,
// upgrade-ready later. No fake image request is made when `src` is omitted.

import { useState } from "react";
import { Typography } from "antd";

const { Text } = Typography;

type AuthMascotProps = {
  /** Optional illustration URL. When omitted, the emoji fallback renders. */
  src?: string;
  /** Required alt / aria-label text describing the mascot. */
  alt: string;
  /** Short helper copy shown under the mascot (A-02 §2: 60자 이하). */
  caption?: string;
  /** Emoji fallback shown when no src or the image fails to load. */
  emoji?: string;
  /** Pixel size of the mascot glyph/image. */
  size?: 48 | 56;
};

const MASCOT_TEXT_SIZE_CLASS: Record<
  NonNullable<AuthMascotProps["size"]>,
  string
> = {
  48: "text-5xl",
  56: "text-[56px]",
};

export function AuthMascot({
  src,
  alt,
  caption,
  emoji = "🐥",
  size = 56,
}: AuthMascotProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(src) && !imageFailed;

  return (
    <div className="text-center" data-testid="auth-mascot">
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- runtime asset w/ onError fallback
        <img
          src={src}
          alt={alt}
          width={size}
          height={size}
          className="inline-block"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span
          role="img"
          aria-label={alt}
          className={[
            "inline-block leading-none",
            MASCOT_TEXT_SIZE_CLASS[size],
          ].join(" ")}
        >
          {emoji}
        </span>
      )}
      {caption ? (
        <div className="mt-2">
          <Text type="secondary" className="text-[13px]">
            {caption}
          </Text>
        </div>
      ) : null}
    </div>
  );
}
