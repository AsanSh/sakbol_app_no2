/**
 * Программный доступ к токенам UI Kit (hex для inline-стилей, чартов, PDF).
 * Основной источник правды для классов — tailwind.config.ts (`ui.*`).
 */
export const uiKit = {
  radius: {
    sm: "0.5rem",
    md: "0.75rem",
    lg: "1rem",
    xl: "1.25rem",
  },
  color: {
    canvas: "#F9FAFB",
    surface: "#FFFFFF",
    accent: "#00BFA5",
    accentHover: "#00A693",
    foreground: "#0F172A",
    muted: "#475569",
    subtle: "#64748B",
    border: "#E2E8F0",
    borderSubtle: "#F1F5F9",
    danger: "#EF4444",
    success: "#10B981",
    warning: "#F59E0B",
  },
} as const;

/** Иерархия текста: заголовок секции → подзаголовок → основной → подпись */
export const uiTypography = {
  sectionTitle: "font-manrope text-h3 font-semibold text-ui-foreground tracking-tight",
  sectionLead: "text-body text-ui-muted leading-relaxed",
  body: "text-body text-ui-foreground leading-relaxed",
  caption: "text-caption text-ui-subtle",
  label: "text-small font-medium text-ui-muted",
} as const;
