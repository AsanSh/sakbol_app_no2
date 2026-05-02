import { notFound } from "next/navigation";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { UiSurface } from "@/components/ui/surface";
import { UiLead, UiSectionTitle } from "@/components/ui/typography";
import { uiKit } from "@/lib/ui-kit";

/** Локальная витрина токенов; в production отключена. */
export default function UiKitDevPage() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const swatches = [
    { name: "canvas", className: "bg-ui-canvas", label: "Canvas" },
    { name: "surface", className: "bg-ui-surface ring-1 ring-ui-border", label: "Surface" },
    { name: "accent", className: "bg-ui-accent", label: "Accent" },
    { name: "foreground", className: "bg-ui-foreground", label: "Foreground" },
    { name: "muted", className: "bg-ui-muted", label: "Muted" },
    { name: "danger", className: "bg-ui-danger", label: "Danger" },
  ] as const;

  return (
    <div className="mx-auto min-h-screen max-w-3xl space-y-10 px-4 py-10 pb-20">
      <header className="space-y-2">
        <p className="text-caption font-medium uppercase tracking-wider text-ui-subtle">Dev only</p>
        <h1 className="font-manrope text-h2 font-semibold text-ui-foreground">SakBol UI Kit 2.0</h1>
        <UiLead>
          Токены: <code className="rounded bg-ui-border-subtle px-1.5 py-0.5 font-mono text-caption">ui.*</code> в
          Tailwind, переменные в <code className="font-mono text-caption">styles/ui-kit-tokens.css</code>, константы в{" "}
          <code className="font-mono text-caption">lib/ui-kit.ts</code>.
        </UiLead>
      </header>

      <UiSurface>
        <UiSectionTitle>Цвета</UiSectionTitle>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {swatches.map((s) => (
            <div key={s.name} className="overflow-hidden rounded-ui-md ring-1 ring-ui-border">
              <div className={cn("h-14 w-full", s.className)} />
              <p className="px-2 py-1.5 text-caption text-ui-muted">{s.label}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-caption text-ui-subtle">
          Accent hex (для JS): <span className="font-mono">{uiKit.color.accent}</span>
        </p>
      </UiSurface>

      <UiSurface>
        <UiSectionTitle>Скругления</UiSectionTitle>
        <div className="mt-4 flex flex-wrap gap-3">
          {(["ui-sm", "ui-md", "ui-lg", "ui-xl"] as const).map((r) => (
            <div
              key={r}
              className={cn(
                "flex h-16 w-24 items-center justify-center bg-ui-accent/15 text-caption font-medium text-ui-foreground",
                r,
              )}
            >
              {r}
            </div>
          ))}
        </div>
      </UiSurface>

      <UiSurface>
        <UiSectionTitle>Типографика</UiSectionTitle>
        <div className="mt-4 space-y-3">
          <p className="font-manrope text-h2 font-semibold text-ui-foreground">Section / H2</p>
          <p className="text-h3 font-semibold text-ui-foreground">Subsection / H3</p>
          <p className="text-body text-ui-foreground">Body — основной текст, line-height relaxed.</p>
          <p className="text-caption text-ui-subtle">Caption — вторичные подписи и метки.</p>
        </div>
      </UiSurface>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <p className="text-small font-medium text-ui-foreground">&lt;Card /&gt;</p>
          <p className="mt-2 text-caption text-ui-muted">surface · shadow-ui-card · без border</p>
        </Card>
        <UiSurface elevated>
          <p className="text-small font-medium text-ui-foreground">&lt;UiSurface elevated /&gt;</p>
          <p className="mt-2 text-caption text-ui-muted">модальные панели</p>
        </UiSurface>
      </div>

      <UiSurface>
        <UiSectionTitle>Кнопки</UiSectionTitle>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
        </div>
      </UiSurface>
    </div>
  );
}
