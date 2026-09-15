import { SIBLINGS } from './constants';
import { fmt, pct, ratePct } from './format';
import {
  INTEREST_ONLY_YEARS,
  LOAN_TYPES,
  MORTGAGE_LTV_MAX,
} from './loanConstants';
import type { SettlementInput, SettlementResult } from './settlement';

export interface SettlementExplanations {
  /** Vises i stedet for tabellerne, når datteren intet skylder. */
  noSettlement: string;
  daughterOwes: string;
  newMortgageCash: string;
  noteAmount: string;
  existingMortgage: string;
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
): SettlementExplanations {
  const { inheritance, otherAssets, loan, noteRate, noteYears } = input;

  const noSettlement =
    'Datterens arv dækker restgælden. Hun skal ikke betale noget til boet' +
    (result.daughterReceives > 0
      ? `, men får ${fmt(result.daughterReceives)} kr. udbetalt.`
      : '.');

  const daughterOwes = inheritance.advanceCovered
    ? [
        `Restgælden på gældsbrevet på ${fmt(inheritance.remainingDebt)} kr.`,
        `minus datterens arv på`,
        `${fmt(inheritance.share - inheritance.advance)} kr.`,
      ].join(' ')
    : [
        `Restgælden på gældsbrevet på ${fmt(inheritance.remainingDebt)} kr.`,
        `plus udligningen på ${fmt(inheritance.excess)} kr., så datteren står`,
        'lige med sine søskende.',
      ].join(' ');

  const newMortgageCash = [
    `Anparten kan belånes med op til ${pct(MORTGAGE_LTV_MAX)} af`,
    `markedsværdien på ${fmt(loan.marketValue)} kr. Efter det eksisterende`,
    `lån er der plads til højst ${fmt(result.maxNewMortgageCash)} kr.`,
    'udbetalt. Om datteren kan få lånet, afhænger af hendes indkomst og',
    'långivers kreditvurdering.',
  ].join(' ');

  const noteAmount =
    result.noteAmount > 0
      ? [
          'Resten afvikles over for søskendene med et pantebrev i anparten,',
          `fordelt med ${fmt(result.notePerSibling)} kr. til hver.`,
        ].join(' ')
      : 'Hele beløbet dækkes af det nye realkreditlån, så der er ikke behov for et pantebrev.';

  const interestOnlyMonths = LOAN_TYPES[loan.loanType].interestOnlyYears * 12;
  const stillInterestOnly = result.deathYear * 12 < interestOnlyMonths;

  let existingMortgage = [
    `Restgælden efter ${result.deathYear} års afdrag. Ydelsen er uændret,`,
    'men bidraget beregnes nu af restgælden.',
  ].join(' ');
  if (stillInterestOnly) {
    existingMortgage +=
      ' Lånet er stadig afdragsfrit, så restgælden er den samme som ved købet.';
  }

  let newMortgage =
    'Samme rente, bidragssats, kurs og løbetid som det eksisterende lån.';
  if (interestOnlyMonths > 0) {
    newMortgage += [
      '',
      `Det nye lån får sin egen afdragsfri periode på ${INTEREST_ONLY_YEARS}`,
      'år fra dødsfaldet.',
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
      `Friværdien bag realkreditlånene er kun ${fmt(result.pledgeRoom)} kr.,`,
      `så ${fmt(result.noteUnsecured)} kr. af pantebrevet er uden reel`,
      'sikkerhed.',
    ].join(' ');
  }

  const debtTotal =
    'Ydelse før skat. Afdraget på pantebrevet giver ikke fradrag.';

  const cashPerSibling = [
    `Farens øvrige formue på ${fmt(otherAssets)} kr. plus det kontante beløb`,
    `fra datteren på ${fmt(result.cashToEstate)} kr.`,
    result.daughterReceives > 0
      ? `, minus ${fmt(result.daughterReceives)} kr. udbetalt til datteren,`
      : ',',
    `delt mellem ${SIBLINGS} søskende.`,
  ]
    .join(' ')
    .replace(' ,', ',');

  const notePerSibling =
    result.noteAmount > 0
      ? `Afdrages over ${noteYears} år.`
      : 'Intet pantebrev.';

  const siblingTotal = `Svarer til arvelodden på ${fmt(inheritance.share)} kr.`;

  const footnote = [
    `Forudsætninger: dødsfald efter ${result.deathYear} år, uændret`,
    'markedsværdi, nyt lån på samme vilkår som det eksisterende. Boafgift,',
    'boomkostninger og låneomkostninger er ikke medregnet.',
  ].join(' ');

  return {
    noSettlement,
    daughterOwes,
    newMortgageCash,
    noteAmount,
    existingMortgage,
    newMortgage,
    note,
    debtTotal,
    cashPerSibling,
    notePerSibling,
    siblingTotal,
    footnote,
  };
}
