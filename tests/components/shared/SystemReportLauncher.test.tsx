// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import enMessages from "../../../messages/en.json";
import koMessages from "../../../messages/ko.json";
import viMessages from "../../../messages/vi.json";
import { SystemReportLauncher } from "../../../src/components/shared/SystemReportLauncher";
import { renderWithIntl } from "../../test-utils/renderWithIntl";

const testState = vi.hoisted(() => ({
  pathname: "/dashboard",
  getUser: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => testState.pathname,
}));

vi.mock("@/lib/supabase/browser", () => ({
  createSupabaseBrowserClient: () => ({
    auth: {
      getUser: testState.getUser,
    },
  }),
}));

const IDEMPOTENCY_KEY = "11111111-2222-4333-8444-555555555555";
const NEXT_IDEMPOTENCY_KEY = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
let fetchMock: ReturnType<typeof vi.fn>;

function okResponse() {
  return new Response(
    JSON.stringify({
      referenceCode: "SR-0123456789ABCDEF",
      createdAt: "2026-07-23T08:15:00.000Z",
    }),
    {
      status: 201,
      headers: { "content-type": "application/json" },
    },
  );
}

function failedResponse() {
  return new Response(JSON.stringify({ error: "service_unavailable" }), {
    status: 503,
    headers: { "content-type": "application/json" },
  });
}

function openPanel() {
  fireEvent.click(
    screen.getByRole("button", { name: koMessages.systemReport.launcherAria }),
  );
  return screen.getByRole("dialog", {
    name: koMessages.systemReport.title,
  });
}

function fillRequiredFields({
  email = "learner@example.com",
  title = "페이지 오류",
  message = "저장 버튼을 누르면 화면이 멈춥니다.",
} = {}) {
  fireEvent.change(
    screen.getByRole("textbox", {
      name: koMessages.systemReport.email.label,
    }),
    { target: { value: email } },
  );
  fireEvent.change(
    screen.getByRole("textbox", {
      name: koMessages.systemReport.reportTitle.label,
    }),
    { target: { value: title } },
  );
  fireEvent.change(
    screen.getByRole("textbox", {
      name: koMessages.systemReport.message.label,
    }),
    { target: { value: message } },
  );
}

beforeEach(() => {
  testState.pathname = "/dashboard";
  testState.getUser.mockReset();
  testState.getUser.mockResolvedValue({
    data: { user: null },
    error: null,
  });
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("crypto", {
    randomUUID: () => IDEMPOTENCY_KEY,
  });
  Object.defineProperty(window, "innerWidth", {
    configurable: true,
    value: 1280,
  });
  Object.defineProperty(window, "innerHeight", {
    configurable: true,
    value: 800,
  });
  Object.defineProperty(window.navigator, "userAgent", {
    configurable: true,
    value:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
  });
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("SystemReportLauncher visibility", () => {
  it.each([
    ["/", false],
    ["/terms", true],
    ["/auth/error", true],
    ["/definitely-missing", true],
  ])(
    "shows on %s only when it is not the landing page",
    (pathname, visible) => {
      testState.pathname = pathname;
      renderWithIntl(<SystemReportLauncher />);

      const launcher = screen.queryByRole("button", {
        name: koMessages.systemReport.launcherAria,
      });
      expect(Boolean(launcher)).toBe(visible);
    },
  );

  it("keeps the launcher visible as the only close control and preserves a draft", () => {
    renderWithIntl(<SystemReportLauncher />);
    openPanel();

    const closeLauncher = screen.getByRole("button", {
      name: koMessages.systemReport.close,
    });
    expect(closeLauncher).toBeTruthy();
    expect(closeLauncher.getAttribute("aria-expanded")).toBe("true");
    expect(closeLauncher.getAttribute("aria-controls")).toBe(
      "system-report-panel",
    );
    expect(document.getElementById("system-report-panel")).toBeTruthy();
    expect(document.querySelector(".ant-modal-close")).toBeNull();
    expect(screen.queryByTestId("system-report-cancel")).toBeNull();
    expect(screen.queryByTestId("system-report-discard")).toBeNull();

    fireEvent.change(
      screen.getByRole("textbox", {
        name: koMessages.systemReport.reportTitle.label,
      }),
      { target: { value: "계속 작성할 제목" } },
    );
    fireEvent.click(closeLauncher);
    expect(
      screen.getByRole("button", {
        name: koMessages.systemReport.launcherAria,
      }),
    ).toBeTruthy();
    expect(
      screen
        .getByRole("button", {
          name: koMessages.systemReport.launcherAria,
        })
        .getAttribute("aria-expanded"),
    ).toBe("false");

    fireEvent.click(
      screen.getByRole("button", {
        name: koMessages.systemReport.launcherAria,
      }),
    );
    expect(
      (
        screen.getByRole("textbox", {
          name: koMessages.systemReport.reportTitle.label,
        }) as HTMLInputElement
      ).value,
    ).toBe("계속 작성할 제목");
  });

  it("does not close from Escape or render a blocking background", () => {
    renderWithIntl(<SystemReportLauncher />);
    openPanel();

    fireEvent.keyDown(window, { key: "Escape", code: "Escape" });

    expect(
      screen.getByRole("dialog", { name: koMessages.systemReport.title }),
    ).toBeTruthy();
    expect(
      document.querySelector(".app-system-report-modal .ant-modal-mask"),
    ).toBeNull();
  });
});

describe("SystemReportLauncher form", () => {
  it("names its generated field ids independently from the host page", () => {
    renderWithIntl(
      <>
        <label htmlFor="email">Host email</label>
        <input id="email" />
        <SystemReportLauncher />
      </>,
    );
    openPanel();

    const reportEmail = screen.getByTestId("system-report-email");
    expect(reportEmail.id).toBe("system-report_email");
    expect(
      screen.getByRole("textbox", {
        name: koMessages.systemReport.email.label,
      }),
    ).toBe(reportEmail);
  });

  it("best-effort prefills the account email while keeping it editable", async () => {
    testState.getUser.mockResolvedValue({
      data: { user: { email: "account@example.com" } },
      error: null,
    });
    renderWithIntl(<SystemReportLauncher />);
    openPanel();

    const email = screen.getByRole("textbox", {
      name: koMessages.systemReport.email.label,
    }) as HTMLInputElement;
    await waitFor(() => expect(email.value).toBe("account@example.com"));

    fireEvent.change(email, { target: { value: "reply@example.com" } });
    expect(email.value).toBe("reply@example.com");
  });

  it("leaves the email editable and empty when account lookup fails", async () => {
    testState.getUser.mockRejectedValue(new Error("offline"));
    renderWithIntl(<SystemReportLauncher />);
    openPanel();

    const email = screen.getByRole("textbox", {
      name: koMessages.systemReport.email.label,
    }) as HTMLInputElement;
    await waitFor(() => expect(testState.getUser).toHaveBeenCalledTimes(1));
    expect(email.value).toBe("");
    expect(email.disabled).toBe(false);
  });

  it("shows inline required validation without sending", async () => {
    renderWithIntl(<SystemReportLauncher />);
    openPanel();

    fireEvent.click(
      screen.getByRole("button", { name: koMessages.systemReport.send }),
    );

    expect(
      await screen.findByText(koMessages.systemReport.validation.emailRequired),
    ).toBeTruthy();
    expect(
      screen.getByText(koMessages.systemReport.validation.titleRequired),
    ).toBeTruthy();
    expect(
      screen.getByText(koMessages.systemReport.validation.messageRequired),
    ).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("gives the category radiogroup its translated field name", () => {
    renderWithIntl(<SystemReportLauncher />);
    openPanel();

    expect(
      screen.getByRole("radiogroup", {
        name: koMessages.systemReport.category.label,
      }),
    ).toBeTruthy();
    expect(screen.getByRole("radio", { name: "버그" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "문의" })).toBeTruthy();
    expect(screen.getByRole("radio", { name: "제안" })).toBeTruthy();
  });

  it("posts an exact coarse payload without raw browser or URL data", async () => {
    testState.pathname = "/terms?token=secret#private";
    fetchMock.mockResolvedValue(okResponse());
    renderWithIntl(<SystemReportLauncher />);
    openPanel();
    fillRequiredFields();

    fireEvent.click(
      screen.getByRole("button", { name: koMessages.systemReport.send }),
    );

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const payload = JSON.parse(String(init.body));

    expect(url).toBe("/api/system-reports");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      "Content-Type": "application/json",
      "Idempotency-Key": IDEMPOTENCY_KEY,
    });
    expect(payload).toEqual({
      category: "bug",
      email: "learner@example.com",
      title: "페이지 오류",
      message: "저장 버튼을 누르면 화면이 멈춥니다.",
      context: {
        pathname: "/terms",
        browser: "chrome",
        os: "windows",
        deviceType: "desktop",
        viewportWidth: 1280,
        viewportHeight: 800,
        locale: "ko",
      },
    });
    expect(JSON.stringify(payload)).not.toContain("Mozilla");
    expect(JSON.stringify(payload)).not.toContain("secret");
    expect(JSON.stringify(payload)).not.toContain("private");
  });

  it("reuses the idempotency key and retains form values after failure", async () => {
    fetchMock
      .mockResolvedValueOnce(failedResponse())
      .mockResolvedValueOnce(okResponse());
    renderWithIntl(<SystemReportLauncher />);
    openPanel();
    fillRequiredFields({ title: "재시도 유지 제목" });

    fireEvent.click(
      screen.getByRole("button", { name: koMessages.systemReport.send }),
    );
    expect(
      await screen.findByText(koMessages.systemReport.errorTitle),
    ).toBeTruthy();
    expect(
      (
        screen.getByRole("textbox", {
          name: koMessages.systemReport.reportTitle.label,
        }) as HTMLInputElement
      ).value,
    ).toBe("재시도 유지 제목");

    fireEvent.click(
      screen.getByRole("button", { name: koMessages.systemReport.retry }),
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    const firstHeaders = fetchMock.mock.calls[0]?.[1]?.headers;
    const secondHeaders = fetchMock.mock.calls[1]?.[1]?.headers;
    expect(firstHeaders).toMatchObject({
      "Idempotency-Key": IDEMPOTENCY_KEY,
    });
    expect(secondHeaders).toMatchObject({
      "Idempotency-Key": IDEMPOTENCY_KEY,
    });
  });

  it("creates a new idempotency key when values change after failure", async () => {
    vi.stubGlobal("crypto", {
      randomUUID: vi
        .fn()
        .mockReturnValueOnce(IDEMPOTENCY_KEY)
        .mockReturnValueOnce(NEXT_IDEMPOTENCY_KEY),
    });
    fetchMock
      .mockResolvedValueOnce(failedResponse())
      .mockResolvedValueOnce(okResponse());
    renderWithIntl(<SystemReportLauncher />);
    openPanel();
    fillRequiredFields({ title: "첫 번째 제목" });

    fireEvent.click(screen.getByTestId("system-report-submit"));
    expect(
      await screen.findByText(koMessages.systemReport.errorTitle),
    ).toBeTruthy();

    fireEvent.change(
      screen.getByRole("textbox", {
        name: koMessages.systemReport.reportTitle.label,
      }),
      { target: { value: "수정한 제목" } },
    );
    fireEvent.click(screen.getByTestId("system-report-submit"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      "Idempotency-Key": IDEMPOTENCY_KEY,
    });
    expect(fetchMock.mock.calls[1]?.[1]?.headers).toMatchObject({
      "Idempotency-Key": NEXT_IDEMPOTENCY_KEY,
    });
  });

  it("prevents duplicate submission and blocks every close path while pending", async () => {
    let resolveRequest: ((response: Response) => void) | undefined;
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        resolveRequest = resolve;
      }),
    );
    renderWithIntl(<SystemReportLauncher />);
    openPanel();
    fillRequiredFields();

    const send = screen.getByRole("button", {
      name: koMessages.systemReport.send,
    });
    fireEvent.click(send);
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    const pendingButton = screen.getByRole("button", {
      name: koMessages.systemReport.sending,
    }) as HTMLButtonElement;
    expect(pendingButton.disabled).toBe(true);
    const closeLauncher = screen.getByRole("button", {
      name: koMessages.systemReport.close,
    }) as HTMLButtonElement;
    expect(closeLauncher.disabled).toBe(true);
    fireEvent.click(pendingButton);
    fireEvent.click(closeLauncher);
    fireEvent.keyDown(screen.getByRole("dialog"), {
      key: "Escape",
      code: "Escape",
    });
    const mask = document.querySelector(
      ".app-system-report-modal .ant-modal-mask",
    );
    if (mask) fireEvent.click(mask);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("dialog", { name: koMessages.systemReport.title }),
    ).toBeTruthy();

    resolveRequest?.(okResponse());
    expect(await screen.findByText("SR-0123456789ABCDEF")).toBeTruthy();
  });

  it("shows a receipt until the floating button closes it and starts fresh next time", async () => {
    fetchMock.mockResolvedValue(okResponse());
    renderWithIntl(<SystemReportLauncher />);
    openPanel();
    fillRequiredFields();
    fireEvent.click(
      screen.getByRole("button", { name: koMessages.systemReport.send }),
    );

    const successTitle = await screen.findByRole("heading", {
      name: koMessages.systemReport.success.title,
    });
    await waitFor(() => expect(document.activeElement).toBe(successTitle));
    expect(screen.getByText("SR-0123456789ABCDEF")).toBeTruthy();
    expect(screen.getByText(koMessages.systemReport.success.time)).toBeTruthy();
    expect(
      within(screen.getByTestId("system-report-success")).queryByRole("button"),
    ).toBeNull();

    fireEvent.click(
      screen.getByRole("button", {
        name: koMessages.systemReport.close,
      }),
    );
    await screen.findByRole("button", {
      name: koMessages.systemReport.launcherAria,
    });
    openPanel();
    expect(
      (
        screen.getByRole("textbox", {
          name: koMessages.systemReport.reportTitle.label,
        }) as HTMLInputElement
      ).value,
    ).toBe("");
  });
});

describe("system report locale catalogs", () => {
  it("keeps a complete non-empty namespace in ko, en, and vi", () => {
    const keys = (value: object, prefix = ""): string[] =>
      Object.entries(value).flatMap(([key, child]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        return child && typeof child === "object"
          ? keys(child as object, path)
          : [path];
      });

    const koKeys = keys(koMessages.systemReport).sort();
    expect(keys(enMessages.systemReport).sort()).toEqual(koKeys);
    expect(keys(viMessages.systemReport).sort()).toEqual(koKeys);
    expect(koKeys).toContain("diagnosticsDisclosure");
    expect(koKeys).toContain("close");
    expect(koKeys).toContain("success.reference");
    expect(koKeys).not.toContain("cancel");
    expect(koKeys).not.toContain("discard.confirm");
    expect(koKeys).not.toContain("success.close");

    for (const catalog of [koMessages, enMessages, viMessages]) {
      expect(
        keys(catalog.systemReport).every((key) => {
          const value = key
            .split(".")
            .reduce<unknown>(
              (current, segment) =>
                (current as Record<string, unknown>)[segment],
              catalog.systemReport,
            );
          return typeof value === "string" && value.length > 0;
        }),
      ).toBe(true);
    }
  });
});
