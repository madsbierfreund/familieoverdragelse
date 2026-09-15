import { PURCHASE_PRICE } from './constants';
import { decimal, fmt, pct, ratePct } from './format';
import type { LoanInput, LoanResult } from './loan';
import { MIN_DOWN_PAYMENT_SHARE, MORTGAGE_LTV_MAX } from './loanConstants';

export interface LoanExplanations {
  downPayment: string;
  mortgageCash: string;
  mortgagePrincipal: string;
  bankLoan: string;
  mortgagePayment: string;
  mortgageContribution: string;
  bankMonthly: string;
  total: string;
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
  if (result.mortgageCash < result.toFinance) {
    mortgageCash += ' Resten finansieres med banklån.';
  }

  const mortgagePrincipal = [
    `Lånet udbetales til kurs ${decimal(input.bondPrice)}, så hovedstolen`,
    `skal være ${fmt(result.mortgageCash)} ÷`,
    `${decimal(input.bondPrice / 100, 2, 2)} =`,
    `${fmt(result.mortgagePrincipal)} kr. for at give det udbetalte beløb.`,
    'Låneomkostninger er ikke medregnet.',
  ].join(' ');

  const bankLoan =
    result.bankLoan > 0
      ? 'Den del af egenfinansieringen, som hverken dækkes af udbetalingen eller realkreditlånet.'
      : 'Der er ikke behov for banklån.';

  const mortgagePayment = [
    `Annuitetsydelse på ${fmt(result.mortgagePrincipal)} kr. over`,
    `${input.mortgageYears} år med en debitorrente på`,
    `${ratePct(input.mortgageRate)}.`,
  ].join(' ');

  const mortgageContribution = [
    `Bidragssats på ${ratePct(input.contributionRate)} af hovedstolen om året.`,
    'Beløbet falder i takt med afdragene.',
  ].join(' ');

  const bankMonthly =
    result.bankLoan > 0
      ? [
          `Annuitetsydelse over ${input.bankYears} år med en rente på`,
          `${ratePct(input.bankRate)}.`,
        ].join(' ')
      : 'Intet banklån.';

  const total = [
    'Ydelse før skat i det første år. Rentefradrag, ejendomsskat og',
    'fællesudgifter efter samejeoverenskomsten er ikke medregnet.',
  ].join(' ');

  return {
    downPayment,
    mortgageCash,
    mortgagePrincipal,
    bankLoan,
    mortgagePayment,
    mortgageContribution,
    bankMonthly,
    total,
  };
}
