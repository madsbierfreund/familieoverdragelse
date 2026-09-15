import type { CalculationResult } from './calculate';
import { GIFT_YEARS, SIBLINGS } from './constants';
import { annuity, balanceAfter, type LoanInput, type LoanResult } from './loan';
import { MORTGAGE_LTV_MAX } from './loanConstants';

export interface SettlementInput {
  /** Resultatet af arveberegningen. */
  inheritance: CalculationResult;
  /** Farens øvrige formue. */
  otherAssets: number;
  /** Lånet fra finansieringsafsnittet. */
  loan: LoanInput;
  /** Resultatet af låneberegningen. */
  loanResult: LoanResult;
  /** Udbetalt beløb på et nyt realkreditlån. */
  newMortgageCash: number;
  /** Rente på pantebrevet pr. år. */
  noteRate: number;
  /** Afdragsperiode på pantebrevet i år. */
  noteYears: number;
}

export interface SettlementResult {
  /** Antal år fra handlen til dødsfaldet. */
  deathYear: number;
  /** Hvad datteren skylder boet med udligningsaftale. */
  daughterOwes: number;
  /** Hvad datteren får udbetalt med udligningsaftale. */
  daughterReceives: number;
  /** Restgæld på det eksisterende realkreditlån ved dødsfaldet. */
  existingBalance: number;
  /** Månedlig ydelse på det eksisterende lån efter dødsfaldet. */
  existingMonthly: number;
  /** Største nye hovedstol inden for belåningsgrænsen. */
  maxNewPrincipal: number;
  /** Største udbetalte beløb på et nyt realkreditlån. */
  maxNewMortgageCash: number;
  /** Udbetalt beløb på det nye realkreditlån. */
  newMortgageCash: number;
  /** Det nye realkreditlåns hovedstol. */
  newPrincipal: number;
  /** Månedlig ydelse på det nye realkreditlån. */
  newMonthly: number;
  /** Pantebrev til søskendene. */
  noteAmount: number;
  /** Månedlig ydelse på pantebrevet. */
  noteMonthly: number;
  /** Pantebrev pr. søskende. */
  notePerSibling: number;
  /** Kontant beløb fra datteren til boet. */
  cashToEstate: number;
  /** Kontant beløb pr. søskende. */
  cashPerSibling: number;
  /** Hvad hver søskende får i alt. */
  siblingTotal: number;
  /** Datterens samlede gæld efter udligningen. */
  totalDebt: number;
  /** Datterens samlede månedlige ydelse efter udligningen. */
  totalMonthly: number;
  /** Friværdi bag realkreditlånene. */
  pledgeRoom: number;
  /** Den del af pantebrevet, der ikke er dækket af friværdi. */
  noteUnsecured: number;
}

/**
 * Beregner udligningen ved farens død, når datteren skal betale boet.
 * Ren funktion uden afhængigheder til UI.
 */
export function calculateSettlement(
  input: SettlementInput,
): SettlementResult {
  const {
    inheritance,
    otherAssets,
    loan,
    loanResult,
    newMortgageCash,
    noteRate,
    noteYears,
  } = input;

  const deathYear = GIFT_YEARS;
  const daughterOwes = inheritance.withAgreement.daughterPays;
  const daughterReceives = inheritance.withAgreement.daughterPaidOut;

  const months = Math.min(deathYear * 12, loan.mortgageYears * 12);
  const existingBalance = balanceAfter(
    loanResult.mortgagePrincipal,
    loan.mortgageRate,
    loanResult.mortgagePayment,
    months,
  );
  // Ydelsen er uændret, men bidraget beregnes af restgælden.
  const existingMonthly =
    existingBalance > 0
      ? loanResult.mortgagePayment +
        (existingBalance * loan.contributionRate) / 12
      : 0;

  const maxNewPrincipal = Math.max(
    0,
    MORTGAGE_LTV_MAX * loan.marketValue - existingBalance,
  );
  const maxNewMortgageCash = Math.min(
    daughterOwes,
    (maxNewPrincipal * loan.bondPrice) / 100,
  );

  const newPrincipal = newMortgageCash / (loan.bondPrice / 100);
  const newMonthly =
    annuity(newPrincipal, loan.mortgageRate, loan.mortgageYears) +
    (newPrincipal * loan.contributionRate) / 12;

  const noteAmount = daughterOwes - newMortgageCash;
  const noteMonthly = annuity(noteAmount, noteRate, noteYears);
  const notePerSibling = noteAmount / SIBLINGS;

  const cashToEstate = newMortgageCash;
  const cashPerSibling =
    (otherAssets + cashToEstate - daughterReceives) / SIBLINGS;

  const pledgeRoom = Math.max(
    0,
    loan.marketValue - existingBalance - newPrincipal,
  );

  return {
    deathYear,
    daughterOwes,
    daughterReceives,
    existingBalance,
    existingMonthly,
    maxNewPrincipal,
    maxNewMortgageCash,
    newMortgageCash,
    newPrincipal,
    newMonthly,
    noteAmount,
    noteMonthly,
    notePerSibling,
    cashToEstate,
    cashPerSibling,
    siblingTotal: cashPerSibling + notePerSibling,
    totalDebt: existingBalance + newPrincipal + noteAmount,
    totalMonthly: existingMonthly + newMonthly + noteMonthly,
    pledgeRoom,
    noteUnsecured: Math.max(0, noteAmount - pledgeRoom),
  };
}
