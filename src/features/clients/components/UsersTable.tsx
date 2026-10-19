import type { ReactNode } from 'react';

import { initialsOf } from '../format';
import type { MemberRead } from '../types';
import { Initials } from './ClientCells';

export interface UsersTableProps {
  rows: MemberRead[];
  loading: boolean;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  placeholder?: ReactNode;
}

const STATUS_TONES: Record<string, string> = {
  active: 'cc-pill cc-pill--success',
  suspended: 'cc-pill cc-pill--warning',
  invited: 'cc-pill cc-pill--info',
  removed: 'cc-pill',
};

const statusLabel = (status: string) => status.charAt(0).toUpperCase() + status.slice(1);

/** The "Users" tab: the practice's staff in the client table's style. */
export function UsersTable({
  rows,
  loading,
  hasMore,
  loadingMore,
  onLoadMore,
  placeholder,
}: UsersTableProps) {
  return (
    <div className="cc-table-card">
      <div className="cc-table-scroll">
        <table className="cc-table" style={{ minWidth: 900 }}>
          <caption className="cc-sr-only">Users</caption>
          <thead>
            <tr>
              <th scope="col" style={{ width: 'auto', paddingLeft: 14 }}>
                Name
              </th>
              <th scope="col">Role</th>
              <th scope="col">Email</th>
              <th scope="col">Status</th>
              <th scope="col">Initials</th>
              <th scope="col">Job title</th>
            </tr>
          </thead>
          <tbody>
            {placeholder ? (
              <tr className="cc-row--static">
                <td colSpan={6}>{placeholder}</td>
              </tr>
            ) : loading && rows.length === 0 ? (
              Array.from({ length: 6 }, (_, index) => (
                <tr key={index} className="cc-row--static" aria-hidden="true">
                  {Array.from({ length: 6 }, (_, cell) => (
                    <td key={cell}>
                      <span className="cc-skeleton" style={{ width: cell === 0 ? 140 : 70 }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              rows.map((member) => (
                <tr key={member.user_id} className="cc-row--static">
                  <td style={{ width: 'auto', paddingLeft: 14 }}>
                    <span className="cc-client">
                      <Initials
                        name={member.full_name}
                        initials={member.initials ?? initialsOf(member.full_name)}
                      />
                      <span
                        className="cc-client-name"
                        style={{ textTransform: 'none', maxWidth: 220 }}
                      >
                        {member.full_name}
                      </span>
                    </span>
                  </td>
                  <td>{member.role.name}</td>
                  <td>{member.email}</td>
                  <td>
                    <span className={STATUS_TONES[member.status] ?? 'cc-pill'}>
                      {statusLabel(member.status)}
                    </span>
                  </td>
                  <td>{member.initials ?? initialsOf(member.full_name)}</td>
                  <td>{member.job_title ?? ''}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      {hasMore && !placeholder ? (
        <div className="cc-load-more">
          <button type="button" className="cc-btn" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? 'Loading…' : 'Load more'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
