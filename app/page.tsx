'use client';

import { useMemo, useState } from 'react';
import { calculate, type CalculationInput } from '@/lib/calculate';
import {
  ANNUAL_GIFT_ALLOWANCE,
  GIFT_YEARS,
  PRICE_FACTOR,
  PUBLIC_VALUATION,
  PURCHASE_PRICE,
  SHARE_FRACTION,
} from '@/lib/constants';
import styles from './page.module.css';

type FieldName = keyof CalculationInput;

const DEFAULTS: CalculationInput = {
  marketValue: 12_000_000,
  otherAssets: 2_000_000,
  ownFinancing: 4_000_000,
};

const FIELDS: {
  name: FieldName;
  label: string;
  min: number;
  max: number;
  step: number;
}[] = [
  {
    name: 'marketValue',
    label: 'Markedsværdi (kr.)',
    min: 6_000_000,
    max: 18_000_000,
    step: 100_000,
  },
  {
    name: 'otherAssets',
    label: 'Øvrig formue (kr.)',
    min: 0,
    max: 30_000_000,
    step: 100_000,
  },
  {
    name: 'ownFinancing',
    label: 'Egenfinansiering (kr.)',
    min: 0,
    max: PURCHASE_PRICE,
    step: 100_000,
  },
];

const NEGATIVE_MESSAGE = 'Indtast positive beløb.';
const OWN_FINANCING_MESSAGE = `Egenfinansiering kan højst være købesummen på ${fmt(
  PURCHASE_PRICE,
)} kr.`;

/** Afrunder til hele kroner og formaterer dansk. */
function fmt(value: number): string {
  return Math.round(value).toLocaleString('da-DK');
}

/** Parser et inputfelt. Returnerer null hvis feltet ikke er et tal. */
function parse(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

function errorsFor(raw: Record<FieldName, string>): string[] {
  const messages: string[] = [];
  const values = FIELDS.map((field) => parse(raw[field.name]));

  if (values.some((value) => value === null || value < 0)) {
    messages.push(NEGATIVE_MESSAGE);
  }

  const ownFinancing = parse(raw.ownFinancing);
  if (ownFinancing !== null && ownFinancing > PURCHASE_PRICE) {
    messages.push(OWN_FINANCING_MESSAGE);
  }

  return messages;
}

export default function Page() {
  // `values` holder altid det senest gyldige input, så resultaterne bliver
  // stående mens man taster et ugyldigt beløb.
  const [values, setValues] = useState<CalculationInput>(DEFAULTS);
  const [raw, setRaw] = useState<Record<FieldName, string>>({
    marketValue: String(DEFAULTS.marketValue),
    otherAssets: String(DEFAULTS.otherAssets),
    ownFinancing: String(DEFAULTS.ownFinancing),
  });

  const errors = errorsFor(raw);
  const result = useMemo(() => calculate(values), [values]);

  function update(name: FieldName, text: string) {
    const next = { ...raw, [name]: text };
    setRaw(next);
    if (errorsFor(next).length === 0) {
      setValues({
        marketValue: parse(next.marketValue) as number,
        otherAssets: parse(next.otherAssets) as number,
        ownFinancing: parse(next.ownFinancing) as number,
      });
    }
  }

  const fieldInvalid = (name: FieldName) => {
    const value = parse(raw[name]);
    if (value === null || value < 0) return true;
    return name === 'ownFinancing' && value > PURCHASE_PRICE;
  };

  return (
    <main className={styles.main}>
      <h1 className={styles.heading}>Familieoverdragelse af anpart A</h1>
      <p className={styles.intro}>
        Fordeling mellem datteren og tre søskende ved salg efter 20%-reglen og
        efterfølgende arv.
      </p>

      <div className={styles.inputs}>
        {FIELDS.map((field) => {
          const sliderValue = Math.min(
            field.max,
            Math.max(field.min, values[field.name]),
          );
          return (
            <div className={styles.field} key={field.name}>
              <label className={styles.label} htmlFor={`${field.name}-number`}>
                {field.label}
              </label>
              <input
                className={styles.slider}
                type="range"
                min={field.min}
                max={field.max}
                step={field.step}
                value={sliderValue}
                aria-label={`${field.label} – skyder`}
                onChange={(event) => update(field.name, event.target.value)}
              />
              <input
                className={`${styles.number}${
                  fieldInvalid(field.name) ? ` ${styles.numberInvalid}` : ''
                }`}
                id={`${field.name}-number`}
                type="number"
                min={0}
                step={field.step}
                value={raw[field.name]}
                aria-invalid={fieldInvalid(field.name)}
                onChange={(event) => update(field.name, event.target.value)}
              />
            </div>
          );
        })}
        <p className={styles.error} role="alert">
          {errors.join(' ')}
        </p>
      </div>

      <section className={styles.section}>
        <div className={styles.figures}>
          <div className={styles.figure}>
            <span className={styles.figureLabel}>Forskud</span>
            <span className={styles.figureValue}>{fmt(result.advance)} kr.</span>
          </div>
          <div className={styles.figure}>
            <span className={styles.figureLabel}>Arvelod pr. barn</span>
            <span className={styles.figureValue}>{fmt(result.share)} kr.</span>
          </div>
          <div className={styles.figure}>
            <span className={styles.figureLabel}>Formue for ligestilling</span>
            <span className={styles.figureValue}>
              {fmt(result.equalityAssets)} kr.
            </span>
          </div>
        </div>
      </section>

      <section className={styles.section}>
        <table className={styles.table}>
          <caption>Mellemregning</caption>
          <tbody>
            <tr>
              <th scope="row">
                Købesum
                <span className={styles.note}>
                  {SHARE_FRACTION * 100}% × {fmt(PUBLIC_VALUATION)} ×{' '}
                  {PRICE_FACTOR * 100}%
                </span>
              </th>
              <td className={styles.amount}>{fmt(PURCHASE_PRICE)} kr.</td>
            </tr>
            <tr>
              <th scope="row">
                Fordel
                <span className={styles.note}>markedsværdi − købesum</span>
              </th>
              <td className={styles.amount}>{fmt(result.benefit)} kr.</td>
            </tr>
            <tr>
              <th scope="row">
                Gældsbrev
                <span className={styles.note}>købesum − egenfinansiering</span>
              </th>
              <td className={styles.amount}>{fmt(result.promissoryNote)} kr.</td>
            </tr>
            <tr>
              <th scope="row">
                Eftergivet gæld
                <span className={styles.note}>
                  maks. {GIFT_YEARS} × {fmt(ANNUAL_GIFT_ALLOWANCE)}
                </span>
              </th>
              <td className={styles.amount}>{fmt(result.forgiven)} kr.</td>
            </tr>
            <tr>
              <th scope="row">Restgæld på gældsbrev</th>
              <td className={styles.amount}>{fmt(result.remainingDebt)} kr.</td>
            </tr>
            <tr>
              <th scope="row">Boets aktiver</th>
              <td className={styles.amount}>{fmt(result.estateAssets)} kr.</td>
            </tr>
            <tr className={styles.total}>
              <th scope="row">Beregningsmasse</th>
              <td className={styles.amount}>{fmt(result.estateMass)} kr.</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className={styles.section}>
        <p
          className={`${styles.status} ${
            result.advanceCovered ? styles.statusCovered : styles.statusExcess
          }`}
        >
          {result.advanceCovered
            ? 'Forskuddet er dækket af arvelodden. Udligning er ikke nødvendig.'
            : `Forskuddet overstiger arvelodden med ${fmt(result.excess)} kr.`}
        </p>
      </section>

      <section className={styles.section}>
        <table className={styles.table}>
          <caption>Uden udligningsaftale</caption>
          <thead>
            <tr>
              <th scope="col"> </th>
              <th scope="col" className={styles.amount}>
                Datteren
              </th>
              <th scope="col" className={styles.amount}>
                Hver søskende
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Indbetaler til boet</th>
              <td className={styles.amount}>
                {fmt(result.withoutAgreement.daughterPays)} kr.
              </td>
              <td className={styles.amount}>0 kr.</td>
            </tr>
            <tr>
              <th scope="row">Arv udbetalt</th>
              <td className={styles.amount}>
                {fmt(result.withoutAgreement.daughterPaidOut)} kr.
              </td>
              <td className={styles.amount}>
                {fmt(result.withoutAgreement.siblingEach)} kr.
              </td>
            </tr>
            <tr className={styles.total}>
              <th scope="row">Samlet værdi</th>
              <td className={styles.amount}>
                {fmt(result.withoutAgreement.daughterTotal)} kr.
              </td>
              <td className={styles.amount}>
                {fmt(result.withoutAgreement.siblingEach)} kr.
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className={styles.section}>
        <table className={styles.table}>
          <caption>Med udligningsaftale</caption>
          <thead>
            <tr>
              <th scope="col"> </th>
              <th scope="col" className={styles.amount}>
                Datteren
              </th>
              <th scope="col" className={styles.amount}>
                Hver søskende
              </th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Indbetaler til boet</th>
              <td className={styles.amount}>
                {fmt(result.withAgreement.daughterPays)} kr.
              </td>
              <td className={styles.amount}>0 kr.</td>
            </tr>
            <tr>
              <th scope="row">Arv udbetalt</th>
              <td className={styles.amount}>
                {fmt(result.withAgreement.daughterPaidOut)} kr.
              </td>
              <td className={styles.amount}>
                {fmt(result.withAgreement.siblingEach)} kr.
              </td>
            </tr>
            <tr className={styles.total}>
              <th scope="row">Samlet værdi</th>
              <td className={styles.amount}>
                {fmt(result.withAgreement.daughterTotal)} kr.
              </td>
              <td className={styles.amount}>
                {fmt(result.withAgreement.siblingEach)} kr.
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <p className={styles.footnote}>
        Faste forudsætninger: 2020-vurdering {fmt(PUBLIC_VALUATION)} kr.,
        anpartsbrøk 50/100, fem års eftergivelser, ugift far, ingen boafgift
        eller boomkostninger.
      </p>
    </main>
  );
}
