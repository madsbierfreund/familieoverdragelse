import { CHILDREN, SIBLINGS } from './constants';
import { annuity, schedule } from './loan';
import { MORTGAGE_LTV_MAX } from './loanConstants';

/** Hvordan indfrielsen finansieres. */
export type RedemptionFinancing = 'note' | 'mortgage';

/** Vilkårene på købslånet, som et nyt realkreditlån følger. */
export interface PurchaseLoanTerms {
  rate: number;
  contributionRate: number;
  bondPrice: number;
  mortgageYears: number;
  interestOnlyYears: number;
  mortgagePrincipal: number;
}

export interface ValueLinkedInput {
  marketValue: number;
  otherAssets: number;
  ownFinancing: number;
  /** År fra handlen til farens død. */
  deathYears: number;
  /** Årlig stigning i boligpriserne. */
  priceGrowth: number;
  /** År fra dødsfaldet til indfrielsen. */
  redemptionYears: number;
  financing: RedemptionFinancing;
  noteRate: number;
  noteYears: number;
  loan: PurchaseLoanTerms;
}

export interface ValueLinkedResult {
  /** Den andel af anparten, datteren selv har betalt. */
  paidShare: number;
  /** Den ubetalte andel, som tilhører faren. */
  unpaidShare: number;
  /** Anpartens værdi ved dødsfaldet. */
  valueAtDeath: number;
  /** Boets andel af anparten. */
  estateShareValue: number;
  /** Beregningsmasse i boet. */
  estateMass: number;
  /** Arvelod pr. barn. */
  share: number;
  /** Søskendenes arvelodder minus farens øvrige formue. */
  netAtDeath: number;
  /** Datterens gæld til søskendene ved dødsfaldet. */
  debtAtDeath: number;
  /** Hvad datteren i stedet får udbetalt, hvis arven overstiger gælden. */
  daughterReceives: number;
  /** Søskendenes andel af anparten. */
  siblingsShareOfProperty: number;
  /** Datterens andel af anparten. */
  daughterShareOfProperty: number;
  /** Anpartens værdi ved indfrielsen. */
  valueAtRedemption: number;
  /** Gælden ved indfrielsen, reguleret med anpartens værdi. */
  debtAtRedemption: number;
  /** Søskendenes værdistigning fra dødsfaldet til indfrielsen. */
  siblingsGrowth: number;
  /** Månedlig ydelse efter indfrielsen. */
  monthly: number;
  /** Samlede renter på et pantebrev. */
  interestTotal: number;
  /** Hovedstolen på et nyt realkreditlån. */
  principal: number;
  /** Restgæld på købslånet ved indfrielsen. */
  existingAtRedemption: number;
  /** Største nye hovedstol inden for belåningsgrænsen. */
  maxPrincipal: number;
  /** Om indfrielsen kan finansieres som valgt. */
  valid: boolean;
}

/**
 * Beregner en værdireguleret gæld til søskendene og indfrielsen af den.
 * Ren funktion uden afhængigheder til UI.
 */
export function calculateValueLinked(
  input: ValueLinkedInput,
): ValueLinkedResult {
  const {
    marketValue,
    otherAssets,
    ownFinancing,
    deathYears,
    priceGrowth,
    redemptionYears,
    financing,
    noteRate,
    noteYears,
    loan,
  } = input;

  // Datteren ejer værdistigningen på den del, hun selv har betalt.
  const paidShare =
    marketValue > 0 ? Math.min(1, ownFinancing / marketValue) : 0;
  const unpaidShare = 1 - paidShare;

  const valueAtDeath = marketValue * Math.pow(1 + priceGrowth, deathYears);
  const estateShareValue = unpaidShare * valueAtDeath;
  const estateMass = otherAssets + estateShareValue;
  const share = estateMass / CHILDREN;

  const netAtDeath = SIBLINGS * share - otherAssets;
  const debtAtDeath = Math.max(0, netAtDeath);
  const daughterReceives = Math.max(0, -netAtDeath);

  const siblingsShareOfProperty =
    valueAtDeath > 0 ? debtAtDeath / valueAtDeath : 0;

  const growth = Math.pow(1 + priceGrowth, redemptionYears);
  const valueAtRedemption = valueAtDeath * growth;
  const existingAtRedemption = schedule(
    loan.mortgagePrincipal,
    loan.rate,
    loan.mortgageYears,
    loan.interestOnlyYears * 12,
  ).balanceAfter((deathYears + redemptionYears) * 12);
  const maxPrincipal = Math.max(
    0,
    MORTGAGE_LTV_MAX * valueAtRedemption - existingAtRedemption,
  );

  // Er der ingen gæld, er der heller intet at indfri.
  if (debtAtDeath === 0) {
    return {
      paidShare,
      unpaidShare,
      valueAtDeath,
      estateShareValue,
      estateMass,
      share,
      netAtDeath,
      debtAtDeath,
      daughterReceives,
      siblingsShareOfProperty,
      daughterShareOfProperty: 1,
      valueAtRedemption: 0,
      debtAtRedemption: 0,
      siblingsGrowth: 0,
      monthly: 0,
      interestTotal: 0,
      principal: 0,
      existingAtRedemption: 0,
      maxPrincipal: 0,
      valid: true,
    };
  }

  const debtAtRedemption = debtAtDeath * growth;

  // Gælden følger anpartens værdi, indtil den indfries.
  const principal =
    financing === 'mortgage' ? debtAtRedemption / (loan.bondPrice / 100) : 0;
  const monthly =
    financing === 'mortgage'
      ? schedule(
          principal,
          loan.rate,
          loan.mortgageYears,
          loan.interestOnlyYears * 12,
        ).paymentInMonth(1) +
        (principal * loan.contributionRate) / 12
      : annuity(debtAtRedemption, noteRate, noteYears);
  const interestTotal =
    financing === 'note' ? monthly * noteYears * 12 - debtAtRedemption : 0;

  return {
    paidShare,
    unpaidShare,
    valueAtDeath,
    estateShareValue,
    estateMass,
    share,
    netAtDeath,
    debtAtDeath,
    daughterReceives,
    siblingsShareOfProperty,
    daughterShareOfProperty: 1 - siblingsShareOfProperty,
    valueAtRedemption,
    debtAtRedemption,
    siblingsGrowth: debtAtRedemption - debtAtDeath,
    monthly,
    interestTotal,
    principal,
    existingAtRedemption,
    maxPrincipal,
    valid: financing === 'mortgage' ? principal <= maxPrincipal : true,
  };
}
