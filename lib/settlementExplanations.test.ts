import { describe, expect, it } from 'vitest';
import { SIBLINGS } from './constants';
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
    expect(interestOnly.existingMortgage).toContain(
      'Lånet er stadig afdragsfrit, så restgælden er den samme som ved købet.',
    );
    expect(interestOnly.newMortgage).toContain(
      'Det nye lån får sin egen afdragsfri periode på 10 år fra dødsfaldet.',
    );

    for (const loanType of ['fixed', 'flex'] as const) {
      const t = texts(DEFAULTS, { loanType });
      expect(t.existingMortgage).not.toContain('afdragsfrit');
      expect(t.newMortgage).not.toContain('afdragsfri periode');
    }
  });

  it('henter antallet af søskende fra konstanterne', () => {
    const t = texts(DEFAULTS, { newMortgageCash: 3_000_000 });

    expect(t.cashPerSibling).toContain(`delt mellem ${SIBLINGS} søskende`);
    for (const wrong of ['fire søskende', 'tre søskende', '3 søskende']) {
      expect(t.cashPerSibling).not.toContain(wrong);
    }
  });
});
