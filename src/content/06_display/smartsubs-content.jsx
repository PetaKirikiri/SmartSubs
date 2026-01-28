/**
 * SmartSubs Content Component
 * Component that goes inside the black space container - fills container height
 */

import React, { useEffect } from 'react';
import { SmartSubsParent } from './smartsubs-parent.jsx';

export function SmartSubsContent({ onCacheReadySignal }) {
  useEffect(() => {
    // Component mounted
  }, []);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxSizing: 'border-box'
      }}
    >
      <SmartSubsParent onCacheReadySignal={onCacheReadySignal} />
    </div>
  );
}
