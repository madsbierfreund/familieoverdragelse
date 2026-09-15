import { PURCHASE_PRICE } from './constants';
import { decimal, fmt, pct, ratePct } from './format';
import type { LoanInput, LoanResult } from './loan';
import {
  MIN_DOWN_PAYMENT_SHARE,
  MORTGAGE_LTV_MAX,
  TAX_DEDUCTION_RATE_HIGH,
  TAX_DEDUCTION_RATE_LOW,
  TAX_DEDUCTION_THRESHOLD,
} from './loanConstants';

export interface LoanExplanations {
  lendingBasis: string;
  ownFinancing: string;
  downPayment: string;
  mortgageCash: string;
  mortgagePrincipal: string;
  mortgagePayment: string;
  mortgageContribution: string;
  total: string;
  taxSaving: string;
  afterTax: string;
  footnote: string;
}

/**
 * Bygger de forklarende tekster til låneberegningen.
 * Ren funktion uden afhængigheder til UI.
 */
export function explainLoan(
  input: LoanInput,
  result: LoanResult,
): LoanExplanations {
  const minDown = MIN_DOWN_PAYMENT_SHARE * PURCHASE_PRICE;

  const lendingBasis = [
    `Den værdi, realkreditinstituttet beregner de ${pct(MORTGAGE_LTV_MAX)} af.`,
    'Markedsværdi giver et lån på højst',
    `${fmt(MORTGAGE_LTV_MAX * Math.max(input.marketValue, PURCHASE_PRICE))} kr.`,
    `Købesum giver højst ${fmt(MORTGAGE_LTV_MAX * PURCHASE_PRICE)} kr., som`,
    'nogle institutter bruger ved familiehandel. Valget har kun betydning,',
    'hvis lånebehovet overstiger det laveste af de to beløb. Hvilket grundlag',
    'der gælder, afgøres af långiver.',
  ].join(' ');
  // Resten af købesummen er gældsbrevet til faren, jf. arveberegningen.
  const promissoryNote = PURCHASE_PRICE - input.ownFinancing;

  const ownFinancing =
    promissoryNote > 0
      ? [
          `Den del af købesummen på ${fmt(PURCHASE_PRICE)} kr., som datteren`,
          `selv finansierer. Resten på ${fmt(promissoryNote)} kr. lånes af`,
          'faren via gældsbrevet.',
        ].join(' ')
      : `Datteren finansierer hele købesummen på ${fmt(PURCHASE_PRICE)} kr. selv.`;

  let downPayment = [
    'Datterens egen betaling. Långivere kræver normalt mindst',
    `${pct(MIN_DOWN_PAYMENT_SHARE)} af købesummen, svarende til`,
    `${fmt(minDown)} kr.`,
  ].join(' ');
  if (result.downPaymentShortfall > 0) {
    downPayment += [
      '',
      `Udbetalingen er ${fmt(result.downPaymentShortfall)} kr. under dette`,
      'krav. Nogle långivere accepterer rabatten ved familiehandel som',
      'udbetaling.',
    ].join(' ');
  }

  let mortgageCash = [
    `Realkredit kan højst udgøre ${pct(MORTGAGE_LTV_MAX)} af`,
    `belåningsgrundlaget på ${fmt(result.basis)} kr., svarende til`,
    `${fmt(result.maxMortgageCash)} kr.`,
  ].join(' ');
  if (input.lendingBasis === 'market') {
    mortgageCash +=
      ' Nogle institutter bruger købesummen som grundlag ved familiehandel.';
  }

  const mortgagePrincipal = [
    `Lånet udbetales til kurs ${decimal(input.bondPrice)}, så hovedstolen`,
    `skal være ${fmt(result.mortgageCash)} ÷`,
    `${decimal(input.bondPrice / 100, 2, 2)} =`,
    `${fmt(result.mortgagePrincipal)} kr. for at give det udbetalte beløb.`,
    'Låneomkostninger er ikke medregnet.',
  ].join(' ');

  const mortgagePayment = [
    `Annuitetsydelse på ${fmt(result.mortgagePrincipal)} kr. over`,
    `${input.mortgageYears} år med en debitorrente på`,
    `${ratePct(input.mortgageRate)}.`,
  ].join(' ');

  const mortgageContribution = [
    `Bidragssats på ${ratePct(input.contributionRate)} af hovedstolen om året.`,
    'Beløbet falder i takt med afdragene.',
  ].join(' ');

  const total = [
    'Ydelse før skat i det første år. Ejendomsskat og fællesudgifter efter',
    'samejeoverenskomsten er ikke medregnet.',
  ].join(' ');

  const taxSaving = [
    'Renter og bidrag er fradragsberettigede, afdraget er ikke.',
    `Første år er det ca. ${fmt(result.deductible)} kr.`,
    `Fradraget er anslået til ca. ${pct(TAX_DEDUCTION_RATE_LOW)} af de første`,
    `${fmt(TAX_DEDUCTION_THRESHOLD)} kr. og ca. ${pct(TAX_DEDUCTION_RATE_HIGH)}`,
    `af resten, i alt ca. ${fmt(result.taxSavingYear)} kr. om året.`,
    'Den præcise værdi afhænger af kommuneskat og kirkeskat.',
  ].join(' ');

  const afterTax = [
    'Beregningen forudsætter, at datteren er enlig og ikke har anden negativ',
    'kapitalindkomst. Er hun gift, kan en uudnyttet grænse hos ægtefællen give',
    'et større fradrag.',
  ].join(' ');

  const footnote = [
    'Standardværdier: debitorrente og bidragssats fra Realkredit Danmark,',
    'januar 2026. Kursen er en antagelse. Tjek aktuelle tilbud fra långiver.',
  ].join(' ');

  return {
    lendingBasis,
    ownFinancing,
    downPayment,
    mortgageCash,
    mortgagePrincipal,
    mortgagePayment,
    mortgageContribution,
    total,
    taxSaving,
    afterTax,
    footnote,
  };
}
