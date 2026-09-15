import { fmt } from '@/lib/format';
import styles from '../page.module.css';

/** En beløbsrække med en forklarende linje under. */
export default function LedgerRow({
  label,
  amount,
  explanation,
  total = false,
}: {
  label: string;
  amount: number;
  explanation: string;
  total?: boolean;
}) {
  return (
    <>
      <tr className={`${styles.rowMain}${total ? ` ${styles.total}` : ''}`}>
        <th scope="row">{label}</th>
        <td className={styles.amount}>{fmt(amount)} kr.</td>
      </tr>
      <tr className={styles.explanationRow}>
        <td colSpan={2}>
          <span className={styles.explanation}>{explanation}</span>
        </td>
      </tr>
    </>
  );
}
