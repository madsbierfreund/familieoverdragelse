# Familieoverdragelse – arvefordeling

A small Danish-language calculator for a family transfer (*familieoverdragelse*)
of a property share and the resulting inheritance split between five children.

A daughter buys a 50/100 share of a property from her father at 80% of the 2020
public valuation (the Danish "20% rule"). The unpaid part of the price becomes a
promissory note, of which five annual tax-free gifts are forgiven. The
difference between market value and purchase price, plus the forgiven debt,
counts as an advance on her inheritance. The app shows how the estate is then
divided between her and her four siblings — both without and with an
equalization agreement (*udligningsaftale*).

Everything runs client-side: no backend, no database, no API routes.

## Stack

- Next.js (App Router) with TypeScript in strict mode
- Plain CSS (a global stylesheet plus one CSS module)
- Vitest for unit tests of the calculation module

## Structure

- `lib/constants.ts` — the fixed assumptions (valuation, share, gift allowance, …)
- `lib/calculate.ts` — `calculate(input)`, a pure function with no UI dependencies
- `lib/calculate.test.ts` — unit tests for the calculation
- `lib/explanations.ts` — `explain(input, result)`, the Danish explanatory texts
- `lib/explanations.test.ts` — unit tests for the texts
- `lib/format.ts` — the shared da-DK amount formatter
- `app/page.tsx` — the calculator UI
- `app/layout.tsx` — document shell, fonts and metadata

The calculation is deliberately kept separate from the UI, so new inputs or
scenarios can be added to `lib/` without touching the page.

## Run locally

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

## Tests

```bash
npm test
```

## Other scripts

```bash
npm run build   # production build
npm run lint    # ESLint
```

## Deployment

Deploys to Vercel with default settings — no `vercel.json` required.
