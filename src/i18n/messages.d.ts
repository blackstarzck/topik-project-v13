// next-intl type augmentation: makes `useTranslations` / `getTranslations`
// key arguments type-checked against the baseline (ko) catalog. Adding a new
// key to messages/ko.json immediately makes it available (and type-safe)
// everywhere; missing keys in en/vi fall back to the key path at runtime.
import type messages from "../../messages/ko.json";

declare module "next-intl" {
  interface AppConfig {
    Messages: typeof messages;
  }
}
