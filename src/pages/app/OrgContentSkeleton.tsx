import { Card, Skeleton } from '@/components/ui';

/** Content placeholder while the practice of the URL is being resolved; the shell is already drawn. */
export function OrgContentSkeleton() {
  return (
    <div role="status" aria-label="Loading practice" className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <Skeleton shape="rect" className="h-8 w-64 max-w-full" />
        <Skeleton shape="rect" className="h-4 w-80 max-w-full" />
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        <Card padding="lg" className="flex flex-col gap-4 lg:col-span-2">
          <Skeleton shape="rect" className="size-11" />
          <Skeleton lines={3} />
          <Skeleton shape="rect" className="h-10 w-40" />
        </Card>
        <Card className="flex flex-col gap-3">
          <Skeleton shape="rect" className="h-4 w-24" />
          <Skeleton lines={4} />
        </Card>
      </div>
    </div>
  );
}
