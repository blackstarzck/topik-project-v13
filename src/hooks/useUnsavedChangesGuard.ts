"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

/**
 * D-M3 / §1 예외 — 저장되지 않은 변경(dirty) 상태에서 이탈을 가로채는 재사용 훅.
 *
 * 배경(왜 필요한가):
 * App Router 의 `next/navigation` 에는 Pages Router 의 `router.events`(라우트
 * 변경 구독)에 해당하는 API 가 없다. 그래서 폼/에디터들은 지금까지 `beforeunload`
 * 로 "탭 닫기/새로 고침" 만 막고, 앱 내부 소프트 네비게이션(메뉴 클릭, router.push)
 * 은 막지 못했다 — `exit_with_dirty` 경고가 in-app 이동 시 사실상 트리거되지
 * 않았다. 이 훅이 그 빈틈을 닫는다.
 *
 * 무엇을 가로채는가:
 * 1) `beforeunload` — 탭 닫기/새로 고침/외부 이동(브라우저 기본 경고).
 * 2) 같은 출처(same-origin) anchor(`<a href>`) 클릭 — 캡처 단계에서 가로채
 *    `confirm` 을 띄우고, 사용자가 머무르기를 택하면 네비게이션을 취소한다.
 * 3) `useRouter()` 의 `push`/`replace`/`back`/`forward` — 컴포넌트 코드가
 *    프로그램적으로 이동할 때도 동일한 `confirm` 게이트를 건다.
 *
 * 설계 메모:
 * - `when`(dirty flag)을 ref 로 보관해, 라우터 메서드 패치를 매 렌더마다 다시
 *   감싸지 않는다(중첩 패치/스택 오버플로 방지).
 * - `message` 는 confirm 다이얼로그 텍스트. 한국어 카피 유지(i18n 라이브러리 없음).
 * - `onConfirmLeave` 가 주어지면 confirm 대신 호출자가 직접 모달(예: D-M3
 *   `AutosaveWarningModal`)을 띄워 처리할 수 있도록 boolean 으로 위임한다.
 *   `true` 를 반환하면 이동 허용, `false`/falsy 면 차단. 미지정 시 `window.confirm`.
 *
 * 한계(정직):
 * - 브라우저 뒤로/앞으로(history) 버튼은 popstate 라 완전 차단이 불가능하다.
 *   `router.back`/`forward` 호출은 가로채지만, 사용자가 직접 누른 물리 뒤로
 *   가기까지 막지는 않는다(beforeunload 가 일부 보완). 이는 App Router 공통
 *   제약이다.
 */
export type UnsavedChangesGuardOptions = {
  /** dirty 일 때 true. true 인 동안만 이탈을 가로챈다. */
  when: boolean;
  /** confirm 다이얼로그/브라우저 경고에 쓰일 문구. */
  message?: string;
  /**
   * 사용자가 이탈을 시도할 때 호출. `true` 반환 → 이동 허용, falsy → 차단.
   * 미지정 시 `window.confirm(message)` 로 폴백.
   */
  onConfirmLeave?: () => boolean;
};

/**
 * i18n: 이 모듈은 훅이라 useTranslations 를 호출할 수 없다(렌더 컴포넌트만 가능).
 * 따라서 confirm 다이얼로그 문구는 카탈로그 키로 노출하고, 호출하는 컴포넌트가
 * t(SHARED_UNSAVED_GUARD_MESSAGE_KEY) 로 해석해 `message` 로 넘긴다. 아래 literal
 * 은 message 도 onConfirmLeave 도 안 준 호출자를 위한 브라우저-native 최후 폴백일
 * 뿐이며, 정상 경로에서는 항상 해석된 message 가 우선한다.
 */
export const SHARED_UNSAVED_GUARD_MESSAGE_KEY = "shared.unsavedGuard.message";

const DEFAULT_MESSAGE =
  "저장되지 않은 변경 사항이 있어요. 페이지를 나가면 작성 내용이 사라질 수 있어요. 나가시겠어요?";

export function useUnsavedChangesGuard(options: UnsavedChangesGuardOptions): void {
  const { when, message = DEFAULT_MESSAGE, onConfirmLeave } = options;
  const router = useRouter();

  // 최신 값들을 ref 로 들고 다녀, 패치/리스너를 매 렌더 재설치하지 않는다.
  // ref 쓰기는 렌더 본문이 아니라 effect 에서 한다(렌더 중 ref 접근 금지).
  const whenRef = useRef(when);
  const messageRef = useRef(message);
  const confirmRef = useRef(onConfirmLeave);
  useEffect(() => {
    whenRef.current = when;
    messageRef.current = message;
    confirmRef.current = onConfirmLeave;
  });

  // 이탈 허용 여부를 묻는 단일 진입점.
  const askLeaveRef = useRef(() => {
    const fn = confirmRef.current;
    if (fn) return Boolean(fn());
    if (typeof window === "undefined") return true;
    return window.confirm(messageRef.current);
  });

  // 1) beforeunload — 탭 닫기/새로 고침.
  useEffect(() => {
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (!whenRef.current) return;
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // 2) same-origin anchor 클릭 가로채기(캡처 단계).
  useEffect(() => {
    function onDocumentClick(event: MouseEvent) {
      if (!whenRef.current) return;
      // 보조키 클릭(새 탭 등)/우클릭은 그대로 둔다.
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      // 같은 출처만 가로챈다(외부 링크는 beforeunload 가 처리).
      let url: URL;
      try {
        url = new URL(anchor.href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // 같은 경로(앵커만 다른 경우)면 막지 않는다.
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return;
      }

      if (!askLeaveRef.current()) {
        event.preventDefault();
        event.stopPropagation();
      }
    }
    document.addEventListener("click", onDocumentClick, true);
    return () => document.removeEventListener("click", onDocumentClick, true);
  }, []);

  // 최신 router 를 ref 로만 만지작거린다(렌더가 반환한 값을 직접 수정하면
  // React 컴파일러가 거부). 패치/복원은 모두 effect 안에서 ref 를 통해 한다.
  const routerRef = useRef(router);
  useEffect(() => {
    routerRef.current = router;
  });

  // 3) router.push/replace/back/forward 프로그램적 이동 가로채기.
  useEffect(() => {
    const patched = routerRef.current;
    const originalPush = patched.push.bind(patched);
    const originalReplace = patched.replace.bind(patched);
    const originalBack = patched.back.bind(patched);
    const originalForward = patched.forward.bind(patched);

    patched.push = ((...args: Parameters<typeof originalPush>) => {
      if (whenRef.current && !askLeaveRef.current()) return;
      return originalPush(...args);
    }) as typeof patched.push;

    patched.replace = ((...args: Parameters<typeof originalReplace>) => {
      if (whenRef.current && !askLeaveRef.current()) return;
      return originalReplace(...args);
    }) as typeof patched.replace;

    patched.back = (() => {
      if (whenRef.current && !askLeaveRef.current()) return;
      return originalBack();
    }) as typeof patched.back;

    patched.forward = (() => {
      if (whenRef.current && !askLeaveRef.current()) return;
      return originalForward();
    }) as typeof patched.forward;

    return () => {
      patched.push = originalPush;
      patched.replace = originalReplace;
      patched.back = originalBack;
      patched.forward = originalForward;
    };
  }, [router]);
}
