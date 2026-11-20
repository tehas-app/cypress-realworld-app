# AGENTS.md

Rules for agents working in this repository.

## What this is

A demo payment app (React and Vite at the front, Express with a lowdb JSON
file at the back), forked from cypress-io/cypress-realworld-app to show
real-world Cypress testing. `README.md` describes it. The default branch is
`develop`.

- `src/`: the React app (Material UI, XState, `src/__tests__/` for Vitest).
- `backend/`: the Express API on port 3001; `data/` holds its JSON database
  and the seed it is copied from.
- `cypress/`: end-to-end tests (`cypress/tests/ui`, `cypress/tests/api`),
  component tests beside the components, and custom commands in
  `cypress/support`.
- `scripts/`: seed generation and the test server.

## Gates

- The fast gate is `.pi/verify-cmd`: `yarn types`, `yarn lint` and
  `yarn test:unit:ci`. All three must pass.
- Yarn 1 (in the sandbox image; `corepack yarn` elsewhere); never npm, and never change
  `yarn.lock` by hand.
- `yarn test:unit:ci` rewrites `data/database.json`. Never commit that change
  unless the seed itself is the point: then change `data/database-seed.json`
  through `yarn db:seed` and say so.
- End-to-end tests need `yarn start:ci` and a browser. When you change a flow,
  update its Cypress spec in the same change even if you cannot run it, and
  say in the pull request that it was not run.

## Rules

- Keep the existing style: Prettier formats, ESLint checks. Run `yarn prettier`
  before committing.
- Tests use the `data-test` attributes (`cy.getBySel`). Keep them when you
  change markup.
- Never put keys or secrets in code, tests or the repository. The seed
  password in `.env` is demo data.
- Keep the prose plain. No marketing filler.
- Open a pull request against `develop` in tehas-app/cypress-realworld-app,
  never against cypress-io, and stop. Never push to `develop`.
