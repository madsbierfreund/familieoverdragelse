import { CHILDREN, SIBLINGS } from './constants';
import { decimal, fmt, ratePct } from './format';
import type { ValueLinkedInput, ValueLinkedResult } from './valueLinked';

export interface ValueLinkedExplanations {
  paidShare: string;
  valueAtDeath: string;
  estateShareValue: string;
  share: string;
  debtAtDeath: string;
  valueAtRedemption: string;
  siblingsGrowth: string;
  redemption: string;
  note: string;
}

/** Noten under afsnittet, som altid vises. */
export const VALUE_LINKED_NOTE = [
  'Modellen forudsætter en skriftlig aftale mellem faren og alle børn om, at',
  'gælden reguleres efter anpartens værdi. En værdireguleret gæld kan give',
  'søskendene en skattepligtig gevinst efter kursgevinstloven. Beløbene er',
  'før skat og i nominelle kroner.',
].join(' ');

/**
 * Bygger de forklarende tekster til den værdiregulerede gæld.
 * Ren funktion uden afhængigheder til UI.
 */
export function explainValueLinked(
  input: ValueLinkedInput,
  result: ValueLinkedResult,
): ValueLinkedExplanations {
  const { marketValue, otherAssets, ownFinancing, deathYears, priceGrowth } =
    input;
  const pctOf = (fraction: number) => ratePct(fraction);

  const paidShare = [
    `Datterens betaling ved handlen på ${fmt(ownFinancing)} kr. af`,
    `markedsværdien på ${fmt(marketValue)} kr. Værdistigningen på denne del`,
    'er hendes.',
  ].join(' ');

  const valueAtDeath = [
    `Ny markedsvurdering efter ${deathYears} år med`,
    `${decimal(priceGrowth * 100, 1, 1)} % årlig stigning.`,
  ].join(' ');

  const estateShareValue = `Den ubetalte andel på ${pctOf(
    result.unpaidShare,
  )} af den nye værdi.`;

  const share = [
    `Farens øvrige formue på ${fmt(otherAssets)} kr. plus boets andel af`,
    `anparten, delt mellem ${CHILDREN} børn.`,
  ].join(' ');

  const debtAtDeath =
    result.daughterReceives > 0
      ? [
          'Datterens arvelod overstiger værdien af den ubetalte andel.',
          'Der er ingen gæld at indfri.',
        ].join(' ')
      : [
          `Søskendenes ${SIBLINGS} arvelodder minus farens øvrige formue.`,
          `Gælden svarer til ${pctOf(result.siblingsShareOfProperty)} af`,
          'anparten.',
        ].join(' ');

  const valueAtRedemption =
    input.redemptionYears > 0
      ? `${input.redemptionYears} år efter dødsfaldet med samme årlige stigning.`
      : 'Indfrielse ved dødsfaldet.';

  const siblingsGrowth = [
    `Indtil indfrielsen ejer søskendene værdistigningen på`,
    `${pctOf(result.siblingsShareOfProperty)} af anparten. Datteren betaler`,
    'ingen rente i perioden.',
  ].join(' ');

  const redemption =
    input.financing === 'mortgage'
      ? [
          `Gælden på ${fmt(result.debtAtRedemption)} kr. finansieres med`,
          'realkredit på samme vilkår som købslånet, udbetalt til kurs',
          `${decimal(input.loan.bondPrice)}. Herefter tilfalder hele`,
          'værdistigningen datteren.',
        ].join(' ')
      : [
          `Afdrages over ${input.noteYears} år med ${ratePct(input.noteRate)}`,
          `i rente, i alt ${fmt(result.interestTotal)} kr. Herefter tilfalder`,
          'hele værdistigningen datteren.',
        ].join(' ');

  return {
    paidShare,
    valueAtDeath,
    estateShareValue,
    share,
    debtAtDeath,
    valueAtRedemption,
    siblingsGrowth,
    redemption,
    note: VALUE_LINKED_NOTE,
  };
}
