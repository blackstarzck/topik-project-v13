import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";

const css = readFileSync(
  join(process.cwd(), "src", "styles", "global.css"),
  "utf8",
);
const notificationBell = readFileSync(
  join(
    process.cwd(),
    "src",
    "components",
    "notifications",
    "NotificationBell.tsx",
  ),
  "utf8",
);
const appProviders = readFileSync(
  join(process.cwd(), "src", "app", "providers.tsx"),
  "utf8",
);
const dashboardAlertsCard = readFileSync(
  join(
    process.cwd(),
    "src",
    "components",
    "dashboard",
    "DashboardAlertsCard.tsx",
  ),
  "utf8",
);

function blockFor(selector: string): string {
  const escaped = selector
    .trim()
    .split(/\s+/)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
    .join("\\s+");
  const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`));
  return match?.[1] ?? "";
}

describe("AntD Notification shadow surface", () => {
  test("AppProviders centralizes AntD notification placement and behavior", () => {
    expect(appProviders).toContain("const appNotificationConfig");
    expect(appProviders).toContain('placement: "topRight"');
    expect(appProviders).toContain("top: 88");
    expect(appProviders).toContain("duration: 3");
    expect(appProviders).toContain("maxCount: 3");
    expect(appProviders).toContain("showProgress: true");
    expect(appProviders).toContain("const appNotificationSurfaceConfig");
    expect(appProviders).toContain('className: "app-global-notification"');
    expect(appProviders).toContain(
      "notification={appNotificationSurfaceConfig}",
    );
    expect(appProviders).toContain(
      "<AntdApp notification={appNotificationConfig}>",
    );
  });

  test("AntD notification notice uses the shared elevated shadow token", () => {
    expect(
      blockFor(
        ".ant-notification .ant-notification-notice.ant-notification-notice",
      ),
    ).toContain("box-shadow: var(--app-shadow-elevated)");
  });

  test("global AntD notification notices use the shared surface hook", () => {
    const block = blockFor(
      ".ant-notification .app-global-notification.ant-notification-notice.ant-notification-notice",
    );

    expect(block).toContain("width: min(360px, calc(100vw - 32px))");
    expect(block).toContain(
      "border: 1px solid var(--ant-color-border-secondary, var(--app-color-border))",
    );
    expect(block).toContain("border-radius: var(--app-radius)");
    expect(block).toContain("box-shadow: var(--app-shadow-elevated)");
  });
});

describe("In-app notification inbox item styles", () => {
  test("notification popover uses a darker floating shadow", () => {
    expect(notificationBell).toContain('root: "app-notification-popover"');
    expect(
      blockFor(
        ".app-notification-popover.app-notification-popover .ant-popover-container.ant-popover-container",
      ),
    ).toContain("box-shadow:");
    expect(
      blockFor(
        ".app-notification-popover.app-notification-popover .ant-popover-container.ant-popover-container",
      ),
    ).toContain("rgba(15, 23, 42, 0.16)");
  });

  test("notification popover keeps every text surface at 14px", () => {
    expect(notificationBell).toContain(
      'className="app-notification-item__time"',
    );
    expect(blockFor(".app-notification-panel .ant-typography")).toContain(
      "font-size: 14px",
    );
    expect(blockFor(".app-notification-panel .ant-btn")).toContain(
      "font-size: 14px",
    );
    expect(blockFor(".app-notification-item__button")).toContain(
      "font-size: 14px",
    );
    expect(blockFor(".app-notification-item__title.ant-typography")).toContain(
      "font-size: 14px",
    );
    expect(blockFor(".app-notification-item__body.ant-typography")).toContain(
      "font-size: 14px",
    );
    expect(blockFor(".app-notification-item__time.ant-typography")).toContain(
      "font-size: 14px",
    );
  });

  test("notification popover fixed header uses the AntD Card border color", () => {
    expect(blockFor(".app-notification-panel__header")).toContain(
      "border-bottom: 1px solid var(--ant-color-border-secondary)",
    );
  });

  test("notification rows remove outer horizontal padding and add transitioned hover feedback", () => {
    expect(
      blockFor(".app-notification-item"),
    ).toContain("padding-inline: 0");
    expect(blockFor(".app-notification-item__button")).toContain(
      "background: transparent",
    );
    expect(blockFor(".app-notification-item__button")).toContain(
      "position: relative",
    );
    expect(blockFor(".app-notification-item__button::before")).toContain(
      "background: var(--app-color-bg-layout)",
    );
    expect(blockFor(".app-notification-item__button::before")).toContain(
      "opacity: 0",
    );
    expect(blockFor(".app-notification-item__button::before")).toContain(
      "transition: opacity 160ms ease",
    );
    expect(blockFor(".app-notification-item__button:hover::before")).toContain(
      "opacity: 1",
    );
    expect(
      blockFor(".app-notification-item--unread .app-notification-item__button"),
    ).toContain("background: transparent");
    expect(
      blockFor(
        ".app-notification-item--unread .app-notification-item__button:hover::before",
      ),
    ).toContain("opacity: 1");
  });

  test("notification title and body use the requested typography hooks", () => {
    expect(notificationBell).toContain(
      'className="app-notification-item__title"',
    );
    expect(notificationBell).toContain(
      'className="app-notification-item__body !m-0"',
    );
    expect(blockFor(".app-notification-item__title.ant-typography")).toContain(
      "font-weight: 500",
    );
    expect(blockFor(".app-notification-item__body.ant-typography")).toContain(
      "font-size: 14px",
    );
  });

  test("unread dot and mark-all action match the notification badge affordance", () => {
    expect(notificationBell).toContain(
      'className="app-notification-panel__mark-all"',
    );
    expect(notificationBell).toContain(
      'className="app-notification-item__unread-dot"',
    );
    expect(blockFor(".app-notification-panel__mark-all.ant-btn")).toContain(
      "font-size: 14px",
    );
    expect(blockFor(".app-notification-item__unread-dot")).toContain(
      "background: var(--ant-color-error)",
    );
  });

  test("dashboard notice feed keeps rows transparent and regular weight", () => {
    expect(dashboardAlertsCard).toContain('className="dashboard-alerts-card"');
    expect(dashboardAlertsCard).not.toContain("  List,");
    expect(dashboardAlertsCard).not.toContain("<List");
    expect(dashboardAlertsCard).toContain(
      'className="app-notification-feed-item__title"',
    );
    expect(dashboardAlertsCard).toContain(
      'className="app-notification-feed-item__time"',
    );
    expect(dashboardAlertsCard).not.toContain(
      'className="app-notification-feed-item__tag"',
    );
    expect(dashboardAlertsCard).not.toContain("strong={unread}");
    expect(blockFor(".dashboard-alerts-card .ant-card-head-title")).toContain(
      "font-size: 14px",
    );
    expect(blockFor(".app-notification-feed-item")).toContain("padding: 0");
    expect(blockFor(".app-notification-feed-item__button")).toContain(
      "background: transparent",
    );
    expect(blockFor(".app-notification-feed-item__button")).toContain(
      "padding: 8px 0",
    );
    expect(blockFor(".app-notification-feed-item__button")).toContain(
      "font-size: 14px",
    );
    expect(blockFor(".app-notification-feed-item__button:hover")).toContain(
      "background: transparent",
    );
    expect(
      blockFor(
        ".app-notification-feed-item--unread .app-notification-feed-item__button",
      ),
    ).toContain("background: transparent");
    expect(
      blockFor(
        ".app-notification-feed-item--unread .app-notification-feed-item__button:hover",
      ),
    ).toContain("background: transparent");
    expect(
      blockFor(".app-notification-feed-item__title.ant-typography"),
    ).toContain("font-weight: 400");
    expect(
      blockFor(".app-notification-feed-item__title.ant-typography"),
    ).toContain("font-size: 14px");
    expect(
      blockFor(".app-notification-feed-item__title.ant-typography"),
    ).toContain("-webkit-line-clamp: 2");
    expect(
      blockFor(".app-notification-feed-item__title.ant-typography"),
    ).toContain("white-space: normal");
    expect(
      blockFor(".app-notification-feed-item__title.ant-typography"),
    ).toContain("overflow-wrap: anywhere");
    expect(
      blockFor(".app-notification-feed-item__time.ant-typography"),
    ).toContain("flex: 0 0 auto");
    expect(blockFor(".app-notification-feed-item__tag.ant-tag")).toBe(
      "",
    );
    expect(
      blockFor(".app-notification-feed-item__time.ant-typography"),
    ).toContain("font-size: 14px");
  });
});
