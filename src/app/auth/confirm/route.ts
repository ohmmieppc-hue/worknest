import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

// Target of the sign-up confirmation and password-reset emails. Handles both
// the PKCE `code` flow (default template) and `token_hash` (custom template).
// A reset link signs the user in with a "recovery" session, which is sent on
// to /reset-password to choose a new password.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  const supabase = await createClient();
  let ok = false;

  if (code) {
    ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } else if (tokenHash && type) {
    ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }

  if (!ok) return NextResponse.redirect(new URL("/login?error=confirm", origin));

  const { data } = await supabase.auth.getClaims();
  const amr = (data?.claims?.amr ?? []) as { method?: string }[];
  const recovery = type === "recovery" || amr.some((m) => m.method === "recovery");
  return NextResponse.redirect(new URL(recovery ? "/reset-password" : "/onboarding", origin));
}
