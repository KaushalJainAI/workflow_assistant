/**
 * Apps launcher registry (P5).
 *
 * One declaration per app: presentation, description, search keywords, and
 * where it opens. Unlike the retired desktop registry, every entry maps to a
 * real server-backed route — no local VFS, no window geometry.
 */
import {
  FileText,
  Folder,
  Globe,
  Image,
  LayoutDashboard,
  Presentation,
  Table,
  type LucideIcon,
} from 'lucide-react';

export interface AppMeta {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  tint: string;
  /** Route the tile opens. */
  path: string;
  keywords: string[];
  /** Hint shown on the "New with AI" button. */
  newPrompt: string;
}

export const APPS: AppMeta[] = [
  {
    id: 'files',
    title: 'Files',
    description: 'Browse, organise and open everything in your workspace',
    icon: Folder,
    tint: 'from-amber-400 to-orange-500',
    path: '/documents',
    keywords: ['finder', 'explorer', 'folder', 'documents', 'browse'],
    newPrompt: 'Upload or organise files',
  },
  {
    id: 'docs',
    title: 'Docs',
    description: 'Write and tweak markdown and Word documents in-browser',
    icon: FileText,
    tint: 'from-blue-400 to-indigo-600',
    path: '/documents?kind=md,docx',
    keywords: ['document', 'write', 'text', 'markdown', 'notes', 'word'],
    newPrompt: 'Draft a document about…',
  },
  {
    id: 'sheets',
    title: 'Sheets',
    description: 'Spreadsheets and CSVs with live data',
    icon: Table,
    tint: 'from-green-400 to-teal-600',
    path: '/documents?kind=xlsx,csv',
    keywords: ['spreadsheet', 'excel', 'sheet', 'csv', 'formula', 'grid'],
    newPrompt: 'Build a spreadsheet tracking…',
  },
  {
    id: 'slides',
    title: 'Slides',
    description: 'Decks you can present from the browser',
    icon: Presentation,
    tint: 'from-orange-400 to-red-500',
    path: '/documents?kind=pptx',
    keywords: ['slides', 'deck', 'present', 'powerpoint'],
    newPrompt: 'Make a slide deck about…',
  },
  {
    id: 'dashboards',
    title: 'Dashboards',
    description: 'Live KPI, chart and table tiles',
    icon: LayoutDashboard,
    tint: 'from-emerald-400 to-green-600',
    path: '/dashboards',
    keywords: ['data', 'chart', 'kpi', 'metrics', 'dashboard'],
    newPrompt: 'Track metrics on a dashboard…',
  },
  {
    id: 'pages',
    title: 'Pages',
    description: 'Reports and files published by link',
    icon: Globe,
    tint: 'from-cyan-400 to-blue-600',
    path: '/pages',
    keywords: ['publish', 'share', 'page', 'report', 'link'],
    newPrompt: 'Publish this report as a page',
  },
  {
    id: 'media',
    title: 'Media',
    description: 'Generated images and uploads, previewed inline',
    icon: Image,
    tint: 'from-pink-400 to-rose-600',
    path: '/documents?kind=image,video,pdf',
    keywords: ['image', 'photo', 'video', 'pdf', 'media'],
    newPrompt: 'Generate an image of…',
  },
];

export function searchApps(query: string): AppMeta[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return APPS;
  return APPS.map((app) => {
    const title = app.title.toLowerCase();
    let score = 0;
    if (title === needle) score = 100;
    else if (title.startsWith(needle)) score = 80;
    else if (title.includes(needle)) score = 60;
    else if (app.keywords.some((k) => k.startsWith(needle))) score = 40;
    else if (app.keywords.some((k) => k.includes(needle))) score = 25;
    else if (app.description.toLowerCase().includes(needle)) score = 10;
    return { app, score };
  })
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score || a.app.title.localeCompare(b.app.title))
    .map((e) => e.app);
}
