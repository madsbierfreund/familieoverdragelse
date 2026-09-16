import { SIBLINGS } from './constants';
import { decimal, fmt, pct, ratePct } from './format';
import {
  INTEREST_ONLY_YEARS,
  LOAN_TYPES,
  MORTGAGE_LTV_MAX,
} from './loanConstants';
import type { SettlementInput, SettlementResult } from './settlement';

/** Linjen under skyderne, der siger hvilke kroner beløbene er vist i. */
export function todaysValueNote(
  rate: number,
  years: number,
  priceGrowth: number,
): string {
  if (rate <= 0) return 'Beløbene er vist i kroner på dødstidspunktet.';

  return [
    `Beløbene i afsnittet er vist i dagens kroner med`,
    `${decimal(rate * 100, 1, 1)} % årlig inflation over ${years} år.`,
    'Faste ydelser stiger ikke med inflationen, men deres værdi falder.',
    priceGrowth > 0
      ? `Anpartens værdi stiger med ${decimal(priceGrowth * 100, 1, 1)} % om året.`
      : 'Anpartens værdi forudsættes uændret i kroner.',
  ].join(' ');
}

export interface SettlementExplanations {
  /** Vises i stedet for tabellerne, når datteren intet skylder. */
  noSettlement: string;
  daughterOwes: string;
  newMortgageCash: string;
  noteAmount: string;
  existingMortgage: string;
  marketValueAtDeath: string;
  pledgeRoom: string;
  newMortgage: string;
  note: string;
  debtTotal: string;
  cashPerSibling: string;
  notePerSibling: string;
  siblingTotal: string;
  footnote: string;
}

/**
 * Bygger de forklarende tekster til udligningen ved farens død.
 * Ren funktion uden afhængigheder til UI.
 */
export function explainSettlement(
  input: SettlementInput,
  result: SettlementResult,
  /** Omregner beløb, fx til dagens kroner. Uden den står beløbene som de er. */
  convert: (amount: number) => number = (amount) => amount,
): SettlementExplanations {
  const { inheritance, otherAssets, loan, deathLoanType, noteRate, noteYears } =
    input;
  // Beløb, der følger omregningen. Markedsværdien gør ikke, jf. noten.
  const kr = (amount: number) => fmt(convert(amount));

  const noSettlement =
    'Datterens arv dækker restgælden. Hun skal ikke betale noget til boet' +
    (result.daughterReceives > 0
      ? `, men får ${kr(result.daughterReceives)} kr. udbetalt.`
      : '.');

  const daughterOwes = inheritance.advanceCovered
    ? [
        `Restgælden på gældsbrevet på ${kr(inheritance.remainingDebt)} kr.`,
        `minus datterens arv på`,
        `${kr(inheritance.share - inheritance.advance)} kr.`,
      ].join(' ')
    : [
        `Restgælden på gældsbrevet på ${kr(inheritance.remainingDebt)} kr.`,
        `plus udligningen på ${kr(inheritance.excess)} kr., så datteren står`,
        'lige med sine søskende.',
      ].join(' ');

  const newMortgageCash = [
    `Anparten kan belånes med op til ${pct(MORTGAGE_LTV_MAX)} af anpartens`,
    `værdi ved dødsfaldet på ${kr(result.marketValueAtDeath)} kr. Efter det`,
    `eksisterende lån er der plads til højst`,
    `${kr(result.maxNewMortgageCash)} kr. udbetalt. Om datteren kan få lånet,`,
    'afhænger af hendes indkomst og långivers kreditvurdering.',
  ].join(' ');

  const noteAmount =
    result.noteAmount > 0
      ? [
          'Resten afvikles over for søskendene med et pantebrev i anparten,',
          `fordelt med ${kr(result.notePerSibling)} kr. til hver.`,
        ].join(' ')
      : 'Hele beløbet dækkes af det nye realkreditlån, så der er ikke behov for et pantebrev.';

  // Det eksisterende lån følger lånetypen fra købet, det nye sin egen.
  const purchaseInterestOnly =
    LOAN_TYPES[loan.loanType].interestOnlyYears * 12;
  const deathType = LOAN_TYPES[deathLoanType];
  const stillInterestOnly = result.deathYear * 12 < purchaseInterestOnly;

  const existingMortgage = stillInterestOnly
    ? [
        `Restgælden efter ${result.deathYear} år. Lånet er stadig`,
        'afdragsfrit, så restgælden og ydelsen er de samme som ved købet.',
      ].join(' ')
    : [
        `Restgælden efter ${result.deathYear} års afdrag. Ydelsen er uændret,`,
        'men bidraget beregnes nu af restgælden.',
      ].join(' ');

  let newMortgage = [
    `Låntype: ${deathType.label}.`,
    'Samme løbetid som det eksisterende lån.',
  ].join(' ');
  if (deathType.interestOnlyYears > 0) {
    newMortgage += [
      '',
      `Lånet får sin egen afdragsfri periode på ${INTEREST_ONLY_YEARS} år fra`,
      'dødsfaldet.',
    ].join(' ');
  }

  let note: string;
  if (result.noteAmount > 0) {
    note = [
      `Annuitetsydelse over ${noteYears} år med en rente på`,
      `${ratePct(noteRate)}. Renten er skattepligtig for søskendene og`,
      'fradragsberettiget for datteren. Et rentefrit pantebrev med fast',
      'løbetid kan udløse skat, fordi gaver mellem søskende er',
      'indkomstskattepligtige.',
    ].join(' ');
  } else {
    note = 'Intet pantebrev.';
  }
  if (result.noteUnsecured > 0) {
    note += [
      '',
      `Friværdien bag realkreditlånene er kun ${kr(result.pledgeRoom)} kr.,`,
      `så ${kr(result.noteUnsecured)} kr. af pantebrevet er uden reel`,
      'sikkerhed.',
    ].join(' ');
  }

  const marketValueAtDeath =
    input.priceGrowth > 0
      ? [
          `Markedsværdien i dag på ${kr(loan.marketValue)} kr. med`,
          `${decimal(input.priceGrowth * 100, 1, 1)} % årlig stigning over`,
          `${result.deathYear} år. Stigningen tilfalder datteren, fordi`,
          'forskuddet opgøres til værdien ved handlen.',
        ].join(' ')
      : 'Markedsværdien forudsættes uændret.';

  const pledgeRoom =
    result.noteAmount > 0
      ? [
          'Anpartens værdi minus begge realkreditlån. Pantebrevet til',
          'søskendene har pant i denne friværdi.',
        ].join(' ')
      : 'Anpartens værdi minus begge realkreditlån.';

  const debtTotal = [
    'Ydelse før skat. Afdraget på pantebrevet giver ikke fradrag.',
    'Efter skat er anslået med samme fradragssatser som ved købet, beregnet',
    'af datterens samlede renter og bidrag i det første år efter dødsfaldet',
    'og fordelt på lånene efter deres andel af fradraget. Fradragsberettiget',
    `i alt ca. ${kr(result.totalDeductible)} kr. om året.`,
  ].join(' ');

  const cashPerSibling = [
    `Farens øvrige formue på ${kr(otherAssets)} kr. plus det kontante beløb`,
    `fra datteren på ${kr(result.cashToEstate)} kr.`,
    result.daughterReceives > 0
      ? `, minus ${kr(result.daughterReceives)} kr. udbetalt til datteren,`
      : ',',
    `delt mellem ${SIBLINGS} søskende.`,
  ]
    .join(' ')
    .replace(' ,', ',');

  const notePerSibling =
    result.noteAmount > 0
      ? `Afdrages over ${noteYears} år.`
      : 'Intet pantebrev.';

  const siblingTotal = `Svarer til arvelodden på ${kr(inheritance.share)} kr.`;

  const footnote = [
    `Forudsætninger: dødsfald efter ${result.deathYear} år,`,
    'boligprisstigning efter den valgte sats, nyt lån med samme løbetid som',
    'det eksisterende og vilkår efter den valgte låntype. Boafgift,',
    'boomkostninger og låneomkostninger er ikke medregnet.',
  ].join(' ');

  return {
    noSettlement,
    daughterOwes,
    newMortgageCash,
    noteAmount,
    existingMortgage,
    marketValueAtDeath,
    pledgeRoom,
    newMortgage,
    note,
    debtTotal,
    cashPerSibling,
    notePerSibling,
    siblingTotal,
    footnote,
  };
}
