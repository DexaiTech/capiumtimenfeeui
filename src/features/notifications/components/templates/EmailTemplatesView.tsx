import { MailPlus } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  DataTable,
  EmptyState,
  ErrorState,
  Skeleton,
  type DataTableColumn,
} from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { useUrlParams } from '@/hooks';
import { isApiError } from '@/services/api';
import { formatUkDateTime } from '@/utils/dates';

import { useEmailTemplates } from '../../api/hooks';
import type { EmailTemplate } from '../../types';
import { TemplateEditor } from './TemplateEditor';

function EditorSkeleton() {
  return (
    <div role="status" aria-label="Loading the template" className="flex flex-col gap-4">
      <Skeleton shape="rect" className="h-8 w-56" />
      <Skeleton shape="rect" className="h-72 w-full" />
    </div>
  );
}

/**
 * The content of Settings → Email Templates: the templates of the practice's emails, and the
 * editor of the one named by `?template=`. The caller must hold `organization.update` or
 * `settings.manage` (the page checks it; the API does too).
 */
export function EmailTemplatesView() {
  const { organization } = useOrg();
  const { params, setParam } = useUrlParams();
  const templates = useEmailTemplates();
  const selectedKey = params.get('template');
  const open = (key: string | null) => setParam({ template: key }, { push: true });

  if (templates.isError) {
    return (
      <Card padding="none">
        <ErrorState
          title="Could not load the email templates"
          error={isApiError(templates.error) ? templates.error : null}
          onRetry={() => void templates.refetch()}
          retrying={templates.isRefetching}
        />
      </Card>
    );
  }

  if (selectedKey) {
    if (templates.isPending) return <EditorSkeleton />;
    const template = templates.data.find((entry) => entry.key === selectedKey);
    if (!template) {
      return (
        <Card padding="none">
          <EmptyState
            icon={<MailPlus className="size-6" />}
            title="Template not found"
            description="There is no email template with that name."
            action={<Button onClick={() => open(null)}>All templates</Button>}
          />
        </Card>
      );
    }
    return <TemplateEditor key={template.key} template={template} onBack={() => open(null)} />;
  }

  const columns: DataTableColumn<EmailTemplate>[] = [
    {
      id: 'name',
      header: 'Email',
      hideable: false,
      cell: (template) => (
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="font-medium text-text">{template.name}</span>
          <span className="text-xs text-text-muted">{template.description}</span>
        </div>
      ),
    },
    {
      id: 'category',
      header: 'Kind',
      className: 'w-32',
      cell: (template) => (
        <Badge tone={template.category === 'system' ? 'blue' : 'grey'}>
          {template.category === 'system' ? 'System' : 'Notification'}
        </Badge>
      ),
    },
    {
      id: 'status',
      header: 'Text',
      className: 'w-32',
      cell: (template) => (
        <Badge tone={template.customised ? 'violet' : 'grey'}>
          {template.customised ? 'Customised' : 'Default'}
        </Badge>
      ),
    },
    {
      id: 'edited',
      header: 'Last edited',
      className: 'w-56',
      cell: (template) =>
        template.updated_at ? (
          <span className="flex flex-col text-xs text-text-muted">
            <span>{formatUkDateTime(template.updated_at, organization.timezone)}</span>
            {template.updated_by_name ? <span>by {template.updated_by_name}</span> : null}
          </span>
        ) : (
          <span className="text-text-subtle">—</span>
        ),
    },
  ];

  return (
    <DataTable
      caption="Email templates"
      columns={columns}
      rows={templates.data ?? []}
      rowKey={(template) => template.key}
      loading={templates.isPending}
      skeletonRows={8}
      onRowClick={(template) => open(template.key)}
      rowActions={(template) => (
        <Button
          size="sm"
          variant="outline"
          aria-label={`Edit ${template.name}`}
          onClick={() => open(template.key)}
        >
          Edit
        </Button>
      )}
      empty={
        <EmptyState
          icon={<MailPlus className="size-6" />}
          title="No email templates"
          description="The emails the application sends will be listed here."
        />
      }
    />
  );
}
