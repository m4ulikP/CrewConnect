# CrewConnect CI/CD Workflows (`.github/workflows`)

GitHub Actions automation for Continuous Integration and Continuous Delivery.

## Planned Workflows (to be implemented in Phase 2)

- `ci.yml`: Triggers on pull requests and pushes to `main`.
  - Runs linting and code formatting checks.
  - Compiles TypeScript in strict mode.
  - Launches a MongoDB replica set service container.
  - Runs Vitest unit & integration test suites.
  - Executes the automated 50-user race condition integration test.
- `audit.yml`: Dependency vulnerability scanning (`npm audit`) and secrets scanning.

> **Status**: Architecture defined in Phase 1. GitHub Actions YAML configurations will be created in Phase 2.
