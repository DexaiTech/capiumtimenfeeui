import { MailPlus } from 'lucide-react';

import {
  Badge,
  Button,
  Card,
  CountTabs,
  DataTable,
  EmptyState,
  ErrorState,
  PageToolbar,
  Skeleton,
  type DataTableColumn,
} from '@/components/ui';
import { useOrg } from '@/features/organizations';
import { useUrlParams } from '@/hooks';
import { isApiError } from '@/services/api';
import { formatUkDateTime } from '@/utils/dates';

import { useEmailTemplates } from '../../api/hooks';
import type { EmailTemplate, TemplateAudience } from '../../types';
import { TemplateEditor } from './TemplateEditor';

const AUDIENCES: ReadonlyArray<{ value: TemplateAudience; label: string }> = [
  { value: 'external', label: 'Client emails (external)' },
  { value: 'internal', label: 'Team emails (internal)' },
];

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
  const audience: TemplateAudience =
    AUDIENCES.find((entry) => entry.value === params.get('audience'))?.value ?? 'external';

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
    return (
      <TemplateEditor
        key={template.key}
        template={template}
        onBack={() => setParam({ template: null, audience: template.audience }, { push: true })}
      />
    );
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

  const all = templates.data ?? [];
  const rows = all.filter((template) => template.audience === audience);

  return (
    <DataTable
      caption="Email templates"
      columns={columns}
      rows={rows}
      toolbar={
        <PageToolbar
          start={
            <CountTabs
              label="Who the emails are for"
              items={AUDIENCES.map((entry) => ({
                ...entry,
                count: templates.data
                  ? all.filter((template) => template.audience === entry.value).length
                  : null,
              }))}
              value={audience}
              onChange={(value) => setParam({ audience: value === 'external' ? null : value })}
            />
          }
        />
      }
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
          description={
            all.length > 0
              ? 'There are no emails for this audience.'
              : 'The emails the application sends will be listed here.'
          }
        />
      }
    />
  );
}
