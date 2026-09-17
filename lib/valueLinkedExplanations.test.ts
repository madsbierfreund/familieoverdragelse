import { describe, expect, it } from 'vitest';
import { CHILDREN, SIBLINGS } from './constants';
import { calculateLoan } from './loan';
import { LOAN_TYPES } from './loanConstants';
import { loanInput } from './testFixtures';
import { calculateValueLinked, type ValueLinkedInput } from './valueLinked';
import {
  explainValueLinked,
  VALUE_LINKED_NOTE,
} from './valueLinkedExplanations';

const DEFAULTS = {
  marketValue: 12_000_000,
  otherAssets: 2_000_000,
  ownFinancing: 4_000_000,
};

function input(overrides: Partial<ValueLinkedInput> = {}): ValueLinkedInput {
  const loan = loanInput('fixed');
  return {
    ...DEFAULTS,
    deathYears: 5,
    priceGrowth: 0.02,
    redemptionYears: 0,
    financing: 'mortgage',
    noteRate: 0.04,
    noteYears: 10,
    loan: {
      rate: loan.mortgageRate,
      contributionRate: loan.contributionRate,
      bondPrice: loan.bondPrice,
      mortgageYears: loan.mortgageYears,
      interestOnlyYears: LOAN_TYPES[loan.loanType].interestOnlyYears,
      mortgagePrincipal: calculateLoan(loan).mortgagePrincipal,
    },
    ...overrides,
  };
}

function texts(overrides: Partial<ValueLinkedInput> = {}) {
  const settings = input(overrides);
  return explainValueLinked(settings, calculateValueLinked(settings));
}

describe('explainValueLinked', () => {
  it('forklarer andelene ved dødsfaldet', () => {
    const t = texts();

    expect(t.paidShare).toBe(
      'Datterens betaling ved handlen på 4.000.000 kr. af markedsværdien på ' +
        '12.000.000 kr. Værdistigningen på denne del er hendes.',
    );
    expect(t.valueAtDeath).toBe(
      'Ny markedsvurdering efter 5 år med 2,0 % årlig stigning.',
    );
    expect(t.estateShareValue).toBe(
      'Den ubetalte andel på 66,67% af den nye værdi.',
    );
    expect(t.share).toContain(`delt mellem ${CHILDREN} børn`);
    expect(t.debtAtDeath).toContain(`Søskendenes ${SIBLINGS} arvelodder`);
    expect(t.debtAtDeath).toContain('50,31% af anparten');
  });

  it('forklarer indfrielsen med realkredit og med pantebrev', () => {
    expect(texts().valueAtRedemption).toBe('Indfrielse ved dødsfaldet.');
    expect(texts({ redemptionYears: 5 }).valueAtRedemption).toBe(
      '5 år efter dødsfaldet med samme årlige stigning.',
    );

    expect(texts().redemption).toContain(
      'Gælden på 6.666.117 kr. finansieres med realkredit på samme vilkår ' +
        'som købslånet, udbetalt til kurs 98.',
    );
    expect(texts({ financing: 'note' }).redemption).toContain(
      'Afdrages over 10 år med 4,00% i rente, i alt 1.432.826 kr.',
    );
    expect(texts().siblingsGrowth).toContain(
      'ejer søskendene værdistigningen på 50,31% af anparten',
    );
  });

  it('siger fra, når der ingen gæld er', () => {
    const t = texts({ otherAssets: 40_000_000 });

    expect(t.debtAtDeath).toBe(
      'Datterens arvelod overstiger værdien af den ubetalte andel. ' +
        'Der er ingen gæld at indfri.',
    );
  });

  it('advarer om aftalen og skatten', () => {
    expect(VALUE_LINKED_NOTE).toContain('skriftlig aftale mellem faren og alle børn');
    expect(VALUE_LINKED_NOTE).toContain('kursgevinstloven');
    expect(texts().note).toBe(VALUE_LINKED_NOTE);
  });
});
