import { NextResponse, type NextRequest } from "next/server";
import { todayISO } from "@/lib/format";
import { sendDailyDigests } from "@/lib/notify";

// Vercel Cron (see vercel.json) calls this daily with
// `Authorization: Bearer $CRON_SECRET`. ?date=YYYY-MM-DD overrides the day for testing.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const date = request.nextUrl.searchParams.get("date");
  const today = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : todayISO();
  try {
    const results = await sendDailyDigests(today);
    return NextResponse.json({ date: today, workspaces: Object.keys(results).length, results });
  } catch (e) {
    console.error("[cron:reminders]", e);
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
