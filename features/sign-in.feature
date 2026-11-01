Feature: Sign in with Google
  Team members sign in with their Google account. The backend decides who may
  use the application; the browser is never trusted with identity or role.

  See docs/gather-spec.md §2, §10 and assumptions A5–A8.

  Rule: Only verified Google identities are accepted

    Scenario Outline: Rejecting an untrustworthy ID token
      Given "maria@example.com" is an enabled member
      When someone signs in with a token that <problem>
      Then they are told they are not signed in

      Examples:
        | problem                                  |
        | Google does not recognise                |
        | was issued for a different application   |
        | was issued by someone other than Google  |
        | has expired                              |
        | carries an unverified email address      |

  Rule: Only enabled allowlisted users are authorized

    Scenario: An enabled member signs in
      Given "maria@example.com" is an enabled member
      When "maria@example.com" signs in with Google
      Then she sees that she is signed in as "maria@example.com" with the role "member"

    Scenario: Email addresses are matched regardless of letter case
      Given "maria@example.com" is an enabled member
      When "Maria@Example.com" signs in with Google
      Then she sees that she is signed in as "maria@example.com" with the role "member"

    Scenario: Someone who is not on the allowlist signs in
      When "stranger@example.com" signs in with Google
      Then they are told their account is not authorized to use Gather

    Scenario: A disabled user signs in
      Given "maria@example.com" is a disabled member
      When "maria@example.com" signs in with Google
      Then they are told their account is not authorized to use Gather

  Rule: The configured initial administrator is bootstrapped once (A5)

    Scenario: The initial administrator signs in for the first time
      Given the initial administrator is configured as "admin@example.com"
      And the allowlist has no entry for "admin@example.com"
      When "admin@example.com" signs in with Google
      Then they see that they are signed in with the role "admin"
      And the allowlist contains an enabled administrator entry for "admin@example.com"

    Scenario: The allowlist overrides the configuration after bootstrap
      Given the initial administrator is configured as "admin@example.com"
      And "admin@example.com" is a disabled administrator
      When "admin@example.com" signs in with Google
      Then they are told their account is not authorized to use Gather

  Rule: An allowlist entry is bound to one Google account (A6)

    Scenario: The Google account is remembered on first sign-in
      Given "maria@example.com" is an enabled member with no Google account recorded
      When "maria@example.com" signs in with Google account "sub-1"
      Then the allowlist entry for "maria@example.com" records Google account "sub-1"

    Scenario: A different Google account with the same email is refused
      Given "maria@example.com" is an enabled member bound to Google account "sub-1"
      When "maria@example.com" signs in with Google account "sub-2"
      Then they are told their account is not authorized to use Gather

  Rule: Backend failures are reported, not hidden

    Scenario: The backend cannot be reached
      Given the backend is unavailable
      When "maria@example.com" signs in with Google
      Then they are told sign-in failed and can try again
