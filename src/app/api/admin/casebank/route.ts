import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { adminRoute } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { CASEBANK_MAX_BYTES as MAX_BYTES } from "@/lib/types";
import { importCasebank } from "@/server/services/casebank";

export const dynamic = "force-dynamic";

/** Reads at most MAX_BYTES; route handlers have no default body limit. */
async function readCapped(req: NextRequest): Promise<string | null> {
  const declared = Number(req.headers.get("content-length") ?? "0");
  if (declared > MAX_BYTES) return null;
  if (!req.body) return "";
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}

/** POST { document, dryRun } (R24). Admins only (403 otherwise, KTD6). */
export const POST = adminRoute(async (req) => {
  const raw = await readCapped(req);
  if (raw === null) return NextResponse.json({ ok: false, errors: ["The file is larger than 2 MB."] }, { status: 413 });
  let body: { document?: unknown; dryRun?: unknown };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, errors: ["That isn't valid JSON."] }, { status: 400 });
  }
  const result = await importCasebank(db, body.document, { dryRun: body.dryRun !== false });
  if (result.ok && !result.dryRun) revalidatePath("/admin/cases", "layout");
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
});
