import { Calculator, Gem, Layers, Search, Shield, Sparkles, type LucideIcon } from "lucide-react";

const ICONS: Record<string, LucideIcon> = { calculator: Calculator, shield: Shield, gem: Gem, layers: Layers, search: Search, sparkles: Sparkles };

export const CONCEPT_ICON_NAMES = Object.keys(ICONS);

export function ConceptIcon({ name, size = 24, className }: { name: string; size?: number; className?: string }) {
  const Icon = ICONS[name] ?? Sparkles;
  return <Icon size={size} className={className} aria-hidden />;
}
