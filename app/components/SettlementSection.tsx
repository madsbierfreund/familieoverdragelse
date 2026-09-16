'use client';

import { useMemo, useState } from 'react';
import { calculate, type CalculationInput } from '@/lib/calculate';
import { fmt } from '@/lib/format';
import { calculateLoan, type LoanInput } from '@/lib/loan';
import { type LoanType, MAX_YEARS, MIN_YEARS } from '@/lib/loanConstants';
import { GIFT_YEARS } from '@/lib/constants';
import { toTodaysValue } from '@/lib/inflation';
import {
  borrowingLimit,
  calculateSettlement,
  type SettlementInput,
  type SettlementResult,
} from '@/lib/settlement';
import {
  DEFAULT_INFLATION_RATE,
  DEFAULT_NOTE_RATE,
  DEFAULT_NOTE_YEARS,
  MAX_INFLATION_RATE,
  MIN_INFLATION_RATE,
} from '@/lib/settlementConstants';
import {
  explainSettlement,
  todaysValueNote,
} from '@/lib/settlementExplanations';
import styles from '../page.module.css';
import LedgerRow from './LedgerRow';
import LoanTypePicker, { LOAN_TYPES_ANCHOR } from './LoanTypePicker';

type SettlementFieldName =
  | 'newMortgageCash'
  | 'noteRate'
  | 'noteYears'
  | 'inflation';

/** De beløb, afsnittet viser, og som kan omregnes til dagens kroner. */
const AMOUNT_KEYS = [
  'daughterOwes',
  'newMortgageCash',
  'noteAmount',
  'existingBalance',
  'existingMonthly',
  'existingAfterTax',
  'newPrincipal',
  'newMonthly',
  'newAfterTax',
  'noteMonthly',
  'noteAfterTax',
  'cashPerSibling',
  'notePerSibling',
  'siblingTotal',
  'totalDebt',
  'totalMonthly',
  'totalAfterTax',
] as const satisfies readonly (keyof SettlementResult)[];

/** Omregner de viste beløb til dagens kroner. Beregningen selv rører sig ikke. */
function inTodaysValue(
  result: SettlementResult,
  rate: number,
): SettlementResult {
  const converted = { ...result };
  for (const key of AMOUNT_KEYS) {
    converted[key] = toTodaysValue(result[key], rate, GIFT_YEARS);
  }
  return converted;
}

const RAW_DEFAULTS: Record<SettlementFieldName, string> = {
  // Udfyldes ved første visning, når belåningsgrænsen er kendt.
  newMortgageCash: '',
  noteRate: (DEFAULT_NOTE_RATE * 100).toLocaleString('da-DK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
  noteYears: String(DEFAULT_NOTE_YEARS),
  inflation: (DEFAULT_INFLATION_RATE * 100).toLocaleString('da-DK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),
};

const NEGATIVE_MESSAGE = 'Indtast positive tal.';
const NOTE_YEARS_MESSAGE = `Afdragsperioden skal være et helt antal år mellem ${MIN_YEARS} og ${MAX_YEARS}.`;
const INFLATION_MESSAGE = `Inflation skal være mellem ${MIN_INFLATION_RATE * 100} og ${MAX_INFLATION_RATE * 100} %.`;

/** Parser et tal med komma eller punktum som decimalseparator. */
function parseDecimal(raw: string): number | null {
  const trimmed = raw.trim().replace(',', '.');
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** Læser et felt som den værdi, beregningen bruger. */
function readField(name: SettlementFieldName, raw: string): number | null {
  const value = parseDecimal(raw);
  if (value === null) return null;
  return name === 'noteRate' || name === 'inflation' ? value / 100 : value;
}

function errorsFor(
  raw: Record<SettlementFieldName, string>,
  maxNewMortgageCash: number,
): string[] {
  const messages: string[] = [];
  const names = Object.keys(raw) as SettlementFieldName[];
  const values = names.map((name) => readField(name, raw[name]));

  if (values.some((value) => value === null || value < 0)) {
    messages.push(NEGATIVE_MESSAGE);
  }

  const newMortgageCash = parseDecimal(raw.newMortgageCash);
  if (newMortgageCash !== null && newMortgageCash > maxNewMortgageCash) {
    messages.push(
      `Nyt realkreditlån kan højst være ${fmt(maxNewMortgageCash)} kr.`,
    );
  }

  const noteYears = parseDecimal(raw.noteYears);
  if (
    noteYears !== null &&
    (!Number.isInteger(noteYears) ||
      noteYears < MIN_YEARS ||
      noteYears > MAX_YEARS)
  ) {
    messages.push(NOTE_YEARS_MESSAGE);
  }

  const inflation = readField('inflation', raw.inflation);
  if (
    inflation !== null &&
    (inflation < MIN_INFLATION_RATE || inflation > MAX_INFLATION_RATE)
  ) {
    messages.push(INFLATION_MESSAGE);
  }

  return messages;
}

export default function SettlementSection({
  values,
  loanInput,
  purchaseLoanType,
  deathLoanType,
  onPurchaseLoanTypeChange,
  onDeathLoanTypeChange,
}: {
  values: CalculationInput;
  loanInput: LoanInput;
  /** Lånetypen på lånet fra købet. */
  purchaseLoanType: LoanType;
  /** Lånetypen på det nye lån, der optages ved dødsfaldet. */
  deathLoanType: LoanType;
  onPurchaseLoanTypeChange: (loanType: LoanType) => void;
  onDeathLoanTypeChange: (loanType: LoanType) => void;
}) {
  const [raw, setRaw] =
    useState<Record<SettlementFieldName, string>>(RAW_DEFAULTS);
  // Så længe feltet ikke er rørt, følger det nye lån belåningsgrænsen.
  const [touched, setTouched] = useState(false);
  const [note, setNote] = useState({
    noteRate: DEFAULT_NOTE_RATE,
    noteYears: DEFAULT_NOTE_YEARS,
  });
  // Inflationen ændrer ikke beregningen, kun hvordan beløbene vises.
  const [inflation, setInflation] = useState(DEFAULT_INFLATION_RATE);
  const [showToday, setShowToday] = useState(false);
  const [chosenCash, setChosenCash] = useState(0);

  const base: Omit<SettlementInput, 'newMortgageCash'> = useMemo(() => {
    const loanResult = calculateLoan(loanInput);
    return {
      inheritance: calculate(values),
      otherAssets: values.otherAssets,
      loan: loanInput,
      loanResult,
      deathLoanType,
      ...note,
    };
  }, [values, loanInput, deathLoanType, note]);

  // Grænsen afhænger ikke af det valgte beløb, så den kan læses af en prøve.
  // Den skæres til hele kroner og bruges både til feltet, skyderen og
  // valideringen, så de aldrig er uenige om, hvad der er tilladt.
  const cashLimit = useMemo(
    () =>
      borrowingLimit(
        calculateSettlement({ ...base, newMortgageCash: 0 })
          .maxNewMortgageCash,
      ),
    [base],
  );

  const errors = errorsFor(raw, cashLimit);

  const newMortgageCash = touched
    ? Math.min(chosenCash, cashLimit)
    : cashLimit;
  const shownCash = String(newMortgageCash);
  // Feltet følger belåningsgrænsen, indtil brugeren selv vælger et beløb, og
  // et valgt beløb skæres ned, hvis ændringer længere oppe sænker grænsen.
  if (
    raw.newMortgageCash !== shownCash &&
    (!touched || chosenCash > cashLimit)
  ) {
    setRaw({ ...raw, newMortgageCash: shownCash });
    setChosenCash(newMortgageCash);
  }

  const input: SettlementInput = useMemo(
    () => ({ ...base, newMortgageCash }),
    [base, newMortgageCash],
  );
  const calculated = useMemo(() => calculateSettlement(input), [input]);
  const explanations = useMemo(
    () => explainSettlement(input, calculated),
    [input, calculated],
  );
  const result = useMemo(
    () => (showToday ? inTodaysValue(calculated, inflation) : calculated),
    [calculated, showToday, inflation],
  );

  function update(name: SettlementFieldName, text: string) {
    const next = { ...raw, [name]: text };
    setRaw(next);
    // Feltet er rørt, også når beløbet er ugyldigt, så det ikke skrives over
    // mens fejlen står.
    if (name === 'newMortgageCash') setTouched(true);
    if (errorsFor(next, cashLimit).length > 0) return;

    if (name === 'newMortgageCash') {
      setChosenCash(readField(name, text) as number);
    } else if (name === 'inflation') {
      setInflation(readField(name, text) as number);
    } else {
      setNote({
        noteRate: readField('noteRate', next.noteRate) as number,
        noteYears: readField('noteYears', next.noteYears) as number,
      });
    }
  }

  const fieldInvalid = (name: SettlementFieldName) => {
    const value = readField(name, raw[name]);
    if (value === null || value < 0) return true;
    if (name === 'newMortgageCash') return value > cashLimit;
    if (name === 'noteYears') {
      return !Number.isInteger(value) || value < MIN_YEARS || value > MAX_YEARS;
    }
    if (name === 'inflation') {
      return value < MIN_INFLATION_RATE || value > MAX_INFLATION_RATE;
    }
    return false;
  };

  const numberField = (
    name: SettlementFieldName,
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
      <h2 className={styles.subheading}>Ved farens død: udligning</h2>
      {showToday && (
        <p className={`${styles.explanation} ${styles.typeLine}`}>
          {todaysValueNote(inflation)}
        </p>
      )}

      <div className={styles.inputs}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="newMortgageCash-number">
            Nyt realkreditlån, udbetalt (kr.)
          </label>
          <input
            className={styles.slider}
            type="range"
            min={0}
            max={Math.max(0, cashLimit)}
            step={10_000}
            value={newMortgageCash}
            aria-label="Nyt realkreditlån – skyder"
            onChange={(event) => update('newMortgageCash', event.target.value)}
          />
          <input
            className={`${styles.number}${
              fieldInvalid('newMortgageCash') ? ` ${styles.numberInvalid}` : ''
            }`}
            id="newMortgageCash-number"
            type="number"
            min={0}
            step={10_000}
            value={raw.newMortgageCash}
            aria-invalid={fieldInvalid('newMortgageCash')}
            onChange={(event) => update('newMortgageCash', event.target.value)}
          />
        </div>

        {numberField('noteRate', 'Rente på pantebrev (%)', true)}
        {numberField('noteYears', 'Afdragsperiode (år)')}
        {numberField('inflation', 'Inflation (%)', true)}

        <div className={styles.fieldPlain}>
          <label className={styles.label} htmlFor="todaysValue">
            Vis i dagens kroner
          </label>
          <input
            className={styles.toggle}
            id="todaysValue"
            type="checkbox"
            checked={showToday}
            onChange={(event) => setShowToday(event.target.checked)}
          />
        </div>

        <p className={styles.error} role="alert">
          {errors.join(' ')}
        </p>
      </div>

      <section className={styles.section}>
        <div className={`${styles.figures} ${styles.figuresQuad}`}>
          <div className={styles.figure}>
            <span className={styles.figureLabel}>Datteren skal betale boet</span>
            <span className={styles.figureValue}>
              {fmt(result.daughterOwes)} kr.
            </span>
          </div>
          <div className={styles.figure}>
            <span className={styles.figureLabel}>
              Samlet gæld efter udligning
            </span>
            <span className={styles.figureValue}>
              {fmt(result.totalDebt)} kr.
            </span>
          </div>
          <div className={styles.figure}>
            <span className={styles.figureLabel}>
              Månedlig ydelse efter udligning
            </span>
            <span className={styles.figureValue}>
              {fmt(result.totalMonthly)} kr.
            </span>
          </div>
          <div className={styles.figure}>
            <span className={styles.figureLabel}>Efter skat, anslået</span>
            <span className={styles.figureValue}>
              {fmt(result.totalAfterTax)} kr.
            </span>
          </div>
        </div>
      </section>

      {result.daughterOwes === 0 ? (
        <section className={styles.section}>
          <p className={styles.statusExplanation}>{explanations.noSettlement}</p>
        </section>
      ) : (
        <section className={styles.section}>
          <table className={styles.table}>
            <caption>Datterens finansiering</caption>
            <tbody>
              <LedgerRow
                label="Skyldigt beløb til boet"
                amount={result.daughterOwes}
                explanation={explanations.daughterOwes}
              />
              <LedgerRow
                label="Nyt realkreditlån, udbetalt"
                amount={result.newMortgageCash}
                explanation={explanations.newMortgageCash}
              />
              <LedgerRow
                label="Pantebrev til søskende"
                amount={result.noteAmount}
                explanation={explanations.noteAmount}
              />
            </tbody>
          </table>
        </section>
      )}

      <section className={styles.section} id={LOAN_TYPES_ANCHOR}>
        <div className={styles.typeFields}>
          <LoanTypePicker
            name="purchaseLoanType"
            label="Låntype ved købet"
            loanType={purchaseLoanType}
            onChange={onPurchaseLoanTypeChange}
          />
          <LoanTypePicker
            name="deathLoanType"
            label="Låntype ved dødsfaldet"
            loanType={deathLoanType}
            onChange={onDeathLoanTypeChange}
          />
        </div>
      </section>

      {result.daughterOwes !== 0 && (
        <>
          <section className={styles.section}>
            <table className={`${styles.table} ${styles.tableQuad}`}>
              <caption>Datterens gæld og ydelse</caption>
              <thead>
                <tr>
                  <th scope="col"> </th>
                  <th scope="col" className={styles.amount}>
                    Gæld
                  </th>
                  <th scope="col" className={styles.amount}>
                    Pr. måned
                  </th>
                  <th scope="col" className={styles.amount}>
                    Efter skat
                  </th>
                </tr>
              </thead>
              <tbody>
                <LedgerRow
                  label="Eksisterende realkreditlån, restgæld"
                  amount={result.existingBalance}
                  second={result.existingMonthly}
                  third={result.existingAfterTax}
                  explanation={explanations.existingMortgage}
                />
                <LedgerRow
                  label="Nyt realkreditlån, hovedstol"
                  amount={result.newPrincipal}
                  second={result.newMonthly}
                  third={result.newAfterTax}
                  explanation={explanations.newMortgage}
                />
                <LedgerRow
                  label="Pantebrev til søskende"
                  amount={result.noteAmount}
                  second={result.noteMonthly}
                  third={result.noteAfterTax}
                  explanation={explanations.note}
                />
                <LedgerRow
                  label="I alt"
                  amount={result.totalDebt}
                  second={result.totalMonthly}
                  third={result.totalAfterTax}
                  explanation={explanations.debtTotal}
                  total
                />
              </tbody>
            </table>
          </section>

          <section className={styles.section}>
            <table className={styles.table}>
              <caption>Hver søskende får</caption>
              <tbody>
                <LedgerRow
                  label="Kontant ved skiftet"
                  amount={result.cashPerSibling}
                  explanation={explanations.cashPerSibling}
                />
                <LedgerRow
                  label="Pantebrev"
                  amount={result.notePerSibling}
                  explanation={explanations.notePerSibling}
                />
                <LedgerRow
                  label="I alt"
                  amount={result.siblingTotal}
                  explanation={explanations.siblingTotal}
                  total
                />
              </tbody>
            </table>
          </section>
        </>
      )}

      <p className={styles.footnote}>{explanations.footnote}</p>
    </>
  );
}
