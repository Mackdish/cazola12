import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between sm:pb-6">
      <div className="min-w-0 space-y-1.5">
        {eyebrow ? <p className="text-eyebrow">{eyebrow}</p> : null}
        <h1 className="text-xl font-semibold tracking-tight break-words sm:text-3xl">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-sm text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">
          {actions}
        </div>
      ) : null}
    </header>
  );
}

