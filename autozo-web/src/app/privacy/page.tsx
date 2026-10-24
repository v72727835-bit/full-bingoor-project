'use client';

import React from 'react';
import { LegalPage, LegalSection } from '../../components/LegalPage';
import data from '../../content/privacy.json';

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      updated="Last updated in January 2025"
      crumb="Privacy Policy"
      sections={data as LegalSection[]}
    />
  );
}
