import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { exportUserData } from "@/server/services/settings";

export const dynamic = "force-dynamic";

/** Settings → Export my data (R27). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  const data = await exportUserData(db, user.id);
  return new NextResponse(JSON.stringify(data, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="lowercase-${user.username}.json"`,
    },
  });
}
