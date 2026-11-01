Feature: Administrator manages authorized users
  The administrator decides who may use Gather entirely from the app.
  See docs/gather-spec.md §2 "User management" and assumption A9.

  Background:
    Given "admin@example.com" is signed in as the administrator

  Scenario: Viewing the allowlist
    Given "maria@example.com" is an enabled member
    When the administrator opens user management
    Then they see "admin@example.com" as an enabled admin
    And they see "maria@example.com" as an enabled member

  Scenario: Adding a member
    When the administrator adds "nikos@example.com" as a member
    Then "nikos@example.com" can sign in as a member

  Scenario: Adding an email that is already on the list
    Given "maria@example.com" is an enabled member
    When the administrator adds "Maria@Example.com" as a member
    Then they are told "maria@example.com is already on the list"

  Scenario: Adding an invalid email address
    When the administrator adds "not-an-email" as a member
    Then they are told "Enter a valid email address"

  Scenario: Disabling and re-enabling a user
    Given "maria@example.com" is an enabled member
    When the administrator disables "maria@example.com"
    Then "maria@example.com" can no longer sign in
    When the administrator enables "maria@example.com"
    Then "maria@example.com" can sign in as a member

  Scenario: Promoting a member to administrator
    Given "maria@example.com" is an enabled member
    When the administrator makes "maria@example.com" an admin
    Then "maria@example.com" can manage users

  Scenario: Removing a user
    Given "maria@example.com" is an enabled member
    When the administrator removes "maria@example.com"
    Then "maria@example.com" is no longer on the list and cannot sign in

  Scenario Outline: The administrator cannot lock themselves out (A9)
    When the administrator tries to <change> their own account
    Then they are told "You cannot <change> your own account"

    Examples:
      | change                                |
      | disable                               |
      | remove                                |
      | remove the administrator role from    |

  Scenario: Members cannot manage users
    Given "maria@example.com" is an enabled member
    When "maria@example.com" tries to view the allowlist
    Then they are refused
