import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GodavariFloodScene3D } from '../components/three/GodavariFloodScene3D';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { useAuth } from '../hooks/useAuth';
import { dataService } from '../services/dataService';

export function FloodTwin3DPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [incidents, setIncidents] = useState([]);

  useEffect(() => {
    let active = true;
    dataService
      .getMapIncidents({ userId: user?.id })
      .then((rows) => {
        if (active && Array.isArray(rows)) setIncidents(rows);
      })
      .catch(() => {
        // Scene renders cleanly even if incident list fails
      });
    return () => {
      active = false;
    };
  }, [user?.id]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-display text-lg font-bold text-[#0B2545]">
            {t('basin3d.pageTitle', { defaultValue: 'East Godavari 3D Flood Basin Twin' })}
          </h2>
          <p className="text-xs text-slate-600">
            {t('basin3d.pageSubtitle', {
              defaultValue:
                'Drag to orbit, scroll to zoom, and adjust the simulated Godavari river stage to inspect Dowleswaram Barrage sluices, low-lying residential zones, and elevated shelters.',
            })}
          </p>
        </div>
      </div>

      <ErrorBoundary sectionName="3D Flood Basin" compact>
        <GodavariFloodScene3D incidents={incidents} />
      </ErrorBoundary>
    </div>
  );
}
