'use client';

import { useEffect, useMemo, useState } from 'react';
import { PURCHASE_PRICE } from '@/lib/constants';
import { decimal, fmt } from '@/lib/format';
import { calculateLoan, type LendingBasis, type LoanInput } from '@/lib/loan';
import {
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

export const LOAN_DEFAULTS: LoanSettings = {
  lendingBasis: 'market',
  downPayment: MIN_DOWN_PAYMENT_SHARE * PURCHASE_PRICE,
  mortgageRate: DEFAULT_MORTGAGE_RATE,
  contributionRate: DEFAULT_CONTRIBUTION_RATE,
  bondPrice: DEFAULT_BOND_PRICE,
  mortgageYears: DEFAULT_MORTGAGE_YEARS,
};

const LOAN_RAW_DEFAULTS: Record<LoanFieldName, string> = {
  downPayment: String(LOAN_DEFAULTS.downPayment),
  mortgageRate: decimal(DEFAULT_MORTGAGE_RATE * 100, 2, 2),
  contributionRate: decimal(DEFAULT_CONTRIBUTION_RATE * 100, 2, 2),
  bondPrice: decimal(DEFAULT_BOND_PRICE),
  mortgageYears: String(DEFAULT_MORTGAGE_YEARS),
};

/** Felter der indtastes som procent og gemmes som brøkdel. */
const RATE_FIELDS: LoanFieldName[] = ['mortgageRate', 'contributionRate'];

const LOAN_NEGATIVE_MESSAGE = 'Indtast positive tal.';
const BOND_PRICE_MESSAGE = `Kurs skal være mellem ${MIN_BOND_PRICE} og ${MAX_BOND_PRICE}.`;
const YEARS_MESSAGE = `Løbetid for realkreditlån skal være et helt antal år mellem ${MIN_YEARS} og ${MAX_YEARS}.`;

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

/** Det aktuelle sæt værdier, eller null hvis et felt ikke er et tal. */
function buildInput(
  raw: Record<LoanFieldName, string>,
  lendingBasis: LendingBasis,
  marketValue: number,
  ownFinancing: number,
): LoanInput | null {
  const values = {} as Record<LoanFieldName, number>;
  for (const name of Object.keys(raw) as LoanFieldName[]) {
    const value = readLoanField(name, raw[name]);
    if (value === null) return null;
    values[name] = value;
  }
  return { ...values, lendingBasis, marketValue, ownFinancing };
}

function sameInput(a: LoanInput, b: LoanInput): boolean {
  return (Object.keys(a) as (keyof LoanInput)[]).every(
    (key) => a[key] === b[key],
  );
}

function loanErrorsFor(
  raw: Record<LoanFieldName, string>,
  lendingBasis: LendingBasis,
  marketValue: number,
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

  const mortgageYears = parseDecimal(raw.mortgageYears);
  if (
    mortgageYears !== null &&
    (!Number.isInteger(mortgageYears) ||
      mortgageYears < MIN_YEARS ||
      mortgageYears > MAX_YEARS)
  ) {
    messages.push(YEARS_MESSAGE);
  }

  // Realkreditgrænsen afhænger også af belåningsgrundlaget og af de beløb,
  // arveberegneren leverer, så den prøves på hele sættet.
  const input = buildInput(raw, lendingBasis, marketValue, ownFinancing);
  if (input !== null && messages.length === 0) {
    const { maxMortgageCash, toFinance, minDownPaymentForLtv } =
      calculateLoan(input);
    if (toFinance > maxMortgageCash) {
      messages.push(
        `Realkredit kan højst dække ${fmt(maxMortgageCash)} kr. Kontant ` +
          `udbetaling skal derfor være mindst ${fmt(minDownPaymentForLtv)} kr.`,
      );
    }
  }

  return messages;
}

export default function LoanSection({
  marketValue,
  ownFinancing,
  onInput,
}: {
  marketValue: number;
  ownFinancing: number;
  /** Melder det senest gyldige sæt værdier op, så udligningen kan bruge det. */
  onInput: (input: LoanInput) => void;
}) {
  // `input` holder det senest gyldige sæt værdier, så resultaterne bliver
  // stående, mens man taster et ugyldigt tal. `raw` og `lendingBasis` er det,
  // felterne viser lige nu.
  const [input, setInput] = useState<LoanInput>({
    ...LOAN_DEFAULTS,
    marketValue,
    ownFinancing,
  });
  const [raw, setRaw] =
    useState<Record<LoanFieldName, string>>(LOAN_RAW_DEFAULTS);
  const [lendingBasis, setLendingBasis] = useState<LendingBasis>(
    LOAN_DEFAULTS.lendingBasis,
  );

  const errors = loanErrorsFor(raw, lendingBasis, marketValue, ownFinancing);

  // Markedsværdi og egenfinansiering kommer fra arveberegneren, så et gyldigt
  // sæt værdier kan blive ugyldigt uden et tastetryk her. Resultaterne følger
  // først med, når alle felterne passer sammen igen.
  const candidate = buildInput(raw, lendingBasis, marketValue, ownFinancing);
  if (errors.length === 0 && candidate !== null && !sameInput(candidate, input)) {
    setInput(candidate);
  }

  useEffect(() => {
    onInput(input);
  }, [input, onInput]);

  const result = useMemo(() => calculateLoan(input), [input]);
  const explanations = useMemo(
    () => explainLoan(input, result),
    [input, result],
  );

  function update(name: LoanFieldName, text: string) {
    setRaw({ ...raw, [name]: text });
  }

  const fieldInvalid = (name: LoanFieldName) => {
    const value = readLoanField(name, raw[name]);
    if (value === null || value < 0) return true;
    if (name === 'downPayment') return value > ownFinancing;
    if (name === 'bondPrice') {
      return value < MIN_BOND_PRICE || value > MAX_BOND_PRICE;
    }
    if (name === 'mortgageYears') {
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
                  checked={lendingBasis === value}
                  onChange={() => setLendingBasis(value)}
                />
                {label}
              </label>
            ))}
          </div>
          <p className={`${styles.explanation} ${styles.basisExplanation}`}>
            {explanations.lendingBasis}
          </p>
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
            <span className={styles.figureLabel}>
              Månedlig ydelse, første år
            </span>
            <span className={styles.figureValue}>
              {fmt(result.totalMonthly)} kr.
            </span>
          </div>
          <div className={styles.figure}>
            <span className={styles.figureLabel}>
              Ydelse efter skat, anslået
            </span>
            <span className={styles.figureValue}>
              {fmt(result.monthlyAfterTax)} kr.
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
              label="I alt"
              amount={result.totalMonthly}
              explanation={explanations.total}
              total
            />
            <LedgerRow
              label="Skattefradrag, anslået"
              amount={result.taxSavingMonthly}
              explanation={explanations.taxSaving}
              negative
            />
            <LedgerRow
              label="Ydelse efter skat, anslået"
              amount={result.monthlyAfterTax}
              explanation={explanations.afterTax}
              total
            />
          </tbody>
        </table>
      </section>

      <p className={styles.footnote}>{explanations.footnote}</p>
    </>
  );
}
