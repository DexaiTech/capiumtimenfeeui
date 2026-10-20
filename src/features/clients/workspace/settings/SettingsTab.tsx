import type { ComponentType } from 'react';

import { useUrlParams } from '@/hooks/useUrlParams';

import type { ClientDetail } from '../../types';
import type { ClientAbilities } from '../abilities';
import { BillingCard } from './BillingCard';
import { CentralCard } from './CentralCard';
import { DangerCard } from './DangerCard';
import { RatesCard } from './RatesCard';
import { sectionFromParam, visibleSections, type SettingsSectionId } from './sections';
import { ServicesCard } from './ServicesCard';
import { SettingsSectionNav } from './SettingsSectionNav';
import { TeamCard } from './TeamCard';

export interface SettingsTabProps {
  client: ClientDetail;
  abilities: ClientAbilities;
}

const CARDS: Record<SettingsSectionId, ComponentType<SettingsTabProps>> = {
  billing: BillingCard,
  team: TeamCard,
  services: ServicesCard,
  rates: RatesCard,
  central: CentralCard,
  danger: DangerCard,
};

/**
 * Settings: a left menu of the sections and one card at a time (`?section=…`, Billing by
 * default). Each card saves on its own (billing, team) or acts on its own (services, rate
 * overrides, the central link, archive).
 */
export function SettingsTab({ client, abilities }: SettingsTabProps) {
  const { params } = useUrlParams();
  const sections = visibleSections(abilities);
  const active = sectionFromParam(params.get('section'), sections);
  const Card = CARDS[active];
  return (
    <div className="flex flex-col gap-4">
      {abilities.readOnly ? (
        <p role="note" className="text-sm text-text-muted">
          This client was merged into another one and is read-only: its settings cannot be changed.
        </p>
      ) : null}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-5">
        <SettingsSectionNav sections={sections} active={active} />
        <div className="min-w-0 flex-1">
          <Card client={client} abilities={abilities} />
        </div>
      </div>
    </div>
  );
}
