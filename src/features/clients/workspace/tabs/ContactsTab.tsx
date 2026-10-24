import { Pencil, Plus, Star, Trash2, UserRound } from 'lucide-react';
import { useState } from 'react';

import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  PageToolbar,
  useToast,
  type DataTableColumn,
} from '@/components/ui';

import { useDeleteContact, useUpdateContact } from '../../api';
import { ContactFormPanel, type ContactTarget } from '../../components/ContactFormPanel';
import type { ClientDetail, ContactRead } from '../../types';
import { describeError } from '../errors';

export interface ContactsTabProps {
  client: ClientDetail;
  /** `client.update` on a client that is not merged away. */
  canEdit: boolean;
}

/** The client's contacts: add, edit, delete, and choose the primary contact. */
export function ContactsTab({ client, canEdit }: ContactsTabProps) {
  const { toast } = useToast();
  const [target, setTarget] = useState<ContactTarget | null>(null);
  const [deleting, setDeleting] = useState<ContactRead | null>(null);
  const update = useUpdateContact();
  const remove = useDeleteContact();

  const openAdd = () =>
    setTarget({
      clientId: client.id,
      clientName: client.name,
      contact: null,
      primary: client.contacts.length === 0,
    });

  const makePrimary = async (contact: ContactRead) => {
    try {
      await update.mutateAsync({
        clientId: client.id,
        contactId: contact.id,
        body: { is_primary: true },
      });
      toast({ tone: 'success', title: 'Primary contact changed', description: contact.name });
    } catch (error) {
      toast({
        tone: 'error',
        title: 'Could not change the primary contact',
        description: describeError(error).message,
      });
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await remove.mutateAsync({ clientId: client.id, contactId: deleting.id });
      toast({ tone: 'success', title: 'Contact deleted', description: deleting.name });
      setDeleting(null);
    } catch (error) {
      toast({
        tone: 'error',
        title: 'Could not delete the contact',
        description: describeError(error).message,
      });
    }
  };

  const columns: DataTableColumn<ContactRead>[] = [
    {
      id: 'name',
      header: 'Name',
      hideable: false,
      cell: (contact) => <span className="font-semibold text-text">{contact.name}</span>,
    },
    { id: 'position', header: 'Position', cell: (contact) => contact.position ?? '—' },
    {
      id: 'email',
      header: 'Email',
      cell: (contact) =>
        contact.email ? (
          <a className="text-brand-text hover:underline" href={`mailto:${contact.email}`}>
            {contact.email}
          </a>
        ) : (
          '—'
        ),
    },
    { id: 'phone', header: 'Phone', cell: (contact) => contact.phone ?? '—' },
    {
      id: 'role',
      header: 'Role',
      cell: (contact) => (
        <span className="flex flex-wrap items-center gap-1.5">
          {contact.is_primary ? (
            <Badge tone="violet" size="sm">
              Primary
            </Badge>
          ) : null}
          {contact.is_billing ? (
            <Badge tone="blue" size="sm">
              Billing
            </Badge>
          ) : null}
          {!contact.is_primary && !contact.is_billing ? '—' : null}
        </span>
      ),
    },
  ];

  return (
    <>
      <ContactFormPanel target={target} onClose={() => setTarget(null)} />
      <DataTable
        caption={`Contacts of ${client.name}`}
        columns={columns}
        rows={client.contacts}
        rowKey={(contact) => contact.id}
        toolbar={
          <PageToolbar
            start={
              <h2 className="px-2 text-sm font-semibold text-text">
                Contacts{' '}
                <span className="font-normal text-text-muted">{client.contacts.length}</span>
              </h2>
            }
            primaryAction={
              canEdit ? (
                <Button
                  variant="primary"
                  size="sm"
                  leftIcon={<Plus aria-hidden="true" className="size-4" />}
                  onClick={openAdd}
                >
                  Add contact
                </Button>
              ) : undefined
            }
          />
        }
        rowActions={
          canEdit
            ? (contact) => (
                <span className="inline-flex items-center gap-1.5">
                  {!contact.is_primary ? (
                    <Button
                      size="sm"
                      leftIcon={<Star aria-hidden="true" className="size-3.5" />}
                      onClick={() => void makePrimary(contact)}
                      disabled={update.isPending}
                    >
                      Make primary
                    </Button>
                  ) : null}
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Edit ${contact.name}`}
                    onClick={() =>
                      setTarget({ clientId: client.id, clientName: client.name, contact })
                    }
                  >
                    <Pencil aria-hidden="true" className="size-4" />
                  </Button>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Delete ${contact.name}`}
                    onClick={() => setDeleting(contact)}
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </Button>
                </span>
              )
            : undefined
        }
        empty={
          <EmptyState
            icon={<UserRound className="size-6" />}
            title="No contacts yet"
            description="Add the people to write to at this client. The primary contact shows in the client list; billing contacts receive invoices."
          />
        }
      />
      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
        title="Delete contact"
        confirmLabel="Delete"
        loading={remove.isPending}
      >
        <p>
          Delete {deleting?.name}?
          {deleting?.is_primary ? ' The client will have no primary contact.' : ''}
        </p>
      </ConfirmDialog>
    </>
  );
}
