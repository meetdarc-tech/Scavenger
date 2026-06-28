import { Card } from '../ui/Card';

interface ChartContainerProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function ChartContainer({ title, description, children }: ChartContainerProps) {
  return (
    <Card className="p-6">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
      </div>
      <div className="w-full h-[300px]">{children}</div>
    </Card>
  );
}
