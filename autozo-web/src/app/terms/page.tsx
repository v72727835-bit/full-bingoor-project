'use client';

import React from 'react';
import { LegalPage, LegalSection } from '../../components/LegalPage';
import data from '../../content/terms.json';

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms & Conditions"
      updated="Updated in January 2026"
      crumb="Terms & Conditions"
      sections={(data as LegalSection[]).slice(1)}
    />
  );
}
