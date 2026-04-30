"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

type Props = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: Props) {
  return (
    <Card className="py-8 text-center">
      <h3 className="text-h4 font-semibold text-health-text">{title}</h3>
      {description ? (
        <p className="mx-auto mt-2 max-w-md text-small text-health-text-secondary">{description}</p>
      ) : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </Card>
  );
}
