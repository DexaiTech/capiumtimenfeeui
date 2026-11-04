import { describe, expect, it } from 'vitest';

import { OWNER_PERMISSIONS, STAFF_PERMISSIONS } from '@/test/orgFixtures';

import { techwaveDetail } from '../test/fixtures';
import { linkedDetail, mergedDetail } from '../test/workspaceFixtures';
import type { ClientDetail } from '../types';
import { clientAbilities } from './abilities';

const can = (permissions: string[]) => (permission: string) => permissions.includes(permission);
const owner = can(OWNER_PERMISSIONS);
const staff = can(STAFF_PERMISSIONS);
const archived: ClientDetail = { ...techwaveDetail, status: 'archived' };

describe('clientAbilities', () => {
  it('lets an owner edit, archive, link and manage the rates of a local client', () => {
    expect(clientAbilities(techwaveDetail, owner, true)).toEqual({
      readOnly: false,
      central: true,
      edit: true,
      archive: true,
      restore: false,
      sync: false,
      link: true,
      unlink: false,
      seeRates: true,
      manageRates: true,
      pickPeople: true,
    });
  });

  it('lets an owner synchronise and unlink a linked client, not link it again', () => {
    const abilities = clientAbilities(linkedDetail, owner, true);
    expect(abilities.sync).toBe(true);
    expect(abilities.unlink).toBe(true);
    expect(abilities.link).toBe(false);
  });

  it('restores an archived client instead of archiving it', () => {
    const abilities = clientAbilities(archived, owner, true);
    expect(abilities.archive).toBe(false);
    expect(abilities.restore).toBe(true);
  });

  it('needs client.update as well as client.delete to restore', () => {
    const noUpdate = can(OWNER_PERMISSIONS.filter((permission) => permission !== 'client.update'));
    expect(clientAbilities(archived, noUpdate, true).restore).toBe(false);
    expect(clientAbilities(techwaveDetail, noUpdate, true).archive).toBe(true);
  });

  it('treats a merged-away client as read-only history', () => {
    expect(clientAbilities(mergedDetail, owner, true)).toEqual({
      readOnly: true,
      central: true,
      edit: false,
      archive: false,
      restore: false,
      sync: false,
      link: false,
      unlink: false,
      seeRates: true,
      manageRates: false,
      pickPeople: true,
    });
  });

  it('gives a member of staff nothing to change', () => {
    expect(clientAbilities(techwaveDetail, staff, true)).toEqual({
      readOnly: false,
      central: true,
      edit: false,
      archive: false,
      restore: false,
      sync: false,
      link: false,
      unlink: false,
      seeRates: false,
      manageRates: false,
      pickPeople: true,
    });
  });

  it('hides the rates when the API left them out, whatever the role', () => {
    const abilities = clientAbilities({ ...techwaveDetail, rates: null }, owner, true);
    expect(abilities.seeRates).toBe(false);
    expect(abilities.manageRates).toBe(false);
  });

  it('may see the rates without managing them', () => {
    const readOnly = can(OWNER_PERMISSIONS.filter((permission) => permission !== 'rate.manage'));
    const abilities = clientAbilities(techwaveDetail, readOnly, true);
    expect(abilities.seeRates).toBe(true);
    expect(abilities.manageRates).toBe(false);
  });

  it('needs client.create to link or unlink', () => {
    const noCreate = can(OWNER_PERMISSIONS.filter((permission) => permission !== 'client.create'));
    expect(clientAbilities(techwaveDetail, noCreate, true).link).toBe(false);
    expect(clientAbilities(linkedDetail, noCreate, true).unlink).toBe(false);
    expect(clientAbilities(linkedDetail, noCreate, true).sync).toBe(true);
  });

  it('has nothing about Capium Central while the practice has it off', () => {
    const local = clientAbilities(techwaveDetail, owner, false);
    const linked = clientAbilities(linkedDetail, owner, false);
    expect(local.central).toBe(false);
    expect(local.link).toBe(false);
    expect(linked.sync).toBe(false);
    expect(linked.unlink).toBe(false);
    // The rest does not depend on it.
    expect(local.edit).toBe(true);
    expect(local.archive).toBe(true);
  });
});
