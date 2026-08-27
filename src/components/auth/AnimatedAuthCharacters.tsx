"use client";

import type { CSSProperties, PointerEvent } from "react";
import { useEffect, useState } from "react";

type AnimatedAuthCharactersProps = {
  ariaLabel: string;
  isTyping?: boolean;
  passwordVisible?: boolean;
  hasPassword?: boolean;
};

type CharacterStyle = CSSProperties & {
  "--look-x": string;
  "--look-y": string;
  "--lean": string;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

export function AnimatedAuthCharacters({
  ariaLabel,
  isTyping = false,
  passwordVisible = false,
  hasPassword = false,
}: AnimatedAuthCharactersProps) {
  const [look, setLook] = useState({ x: 0, y: 0 });
  const [isBlinking, setIsBlinking] = useState(false);

  useEffect(() => {
    let blinkEnd: number | undefined;
    const blinkInterval = window.setInterval(() => {
      setIsBlinking(true);
      blinkEnd = window.setTimeout(() => setIsBlinking(false), 150);
    }, 4200);

    return () => {
      window.clearInterval(blinkInterval);
      if (blinkEnd) {
        window.clearTimeout(blinkEnd);
      }
    };
  }, []);

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    setLook({
      x: clamp((event.clientX - centerX) / (rect.width / 2), -1, 1),
      y: clamp((event.clientY - centerY) / (rect.height / 2), -1, 1),
    });
  }

  const shouldPeek = passwordVisible && hasPassword;
  const activeLook = shouldPeek
    ? { x: -0.8, y: -0.6 }
    : isTyping
      ? { x: 0.55, y: 0.45 }
      : look;

  const characterStyle: CharacterStyle = {
    "--look-x": `${activeLook.x * 5}px`,
    "--look-y": `${activeLook.y * 4}px`,
    "--lean": `${activeLook.x * -5}deg`,
  };

  return (
    <div
      className={[
        "signup-character-stage",
        isTyping ? "is-typing" : "",
        shouldPeek ? "is-password-visible" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      role="img"
      aria-label={ariaLabel}
      onPointerMove={handlePointerMove}
      onPointerLeave={() => setLook({ x: 0, y: 0 })}
      style={characterStyle}
    >
      <div
        className={`signup-character signup-character--purple ${
          isBlinking ? "is-blinking" : ""
        }`}
        aria-hidden="true"
      >
        <span className="signup-character__eyes signup-character__eyes--white">
          <i />
          <i />
        </span>
      </div>

      <div
        className={`signup-character signup-character--charcoal ${
          isBlinking ? "is-blinking" : ""
        }`}
        aria-hidden="true"
      >
        <span className="signup-character__eyes signup-character__eyes--white">
          <i />
          <i />
        </span>
      </div>

      <div
        className="signup-character signup-character--coral"
        aria-hidden="true"
      >
        <span className="signup-character__eyes signup-character__eyes--dots">
          <i />
          <i />
        </span>
      </div>

      <div
        className="signup-character signup-character--yellow"
        aria-hidden="true"
      >
        <span className="signup-character__eyes signup-character__eyes--dots">
          <i />
          <i />
        </span>
        <span className="signup-character__mouth" />
      </div>
    </div>
  );
}
