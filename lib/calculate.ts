import {
  ANNUAL_GIFT_ALLOWANCE,
  CHILDREN,
  GIFT_YEARS,
  PURCHASE_PRICE,
  SIBLINGS,
} from './constants';

export interface CalculationInput {
  /** Ejendommens markedsværdi for hele ejendommen. */
  marketValue: number;
  /** Farens øvrige formue. */
  otherAssets: number;
  /** Datterens egenfinansiering af købesummen. */
  ownFinancing: number;
}

export interface Scenario {
  /** Hvad datteren indbetaler til boet. */
  daughterPays: number;
  /** Hvad datteren får udbetalt i arv. */
  daughterPaidOut: number;
  /** Datterens samlede værdi (forskud + arv). */
  daughterTotal: number;
  /** Hvad hver af søskendene modtager. */
  siblingEach: number;
}

export interface CalculationResult {
  /** Gældsbrevets oprindelige hovedstol. */
  promissoryNote: number;
  /** Eftergivet gæld via årlige afgiftsfrie gaver. */
  forgiven: number;
  /** Restgæld på gældsbrevet ved farens død. */
  remainingDebt: number;
  /** Fordelen ved at købe under markedsværdi. */
  benefit: number;
  /** Forskud på arv (fordel + eftergivet gæld). */
  advance: number;
  /** Boets aktiver (øvrig formue + restgæld). */
  estateAssets: number;
  /** Beregningsmasse (boets aktiver + forskud). */
  estateMass: number;
  /** Arvelod pr. barn. */
  share: number;
  /** Øvrig formue der skal til, før forskuddet er dækket af arvelodden. */
  equalityAssets: number;
  /** Hvor meget forskuddet overstiger arvelodden (0 hvis dækket). */
  excess: number;
  /** Om forskuddet er dækket af arvelodden. */
  advanceCovered: boolean;
  /** Fordeling uden udligningsaftale. */
  withoutAgreement: Scenario;
  /** Fordeling med udligningsaftale. */
  withAgreement: Scenario;
}

/**
 * Beregner arvefordelingen mellem datteren og hendes søskende.
 * Ren funktion uden afhængigheder til UI.
 */
export function calculate(
  input: CalculationInput,
  /** År fra handlen til farens død, og dermed antal eftergivelser. */
  deathYears: number = GIFT_YEARS,
): CalculationResult {
  const { marketValue, otherAssets, ownFinancing } = input;

  const promissoryNote = PURCHASE_PRICE - ownFinancing;
  const forgiven = Math.min(deathYears * ANNUAL_GIFT_ALLOWANCE, promissoryNote);
  const remainingDebt = promissoryNote - forgiven;

  const benefit = Math.max(0, marketValue - PURCHASE_PRICE);
  const advance = benefit + forgiven;

  const estateAssets = otherAssets + remainingDebt;
  const estateMass = estateAssets + advance;
  const share = estateMass / CHILDREN;

  const equalityAssets = Math.max(0, SIBLINGS * advance - remainingDebt);

  const advanceCovered = advance <= share;
  const excess = advanceCovered ? 0 : advance - share;

  let withoutAgreement: Scenario;
  let withAgreement: Scenario;

  if (advanceCovered) {
    const inheritance = share - advance;
    const net = inheritance - remainingDebt;
    const scenario: Scenario = {
      daughterPays: Math.max(0, -net),
      daughterPaidOut: Math.max(0, net),
      daughterTotal: advance + inheritance,
      siblingEach: share,
    };
    withoutAgreement = scenario;
    withAgreement = { ...scenario };
  } else {
    withoutAgreement = {
      daughterPays: remainingDebt,
      daughterPaidOut: 0,
      daughterTotal: advance,
      siblingEach: estateAssets / SIBLINGS,
    };
    withAgreement = {
      daughterPays: remainingDebt + excess,
      daughterPaidOut: 0,
      daughterTotal: share,
      siblingEach: share,
    };
  }

  return {
    promissoryNote,
    forgiven,
    remainingDebt,
    benefit,
    advance,
    estateAssets,
    estateMass,
    share,
    equalityAssets,
    excess,
    advanceCovered,
    withoutAgreement,
    withAgreement,
  };
}
