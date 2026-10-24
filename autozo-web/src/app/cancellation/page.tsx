'use client';

import React from 'react';
import { LegalPage, LegalSection } from '../../components/LegalPage';
import data from '../../content/cancellation.json';

export default function CancellationPage() {
  return (
    <LegalPage
      title="Cancellation Policy"
      crumb="Cancellation Policy"
      sections={(data as LegalSection[]).map((s, i) => (i === 0 ? { ...s, heading: null } : s))}
    />
  );
}
