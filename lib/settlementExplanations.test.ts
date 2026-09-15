import { describe, expect, it } from 'vitest';
import { GIFT_YEARS, SIBLINGS } from './constants';
import { INTEREST_ONLY_YEARS, LOAN_TYPES } from './loanConstants';
import { calculateSettlement } from './settlement';
import { explainSettlement } from './settlementExplanations';
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

describe('explainSettlement', () => {
  it('forklarer hvad datteren skylder boet', () => {
    const t = texts(DEFAULTS);

    expect(t.daughterOwes).toBe(
      'Restgælden på gældsbrevet på 2.297.400 kr. plus udligningen på ' +
        '3.702.600 kr., så datteren står lige med sine søskende.',
    );
    expect(t.newMortgageCash).toContain('op til 80% af markedsværdien');
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
