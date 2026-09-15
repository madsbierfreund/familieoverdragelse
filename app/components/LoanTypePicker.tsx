'use client';

import {
  LOAN_TYPES,
  type LoanType,
} from '@/lib/loanConstants';
import { LOAN_TYPE_EXPLANATIONS } from '@/lib/loanExplanations';
import styles from '../page.module.css';

/** Valg af lånetype for ét af de to lån. */
export default function LoanTypePicker({
  name,
  label,
  loanType,
  onChange,
}: {
  /** Adskiller de to grupper af radioknapper. */
  name: string;
  label: string;
  loanType: LoanType;
  onChange: (loanType: LoanType) => void;
}) {
  return (
    <div className={styles.typeField}>
      <span className={styles.label} id={`${name}-label`}>
        {label}
      </span>
      <div
        className={styles.radioGroup}
        role="radiogroup"
        aria-labelledby={`${name}-label`}
      >
        {(Object.keys(LOAN_TYPES) as LoanType[]).map((type) => (
          <label className={styles.radio} key={type}>
            <input
              type="radio"
              name={name}
              value={type}
              checked={loanType === type}
              onChange={() => onChange(type)}
            />
            {LOAN_TYPES[type].label}
          </label>
        ))}
      </div>
      <p className={`${styles.explanation} ${styles.basisExplanation}`}>
        {LOAN_TYPE_EXPLANATIONS[loanType]}
      </p>
    </div>
  );
}
