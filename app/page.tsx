'use client';

import { useState } from 'react';
import type { CalculationInput } from '@/lib/calculate';
import InheritanceSection from './components/InheritanceSection';
import LoanSection from './components/LoanSection';
import styles from './page.module.css';

const DEFAULTS: CalculationInput = {
  marketValue: 12_000_000,
  otherAssets: 2_000_000,
  ownFinancing: 4_000_000,
};

export default function Page() {
  // Markedsværdi og egenfinansiering deles af de to beregnere.
  const [values, setValues] = useState<CalculationInput>(DEFAULTS);

  return (
    <main className={styles.main}>
      <InheritanceSection values={values} onChange={setValues} />
      <LoanSection
        marketValue={values.marketValue}
        ownFinancing={values.ownFinancing}
      />
    </main>
  );
}
