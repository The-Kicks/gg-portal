import { useState, useCallback } from 'react';
import type { HydratedEntity } from '../../../types';

/**
 * Manages foundational top-level entity attributes like name, operational status, and standalone flags.
 */
export const useStandardEntityAttributes = (originalEntity: HydratedEntity | undefined) => {
  const [name, setName] = useState<string>(() => originalEntity?.name || '');
  const [status, setStatus] = useState<string>(() => originalEntity?.status || 'active');
  const [isStandalone, setIsStandalone] = useState<boolean>(() => originalEntity?.isStandalone || false);

  const resetStandardAttributes = useCallback((entity: HydratedEntity | undefined) => {
    setName(entity?.name || '');
    setStatus(entity?.status || 'active');
    setIsStandalone(entity?.isStandalone || false);
  }, []);

  return {
    name,
    setName,
    status,
    setStatus,
    isStandalone,
    setIsStandalone,
    resetStandardAttributes,
  };
};