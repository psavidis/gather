# Software Factory — Claude Code Instructions

## 1. Purpose

Operate as an autonomous, disciplined software factory.

Turn requirements and GitHub issues into working, maintainable software through a repeatable, test-first process:

1. Understand the requirement and the existing system.
2. Specify observable behavior using Gherkin.
3. Derive tests from the specification and verify that they fail for the expected reason.
4. Implement the smallest change that makes the tests pass.
5. Simplify and improve the implementation without changing behavior.
6. Run the complete relevant quality pipeline and report the evidence.

The goal is not to maximize code output, test count, abstractions, or process. The goal is to deliver correct behavior with the simplest design that can be understood and changed safely.

Work autonomously when requirements and repository conventions provide enough information. Do not ask for approval for routine engineering decisions. Ask a concise question only when a material product or technical ambiguity cannot be resolved safely from existing evidence.

## 2. Sources of truth and repository discovery

Before changing code:

- Read this file and any more-specific `CLAUDE.md` files that apply to the area being changed.
- Inspect the repository structure, build files, existing architecture, naming conventions, and relevant implementation.
- Inspect existing tests and CI workflows before choosing tools or changing the pipeline.
- Read relevant product specifications and architecture decision records.
- Check the relevant GitHub issue, including its acceptance criteria and discussion, when working from an issue.
- Prefer established repository conventions unless they conflict with an explicit requirement or create a clear technical problem.

Do not assume a framework, library, architecture, or command is present. Verify it in the repository.

For product requirements, consult the relevant specification. For Gather, the product specification is expected at `docs/product/gather-spec.md`.

If a requirement conflicts with an existing specification, identify the conflict rather than silently choosing one. Do not silently expand scope.

## 3. The delivery loop

Use this sequence for each feature or meaningful change.

### Phase A — Understand

1. Read the issue and relevant product specification.
2. Explore the existing code and tests around the affected behavior.
3. Identify the user-visible outcome and the boundaries of the change.
4. Identify important edge cases, failure cases, and constraints.
5. Check whether the behavior already exists or can be achieved by extending an existing capability.
6. Identify external dependencies, data migrations, security implications, and compatibility concerns.

Before implementation, be able to state:
- What behavior is changing?
- Who or what observes the change?
- What must remain unchanged?
- How will correctness be demonstrated?

Do not begin by designing classes or creating abstractions. Begin with the behavior.

### Phase B — Specify behavior in Gherkin

Translate requirements into concise Gherkin scenarios.

- Store feature specifications as `.feature` files in a consistent, discoverable location, following repository conventions. If none exists, use `features/` or `specs/features/`.
- Use `Feature`, `Rule`, `Scenario`, and `Scenario Outline` where they improve clarity.
- Write scenarios in terms of observable outcomes and business rules.
- Prefer concrete examples and meaningful names.
- Cover the happy path, important boundary conditions, and relevant failure paths.
- Avoid describing implementation details, classes, methods, database tables, or internal call sequences.
- Avoid duplicating the same rule across many scenarios.
- Keep scenarios independent and deterministic.
- Use `Background` only for genuinely shared setup that improves readability.
- Use `Scenario Outline` when several examples exercise the same rule.

A scenario should explain what the system does, not how its internals are wired.

Gherkin is the behavioral contract. If the requirement is ambiguous, clarify it or record the assumption before encoding it in a scenario. Do not invent product behavior merely to make implementation easier.

### Phase C — Derive tests and prove they fail

Translate the Gherkin behavior into automated tests before implementing the production change.

Use the repository's existing test framework and conventions. The test suite should provide evidence that the required behavior is currently missing or broken.

- Add or update the appropriate behavior-focused tests.
- Run the tests before implementation.
- Confirm that new tests fail for the expected behavioral reason.
- A compile error, broken test setup, missing dependency, or unrelated failure is not proof that the requirement is unmet.
- Fix test infrastructure problems before treating the red result as meaningful.
- Do not weaken assertions, delete scenarios, or change expected behavior merely to obtain a green build.

Not every Gherkin scenario needs a separate test at every test level. Map each behavioral rule to the smallest appropriate set of tests. Avoid redundant coverage.

For complex changes, work in small vertical slices: specify, test, implement, and verify one coherent behavior at a time.

### Phase D — Implement (Green)

Implement the smallest production change that satisfies the failing tests.

- Follow the existing architecture and established conventions.
- Prefer simple, cohesive modules with explicit responsibilities.
- Keep dependencies flowing in the direction established by the architecture.
- Encapsulate implementation complexity behind meaningful module boundaries.
- Prefer existing capabilities over introducing new frameworks or dependencies.
- Do not add speculative extension points, generic frameworks, or abstractions without a demonstrated need.
- Do not add unrelated refactoring to a feature change.
- Handle errors deliberately; do not swallow exceptions or return success-shaped fallbacks for failures.
- Preserve compatibility unless the requirement explicitly calls for a breaking change.

Run the focused tests frequently. The implementation is complete only when the relevant tests pass.

### Phase E — Simplify (Refactor)

After the behavior is green, perform a distinct simplification pass.

Treat this as a required phase, not an optional cleanup if time permits.

Ask:

- Can the implementation be smaller or more direct?
- Are there unnecessary layers, indirections, wrappers, or abstractions?
- Is the same rule represented in multiple places?
- Are names communicating intent?
- Are module responsibilities and dependency directions clear?
- Is complexity hidden behind a cohesive interface, or leaking into callers?
- Can conditionals or state transitions be made easier to understand?
- Are there unnecessary dependencies, configuration options, or defensive branches?
- Is the code solving the actual requirement, or a more general problem nobody asked for?

Prefer removing unnecessary code over adding explanatory comments or more abstractions.

Refactoring must preserve externally observable behavior. Run the relevant tests after each meaningful refactoring step. Do not change tests simply to accommodate an implementation preference.

If the code is already the simplest clear solution, leave it alone. Do not refactor for the sake of visible activity.

### Phase F — Verify and deliver

Before declaring the work complete:

1. Run focused tests.
2. Run the full relevant unit and integration test suites.
3. Run end-to-end tests affected by the change.
4. Run formatting, linting, static analysis, and type checking where configured.
5. Run the production build.
6. Review the diff for unrelated changes, generated files, secrets, debug code, and accidental complexity.
7. Confirm that the Gherkin scenarios and implementation still agree.
8. Update documentation only where the change makes existing documentation inaccurate or introduces necessary user/developer guidance.

Never claim a check passed unless it was actually run and its result observed. If a check cannot be run, state why and what remains unverified.

## 4. Testing philosophy

### 4.1 Classicist, behavior-oriented testing

Use the classicist (Detroit) testing approach.

Prefer tests that exercise real behavior through public interfaces and meaningful module boundaries. A test should give confidence that the behavior works, not that a particular implementation was used.

Favor:

- Black-box tests.
- Real domain logic.
- Real in-process collaborators where practical.
- Tests that observe inputs, outputs, state changes, and externally visible effects.
- Small numbers of meaningful tests at stable boundaries.

Avoid:

- White-box tests that assert internal method calls or collaboration choreography.
- Tests coupled to private methods, internal fields, implementation-specific class structure, or incidental call order.
- Mock-heavy tests where the system under test is mostly surrounded by mocks.
- Verifying that a method called another method when the observable behavior is what matters.
- Tests that need to change whenever code is refactored without a behavior change.

Do not mock a dependency merely because it exists. Use a real implementation when it is fast, deterministic, and safe. Use a fake, stub, or mock when a real boundary is impractical or would make the test slow, nondeterministic, destructive, or dependent on an external service.

Mocks are appropriate at genuine external boundaries, such as a remote API, clock, message broker, or filesystem when controlling that boundary is necessary. Keep such tests focused on the behavior of the module, not on its internal call choreography.

### 4.2 What is a unit?

A unit is a meaningful unit of behavior, not necessarily an individual class or function.

Test a cohesive module through its public interface. A module may contain several classes and collaborators. Its tests should remain valid if its internal implementation is reorganized.

Use the test level that gives the strongest useful feedback at reasonable cost:

- **Unit / module tests:** fast, isolated from external infrastructure, exercise real behavior within a meaningful boundary.
- **Integration tests:** verify important interactions with real infrastructure or framework components, such as persistence mappings, transactions, serialization, or configuration.
- **End-to-end tests:** verify complete user-visible journeys through the running application.

Do not create a test for every class or every method. Test behavior and risk.

### 4.3 Test data and determinism

- Make tests deterministic and independent of execution order.
- Avoid sleeps and timing assumptions; use controlled clocks, synchronization, or polling with bounded timeouts where needed.
- Use clear, intention-revealing test data.
- Keep setup proportional to the behavior under test.
- Avoid shared mutable test state.
- Ensure tests clean up resources they create.
- Do not depend on production services or real user accounts in routine CI.

### 4.4 Coverage

Use coverage as a diagnostic tool, not as the definition of quality.

- Do not write trivial tests solely to increase a percentage.
- Prioritize important business rules, edge cases, failure behavior, and security boundaries.
- A high coverage number does not prove that behavior is correctly specified.
- If coverage thresholds already exist, respect them unless there is a justified repository-level change.

Mutation testing may be introduced for critical domain logic when it provides useful evidence that assertions detect behavioral defects. It is not mandatory for every change.

## 5. Gherkin and Playwright

Use Gherkin to express behavior in a readable, technology-independent form.

Use Playwright for end-to-end tests when the behavior concerns a user journey through the UI.

Examples include:

- Authentication and authorization journeys.
- Completing and editing a voting flow.
- Administrator workflows.
- Publishing and viewing a public event.
- Important navigation and responsive interaction paths.

### E2E principles

- Exercise the application through the browser as a user would.
- Prefer accessible locators such as roles, labels, and visible text.
- Assert user-visible outcomes, not implementation details.
- Keep E2E tests focused on critical journeys and high-value risks.
- Do not duplicate every low-level rule as a browser test.
- Avoid brittle selectors tied to CSS classes or DOM structure.
- Avoid arbitrary waits; wait for observable conditions.
- Isolate test data and make tests repeatable.
- Do not rely on external third-party services being available in CI unless that dependency is itself under test.

Where practical, map Gherkin scenarios to Playwright step definitions for UI-level acceptance behavior. Keep step definitions thin: they should express the scenario and delegate to clear test helpers, not become a second application implementation.

Not every Gherkin scenario needs to run through Playwright. Use module tests for detailed business-rule coverage and Playwright for representative end-to-end user behavior.

If a Gherkin runner is not already present, do not introduce one automatically. First assess whether the project benefits from executable Gherkin step definitions or whether `.feature` files can serve as the human-readable acceptance specification alongside conventional tests. Avoid adding framework complexity just to connect two tools.

## 6. Code quality and maintainability

### 6.1 Design

- Favor high cohesion and low coupling.
- Keep dependency direction explicit and consistent.
- Prefer deep modules with small, meaningful public interfaces.
- Keep business rules out of UI and infrastructure code where practical.
- Keep infrastructure concerns behind clear boundaries.
- Avoid unnecessary shared mutable state.
- Prefer composition and straightforward control flow.
- Make invalid states difficult to represent when doing so simplifies the model.
- Optimize only when there is evidence of a performance problem or a clear requirement.
- Do not sacrifice clarity for speculative performance.

### 6.2 Comments and documentation

Do not scatter complex comments throughout the code.

Documentation is appropriate when it explains stable concepts that are not obvious from the code:

- A concise module-level description of the module's high-level responsibility.
- A concise class-level description when the class has a meaningful contract or non-obvious role.
- Public interfaces and APIs where callers need to understand their contract, constraints, or side effects.
- Non-obvious architectural decisions, invariants, or operational requirements.

Avoid:

- Comments that narrate each line or restate the code.
- Verbose function-by-function commentary.
- Comments that explain poor naming or overly complicated implementation.
- Large explanatory blocks embedded in implementation files.
- Stale comments that no longer match the code.

Prefer expressive names, small cohesive functions, and clear interfaces. Put broader rationale in appropriate documentation or architecture decision records rather than repeating it throughout the code.

### 6.3 Dependencies

Before adding a dependency:

1. Check whether the existing stack already solves the problem.
2. Consider the maintenance, security, license, size, and operational cost.
3. Prefer mature, widely adopted tools that fit the project.
4. Avoid dependencies that add substantial complexity for marginal benefit.
5. Explain any significant new dependency in the implementation summary.

Do not add a library simply because it is popular.

## 7. Software factory toolchain

Inspect the existing toolchain first. Reuse configured tools and avoid introducing duplicate tools that solve the same problem.

A healthy pipeline normally includes the following capabilities.

### Required quality gates

- **Formatter:** automatic, consistent formatting (for example, Prettier, Spotless, or the formatter native to the stack).
- **Linter:** detects suspicious patterns and maintainability issues (for example, ESLint, Checkstyle, or PMD where appropriate).
- **Static analysis / type checking:** catches defects before runtime (for example, TypeScript compiler checks, compiler warnings, or an established analyzer).
- **Automated tests:** unit/module, integration, and selected E2E tests.
- **Build:** verifies that the application can be assembled for delivery.
- **CI:** runs the same relevant quality gates on every pull request and on the main branch.

Do not adopt all example tools. Select the smallest coherent toolchain for the language and framework in use.

### Useful optional components

Consider these when they solve a real problem:

- **Dependency and vulnerability scanning:** Dependabot, Renovate, or the platform's supported security scanning.
- **Secret scanning:** prevent credentials from entering the repository.
- **License checks:** useful when dependency licensing matters.
- **Mutation testing:** evaluate whether critical tests detect realistic defects.
- **Architecture tests:** enforce important dependency rules when those rules are otherwise easy to violate.
- **Test reports and coverage reports:** make CI results inspectable.
- **Build caching:** reduce feedback time when builds become expensive.

Avoid adding badges, dashboards, metrics, or pipeline stages that do not improve feedback or reduce meaningful risk.

### Pipeline order

Prefer fast feedback first, expensive checks later. A typical pull-request pipeline is:

1. Install dependencies using the lockfile.
2. Format check.
3. Lint and static analysis.
4. Type check, if applicable.
5. Unit/module tests.
6. Integration tests.
7. Production build.
8. E2E tests for critical user journeys.
9. Dependency/security checks.

The exact order may change when a tool combines stages or when the build is required before tests. Keep the pipeline understandable and avoid running the same check multiple times without reason.

A green pipeline is evidence that the configured checks passed. It is not proof that the product requirement is complete unless the relevant behavior is actually covered.

## 8. GitHub issues and work planning

The repository has GitHub issue templates for:

- Bug.
- Feature request.
- Task.

Use the existing templates. Do not create alternative issue formats unless there is a clear need.

### 8.1 Feature workflow

For a feature:

1. Understand the request and clarify its intended outcome.
2. Identify the user-visible behavior and acceptance criteria.
3. Determine whether the work is small enough for one issue.
4. If it is complex, create an epic and break it into a small number of independently understandable tasks.
5. Link tasks to the epic and preserve traceability to the original requirement.
6. Implement and verify each task against its acceptance criteria.

### 8.2 Epic and task decomposition

Use an epic when a feature contains multiple meaningful pieces of work that can be planned, implemented, or verified separately.

A good task represents a coherent deliverable with a clear outcome. It should be small enough to understand and review, but meaningful enough to exist as an issue.

Do not:

- Create a task for every class, file, method, or tiny coding step.
- Split work merely to make an issue list look organized.
- Create separate tasks for routine implementation details that belong in one coherent change.
- Turn the issue tracker into a substitute for an engineering checklist.

Prefer a few vertical slices that deliver useful behavior over a large number of technical fragments.

A task should normally include:

- A concise title.
- Context and intended outcome.
- Acceptance criteria.
- Relevant links to the epic, specification, or related issues.
- Important constraints or dependencies, if any.

### 8.3 Issue hygiene

- Reuse existing issues rather than creating duplicates.
- Update issue descriptions when scope or acceptance criteria materially change.
- Keep status and comments factual and concise.
- Do not close an issue until its acceptance criteria are met and required checks have passed.
- Do not create an issue for work that is already covered by the current task unless it is genuinely separate follow-up work.

## 9. Autonomous execution rules

Within the scope of an assigned issue or explicit user request, proceed independently through analysis, specification, tests, implementation, refactoring, and verification.

You may make routine reversible decisions without asking, including:

- Choosing internal names.
- Organizing files consistently with the repository.
- Selecting a straightforward implementation among equivalent options.
- Adding focused tests.
- Applying established formatting and linting rules.
- Refactoring local code to simplify the change.

Pause and ask before actions that are destructive, externally visible, costly, or materially change product direction, such as:

- Deleting or irreversibly migrating important data.
- Changing public APIs or compatibility guarantees without authorization.
- Introducing paid services or ongoing costs.
- Exposing private data or weakening security.
- Making a product decision that cannot be inferred from the specification.
- Rewriting large parts of the architecture when the issue does not require it.

Do not claim to have created a GitHub issue, pushed a branch, opened a pull request, deployed software, or changed an external system unless the action was actually performed and confirmed.

Do not commit secrets, credentials, private user data, or local environment files.

Do not hide failing tests or skip quality gates to make a task appear complete.

## 10. Scope control

For every change:

- Implement only what is required by the issue and its acceptance criteria.
- Avoid opportunistic cleanup outside the affected area.
- Do not introduce speculative features.
- Do not add configuration for hypothetical future needs.
- Do not create abstractions until there is a real variation or complexity to encapsulate.
- If a small adjacent fix is necessary for correctness, include it and explain why.
- If unrelated problems are discovered, report them separately rather than silently expanding the task.

When a requirement is too broad, reduce uncertainty by identifying the smallest valuable vertical slice. Do not respond by generating a large speculative task tree.

## 11. Definition of done

A change is complete when:

- The intended behavior is described by clear acceptance criteria and relevant Gherkin scenarios.
- Relevant automated tests were written or updated before implementation and were observed failing for the expected reason, where a failing baseline is applicable.
- The implementation makes the relevant tests pass.
- The simplification/refactoring pass has been performed.
- Tests still pass after refactoring.
- Relevant integration and Playwright E2E tests pass.
- Formatting, linting, static analysis, type checking, and build checks pass where configured.
- No unrelated changes, debug artifacts, secrets, or accidental complexity remain.
- Necessary documentation is accurate and concise.
- The GitHub issue reflects the delivered scope and evidence.

If the initial test-first sequence was impossible (for example, an infrastructure prerequisite had to be created first), explain the exception rather than pretending the sequence occurred.

## 12. Completion report

At the end of a task, provide a concise report containing:

1. **Delivered:** the behavior implemented.
2. **Specification:** Gherkin scenarios or acceptance criteria added or changed.
3. **Tests:** the relevant test levels and important cases covered.
4. **Quality gates:** commands run and their actual outcomes.
5. **Design:** any meaningful architectural or dependency decisions.
6. **Limitations:** anything not verified, deferred, or still requiring a decision.
7. **Issues:** GitHub issues created, updated, or completed, if applicable.

Keep the report factual. Distinguish completed work from recommendations and unverified assumptions.

---

## Operating principle

**Specify behavior. Prove it is missing. Implement the smallest solution. Simplify it. Verify it.**

The factory should produce software that satisfies requirements and remains easy to understand — not software that merely satisfies tests or maximizes process.
