import { useState } from 'react';
import { useApp } from '../../lib/use-app';
import { PageHeader, Segmented } from '../../components/ui';
import { AchievementsTab } from './AchievementsTab';
import { CollectionTab } from './CollectionTab';
import { CreatureSheet } from './CreatureSheet';
import { ShopTab } from './ShopTab';
import { TeamTab } from './TeamTab';

type Tab = 'equipo' | 'coleccion' | 'tienda' | 'logros';

const TABS: { value: Tab; label: string }[] = [
  { value: 'equipo', label: 'Equipo' },
  { value: 'coleccion', label: 'Colección' },
  { value: 'tienda', label: 'Tienda' },
  { value: 'logros', label: 'Logros' },
];

export function CreaturesView() {
  const { game } = useApp();
  const [tab, setTab] = useState<Tab>('equipo');
  const [open, setOpen] = useState<string | null>(null);

  return (
    <>
      <PageHeader
        title="Criaturas"
        subtitle={`Entrenador nivel ${game.level} · ${game.pesetas} pesetas`}
      />
      <Segmented
        value={tab}
        options={TABS}
        onChange={setTab}
        className="mb-5 max-w-full overflow-x-auto"
      />

      {tab === 'equipo' && <TeamTab onOpen={setOpen} />}
      {tab === 'coleccion' && <CollectionTab />}
      {tab === 'tienda' && <ShopTab />}
      {tab === 'logros' && <AchievementsTab />}

      {open && <CreatureSheet key={open} habitId={open} onClose={() => setOpen(null)} />}
    </>
  );
}
