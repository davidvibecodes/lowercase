import { Avatar } from "@/components/home/Avatar";
import type { SessionView } from "@/lib/realtime/events";

export function PartnerStatus({ view }: { view: SessionView }) {
  const p = view.partner;
  if (!p) return <span className="hidden text-sm font-bold text-faint md:inline">Waiting for a partner</span>;
  return (
    <span className="hidden items-center gap-2 md:flex" role="status" aria-live="polite">
      <Avatar first={p.firstName} last={p.lastName} size="sm" online={p.connected} />
      <span className="text-sm">
        <span className="font-bold">{p.firstName}</span>
        <span className={p.connected ? "block text-xs text-emerald" : "block text-xs text-amber"}>{p.connected ? "Connected" : "Partner reconnecting…"}</span>
      </span>
    </span>
  );
}
