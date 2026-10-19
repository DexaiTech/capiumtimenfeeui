import type { ClientDetail } from '../../types';
import type { ClientAbilities } from '../abilities';
import { BillingCard } from './BillingCard';
import { CentralCard } from './CentralCard';
import { DangerCard } from './DangerCard';
import { RatesCard } from './RatesCard';
import { ServicesCard } from './ServicesCard';
import { TeamCard } from './TeamCard';

export interface SettingsTabProps {
  client: ClientDetail;
  abilities: ClientAbilities;
}

/**
 * Settings: one card for each concern, each saving on its own (billing, team) or acting on its own
 * (services, rate overrides, the central link, archive).
 */
export function SettingsTab({ client, abilities }: SettingsTabProps) {
  return (
    <div className="flex flex-col gap-6">
      {abilities.readOnly ? (
        <p role="note" className="text-sm text-text-muted">
          This client was merged into another one and is read-only: its settings cannot be changed.
        </p>
      ) : null}
      <BillingCard client={client} abilities={abilities} />
      <TeamCard client={client} abilities={abilities} />
      <ServicesCard client={client} abilities={abilities} />
      <RatesCard client={client} abilities={abilities} />
      <CentralCard client={client} abilities={abilities} />
      <DangerCard client={client} abilities={abilities} />
    </div>
  );
}
