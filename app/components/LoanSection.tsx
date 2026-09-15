'use client';

import { useMemo, useState } from 'react';
import { PURCHASE_PRICE } from '@/lib/constants';
import { decimal, fmt } from '@/lib/format';
import { calculateLoan, type LendingBasis, type LoanInput } from '@/lib/loan';
import {
  DEFAULT_BANK_RATE,
  DEFAULT_BANK_YEARS,
  DEFAULT_BOND_PRICE,
  DEFAULT_CONTRIBUTION_RATE,
  DEFAULT_MORTGAGE_RATE,
  DEFAULT_MORTGAGE_YEARS,
  MAX_BOND_PRICE,
  MAX_YEARS,
  MIN_BOND_PRICE,
  MIN_DOWN_PAYMENT_SHARE,
  MIN_YEARS,
} from '@/lib/loanConstants';
import { explainLoan } from '@/lib/loanExplanations';
import styles from '../page.module.css';
import LedgerRow from './LedgerRow';

type LoanSettings = Omit<LoanInput, 'marketValue' | 'ownFinancing'>;
type LoanFieldName = keyof Omit<LoanSettings, 'lendingBasis'>;

const LOAN_DEFAULTS: LoanSettings = {
  lendingBasis: 'market',
  downPayment: MIN_DOWN_PAYMENT_SHARE * PURCHASE_PRICE,
  mortgageRate: DEFAULT_MORTGAGE_RATE,
  contributionRate: DEFAULT_CONTRIBUTION_RATE,
  bondPrice: DEFAULT_BOND_PRICE,
  mortgageYears: DEFAULT_MORTGAGE_YEARS,
  bankRate: DEFAULT_BANK_RATE,
  bankYears: DEFAULT_BANK_YEARS,
};

const LOAN_RAW_DEFAULTS: Record<LoanFieldName, string> = {
  downPayment: String(LOAN_DEFAULTS.downPayment),
  mortgageRate: decimal(DEFAULT_MORTGAGE_RATE * 100, 2, 2),
  contributionRate: decimal(DEFAULT_CONTRIBUTION_RATE * 100, 2, 2),
  bondPrice: decimal(DEFAULT_BOND_PRICE),
  mortgageYears: String(DEFAULT_MORTGAGE_YEARS),
  bankRate: decimal(DEFAULT_BANK_RATE * 100, 2, 2),
  bankYears: String(DEFAULT_BANK_YEARS),
};

/** Felter der indtastes som procent og gemmes som brøkdel. */
const RATE_FIELDS: LoanFieldName[] = [
  'mortgageRate',
  'contributionRate',
  'bankRate',
];

const LOAN_NEGATIVE_MESSAGE = 'Indtast positive tal.';
const BOND_PRICE_MESSAGE = `Kurs skal være mellem ${MIN_BOND_PRICE} og ${MAX_BOND_PRICE}.`;
const YEARS_MESSAGE = (loan: string) =>
  `Løbetid for ${loan} skal være et helt antal år mellem ${MIN_YEARS} og ${MAX_YEARS}.`;

/** Parser et tal med komma eller punktum som decimalseparator. */
function parseDecimal(raw: string): number | null {
  const trimmed = raw.trim().replace(',', '.');
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** Læser et felt som den værdi, beregningen bruger. */
function readLoanField(name: LoanFieldName, raw: string): number | null {
  const value = parseDecimal(raw);
  if (value === null) return null;
  return RATE_FIELDS.includes(name) ? value / 100 : value;
}

function loanErrorsFor(
  raw: Record<LoanFieldName, string>,
  ownFinancing: number,
): string[] {
  const messages: string[] = [];
  const entries = Object.entries(raw) as [LoanFieldName, string][];
  const values = entries.map(([name, text]) => readLoanField(name, text));

  if (values.some((value) => value === null || value < 0)) {
    messages.push(LOAN_NEGATIVE_MESSAGE);
  }

  const downPayment = parseDecimal(raw.downPayment);
  if (downPayment !== null && downPayment > ownFinancing) {
    messages.push(
      `Kontant udbetaling kan højst være egenfinansieringen på ${fmt(
        ownFinancing,
      )} kr.`,
    );
  }

  const bondPrice = parseDecimal(raw.bondPrice);
  if (
    bondPrice !== null &&
    (bondPrice < MIN_BOND_PRICE || bondPrice > MAX_BOND_PRICE)
  ) {
    messages.push(BOND_PRICE_MESSAGE);
  }

  const years: [LoanFieldName, string][] = [
    ['mortgageYears', 'realkreditlån'],
    ['bankYears', 'banklån'],
  ];
  for (const [name, loan] of years) {
    const value = parseDecimal(raw[name]);
    if (
      value !== null &&
      (!Number.isInteger(value) || value < MIN_YEARS || value > MAX_YEARS)
    ) {
      messages.push(YEARS_MESSAGE(loan));
    }
  }

  return messages;
}

export default function LoanSection({
  marketValue,
  ownFinancing,
}: {
  marketValue: number;
  ownFinancing: number;
}) {
  // `input` holder det senest gyldige sæt værdier, så resultaterne bliver
  // stående, mens man taster et ugyldigt tal.
  const [input, setInput] = useState<LoanInput>({
    ...LOAN_DEFAULTS,
    marketValue,
    ownFinancing,
  });
  const [raw, setRaw] =
    useState<Record<LoanFieldName, string>>(LOAN_RAW_DEFAULTS);

  const errors = loanErrorsFor(raw, ownFinancing);

  // Markedsværdi og egenfinansiering kommer fra arveberegneren. En ny
  // egenfinansiering kan gøre udbetalingen for stor, og så venter opdateringen,
  // til beløbene passer sammen igen.
  if (
    errors.length === 0 &&
    (input.marketValue !== marketValue || input.ownFinancing !== ownFinancing)
  ) {
    setInput({ ...input, marketValue, ownFinancing });
  }

  const result = useMemo(() => calculateLoan(input), [input]);
  const explanations = useMemo(
    () => explainLoan(input, result),
    [input, result],
  );

  function update(name: LoanFieldName, text: string) {
    const next = { ...raw, [name]: text };
    setRaw(next);
    if (loanErrorsFor(next, ownFinancing).length === 0) {
      setInput({
        marketValue,
        ownFinancing,
        lendingBasis: input.lendingBasis,
        downPayment: readLoanField('downPayment', next.downPayment) as number,
        mortgageRate: readLoanField('mortgageRate', next.mortgageRate) as number,
        contributionRate: readLoanField(
          'contributionRate',
          next.contributionRate,
        ) as number,
        bondPrice: readLoanField('bondPrice', next.bondPrice) as number,
        mortgageYears: readLoanField(
          'mortgageYears',
          next.mortgageYears,
        ) as number,
        bankRate: readLoanField('bankRate', next.bankRate) as number,
        bankYears: readLoanField('bankYears', next.bankYears) as number,
      });
    }
  }

  const fieldInvalid = (name: LoanFieldName) => {
    const value = readLoanField(name, raw[name]);
    if (value === null || value < 0) return true;
    if (name === 'downPayment') return value > ownFinancing;
    if (name === 'bondPrice') {
      return value < MIN_BOND_PRICE || value > MAX_BOND_PRICE;
    }
    if (name === 'mortgageYears' || name === 'bankYears') {
      return !Number.isInteger(value) || value < MIN_YEARS || value > MAX_YEARS;
    }
    return false;
  };

  const numberField = (
    name: LoanFieldName,
    label: string,
    decimals = false,
  ) => (
    <div className={styles.fieldPlain} key={name}>
      <label className={styles.label} htmlFor={`${name}-number`}>
        {label}
      </label>
      <input
        className={`${styles.number}${
          fieldInvalid(name) ? ` ${styles.numberInvalid}` : ''
        }`}
        id={`${name}-number`}
        type={decimals ? 'text' : 'number'}
        inputMode="decimal"
        min={decimals ? undefined : 0}
        value={raw[name]}
        aria-invalid={fieldInvalid(name)}
        onChange={(event) => update(name, event.target.value)}
      />
    </div>
  );

  return (
    <>
      <h2 className={styles.subheading}>Finansiering af egenfinansiering</h2>

      <div className={styles.inputs}>
        <div className={`${styles.fieldPlain} ${styles.fieldWide}`}>
          <span className={styles.label} id="lendingBasis-label">
            Belåningsgrundlag
          </span>
          <div
            className={styles.radioGroup}
            role="radiogroup"
            aria-labelledby="lendingBasis-label"
          >
            {(
              [
                ['market', 'Markedsværdi'],
                ['purchase', 'Købesum'],
              ] as [LendingBasis, string][]
            ).map(([value, label]) => (
              <label className={styles.radio} key={value}>
                <input
                  type="radio"
                  name="lendingBasis"
                  value={value}
                  checked={input.lendingBasis === value}
                  onChange={() => setInput({ ...input, lendingBasis: value })}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="downPayment-number">
            Kontant udbetaling (kr.)
          </label>
          <input
            className={styles.slider}
            type="range"
            min={0}
            max={ownFinancing}
            step={10_000}
            value={Math.min(ownFinancing, Math.max(0, input.downPayment))}
            aria-label="Kontant udbetaling – skyder"
            onChange={(event) => update('downPayment', event.target.value)}
          />
          <input
            className={`${styles.number}${
              fieldInvalid('downPayment') ? ` ${styles.numberInvalid}` : ''
            }`}
            id="downPayment-number"
            type="number"
            min={0}
            step={10_000}
            value={raw.downPayment}
            aria-invalid={fieldInvalid('downPayment')}
            onChange={(event) => update('downPayment', event.target.value)}
          />
        </div>

        {numberField('mortgageRate', 'Debitorrente realkredit (%)', true)}
        {numberField('contributionRate', 'Bidragssats (%)', true)}
        {numberField('bondPrice', 'Kurs', true)}
        {numberField('mortgageYears', 'Løbetid realkredit (år)')}
        {numberField('bankRate', 'Rente banklån (%)', true)}
        {numberField('bankYears', 'Løbetid banklån (år)')}

        <p className={styles.error} role="alert">
          {errors.join(' ')}
        </p>
      </div>

      <section className={styles.section}>
        <div className={styles.figures}>
          <div className={styles.figure}>
            <span className={styles.figureLabel}>Realkreditlån (hovedstol)</span>
            <span className={styles.figureValue}>
              {fmt(result.mortgagePrincipal)} kr.
            </span>
          </div>
          <div className={styles.figure}>
            <span className={styles.figureLabel}>Banklån</span>
            <span className={styles.figureValue}>
              {fmt(result.bankLoan)} kr.
            </span>
          </div>
          <div className={styles.figure}>
            <span className={styles.figureLabel}>
              Månedlig ydelse, første år
            </span>
            <span className={styles.figureValue}>
              {fmt(result.totalMonthly)} kr.
            </span>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <table className={styles.table}>
          <caption>Fordeling</caption>
          <tbody>
            <LedgerRow
              label="Egenfinansiering"
              amount={ownFinancing}
              explanation={explanations.ownFinancing}
            />
            <LedgerRow
              label="Kontant udbetaling"
              amount={input.downPayment}
              explanation={explanations.downPayment}
            />
            <LedgerRow
              label="Realkreditlån, udbetalt"
              amount={result.mortgageCash}
              explanation={explanations.mortgageCash}
            />
            <LedgerRow
              label="Realkreditlån, hovedstol"
              amount={result.mortgagePrincipal}
              explanation={explanations.mortgagePrincipal}
            />
            <LedgerRow
              label="Banklån"
              amount={result.bankLoan}
              explanation={explanations.bankLoan}
            />
          </tbody>
        </table>
      </section>

      <section className={styles.section}>
        <table className={styles.table}>
          <caption>Månedlig ydelse, første år</caption>
          <tbody>
            <LedgerRow
              label="Realkredit, rente og afdrag"
              amount={result.mortgagePayment}
              explanation={explanations.mortgagePayment}
            />
            <LedgerRow
              label="Realkredit, bidrag"
              amount={result.mortgageContribution}
              explanation={explanations.mortgageContribution}
            />
            <LedgerRow
              label="Banklån"
              amount={result.bankMonthly}
              explanation={explanations.bankMonthly}
            />
            <LedgerRow
              label="I alt"
              amount={result.totalMonthly}
              explanation={explanations.total}
              total
            />
          </tbody>
        </table>
      </section>

      <p className={styles.footnote}>
        Standardværdier: debitorrente og bidragssats fra Realkredit Danmark,
        januar 2026. Kurs og bankrente er antagelser. Tjek aktuelle tilbud fra
        långiver.
      </p>
    </>
  );
}
