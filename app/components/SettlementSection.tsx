'use client';

import { useEffect, useMemo, useState } from 'react';
import { calculate, type CalculationInput } from '@/lib/calculate';
import { decimal, fmt } from '@/lib/format';
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
  DEFAULT_PRICE_GROWTH,
  MAX_DEATH_YEARS,
  MAX_INFLATION_RATE,
  MAX_PRICE_GROWTH,
  MIN_DEATH_YEARS,
  MIN_INFLATION_RATE,
  MIN_PRICE_GROWTH,
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
  | 'deathYears'
  | 'inflation'
  | 'priceGrowth';

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
  'marketValueAtDeath',
  'pledgeRoom',
] as const satisfies readonly (keyof SettlementResult)[];

/** Omregner de viste beløb. Beregningen selv rører sig ikke. */
function mapAmounts(
  result: SettlementResult,
  convert: (amount: number) => number,
): SettlementResult {
  const converted = { ...result };
  for (const key of AMOUNT_KEYS) {
    converted[key] = convert(result[key]);
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
  deathYears: String(GIFT_YEARS),
  inflation: (DEFAULT_INFLATION_RATE * 100).toLocaleString('da-DK', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }),
  priceGrowth: (DEFAULT_PRICE_GROWTH * 100).toLocaleString('da-DK', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }),
};

const NEGATIVE_MESSAGE = 'Indtast positive tal.';
const NOTE_YEARS_MESSAGE = `Afdragsperioden skal være et helt antal år mellem ${MIN_YEARS} og ${MAX_YEARS}.`;
const INFLATION_MESSAGE = `Inflation skal være mellem ${MIN_INFLATION_RATE * 100} og ${MAX_INFLATION_RATE * 100} %.`;
const DEATH_YEARS_MESSAGE = `År til farens død skal være et helt antal mellem ${MIN_DEATH_YEARS} og ${MAX_DEATH_YEARS}.`;
const PRICE_GROWTH_MESSAGE = `Boligprisstigning skal være mellem ${MIN_PRICE_GROWTH * 100} og ${MAX_PRICE_GROWTH * 100} %.`;

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
  const asPercent =
    name === 'noteRate' || name === 'inflation' || name === 'priceGrowth';
  return asPercent ? value / 100 : value;
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

  const deathYears = parseDecimal(raw.deathYears);
  if (
    deathYears !== null &&
    (!Number.isInteger(deathYears) ||
      deathYears < MIN_DEATH_YEARS ||
      deathYears > MAX_DEATH_YEARS)
  ) {
    messages.push(DEATH_YEARS_MESSAGE);
  }

  const priceGrowth = readField('priceGrowth', raw.priceGrowth);
  if (
    priceGrowth !== null &&
    (priceGrowth < MIN_PRICE_GROWTH || priceGrowth > MAX_PRICE_GROWTH)
  ) {
    messages.push(PRICE_GROWTH_MESSAGE);
  }

  return messages;
}

export default function SettlementSection({
  values,
  loanInput,
  purchaseLoanType,
  deathLoanType,
  deathYears,
  onPurchaseLoanTypeChange,
  onDeathLoanTypeChange,
  onDeathYearsChange,
  onSharedChange,
}: {
  values: CalculationInput;
  loanInput: LoanInput;
  /** Lånetypen på lånet fra købet. */
  purchaseLoanType: LoanType;
  /** Lånetypen på det nye lån, der optages ved dødsfaldet. */
  deathLoanType: LoanType;
  /** År fra handlen til farens død. */
  deathYears: number;
  onPurchaseLoanTypeChange: (loanType: LoanType) => void;
  onDeathLoanTypeChange: (loanType: LoanType) => void;
  onDeathYearsChange: (years: number) => void;
  /** Melder de værdier op, som den værdiregulerede gæld også regner på. */
  onSharedChange: (shared: {
    priceGrowth: number;
    noteRate: number;
    noteYears: number;
  }) => void;
}) {
  const [raw, setRaw] = useState<Record<SettlementFieldName, string>>(() => ({
    ...RAW_DEFAULTS,
    deathYears: String(deathYears),
  }));
  // Så længe feltet ikke er rørt, følger det nye lån belåningsgrænsen.
  const [touched, setTouched] = useState(false);
  const [note, setNote] = useState({
    noteRate: DEFAULT_NOTE_RATE,
    noteYears: DEFAULT_NOTE_YEARS,
  });
  // Inflationen ændrer ikke beregningen, kun hvordan beløbene vises.
  const [inflation, setInflation] = useState(DEFAULT_INFLATION_RATE);
  const [priceGrowth, setPriceGrowth] = useState(DEFAULT_PRICE_GROWTH);

  const [chosenCash, setChosenCash] = useState(0);

  const base: Omit<SettlementInput, 'newMortgageCash'> = useMemo(() => {
    const loanResult = calculateLoan(loanInput);
    return {
      inheritance: calculate(values, deathYears),
      otherAssets: values.otherAssets,
      loan: loanInput,
      loanResult,
      deathLoanType,
      deathYears,
      priceGrowth,
      ...note,
    };
  }, [values, loanInput, deathLoanType, deathYears, priceGrowth, note]);

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

  // Årstallet bor i siden, så feltet følger med, når skyderen flyttes. Et
  // ugyldigt tal bliver stående, så fejlen kan læses.
  if (errors.length === 0 && raw.deathYears !== String(deathYears)) {
    setRaw({ ...raw, deathYears: String(deathYears) });
  }

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
  const shared = useMemo(
    () => ({ priceGrowth, noteRate: note.noteRate, noteYears: note.noteYears }),
    [priceGrowth, note],
  );
  useEffect(() => {
    onSharedChange(shared);
  }, [shared, onSharedChange]);

  const calculated = useMemo(() => calculateSettlement(input), [input]);

  // Både tallene og teksterne omregnes af den samme funktion, så hver sætning
  // stemmer med beløbene over den.
  const convert = useMemo(
    () =>
      inflation > 0
        ? (amount: number) => toTodaysValue(amount, inflation, deathYears)
        : (amount: number) => amount,
    [inflation, deathYears],
  );
  const result = useMemo(
    () => (inflation > 0 ? mapAmounts(calculated, convert) : calculated),
    [calculated, inflation, convert],
  );
  const explanations = useMemo(
    () => explainSettlement(input, calculated, convert),
    [input, calculated, convert],
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
    } else if (name === 'deathYears') {
      onDeathYearsChange(readField(name, text) as number);
    } else if (name === 'priceGrowth') {
      setPriceGrowth(readField(name, text) as number);
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
    if (name === 'deathYears') {
      return (
        !Number.isInteger(value) ||
        value < MIN_DEATH_YEARS ||
        value > MAX_DEATH_YEARS
      );
    }
    if (name === 'priceGrowth') {
      return value < MIN_PRICE_GROWTH || value > MAX_PRICE_GROWTH;
    }
    return false;
  };

  const sliderField = (
    name: SettlementFieldName,
    label: string,
    {
      min,
      max,
      step,
      value,
      display,
    }: {
      min: number;
      max: number;
      step: number;
      value: number;
      display: string;
    },
  ) => (
    <div className={styles.typeField} key={name}>
      <label className={styles.label} htmlFor={`${name}-number`}>
        {label}
      </label>
      <div className={styles.sliderRow}>
        <input
          className={styles.slider}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          aria-label={`${label} – skyder`}
          onChange={(event) => update(name, event.target.value)}
        />
        <span className={styles.sliderValue}>{display}</span>
        <input
          className={`${styles.number} ${styles.numberSmall}${
            fieldInvalid(name) ? ` ${styles.numberInvalid}` : ''
          }`}
          id={`${name}-number`}
          type="text"
          inputMode="decimal"
          value={raw[name]}
          aria-invalid={fieldInvalid(name)}
          onChange={(event) => update(name, event.target.value)}
        />
      </div>
    </div>
  );

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

      <section className={styles.section}>
        <div className={`${styles.typeFields} ${styles.typeFieldsThree}`}>
          {sliderField('deathYears', 'År til farens død', {
            min: MIN_DEATH_YEARS,
            max: MAX_DEATH_YEARS,
            step: 1,
            value: deathYears,
            display: `${deathYears} år`,
          })}
          {sliderField('inflation', 'Inflation', {
            min: MIN_INFLATION_RATE * 100,
            max: MAX_INFLATION_RATE * 100,
            step: 0.5,
            value: inflation * 100,
            display: `${decimal(inflation * 100, 1, 1)} %`,
          })}
          {sliderField('priceGrowth', 'Boligprisstigning pr. år', {
            min: MIN_PRICE_GROWTH * 100,
            max: MAX_PRICE_GROWTH * 100,
            step: 0.5,
            value: priceGrowth * 100,
            display: `${decimal(priceGrowth * 100, 1, 1)} %`,
          })}
        </div>
        <p className={`${styles.explanation} ${styles.sliderNote}`}>
          {todaysValueNote(inflation, deathYears, priceGrowth)}
        </p>
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
                <LedgerRow
                  label="Anpartens værdi ved dødsfaldet"
                  amount={result.marketValueAtDeath}
                  second={null}
                  third={null}
                  explanation={explanations.marketValueAtDeath}
                />
                <LedgerRow
                  label="Friværdi efter udligning"
                  amount={result.pledgeRoom}
                  second={null}
                  third={null}
                  explanation={explanations.pledgeRoom}
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
