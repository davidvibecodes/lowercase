import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";

/** /cms is an alias: admins go to the CMS, everyone else home (R12). */
export default async function CmsAlias() {
  const user = await requireUser();
  redirect(user.isAdmin ? "/admin" : "/");
}
