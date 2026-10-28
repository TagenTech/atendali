import { Card } from '@/components/ui/card';

export function Kpi({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="min-w-0 p-3 sm:p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="font-display text-lg font-black tabular sm:text-2xl">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </Card>
  );
}
