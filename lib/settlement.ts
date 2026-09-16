import type { CalculationResult } from './calculate';
import { SIBLINGS } from './constants';
import {
  annuity,
  schedule,
  taxSaving,
  type LoanInput,
  type LoanResult,
} from './loan';
import {
  LOAN_TYPES,
  type LoanType,
  MORTGAGE_LTV_MAX,
} from './loanConstants';

export interface SettlementInput {
  /** Resultatet af arveberegningen. */
  inheritance: CalculationResult;
  /** Farens øvrige formue. */
  otherAssets: number;
  /** Lånet fra finansieringsafsnittet. */
  loan: LoanInput;
  /** Resultatet af låneberegningen. */
  loanResult: LoanResult;
  /** Lånetypen på det nye lån, der optages ved dødsfaldet. */
  deathLoanType: LoanType;
  /** År fra handlen til farens død. */
  deathYears: number;
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
  /** Fradragsberettigede renter og bidrag på det eksisterende lån, første år. */
  existingDeductible: number;
  /** Fradragsberettigede renter og bidrag på det nye lån, første år. */
  newDeductible: number;
  /** Fradragsberettigede renter på pantebrevet, første år. */
  noteDeductible: number;
  /** Fradragsberettiget i alt i det første år efter dødsfaldet. */
  totalDeductible: number;
  /** Anslået skatteværdi af fradraget pr. år. */
  taxSavingYear: number;
  /** Månedlig ydelse efter skat på det eksisterende lån. */
  existingAfterTax: number;
  /** Månedlig ydelse efter skat på det nye lån. */
  newAfterTax: number;
  /** Månedlig ydelse efter skat på pantebrevet. */
  noteAfterTax: number;
  /** Samlet månedlig ydelse efter skat. */
  totalAfterTax: number;
  /** Friværdi bag realkreditlånene. */
  pledgeRoom: number;
  /** Den del af pantebrevet, der ikke er dækket af friværdi. */
  noteUnsecured: number;
}

/**
 * Skærer en lånegrænse ned til hele kroner. Grænsen må aldrig rundes op, men
 * beløb som 5.743.019,9999… skyldes afrundingsstøj og er i praksis hele
 * kroner, så en lille tolerance lægges til, før der rundes ned.
 */
export function borrowingLimit(value: number): number {
  return Math.floor(value + 1e-6);
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
    deathLoanType,
    deathYears,
    newMortgageCash,
    noteRate,
    noteYears,
  } = input;

  const deathYear = deathYears;
  const daughterOwes = inheritance.withAgreement.daughterPays;
  const daughterReceives = inheritance.withAgreement.daughterPaidOut;

  // Det eksisterende lån blev optaget ved købet og følger sin egen lånetype.
  const existingPlan = schedule(
    loanResult.mortgagePrincipal,
    loan.mortgageRate,
    loan.mortgageYears,
    LOAN_TYPES[loan.loanType].interestOnlyYears * 12,
  );
  const months = deathYear * 12;
  const existingBalance = existingPlan.balanceAfter(months);
  // Ydelsen følger afdragsplanen, men bidraget beregnes af restgælden.
  const existingMonthly =
    existingBalance > 0
      ? existingPlan.paymentInMonth(months + 1) +
        (existingBalance * loan.contributionRate) / 12
      : 0;

  const maxNewPrincipal = Math.max(
    0,
    MORTGAGE_LTV_MAX * loan.marketValue - existingBalance,
  );
  // Det nye lån optages ved dødsfaldet og har sin egen lånetype med dens
  // rente, bidragssats og kurs. En afdragsfri periode starter derfor forfra.
  const deathType = LOAN_TYPES[deathLoanType];
  const maxNewMortgageCash = Math.min(
    daughterOwes,
    (maxNewPrincipal * deathType.bondPrice) / 100,
  );

  const newPrincipal = newMortgageCash / (deathType.bondPrice / 100);
  const newPlan = schedule(
    newPrincipal,
    deathType.rate,
    loan.mortgageYears,
    deathType.interestOnlyYears * 12,
  );
  const newMonthly =
    newPlan.paymentInMonth(1) + (newPrincipal * deathType.contribution) / 12;

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

  // Renter og bidrag i det første år efter dødsfaldet er fradragsberettigede.
  // Skatteværdien fordeles på lånene efter deres andel af fradraget.
  const existingDeductible =
    existingPlan.interestInFirst(months + 12) -
    existingPlan.interestInFirst(months) +
    existingBalance * loan.contributionRate;
  const newDeductible =
    newPlan.interestInFirst(12) + newPrincipal * deathType.contribution;
  const noteDeductible = schedule(
    noteAmount,
    noteRate,
    noteYears,
  ).interestInFirst(12);
  const totalDeductible =
    existingDeductible + newDeductible + noteDeductible;

  const taxSavingYear = taxSaving(totalDeductible);
  const share = (part: number) =>
    totalDeductible > 0 ? part / totalDeductible : 0;
  const totalMonthly = existingMonthly + newMonthly + noteMonthly;

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
    totalMonthly,
    existingDeductible,
    newDeductible,
    noteDeductible,
    totalDeductible,
    taxSavingYear,
    existingAfterTax:
      existingMonthly - (taxSavingYear * share(existingDeductible)) / 12,
    newAfterTax: newMonthly - (taxSavingYear * share(newDeductible)) / 12,
    noteAfterTax: noteMonthly - (taxSavingYear * share(noteDeductible)) / 12,
    totalAfterTax: totalMonthly - taxSavingYear / 12,
    pledgeRoom,
    noteUnsecured: Math.max(0, noteAmount - pledgeRoom),
  };
}
