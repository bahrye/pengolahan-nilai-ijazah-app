import type { LucideIcon } from "lucide-react";

export type SiteMapMenuItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

export type SiteMapSection = {
  id: string;
  title: string;
  icon: LucideIcon;
  items: SiteMapMenuItem[];
};

export type SiteMapFlowStep = {
  order: number;
  title: string;
  description: string;
  href: string;
  buttonLabel: string;
  info?: string;
};

export type SiteMapFlowMeta = {
  title: string;
  subtitle: string;
  icon: LucideIcon;
};
