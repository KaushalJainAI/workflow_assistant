/**
 * Display maps for the improve loop and extraction.
 *
 * These live outside the page components so a list and its detail page render a
 * status the same way. Keeping them in the page file also breaks fast refresh,
 * which is the immediate reason they moved — but the real one is that two
 * screens disagreeing about what "deployed" looks like is a bug you only notice
 * in a screenshot.
 */
import {
  Bot, PencilLine, Upload, Shuffle, CheckCircle2, Loader2, XCircle, Clock, Ban,
  Mail, HardDrive, type LucideIcon,
} from 'lucide-react';
import type { DatasetSource, TuningJob } from '../api/improve';
import type { ExtractionSchema, RowStatus } from '../api/extraction';

/** Where a dataset's rows came from. Corrections are the valuable ones. */
export const sourceConfig: Record<
  DatasetSource,
  { icon: LucideIcon; label: string; cls: string }
> = {
  corrected: {
    icon: PencilLine,
    label: 'You corrected the agent',
    cls: 'text-primary bg-primary-subtle border-primary-line',
  },
  captured: {
    icon: Bot,
    label: 'Captured from a run',
    cls: 'text-agent bg-agent-subtle border-agent-line',
  },
  uploaded: {
    icon: Upload,
    label: 'Uploaded',
    cls: 'text-muted-foreground bg-secondary border-border',
  },
  mixed: {
    icon: Shuffle,
    label: 'Mixed sources',
    cls: 'text-muted-foreground bg-secondary border-border',
  },
};

export const jobStatus: Record<
  TuningJob['status'],
  { icon: LucideIcon; label: string; cls: string; spin?: boolean }
> = {
  deployed: { icon: CheckCircle2, label: 'Deployed', cls: 'text-success bg-success-subtle' },
  completed: { icon: CheckCircle2, label: 'Trained', cls: 'text-primary bg-primary-subtle' },
  training: { icon: Loader2, label: 'Training', cls: 'text-agent bg-agent-subtle', spin: true },
  failed: { icon: XCircle, label: 'Failed', cls: 'text-destructive bg-destructive-subtle' },
  queued: { icon: Clock, label: 'Queued', cls: 'text-muted-foreground bg-secondary' },
  cancelled: { icon: Ban, label: 'Cancelled', cls: 'text-muted-foreground bg-secondary' },
};

export const sourceIcon: Record<ExtractionSchema['source_kind'], LucideIcon> = {
  gmail: Mail,
  gdrive: HardDrive,
  upload: Upload,
};

export const sourceLabel: Record<ExtractionSchema['source_kind'], string> = {
  gmail: 'Gmail',
  gdrive: 'Google Drive',
  upload: 'Manual upload',
};

export const rowStatusStyle: Record<RowStatus, string> = {
  accepted: 'text-muted-foreground bg-secondary',
  needs_review: 'text-destructive bg-destructive-subtle font-semibold',
  reviewed: 'text-success bg-success-subtle',
  rejected: 'text-muted-foreground bg-secondary line-through',
};

export const evalRunStatusStyle: Record<string, string> = {
  completed: 'text-success bg-success-subtle',
  running: 'text-agent bg-agent-subtle',
  queued: 'text-muted-foreground bg-secondary',
  failed: 'text-destructive bg-destructive-subtle',
  cancelled: 'text-muted-foreground bg-secondary',
};
