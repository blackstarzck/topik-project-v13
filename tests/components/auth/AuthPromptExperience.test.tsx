// @vitest-environment jsdom
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { act, cleanup, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithIntl } from "../../test-utils/renderWithIntl";

const getUserMock = vi.fn();
const routerReplaceMock = vi.fn();
const routerPushMock = vi.fn();
const LOGO_SRC = "/assets/logo.png";
const GLOBAL_CSS = readFileSync(
  join(process.cwd(), "src/styles/global.css"),
  "utf8",
);
const AUTH_PROMPT_SOURCE = readFileSync(
  join(process.cwd(), "src/components/auth/AuthPromptExperience.tsx"),
  "utf8",
);
const AUTH_PROMPT_STYLES_PATH = join(
  process.cwd(),
  "src/components/auth/AuthPromptExperience.module.css",
);
const AUTH_PROMPT_STYLES = existsSync(AUTH_PROMPT_STYLES_PATH)
  ? readFileSync(AUTH_PROMPT_STYLES_PATH, "utf8")
  : "";
const AUTH_LANGUAGE_SELECT_PATH = join(
  process.cwd(),
  "src/components/auth/AuthLanguageSelect.tsx",
);
const AUTH_MESSAGE_PATHS = ["ko", "en", "vi"].map((locale) =>
  join(process.cwd(), `messages/${locale}.json`),
);
const UNUSED_AUTH_SELECTOR_CONTRACTS = [
  ".signup-prompt-links",
  ".signup-prompt-links a",
  ".signup-prompt-links a:hover",
  ".auth-language-select",
  ".auth-language-select__icon",
  ".auth-language-select__control",
  ".auth-language-select .auth-language-select__control.ant-select",
  ".auth-language-select .ant-select-selector",
  ".auth-language-select .ant-select-selection-item",
  ".auth-language-select .ant-select-arrow",
] as const;
const OWNED_AUTH_LAYOUT_GLOBAL_SELECTORS = [
  ".signup-prompt-form-inner",
  ".signup-prompt-form-heading",
  ".signup-prompt-form-panel .signup-prompt-form-heading.ant-flex",
  ".signup-prompt-form-panel .signup-form-surface",
  ".signup-prompt-form-panel .signup-form-surface > *",
] as const;
const OWNED_AUTH_LAYOUT_MODULE_RULES = [
  `.formInner {
  align-items: stretch;
  width: 100%;
  max-width: var(--auth-form-width);
}`,
  `.formHeading {
  margin-bottom: var(--auth-heading-gap);
  text-align: center;
}`,
  `.formPanel .formHeading:global(.ant-flex) {
  margin-bottom: var(--auth-heading-gap);
}`,
  `.formPanel .formSurface {
  width: 100%;
  max-width: none;
}`,
  `.formPanel .formSurface > * {
  width: 100%;
}`,
  `@media (max-width: 1023px) {
  .formHeading,
  .formPanel .formHeading:global(.ant-flex) {
    margin-bottom: 34px;
  }
}`,
] as const;
let searchParamsMock = new URLSearchParams();

function decodedImageSrc(image: HTMLImageElement) {
  return decodeURIComponent(image.getAttribute("src") ?? "");
}

function getCssRule(selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = GLOBAL_CSS.match(
    new RegExp(`${escapedSelector}\\s*\\{([^}]*)\\}`),
  );

  return match?.[1] ?? "";
}

function hasCssSelector(source: string, selector: string) {
  const escapedSelector = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return new RegExp(`(?:^|[,{])\\s*${escapedSelector}\\s*(?=,|\\{)`, "m").test(
    source,
  );
}

function hasOwnedCssRule(source: string, rule: string) {
  const escapedRule = rule.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  return new RegExp(`(?:^|\\})\\s*${escapedRule}`).test(source);
}

function hasAuthLanguageMessage(path: string) {
  const messages = JSON.parse(readFileSync(path, "utf8")) as {
    auth?: { languageSelect?: unknown };
  };

  return messages.auth?.languageSelect !== undefined;
}

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getUser: (...args: unknown[]) => getUserMock(...args),
      signInWithOAuth: vi.fn(),
      signInWithOtp: vi.fn(),
      signInWithPassword: vi.fn(),
    },
  }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: routerPushMock,
    replace: routerReplaceMock,
    refresh: vi.fn(),
  }),
  useSearchParams: () => searchParamsMock,
}));

import { AuthPromptExperience } from "../../../src/components/auth/AuthPromptExperience";
import authPromptStyles from "../../../src/components/auth/AuthPromptExperience.module.css";

function renderLoginPrompt() {
  return renderWithIntl(
    <AuthPromptExperience
      mode="login"
      pageHeading="Login"
      formSubtitle="Continue with your account"
      heroEyebrow="Login hero"
      mascotAlt="Login mascot"
      switchPrompt="No account?"
      switchHref="/sign-up"
      switchLabel="Sign up"
    />,
  );
}

function renderSignUpPrompt() {
  return renderWithIntl(
    <AuthPromptExperience
      mode="sign-up"
      pageHeading="Sign up"
      formSubtitle="Create your account"
      heroEyebrow="Sign-up hero"
      mascotAlt="Sign-up mascot"
      switchPrompt="Already have an account?"
      switchHref="/login"
      switchLabel="Log in"
    />,
  );
}

function persistedPageShowEvent() {
  const event = new Event("pageshow") as PageTransitionEvent;
  Object.defineProperty(event, "persisted", { value: true });
  return event;
}

describe("AuthPromptExperience", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "http://localhost:3000/login");
    searchParamsMock = new URLSearchParams();
    getUserMock.mockReset();
    getUserMock.mockResolvedValue({ data: { user: null }, error: null });
    routerReplaceMock.mockReset();
    routerPushMock.mockReset();
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("keeps removed secondary auth chrome out of source and global styles", () => {
    const remainingContracts = [
      ...(existsSync(AUTH_LANGUAGE_SELECT_PATH)
        ? ["src/components/auth/AuthLanguageSelect.tsx"]
        : []),
      ...UNUSED_AUTH_SELECTOR_CONTRACTS.filter((selector) =>
        GLOBAL_CSS.includes(selector),
      ),
      ...AUTH_MESSAGE_PATHS.filter(hasAuthLanguageMessage),
    ];

    expect(remainingContracts).toEqual([]);
  });

  it("keeps auth form layout owned by the rendering component without changing its values", () => {
    const { container } = renderLoginPrompt();
    const missingContracts = [
      ...(!existsSync(AUTH_PROMPT_STYLES_PATH) ? ["component stylesheet"] : []),
      ...(!AUTH_PROMPT_SOURCE.includes(
        'import styles from "./AuthPromptExperience.module.css";',
      )
        ? ["component stylesheet import"]
        : []),
      ...[
        "createAuthPromptTheme(mode, token)",
        "<ConfigProvider theme={authPromptTheme}>",
      ].filter((contract) => !AUTH_PROMPT_SOURCE.includes(contract)),
      ...[
        "styles.formPanel].join(",
        "styles.formInner].join(",
        "styles.formHeading].join(",
        "styles.formSurface].join(",
      ].filter((contract) => !AUTH_PROMPT_SOURCE.includes(contract)),
      ...OWNED_AUTH_LAYOUT_MODULE_RULES.filter(
        (rule) => !hasOwnedCssRule(AUTH_PROMPT_STYLES, rule),
      ),
      ...OWNED_AUTH_LAYOUT_GLOBAL_SELECTORS.filter((selector) =>
        hasCssSelector(GLOBAL_CSS, selector),
      ),
    ];

    expect(missingContracts).toEqual([]);
    expect(
      container
        .querySelector(".signup-prompt-form-panel")
        ?.classList.contains(authPromptStyles.formPanel),
    ).toBe(true);
    expect(
      container
        .querySelector(".signup-prompt-form-inner")
        ?.classList.contains(authPromptStyles.formInner),
    ).toBe(true);
    expect(
      container
        .querySelector(".signup-prompt-form-heading")
        ?.classList.contains(authPromptStyles.formHeading),
    ).toBe(true);
    expect(
      container
        .querySelector(".signup-form-surface")
        ?.classList.contains(authPromptStyles.formSurface),
    ).toBe(true);
  });

  it("replaces authenticated login entry pages with post-auth on mount", async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
      error: null,
    });

    renderLoginPrompt();

    await waitFor(() => {
      expect(routerReplaceMock).toHaveBeenCalledWith(
        "/auth/post-auth?intent=login",
      );
    });
  });

  it("keeps the sign-up intent when replacing an authenticated sign-up page", async () => {
    getUserMock.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
      error: null,
    });

    renderSignUpPrompt();

    await waitFor(() => {
      expect(routerReplaceMock).toHaveBeenCalledWith(
        "/auth/post-auth?intent=sign-up",
      );
    });
  });

  it("uses post-auth instead of a query next target for authenticated login entry pages", async () => {
    searchParamsMock = new URLSearchParams("next=/settings/account");
    getUserMock.mockResolvedValueOnce({
      data: { user: { id: "user-123" } },
      error: null,
    });

    renderLoginPrompt();

    await waitFor(() => {
      expect(routerReplaceMock).toHaveBeenCalledWith(
        "/auth/post-auth?intent=login",
      );
    });
  });

  it("renders the uploaded logo asset in desktop and mobile brand slots", () => {
    renderLoginPrompt();

    const logoImages = Array.from(
      document.querySelectorAll<HTMLImageElement>(
        ".signup-brand img, .signup-prompt-mobile-brand img",
      ),
    );

    expect(logoImages).toHaveLength(2);
    expect(logoImages.map(decodedImageSrc)).toEqual([
      expect.stringContaining(LOGO_SRC),
      expect.stringContaining(LOGO_SRC),
    ]);
    expect(logoImages.map((image) => image.getAttribute("loading"))).toEqual([
      "eager",
      "eager",
    ]);
  });

  it("renders only the four visible auth characters", () => {
    const { container } = renderLoginPrompt();

    expect(container.querySelectorAll(".signup-character")).toHaveLength(4);
    expect(
      container.querySelector(".signup-character-stage__paper"),
    ).toBeNull();
    expect(
      container.querySelector(".signup-character-stage__ground"),
    ).toBeNull();
  });

  it("keeps the desktop hero panel viewport-bound independently from the form column", () => {
    const heroRule = getCssRule(".signup-prompt-hero");

    expect(heroRule).toContain("position: sticky");
    expect(heroRule).toContain("top: 0");
    expect(heroRule).toContain("align-self: start");
    expect(heroRule).toContain("height: 100dvh");
    expect(heroRule).toContain("max-height: 100dvh");
  });

  it("rechecks persisted pageshow restores after OAuth browser-back navigation", async () => {
    getUserMock
      .mockResolvedValueOnce({ data: { user: null }, error: null })
      .mockResolvedValueOnce({
        data: { user: { id: "user-123" } },
        error: null,
      });

    renderLoginPrompt();

    await waitFor(() => {
      expect(getUserMock).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      window.dispatchEvent(persistedPageShowEvent());
    });

    await waitFor(() => {
      expect(routerReplaceMock).toHaveBeenCalledWith(
        "/auth/post-auth?intent=login",
      );
    });
  });
});
