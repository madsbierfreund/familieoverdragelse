'use client';

import { useState } from 'react';
import type { CalculationInput } from '@/lib/calculate';
import { GIFT_YEARS } from '@/lib/constants';
import type { LoanInput } from '@/lib/loan';
import { DEFAULT_LOAN_TYPE, type LoanType } from '@/lib/loanConstants';
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
  // De to lån vælges hver for sig: et ved købet og et ved dødsfaldet.
  const [purchaseLoanType, setPurchaseLoanType] =
    useState<LoanType>(DEFAULT_LOAN_TYPE);
  const [deathLoanType, setDeathLoanType] =
    useState<LoanType>(DEFAULT_LOAN_TYPE);
  // Året for dødsfaldet bestemmer både eftergivelserne og udligningen.
  const [deathYears, setDeathYears] = useState(GIFT_YEARS);
  const [loanInput, setLoanInput] = useState<LoanInput>({
    ...LOAN_DEFAULTS,
    loanType: DEFAULT_LOAN_TYPE,
    marketValue: DEFAULTS.marketValue,
    ownFinancing: DEFAULTS.ownFinancing,
  });

  return (
    <main className={styles.main}>
      <InheritanceSection
        values={values}
        deathYears={deathYears}
        onChange={setValues}
      />

      <LoanSection
        marketValue={values.marketValue}
        ownFinancing={values.ownFinancing}
        loanType={purchaseLoanType}
        onInput={setLoanInput}
      />
      <SettlementSection
        values={values}
        loanInput={loanInput}
        purchaseLoanType={purchaseLoanType}
        deathLoanType={deathLoanType}
        deathYears={deathYears}
        onDeathYearsChange={setDeathYears}
        onPurchaseLoanTypeChange={setPurchaseLoanType}
        onDeathLoanTypeChange={setDeathLoanType}
      />
    </main>
  );
}
