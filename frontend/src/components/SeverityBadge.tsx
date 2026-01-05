import { cn } from '@/lib/utils';
import { SEVERITY_COLORS } from '@threat-modeling/shared';

interface SeverityBadgeProps {
  severity: string;
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export function SeverityBadge({ severity, size = 'md', showLabel = true }: SeverityBadgeProps) {
  const color = SEVERITY_COLORS[severity as keyof typeof SEVERITY_COLORS] || SEVERITY_COLORS.info;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded font-medium uppercase',
        size === 'sm' ? 'px-1.5 py-0.5 text-xs' : 'px-2 py-1 text-xs'
      )}
      style={{
        backgroundColor: `${color}15`,
        color: color,
      }}
    >
      <span
        className={cn('rounded-full', size === 'sm' ? 'h-1.5 w-1.5' : 'h-2 w-2')}
        style={{ backgroundColor: color }}
      />
      {showLabel && severity}
    </span>
  );
}
