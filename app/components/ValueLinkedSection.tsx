'use client';

import { useMemo, useState } from 'react';
import type { CalculationInput } from '@/lib/calculate';
import { fmt, ratePct } from '@/lib/format';
import { calculateLoan, type LoanInput } from '@/lib/loan';
import { LOAN_TYPES } from '@/lib/loanConstants';
import { MAX_DEATH_YEARS } from '@/lib/settlementConstants';
import {
  calculateValueLinked,
  type RedemptionFinancing,
  type ValueLinkedInput,
} from '@/lib/valueLinked';
import {
  explainValueLinked,
  VALUE_LINKED_NOTE,
} from '@/lib/valueLinkedExplanations';
import styles from '../page.module.css';
import LedgerRow from './LedgerRow';

const FINANCING: [RedemptionFinancing, string][] = [
  ['mortgage', 'Realkreditlån'],
  ['note', 'Pantebrev til søskende'],
];

const YEARS_MESSAGE = `Indfrielse skal være et helt antal år mellem 0 og ${MAX_DEATH_YEARS}.`;

/** Parser et tal med komma eller punktum som decimalseparator. */
function parseDecimal(raw: string): number | null {
  const trimmed = raw.trim().replace(',', '.');
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

export default function ValueLinkedSection({
  values,
  loanInput,
  deathYears,
  priceGrowth,
  noteRate,
  noteYears,
}: {
  values: CalculationInput;
  loanInput: LoanInput;
  deathYears: number;
  priceGrowth: number;
  noteRate: number;
  noteYears: number;
}) {
  // Det senest gyldige valg, så resultatet bliver stående ved et ugyldigt input.
  const [redemptionYears, setRedemptionYears] = useState(0);
  const [financing, setFinancing] = useState<RedemptionFinancing>('mortgage');
  const [raw, setRaw] = useState('0');

  const loan = useMemo(() => {
    const purchase = calculateLoan(loanInput);
    return {
      rate: loanInput.mortgageRate,
      contributionRate: loanInput.contributionRate,
      bondPrice: loanInput.bondPrice,
      mortgageYears: loanInput.mortgageYears,
      interestOnlyYears: LOAN_TYPES[loanInput.loanType].interestOnlyYears,
      mortgagePrincipal: purchase.mortgagePrincipal,
    };
  }, [loanInput]);

  const candidate: ValueLinkedInput = useMemo(
    () => ({
      marketValue: values.marketValue,
      otherAssets: values.otherAssets,
      ownFinancing: values.ownFinancing,
      deathYears,
      priceGrowth,
      redemptionYears,
      financing,
      noteRate,
      noteYears,
      loan,
    }),
    [
      values,
      deathYears,
      priceGrowth,
      redemptionYears,
      financing,
      noteRate,
      noteYears,
      loan,
    ],
  );
  const candidateResult = useMemo(
    () => calculateValueLinked(candidate),
    [candidate],
  );

  // Kan realkredit ikke dække indfrielsen, bliver det senest gyldige valg
  // stående, så tallene ikke viser et lån, der ikke kan optages.
  const [input, setInput] = useState<ValueLinkedInput>(candidate);
  if (candidateResult.valid && input !== candidate) {
    setInput(candidate);
  }

  const result = useMemo(() => calculateValueLinked(input), [input]);
  const explanations = useMemo(
    () => explainValueLinked(input, result),
    [input, result],
  );

  const parsed = parseDecimal(raw);
  const yearsInvalid =
    parsed === null ||
    !Number.isInteger(parsed) ||
    parsed < 0 ||
    parsed > MAX_DEATH_YEARS;

  const errors: string[] = [];
  if (yearsInvalid) errors.push(YEARS_MESSAGE);
  if (!candidateResult.valid) {
    errors.push(
      `Realkredit kan højst dække ${fmt(candidateResult.maxPrincipal)} kr. ved ` +
        'indfrielsen. Vælg pantebrev til søskende eller en tidligere ' +
        'indfrielse.',
    );
  }

  function update(text: string) {
    setRaw(text);
    const value = parseDecimal(text);
    if (
      value !== null &&
      Number.isInteger(value) &&
      value >= 0 &&
      value <= MAX_DEATH_YEARS
    ) {
      setRedemptionYears(value);
    }
  }

  return (
    <>
      <h2 className={styles.subheading}>Værdireguleret gæld til søskende</h2>

      <div className={styles.inputs}>
        <div className={styles.typeField}>
          <label className={styles.label} htmlFor="redemptionYears-number">
            Indfrielse efter farens død
          </label>
          <div className={styles.sliderRow}>
            <input
              className={styles.slider}
              type="range"
              min={0}
              max={MAX_DEATH_YEARS}
              step={1}
              value={redemptionYears}
              aria-label="Indfrielse efter farens død – skyder"
              onChange={(event) => update(event.target.value)}
            />
            <span className={styles.sliderValue}>
              {redemptionYears === 0 ? 'ved dødsfaldet' : `${redemptionYears} år`}
            </span>
            <input
              className={`${styles.number} ${styles.numberSmall}${
                yearsInvalid ? ` ${styles.numberInvalid}` : ''
              }`}
              id="redemptionYears-number"
              type="text"
              inputMode="decimal"
              value={raw}
              aria-invalid={yearsInvalid}
              onChange={(event) => update(event.target.value)}
            />
          </div>
        </div>

        <div className={`${styles.fieldPlain} ${styles.fieldWide}`}>
          <span className={styles.label} id="financing-label">
            Finansiering af indfrielsen
          </span>
          <div
            className={styles.radioGroup}
            role="radiogroup"
            aria-labelledby="financing-label"
          >
            {FINANCING.map(([value, label]) => (
              <label className={styles.radio} key={value}>
                <input
                  type="radio"
                  name="redemptionFinancing"
                  value={value}
                  checked={financing === value}
                  onChange={() => setFinancing(value)}
                />
                {label}
              </label>
            ))}
          </div>
        </div>

        <p className={styles.error} role="alert">
          {errors.join(' ')}
        </p>
      </div>

      <section className={styles.section}>
        <div className={`${styles.figures} ${styles.figuresQuad}`}>
          <div className={styles.figure}>
            <span className={styles.figureLabel}>Gæld ved dødsfaldet</span>
            <span className={styles.figureValue}>
              {fmt(result.debtAtDeath)} kr.
            </span>
          </div>
          <div className={styles.figure}>
            <span className={styles.figureLabel}>Gæld ved indfrielsen</span>
            <span className={styles.figureValue}>
              {fmt(result.debtAtRedemption)} kr.
            </span>
          </div>
          <div className={styles.figure}>
            <span className={styles.figureLabel}>
              Søskendenes værdistigning
            </span>
            <span className={styles.figureValue}>
              {fmt(result.siblingsGrowth)} kr.
            </span>
          </div>
          <div className={styles.figure}>
            <span className={styles.figureLabel}>
              Månedlig ydelse efter indfrielsen
            </span>
            <span className={styles.figureValue}>
              {fmt(result.monthly)} kr.
            </span>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <table className={styles.table}>
          <caption>Ved dødsfaldet</caption>
          <tbody>
            <LedgerRow
              label="Datterens betalte andel"
              amount={result.paidShare}
              display={ratePct(result.paidShare)}
              explanation={explanations.paidShare}
            />
            <LedgerRow
              label="Anpartens værdi ved dødsfaldet"
              amount={result.valueAtDeath}
              explanation={explanations.valueAtDeath}
            />
            <LedgerRow
              label="Boets andel af anparten"
              amount={result.estateShareValue}
              explanation={explanations.estateShareValue}
            />
            <LedgerRow
              label="Arvelod pr. barn"
              amount={result.share}
              explanation={explanations.share}
            />
            {result.daughterReceives > 0 ? (
              <LedgerRow
                label="Datteren får udbetalt"
                amount={result.daughterReceives}
                explanation={explanations.debtAtDeath}
                total
              />
            ) : (
              <LedgerRow
                label="Gæld til søskende"
                amount={result.debtAtDeath}
                explanation={explanations.debtAtDeath}
                total
              />
            )}
          </tbody>
        </table>
      </section>

      {result.daughterReceives === 0 && (
        <section className={styles.section}>
          <table className={styles.table}>
            <caption>Indfrielse</caption>
            <thead>
              <tr>
                <th scope="col"> </th>
                <th scope="col" className={styles.amount}>
                  Beløb
                </th>
                <th scope="col" className={styles.amount}>
                  Pr. måned
                </th>
              </tr>
            </thead>
            <tbody>
              <LedgerRow
                label="Anpartens værdi ved indfrielsen"
                amount={result.valueAtRedemption}
                second={null}
                explanation={explanations.valueAtRedemption}
              />
              <LedgerRow
                label="Søskendenes værdistigning"
                amount={result.siblingsGrowth}
                second={null}
                explanation={explanations.siblingsGrowth}
              />
              {input.financing === 'mortgage' ? (
                <LedgerRow
                  label="Realkreditlån, hovedstol"
                  amount={result.principal}
                  second={result.monthly}
                  explanation={explanations.redemption}
                />
              ) : (
                <LedgerRow
                  label="Pantebrev til søskende"
                  amount={result.debtAtRedemption}
                  second={result.monthly}
                  explanation={explanations.redemption}
                />
              )}
            </tbody>
          </table>
        </section>
      )}

      <p className={styles.footnote}>{VALUE_LINKED_NOTE}</p>
    </>
  );
}
