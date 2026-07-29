/**
 * Renders a workflow's icon, whichever of the two formats it is stored in.
 *
 * The icon picker only ever offers emoji, but some rows hold a lucide component
 * name instead ("FileText", "Calendar") — written by the AI generator and the
 * demo seeder, not the UI. Those were rendering as literal text on the cards.
 * Emoji stays the intended format; this just stops old rows looking broken.
 */
import {
  Calendar,
  FileText,
  LifeBuoy,
  Users,
  Mail,
  Folder,
  Database,
  Bot,
  Zap,
  Globe,
  MessageSquare,
  BarChart3,
  Search,
  Bell,
  ShoppingCart,
  CreditCard,
  Lock,
  Settings,
  Rocket,
  Link2,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const NAMED: Record<string, LucideIcon> = {
  Calendar, FileText, LifeBuoy, Users, Mail, Folder, Database, Bot, Zap, Globe,
  MessageSquare, BarChart3, Search, Bell, ShoppingCart, CreditCard, Lock,
  Settings, Rocket, Link2,
};

export default function WorkflowIcon({
  icon,
  className = 'w-6 h-6',
}: {
  icon?: string | null;
  className?: string;
}) {
  if (!icon) return <>⚡</>;
  const Named = NAMED[icon];
  if (Named) return <Named className={className} />;
  // Anything else is an emoji (or a name we don't carry) — render it as text.
  return <>{icon}</>;
}
