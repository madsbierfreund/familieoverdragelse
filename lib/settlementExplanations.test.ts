import { describe, expect, it } from 'vitest';
import { GIFT_YEARS, SIBLINGS } from './constants';
import { toTodaysValue } from './inflation';
import { INTEREST_ONLY_YEARS, LOAN_TYPES } from './loanConstants';
import { calculateSettlement } from './settlement';
import {
  explainSettlement,
  todaysValueNote,
} from './settlementExplanations';
import { DEFAULT_INFLATION_RATE } from './settlementConstants';
import { settlementInput } from './testFixtures';

const DEFAULTS = {
  marketValue: 12_000_000,
  otherAssets: 2_000_000,
  ownFinancing: 4_000_000,
};

function texts(
  values: typeof DEFAULTS,
  overrides: Parameters<typeof settlementInput>[1] = {},
) {
  const input = settlementInput(values, overrides);
  return explainSettlement(input, calculateSettlement(input));
}

/** Læser de danske beløb ud af en sætning, så den kan efterregnes. */
function amountsIn(text: string): number[] {
  return [...text.matchAll(/([\d.]+) kr\./g)].map((match) =>
    Number(match[1].replaceAll('.', '')),
  );
}

describe('explainSettlement i dagens kroner', () => {
  const input = settlementInput(DEFAULTS);
  const result = calculateSettlement(input);
  const convert = (amount: number) =>
    toTodaysValue(amount, DEFAULT_INFLATION_RATE, GIFT_YEARS);
  const today = explainSettlement(input, result, convert);

  it('lader hver sætning stemme med beløbet over den', () => {
    const [otherAssets, cashToEstate] = amountsIn(today.cashPerSibling);

    expect((otherAssets + cashToEstate) / SIBLINGS).toBeCloseTo(
      convert(result.cashPerSibling),
      0,
    );
  });

  it('omregner de øvrige beløb i teksterne', () => {
    expect(amountsIn(today.siblingTotal)[0]).toBeCloseTo(
      convert(result.siblingTotal),
      0,
    );
    expect(amountsIn(today.debtTotal)[0]).toBeCloseTo(
      convert(result.totalDeductible),
      0,
    );
  });

  it('omregner pantebrevet til hver søskende', () => {
    // Et afdragsfrit lån ved købet levner et pantebrev at fordele.
    const withNote = settlementInput(DEFAULTS, {
      loanType: 'fixedInterestOnly',
    });
    const noteResult = calculateSettlement(withNote);
    const texts = explainSettlement(withNote, noteResult, convert);

    expect(amountsIn(texts.noteAmount)[0]).toBeCloseTo(
      convert(noteResult.notePerSibling),
      0,
    );
  });

  it('omregner også anpartens værdi', () => {
    const [value, limit] = amountsIn(today.newMortgageCash);

    expect(value).toBeCloseTo(convert(result.marketValueAtDeath), 0);
    expect(limit).toBeCloseTo(convert(result.maxNewMortgageCash), 0);
  });

  it('lader teksterne stå uændret uden omregning', () => {
    expect(explainSettlement(input, result)).toEqual(
      explainSettlement(input, result, (amount) => amount),
    );
    expect(explainSettlement(input, result).cashPerSibling).toBe(
      'Farens øvrige formue på 2.000.000 kr. plus det kontante beløb fra ' +
        `datteren på 6.000.000 kr., delt mellem ${SIBLINGS} søskende.`,
    );
  });
});

describe('explainSettlement', () => {
  it('forklarer hvad datteren skylder boet', () => {
    const t = texts(DEFAULTS);

    expect(t.daughterOwes).toBe(
      'Restgælden på gældsbrevet på 2.297.400 kr. plus udligningen på ' +
        '3.702.600 kr., så datteren står lige med sine søskende.',
    );
    expect(t.newMortgageCash).toContain(
      'op til 80% af anpartens værdi ved dødsfaldet på 12.000.000 kr.',
    );
    expect(t.noteAmount).toContain('ikke behov for et pantebrev');
    expect(t.existingMortgage).toContain('efter 5 års afdrag');
  });

  it('forklarer arven, når den dækker restgælden', () => {
    const t = texts({ ...DEFAULTS, otherAssets: 40_000_000 });

    expect(t.daughterOwes).toBe(
      'Restgælden på gældsbrevet på 2.297.400 kr. minus datterens arv på ' +
        '3.897.400 kr.',
    );
    expect(t.noSettlement).toBe(
      'Datterens arv dækker restgælden. Hun skal ikke betale noget til ' +
        'boet, men får 1.600.000 kr. udbetalt.',
    );
  });

  it('forklarer pantebrevet og fordelingen til søskendene', () => {
    const t = texts(DEFAULTS, { newMortgageCash: 3_000_000 });

    expect(t.noteAmount).toContain('fordelt med 750.000 kr. til hver');
    expect(t.note).toContain('over 10 år med en rente på 4,00%');
    expect(t.notePerSibling).toBe('Afdrages over 10 år.');
    expect(t.siblingTotal).toBe('Svarer til arvelodden på 2.000.000 kr.');
    expect(t.cashPerSibling).toBe(
      'Farens øvrige formue på 2.000.000 kr. plus det kontante beløb fra ' +
        `datteren på 3.000.000 kr., delt mellem ${SIBLINGS} søskende.`,
    );
  });

  it('advarer, når pantebrevet ikke er dækket af friværdi', () => {
    // Et pres-scenarie: anparten er for lidt værd til at bære både
    // realkreditlånet og pantebrevet.
    const t = texts({
      marketValue: 2_000_000,
      otherAssets: 0,
      ownFinancing: 0,
    });

    expect(t.note).toContain('uden reel sikkerhed');
    expect(t.note).toContain('Friværdien bag realkreditlånene er kun');
  });

  it('nævner afdragsfriheden kun ved den afdragsfri lånetype', () => {
    const interestOnly = texts(DEFAULTS, { loanType: 'fixedInterestOnly' });

    // Et afdragsfrit lån har hverken afdraget eller en uændret ydelse at nævne.
    expect(interestOnly.existingMortgage).toBe(
      `Restgælden efter ${GIFT_YEARS} år. Lånet er stadig afdragsfrit, så ` +
        'restgælden og ydelsen er de samme som ved købet.',
    );
    expect(interestOnly.existingMortgage).not.toContain('års afdrag');
    expect(interestOnly.existingMortgage).not.toContain(
      'Ydelsen er uændret, men',
    );
    expect(interestOnly.newMortgage).toContain(
      `Lånet får sin egen afdragsfri periode på ${INTEREST_ONLY_YEARS} år ` +
        'fra dødsfaldet.',
    );

    for (const loanType of ['fixed', 'flex'] as const) {
      const t = texts(DEFAULTS, { loanType });
      expect(t.existingMortgage).toBe(
        `Restgælden efter ${GIFT_YEARS} års afdrag. Ydelsen er uændret, men ` +
          'bidraget beregnes nu af restgælden.',
      );
      expect(t.existingMortgage).not.toContain('afdragsfrit');
      expect(t.newMortgage).not.toContain('afdragsfri periode');
    }
  });

  it('forklarer anpartens værdi og friværdien', () => {
    const flat = texts(DEFAULTS);
    expect(flat.marketValueAtDeath).toBe('Markedsværdien forudsættes uændret.');
    expect(flat.pledgeRoom).toBe('Anpartens værdi minus begge realkreditlån.');

    const growing = texts(DEFAULTS, { priceGrowth: 0.02 });
    expect(growing.marketValueAtDeath).toBe(
      'Markedsværdien i dag på 12.000.000 kr. med 2,0 % årlig stigning over ' +
        `${GIFT_YEARS} år. Stigningen tilfalder datteren, fordi forskuddet ` +
        'opgøres til værdien ved handlen.',
    );

    // Et pantebrev har pant i friværdien.
    const withNote = texts(DEFAULTS, { loanType: 'fixedInterestOnly' });
    expect(withNote.pledgeRoom).toContain(
      'Pantebrevet til søskendene har pant i denne friværdi.',
    );
  });

  it('nævner boligprisstigningen i noten under skyderne', () => {
    expect(todaysValueNote(0.03, GIFT_YEARS, 0.02)).toContain(
      'Anpartens værdi stiger med 2,0 % om året.',
    );
    expect(todaysValueNote(0.03, GIFT_YEARS, 0)).toContain(
      'Anpartens værdi forudsættes uændret i kroner.',
    );
    expect(todaysValueNote(0, GIFT_YEARS, 0.02)).toBe(
      'Beløbene er vist i kroner på dødstidspunktet.',
    );
  });

  it('beskriver hvert lån ud fra dets egen lånetype', () => {
    const t = texts(DEFAULTS, {
      loanType: 'fixedInterestOnly',
      deathLoanType: 'flex',
    });

    // Lånet fra købet er afdragsfrit, det nye er et flexlån med afdrag.
    expect(t.existingMortgage).toContain('Lånet er stadig afdragsfrit');
    expect(t.newMortgage).toBe(
      `Låntype: ${LOAN_TYPES.flex.label}. Samme løbetid som det ` +
        'eksisterende lån.',
    );
    expect(t.newMortgage).not.toContain('afdragsfri periode');

    const other = texts(DEFAULTS, {
      loanType: 'fixed',
      deathLoanType: 'fixedInterestOnly',
    });
    expect(other.existingMortgage).not.toContain('afdragsfrit');
    expect(other.newMortgage).toContain(
      `Låntype: ${LOAN_TYPES.fixedInterestOnly.label}.`,
    );
    expect(other.newMortgage).toContain(
      `afdragsfri periode på ${INTEREST_ONLY_YEARS} år`,
    );
  });

  it('henter antallet af søskende fra konstanterne', () => {
    const t = texts(DEFAULTS, { newMortgageCash: 3_000_000 });

    expect(t.cashPerSibling).toContain(`delt mellem ${SIBLINGS} søskende`);
    for (const wrong of ['fire søskende', 'tre søskende', '3 søskende']) {
      expect(t.cashPerSibling).not.toContain(wrong);
    }
  });
});
