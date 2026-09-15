import { describe, expect, it } from 'vitest';
import { PURCHASE_PRICE } from './constants';
import { calculateLoan, type LoanInput } from './loan';
import { LOAN_TYPES, type LoanType } from './loanConstants';
import { explainLoan, LOAN_TYPE_EXPLANATIONS } from './loanExplanations';
import { loanInput } from './testFixtures';

const BASE = loanInput('fixed');

function texts(input: LoanInput) {
  return explainLoan(input, calculateLoan(input));
}

describe('LOAN_TYPE_EXPLANATIONS', () => {
  it('har en tekst til hver lånetype', () => {
    for (const type of Object.keys(LOAN_TYPES) as LoanType[]) {
      expect(LOAN_TYPE_EXPLANATIONS[type].length).toBeGreaterThan(40);
    }
  });

  it('henter den afdragsfri periode og belåningsgrænsen fra konstanterne', () => {
    expect(LOAN_TYPE_EXPLANATIONS.fixedInterestOnly).toContain(
      'De første 10 år',
    );
    expect(LOAN_TYPE_EXPLANATIONS.fixedInterestOnly).toContain(
      'lavere belåning end 80%',
    );
    expect(LOAN_TYPE_EXPLANATIONS.flex).toContain('for 5 år ad gangen');
  });
});

describe('explainLoan', () => {
  it('forklarer egenfinansieringen med gældsbrevet til faren', () => {
    expect(texts(BASE).ownFinancing).toBe(
      'Den del af købesummen på 6.700.400 kr., som datteren selv finansierer. ' +
        'Resten på 2.700.400 kr. lånes af faren via gældsbrevet.',
    );
  });

  it('forklarer hvad de to belåningsgrundlag giver i lån', () => {
    const t = texts(BASE);

    expect(t.lendingBasis).toContain('højst 9.600.000 kr.');
    expect(t.lendingBasis).toContain('højst 5.360.320 kr.');
  });

  it('nævner de rigtige satser i fodnoten', () => {
    expect(texts(BASE).footnote).toContain(
      'Bidragssats for afdragsfrihed, satserne for flexlån og kursen er antagelser.',
    );
  });

  it('forklarer det anslåede skattefradrag', () => {
    const t = texts(BASE);

    expect(t.taxSaving).toContain('første 50.000 kr.');
    expect(t.taxSaving).toContain('33%');
    expect(t.taxSaving).toContain('25%');
  });

  it('forklarer egenfinansieringen, når hele købesummen betales selv', () => {
    expect(texts({ ...BASE, ownFinancing: PURCHASE_PRICE }).ownFinancing).toBe(
      'Datteren finansierer hele købesummen på 6.700.400 kr. selv.',
    );
  });
});
