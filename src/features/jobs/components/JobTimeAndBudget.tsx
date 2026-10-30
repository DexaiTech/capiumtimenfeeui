import { useRef, useState } from 'react';

import { PERMISSIONS } from '@/constants/permissions';
import { useOrg } from '@/features/organizations';
import { JobTimeCard } from '@/features/time';

import type { Job } from '../types';
import { BudgetPanel } from './BudgetPanel';

/**
 * A job's time entries (edit, delete) above its budget. Someone who sees everyone's time
 * (`time.read_all`) clicks a person's hours in the budget to list that person's entries in the
 * time card, which comes into view; "Show everyone" goes back. Key it by the job, so another job
 * starts with everyone.
 */
export function JobTimeAndBudget({ job }: { job: Job }) {
  const { can } = useOrg();
  const timeRef = useRef<HTMLDivElement>(null);
  const [person, setPerson] = useState<{ id: string; name: string } | null>(null);

  return (
    <>
      <div ref={timeRef} className="scroll-mt-4 empty:hidden">
        <JobTimeCard
          jobId={job.id}
          jobNumber={job.number}
          person={person}
          onShowEveryone={() => setPerson(null)}
        />
      </div>
      <BudgetPanel
        job={job}
        onShowTime={
          can(PERMISSIONS.timeReadAll)
            ? (picked) => {
                setPerson(picked);
                timeRef.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
              }
            : undefined
        }
      />
    </>
  );
}
