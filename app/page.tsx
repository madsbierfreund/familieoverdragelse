'use client';

import { useState } from 'react';
import type { CalculationInput } from '@/lib/calculate';
import { INTRO } from '@/lib/explanations';
import type { LoanInput } from '@/lib/loan';
import { DEFAULT_LOAN_TYPE, type LoanType } from '@/lib/loanConstants';
import InheritanceSection from './components/InheritanceSection';
import LoanSection, { LOAN_DEFAULTS } from './components/LoanSection';
import LoanTypePicker from './components/LoanTypePicker';
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
  const [loanType, setLoanType] = useState<LoanType>(DEFAULT_LOAN_TYPE);
  const [loanInput, setLoanInput] = useState<LoanInput>({
    ...LOAN_DEFAULTS,
    loanType: DEFAULT_LOAN_TYPE,
    marketValue: DEFAULTS.marketValue,
    ownFinancing: DEFAULTS.ownFinancing,
  });

  return (
    <main className={styles.main}>
      <h1 className={styles.heading}>Familieoverdragelse af anpart A</h1>
      <p className={styles.intro}>{INTRO}</p>

      <LoanTypePicker loanType={loanType} onChange={setLoanType} />
      <InheritanceSection values={values} onChange={setValues} />
      <LoanSection
        marketValue={values.marketValue}
        ownFinancing={values.ownFinancing}
        loanType={loanType}
        onInput={setLoanInput}
      />
      <SettlementSection values={values} loanInput={loanInput} />
    </main>
  );
}
