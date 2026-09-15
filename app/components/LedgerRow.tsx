import { fmt } from '@/lib/format';
import styles from '../page.module.css';

/** En beløbsrække med en forklarende linje under. */
export default function LedgerRow({
  label,
  amount,
  explanation,
  total = false,
  negative = false,
}: {
  label: string;
  amount: number;
  explanation: string;
  total?: boolean;
  negative?: boolean;
}) {
  return (
    <>
      <tr className={`${styles.rowMain}${total ? ` ${styles.total}` : ''}`}>
        <th scope="row">{label}</th>
        <td className={styles.amount}>
          {negative ? '−' : ''}
          {fmt(amount)} kr.
        </td>
      </tr>
      <tr className={styles.explanationRow}>
        <td colSpan={2}>
          <span className={styles.explanation}>{explanation}</span>
        </td>
      </tr>
    </>
  );
}
