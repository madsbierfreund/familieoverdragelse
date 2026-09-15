import type { CalculationInput, CalculationResult } from './calculate';
import {
  ANNUAL_GIFT_ALLOWANCE,
  CHILDREN,
  GIFT_YEARS,
  MAX_FORGIVEN,
  PRICE_FACTOR,
  PUBLIC_VALUATION,
  PURCHASE_PRICE,
  SHARE_FRACTION,
} from './constants';
import { fmt } from './format';

export interface Explanations {
  purchasePrice: string;
  benefit: string;
  promissoryNote: string;
  forgiven: string;
  remainingDebt: string;
  estateAssets: string;
  estateMass: string;
  status: string;
}

const NUMBER_WORDS = [
  'nul',
  'et',
  'to',
  'tre',
  'fire',
  'fem',
  'seks',
  'syv',
  'otte',
  'ni',
  'ti',
];

/** Skriver små tal med bogstaver, så teksterne læser som almindeligt dansk. */
function word(value: number): string {
  return NUMBER_WORDS[value] ?? String(value);
}

/** Formaterer en brøkdel som procent, fx 0.8 til "80%". */
function pct(fraction: number): string {
  return `${fraction * 100}%`;
}

/**
 * Bygger de forklarende tekster til mellemregningen og statuslinjen.
 * Ren funktion uden afhængigheder til UI.
 */
export function explain(
  input: CalculationInput,
  result: CalculationResult,
): Explanations {
  const { marketValue, otherAssets, ownFinancing } = input;
  const siblings = CHILDREN - 1;

  const purchasePrice = [
    `Anpart A's andel af 2020-vurderingen er ${pct(SHARE_FRACTION)} ×`,
    `${fmt(PUBLIC_VALUATION)} = ${fmt(PUBLIC_VALUATION * SHARE_FRACTION)} kr.`,
    `Datteren køber til ${pct(PRICE_FACTOR)} heraf, som er den laveste pris`,
    'efter 20%-reglen.',
  ].join(' ');

  const benefit =
    result.benefit > 0
      ? [
          `Markedsværdien på ${fmt(marketValue)} kr. minus købesummen.`,
          'Det er den værdi, datteren får gennem den lave pris.',
          'Den er afgiftsfri, men indgår som forskud på arv.',
        ].join(' ')
      : 'Markedsværdien er ikke højere end købesummen, så datteren får ingen fordel gennem prisen.';

  const promissoryNote =
    result.promissoryNote > 0
      ? [
          'Den del af købesummen, datteren ikke selv finansierer',
          `(${fmt(PURCHASE_PRICE)} − ${fmt(ownFinancing)}).`,
          'Faren låner hende beløbet rentefrit.',
        ].join(' ')
      : 'Datteren finansierer hele købesummen selv, så der er intet gældsbrev.';

  const allowance = `Faren eftergiver ${fmt(ANNUAL_GIFT_ALLOWANCE)} kr. om året, som er det afgiftsfri beløb`;
  const gift = 'Beløbet er en gave og indgår derfor som forskud.';
  let forgiven: string;
  if (result.forgiven === 0) {
    forgiven = 'Der er ingen gæld at eftergive.';
  } else if (result.forgiven < MAX_FORGIVEN) {
    forgiven = [
      `${allowance}, men gældsbrevet er kun på`,
      `${fmt(result.promissoryNote)} kr., så eftergivelsen begrænses hertil.`,
      gift,
    ].join(' ');
  } else {
    forgiven = [
      `${allowance}.`,
      `Beregningen antager ${word(GIFT_YEARS)} års eftergivelser.`,
      gift,
    ].join(' ');
  }

  const remainingDebt = [
    'Gældsbrevet minus eftergivelserne. Datteren skylder stadig beløbet,',
    'når faren dør, og det er derfor et tilgodehavende for boet.',
  ].join(' ');

  const estateAssets = [
    `Farens øvrige formue på ${fmt(otherAssets)} kr. plus tilgodehavendet`,
    `på ${fmt(result.remainingDebt)} kr.`,
  ].join(' ');

  // Købesummen og eftergivelserne går ud af regnestykket, så beregningsmassen
  // kan skrives som øvrig formue + markedsværdi − egenfinansiering. Er
  // markedsværdien lavere end købesummen, er det købesummen der indgår.
  const effectiveValue = Math.max(marketValue, PURCHASE_PRICE);
  const valueName = marketValue < PURCHASE_PRICE ? 'købesum' : 'markedsværdi';
  const estateMass = [
    `Boets aktiver plus forskuddet på ${fmt(result.advance)} kr.`,
    `(${fmt(result.benefit)} + ${fmt(result.forgiven)}).`,
    'Forskuddet lægges fiktivt tilbage, så arven fordeles, som om datteren',
    'ikke havde fået noget i forvejen. Købesummen og antallet af',
    'eftergivelsesår går ud af regnestykket, så beregningsmassen svarer til',
    `øvrig formue + ${valueName} − egenfinansiering:`,
    `${fmt(otherAssets)} + ${fmt(effectiveValue)} − ${fmt(ownFinancing)} =`,
    `${fmt(result.estateMass)} kr.`,
    `Arvelodden er ${fmt(result.estateMass)} ÷ ${CHILDREN} =`,
    `${fmt(result.share)} kr. pr. barn.`,
  ].join(' ');

  return {
    purchasePrice,
    benefit,
    promissoryNote,
    forgiven,
    remainingDebt,
    estateAssets,
    estateMass,
    status: explainStatus(result, siblings),
  };
}

function explainStatus(result: CalculationResult, siblings: number): string {
  if (!result.advanceCovered) {
    return [
      `Datterens forskud på ${fmt(result.advance)} kr. overstiger hendes`,
      `arvelod med ${fmt(result.excess)} kr. Uden udligningsaftale får hun`,
      `ikke mere arv, men skal betale restgælden på`,
      `${fmt(result.remainingDebt)} kr., og søskendene deler boets aktiver:`,
      `${fmt(result.estateAssets)} ÷ ${siblings} =`,
      `${fmt(result.withoutAgreement.siblingEach)} kr. hver.`,
      `Med udligningsaftale betaler hun desuden ${fmt(result.excess)} kr.`,
      `til boet, så hver søskende får ${fmt(result.share)} kr.`,
    ].join(' ');
  }

  // Er forskuddet dækket, er de to scenarier ens.
  const { daughterPays, daughterPaidOut } = result.withoutAgreement;
  const inheritance = result.share - result.advance;

  let settlement: string;
  if (daughterPays > 0) {
    settlement = `Hun indbetaler derfor ${fmt(daughterPays)} kr. til boet.`;
  } else if (daughterPaidOut > 0) {
    settlement = `Hun får derfor ${fmt(daughterPaidOut)} kr. udbetalt.`;
  } else {
    settlement = 'Beløbene går lige op.';
  }

  return [
    `Datterens forskud på ${fmt(result.advance)} kr. er mindre end hendes`,
    `arvelod på ${fmt(result.share)} kr. Hun arver differencen på`,
    `${fmt(inheritance)} kr., som modregnes i restgælden på`,
    `${fmt(result.remainingDebt)} kr.`,
    settlement,
    `Hver søskende får ${fmt(result.share)} kr.`,
    'Det gælder med og uden udligningsaftale.',
  ].join(' ');
}
