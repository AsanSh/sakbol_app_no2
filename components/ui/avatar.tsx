"use client";

/**
 * ProfileAvatar — единый компонент аватара для всего приложения.
 *
 * Гарантирует правильное отображение фото или инициалов в круге.
 * Не зависит от flex-контекста родителя благодаря inline-flex + aspect-square.
 */

import { cn } from "@/lib/utils";

interface ProfileAvatarProps {
  /** URL фото. Если null/undefined — показываем инициалы. */
  src?: string | null;
  /** Отображаемое имя — из него берём инициалы */
  name: string;
  /** Размер в px. По умолчанию 56 (h-14 w-14) */
  size?: number;
  /** Дополнительные Tailwind-классы на корневой элемент (рамка активного профиля — только border, без outline/ring-offset) */
  className?: string;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/** Детерминированный цвет фона по имени */
const BG_COLORS = [
  "bg-[#004253]",
  "bg-[#006064]",
  "bg-[#00695c]",
  "bg-[#1565c0]",
  "bg-[#4527a0]",
  "bg-[#6a1b9a]",
  "bg-[#ad1457]",
  "bg-[#558b2f]",
];

function bgForName(name: string): string {
  const sum = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return BG_COLORS[sum % BG_COLORS.length];
}

export function ProfileAvatar({
  src,
  name,
  size = 56,
  className,
}: ProfileAvatarProps) {
  const px = `${size}px`;
  const fontSize = Math.round(size * 0.32);

  return (
    <span
      className={cn(
        // box-border: border из className входит в width/height — контур не вылезает за скролл-контейнер
        "relative box-border inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full",
        !src ? bgForName(name) : "bg-slate-200",
        className,
      )}
      style={{
        width: px,
        height: px,
        boxSizing: "border-box",
      }}
      aria-label={name}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          /*
           * absolute inset-0 — отрывает img от flex-потока родителя.
           * Без этого flex-алгоритм может сжать img даже при h-full w-full.
           * object-cover + object-[center_30%] — заполняет круг и показывает
           * верхнюю треть изображения, где обычно находится лицо.
           */
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center 30%",
          }}
        />
      ) : (
        <span
          className="pointer-events-none select-none font-bold leading-none text-white"
          style={{ fontSize, letterSpacing: "-0.01em" }}
          aria-hidden
        >
          {getInitials(name)}
        </span>
      )}
    </span>
  );
}
