import { Construction } from "lucide-react";

import { EmptyState } from "@/components/patterns/states";
import { PageHeader } from "@/components/patterns/page-header";

export function PlaceholderPage({
  eyebrow,
  title,
  description,
  note,
}: {
  eyebrow: string;
  title: string;
  description: string;
  note?: string;
}) {
  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} />
      <EmptyState
        icon={<Construction className="size-5" />}
        title="Reserved for a later phase"
        description={
          note ??
          "The navigation, permissions and data foundation for this area are in place. Functionality lands in a future phase."
        }
      />
    </>
  );
}
