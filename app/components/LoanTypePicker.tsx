'use client';

import {
  LOAN_TYPES,
  type LoanType,
} from '@/lib/loanConstants';
import { LOAN_TYPE_EXPLANATIONS } from '@/lib/loanExplanations';
import styles from '../page.module.css';

/** Valg af lånetype, som både finansieringen og udligningen regner på. */
export default function LoanTypePicker({
  loanType,
  onChange,
}: {
  loanType: LoanType;
  onChange: (loanType: LoanType) => void;
}) {
  return (
    <div className={styles.inputs}>
      <div className={`${styles.fieldPlain} ${styles.fieldWide}`}>
        <span className={styles.label} id="loanType-label">
          Låntype
        </span>
        <div
          className={styles.radioGroup}
          role="radiogroup"
          aria-labelledby="loanType-label"
        >
          {(Object.keys(LOAN_TYPES) as LoanType[]).map((type) => (
            <label className={styles.radio} key={type}>
              <input
                type="radio"
                name="loanType"
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
    </div>
  );
}
