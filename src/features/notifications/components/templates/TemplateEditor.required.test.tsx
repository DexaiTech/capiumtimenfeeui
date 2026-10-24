import { describe, it } from 'vitest';

import { renderInOrg } from '@/test/renderInOrg';
import { expectRequiredFields } from '@/test/requiredFields';
import { server } from '@/test/server';

import { budgetAlertTemplate } from '../../test/fixtures';
import { createBackend, notificationHandlers } from '../../test/handlers';
import { TemplateEditor } from './TemplateEditor';

describe('mandatory fields of the email template editor', () => {
  it('marks the subject and both bodies', () => {
    server.use(...notificationHandlers(createBackend()));
    renderInOrg(<TemplateEditor template={budgetAlertTemplate} onBack={() => undefined} />);
    expectRequiredFields(document.body, {
      required: ['Subject', 'Email body (HTML)', 'Plain text body'],
    });
  });
});
