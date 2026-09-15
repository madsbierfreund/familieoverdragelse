'use client';

import { useState } from 'react';
import type { CalculationInput } from '@/lib/calculate';
import type { LoanInput } from '@/lib/loan';
import InheritanceSection from './components/InheritanceSection';
import LoanSection, { LOAN_DEFAULTS } from './components/LoanSection';
import SettlementSection from './components/SettlementSection';
import styles from './page.module.css';

const DEFAULTS: CalculationInput = {
  marketValue: 12_000_000,
  otherAssets: 2_000_000,
  ownFinancing: 4_000_000,
};

export default function Page() {
  // Markedsværdi og egenfinansiering deles af beregnerne, og udligningen
  // bygger oven på lånets værdier.
  const [values, setValues] = useState<CalculationInput>(DEFAULTS);
  const [loanInput, setLoanInput] = useState<LoanInput>({
    ...LOAN_DEFAULTS,
    marketValue: DEFAULTS.marketValue,
    ownFinancing: DEFAULTS.ownFinancing,
  });

  return (
    <main className={styles.main}>
      <InheritanceSection values={values} onChange={setValues} />
      <LoanSection
        marketValue={values.marketValue}
        ownFinancing={values.ownFinancing}
        onInput={setLoanInput}
      />
      <SettlementSection values={values} loanInput={loanInput} />
    </main>
  );
}
