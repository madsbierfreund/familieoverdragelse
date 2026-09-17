import { fmt } from '@/lib/format';
import styles from '../page.module.css';

/** En beløbsrække med en forklarende linje under. */
export default function LedgerRow({
  label,
  amount,
  second,
  third,
  explanation,
  total = false,
  negative = false,
  display,
}: {
  label: string;
  amount: number;
  /** Et beløb mere i en egen kolonne, fx en månedlig ydelse. null er en tom celle. */
  second?: number | null;
  /** Endnu et beløb i en egen kolonne, fx ydelsen efter skat. */
  third?: number | null;
  explanation: string;
  total?: boolean;
  negative?: boolean;
  /** Vises i stedet for beløbet, fx en procentdel. */
  display?: string;
}) {
  return (
    <>
      <tr className={`${styles.rowMain}${total ? ` ${styles.total}` : ''}`}>
        <th scope="row">{label}</th>
        <td className={styles.amount}>
          {display ?? `${negative ? '−' : ''}${fmt(amount)} kr.`}
        </td>
        {second !== undefined && (
          <td className={styles.amount}>
            {second === null ? '' : `${fmt(second)} kr.`}
          </td>
        )}
        {third !== undefined && (
          <td className={styles.amount}>
            {third === null ? '' : `${fmt(third)} kr.`}
          </td>
        )}
      </tr>
      <tr className={styles.explanationRow}>
        <td
          colSpan={
            2 + (second === undefined ? 0 : 1) + (third === undefined ? 0 : 1)
          }
        >
          <span className={styles.explanation}>{explanation}</span>
        </td>
      </tr>
    </>
  );
}
