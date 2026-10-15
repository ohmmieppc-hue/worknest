import { cache } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Workspace } from "@/lib/types";

// Per-request: the signed-in user and their (first) workspace.
export const getSession = cache(async () => {
  // The Supabase client reads the clock (token expiry); mark this as request-time work.
  await connection();
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace:workspaces(*)")
    .eq("user_id", user.id)
    .order("created_at")
    .limit(1)
    .maybeSingle();

  const workspace = (membership?.workspace ?? null) as Workspace | null;
  return { supabase, user, workspace };
});

export async function requireWorkspace() {
  const session = await getSession();
  if (!session.workspace) redirect("/onboarding");
  return { ...session, workspace: session.workspace };
}
