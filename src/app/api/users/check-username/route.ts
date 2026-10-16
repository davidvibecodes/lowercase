import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { checkUsername } from "@/server/services/username";

export const dynamic = "force-dynamic";

/** GET /api/users/check-username?username=… (R9). Signed-in users only; usable before onboarding. */
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  return NextResponse.json(await checkUsername(db, req.nextUrl.searchParams.get("username") ?? ""));
}
