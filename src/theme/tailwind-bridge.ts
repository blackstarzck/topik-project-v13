export const tailwindBridgeVars = {
  "--app-color-primary": "var(--ant-color-primary)",
  "--app-color-bg-layout": "var(--ant-color-bg-layout)",
  "--app-color-bg-container": "var(--ant-color-bg-container)",
  "--app-color-text": "var(--ant-color-text)",
  "--app-color-text-secondary": "var(--ant-color-text-secondary)",
  "--app-color-border": "var(--ant-color-border)",
  "--app-radius": "var(--ant-border-radius)",
  "--app-font-family": "var(--ant-font-family)",
  "--app-shadow-elevated": "var(--ant-box-shadow-secondary)",
} as const;

export type TailwindBridgeVars = typeof tailwindBridgeVars;

export function getTailwindBridgeVars(): TailwindBridgeVars {
  return { ...tailwindBridgeVars };
}
