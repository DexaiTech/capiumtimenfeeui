import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ownerContext, STAFF_PERMISSIONS } from '@/test/orgFixtures';
import { renderInOrg } from '@/test/renderInOrg';

import { ApprovalOffNotice } from './ApprovalOffNotice';

const practice = (overrides: Partial<typeof ownerContext.organization>) => ({
  ...ownerContext,
  organization: { ...ownerContext.organization, ...overrides },
});

describe('ApprovalOffNotice (ticket APT53)', () => {
  it('says nothing while the practice approves the area', () => {
    renderInOrg(<ApprovalOffNotice area="timesheet" />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('says the area is switched off and links to the setting for who may change it', () => {
    renderInOrg(<ApprovalOffNotice area="expense" />, {
      context: practice({ expense_approval_required: false }),
    });
    expect(screen.getByRole('status')).toHaveTextContent('Expense approval is switched off');
    expect(screen.getByRole('link', { name: 'Change it in General Settings' })).toHaveAttribute(
      'href',
      `/${ownerContext.organization.slug}/settings/general`,
    );
  });

  it('offers no link to someone who cannot change the settings', () => {
    renderInOrg(<ApprovalOffNotice area="wip_adjustment" />, {
      context: {
        ...practice({ wip_adjustment_approval_required: false }),
        permissions: STAFF_PERMISSIONS,
      },
    });
    expect(screen.getByRole('status')).toHaveTextContent('WIP adjustment approval is switched off');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
