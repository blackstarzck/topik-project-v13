import type { AppRole } from "../auth/roles";
import type { QuestionNo } from "../practice/types";
import { APP_ROUTES, WRITING_ROUTE_PATHS_BY_QUESTION } from "./paths";

export type SidebarLeaf = { key: string; label: string; labelKey: string };
export type SidebarGroup = {
  key: string;
  label: string;
  labelKey: string;
  children: SidebarLeaf[];
};
export type SidebarItem = SidebarLeaf | SidebarGroup;

export const SIDEBAR_ITEMS: readonly SidebarItem[] = [
  { key: APP_ROUTES.dashboard, label: "Dashboard", labelKey: "dashboard" },
  {
    key: "practice",
    label: "Practice",
    labelKey: "practice",
    children: [
      {
        key: APP_ROUTES.practiceRecommendations,
        label: "Recommendations",
        labelKey: "practiceRecommendations",
      },
      {
        key: APP_ROUTES.practiceProblems,
        label: "Problems",
        labelKey: "practiceProblems",
      },
    ],
  },
  {
    key: "writing",
    label: "Writing",
    labelKey: "writing",
    children: [
      {
        key: APP_ROUTES.writing51,
        label: "Writing 51",
        labelKey: "writing51",
      },
      {
        key: APP_ROUTES.writing52,
        label: "Writing 52",
        labelKey: "writing52",
      },
      {
        key: APP_ROUTES.writing53,
        label: "Writing 53",
        labelKey: "writing53",
      },
      {
        key: APP_ROUTES.writing54,
        label: "Writing 54",
        labelKey: "writing54",
      },
    ],
  },
  { key: APP_ROUTES.library, label: "Library", labelKey: "library" },
  {
    key: "growth",
    label: "Growth",
    labelKey: "growth",
    children: [
      {
        key: APP_ROUTES.growth,
        label: "Growth dashboard",
        labelKey: "growthDashboard",
      },
      {
        key: APP_ROUTES.practiceWeakness,
        label: "Weakness",
        labelKey: "practiceWeakness",
      },
    ],
  },
  {
    key: "settings",
    label: "Settings",
    labelKey: "settings",
    children: [
      {
        key: APP_ROUTES.profile,
        label: "Profile",
        labelKey: "profile",
      },
      {
        key: APP_ROUTES.settingsLearning,
        label: "Learning goal",
        labelKey: "settingsLearning",
      },
      {
        key: APP_ROUTES.settingsAccount,
        label: "Account",
        labelKey: "settingsAccount",
      },
      {
        key: APP_ROUTES.settingsLanguage,
        label: "Language",
        labelKey: "settingsLanguage",
      },
      {
        key: APP_ROUTES.settingsNotifications,
        label: "Notifications",
        labelKey: "settingsNotifications",
      },
      // 구독 관리(X-04)는 사이드바 직접 메뉴에서 숨긴다. route 자체는 유지하며
      // 페이월(X-03) CTA 흐름에서만 진입한다(SHARE-03 contextual-only 옵션).
    ],
  },
];

export type SidebarLockMap = Readonly<Record<string, string>>;

export function computeSidebarLocks(args: {
  role: AppRole;
  planLabel: string | null | undefined;
  lockedWritingTypes?: ReadonlySet<QuestionNo> | readonly QuestionNo[];
}): SidebarLockMap {
  const locks: Record<string, string> = {};
  const lockedWritingTypes: ReadonlySet<QuestionNo> =
    args.lockedWritingTypes instanceof Set
      ? args.lockedWritingTypes
      : new Set<QuestionNo>(args.lockedWritingTypes ?? []);

  for (const questionNo of lockedWritingTypes) {
    locks[WRITING_ROUTE_PATHS_BY_QUESTION[questionNo]] = "writingTypeLocked";
  }

  return locks;
}
