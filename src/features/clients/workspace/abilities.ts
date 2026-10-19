import { PERMISSIONS as P } from '@/constants/permissions';

import { canSync, isLinked, isMergedAway } from '../central/format';
import type { ClientDetail } from '../types';

export interface ClientAbilities {
  /** A client merged into another is read-only history: nothing on it can be changed. */
  readOnly: boolean;
  /** Edit the details, the billing settings, contacts, services and the team (`client.update`). */
  edit: boolean;
  archive: boolean;
  restore: boolean;
  /** Pull the central name and address (`client.update`, linked clients). */
  sync: boolean;
  /** Link a local client to a central client (`client.create`). */
  link: boolean;
  unlink: boolean;
  seeRates: boolean;
  manageRates: boolean;
  /** The staff pickers (partner, manager, rate person) need `member.read`. */
  pickPeople: boolean;
}

/** What the caller may do with this client; UI gating only, the API checks every permission. */
export function clientAbilities(
  client: ClientDetail,
  can: (permission: string) => boolean,
): ClientAbilities {
  const readOnly = isMergedAway(client);
  const archived = client.status === 'archived';
  const seeRates = can(P.rateRead) && client.rates !== null;
  return {
    readOnly,
    edit: !readOnly && can(P.clientUpdate),
    archive: !readOnly && can(P.clientDelete) && !archived,
    restore: !readOnly && can(P.clientDelete) && can(P.clientUpdate) && archived,
    sync: !readOnly && can(P.clientUpdate) && canSync(client),
    link: !readOnly && can(P.clientCreate) && !isLinked(client),
    unlink: !readOnly && can(P.clientCreate) && isLinked(client),
    seeRates,
    manageRates: !readOnly && seeRates && can(P.rateManage),
    pickPeople: can(P.memberRead),
  };
}
