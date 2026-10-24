import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

import { LoadingState } from "@/components/patterns/states";
import { supabase } from "@/integrations/supabase/client";
import { supabasePreconnectLinks } from "@/lib/preconnect";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  head: () => ({ links: supabasePreconnectLinks() }),
  // getSession() reads the locally stored session (no network round trip).
  // getUser() called Supabase Auth on EVERY dashboard navigation. Every server
  // function still verifies the JWT server-side, so security is unchanged.
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session?.user) throw redirect({ to: "/auth" });
    return { user: data.session.user };
  },
  // Show a skeleton immediately instead of a blank screen while the app loads.
  pendingMs: 0,
  pendingComponent: () => (
    <div className="mx-auto w-full max-w-3xl px-4 py-16">
      <LoadingState rows={3} label="Loading your workspace" />
    </div>
  ),
  component: () => <Outlet />,
});
