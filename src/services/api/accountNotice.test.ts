import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { apiPath, fail, ok, server } from '@/test/server';

import { api, subscribeAccountNotice, type AccountNotice } from './index';

function recordNotices() {
  const notices: AccountNotice[] = [];
  const stop = subscribeAccountNotice((notice) => notices.push(notice));
  return { notices, stop };
}

describe('account notices', () => {
  it('announces a 403 PASSWORD_CHANGE_REQUIRED from any request, and still throws it', async () => {
    server.use(
      http.get(apiPath('/organizations/by-slug/acme'), () =>
        fail(403, 'PASSWORD_CHANGE_REQUIRED', 'Change your password to continue.'),
      ),
    );
    const { notices, stop } = recordNotices();

    await expect(api.get('/organizations/by-slug/acme')).rejects.toMatchObject({
      status: 403,
      code: 'PASSWORD_CHANGE_REQUIRED',
    });
    expect(notices).toEqual(['password-change-required']);
    stop();
  });

  it('stays quiet for other 403 answers and for success', async () => {
    server.use(
      http.get(apiPath('/a'), () => fail(403, 'PERMISSION_DENIED', 'No.')),
      http.get(apiPath('/b'), () => fail(403, 'PAGE_NOT_ALLOWED', 'Not in your role.')),
      http.get(apiPath('/c'), () => ok({})),
    );
    const { notices, stop } = recordNotices();

    await expect(api.get('/a')).rejects.toMatchObject({ code: 'PERMISSION_DENIED' });
    await expect(api.get('/b')).rejects.toMatchObject({ code: 'PAGE_NOT_ALLOWED' });
    await api.get('/c');
    expect(notices).toEqual([]);
    stop();
  });

  it('stops notifying after the listener is removed', async () => {
    server.use(http.get(apiPath('/a'), () => fail(403, 'PASSWORD_CHANGE_REQUIRED', 'Change it.')));
    const { notices, stop } = recordNotices();
    stop();
    await expect(api.get('/a')).rejects.toBeDefined();
    expect(notices).toEqual([]);
  });
});
