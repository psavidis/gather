Feature: Administrator initiates and manages a weekly voting round
  See docs/gather-spec.md §3.1, §5 and assumptions A1, A4, A11, A12.

  Background:
    Given "admin@example.com" is signed in as the administrator
    And "maria@example.com" is an enabled member
    And today is Monday 2 November 2026

  Scenario: Creating a draft round for a week
    When the administrator creates a round for the week of Wednesday 11 November 2026 with a deadline of Friday 6 November 18:00
    Then a draft round exists for Monday 9 to Friday 13 November
    And members cannot vote on it yet

  Scenario: Opening a round snapshots the eligible participants
    Given a draft round for the week of 9 November
    When the administrator opens voting
    Then the round is open
    And "admin@example.com" and "maria@example.com" are its eligible participants

  Scenario: Users added after opening are not eligible
    Given an open round
    When the administrator adds "nikos@example.com" as a member
    Then the round still has 2 eligible participants

  Scenario: Only one active round at a time
    Given a draft round for the week of 9 November
    When the administrator creates another round
    Then they are told "Finish the current round before starting a new one"

  Scenario Outline: Invalid rounds are refused
    When the administrator creates a round with <problem>
    Then they are told "<message>"

    Examples:
      | problem                          | message                                 |
      | a week that has already ended    | That week has already ended             |
      | a deadline in the past           | The deadline must be in the future      |

  Scenario: Voting closes when the deadline passes (A4)
    Given an open round with a deadline of Friday 6 November 18:00
    When it is Friday 6 November 18:00
    Then the round is closed

  Scenario: Closing and reopening voting manually
    Given an open round
    When the administrator closes voting
    Then the round is closed
    When the administrator reopens voting with a deadline of Saturday 7 November 12:00
    Then the round is open with the new deadline

  Scenario: Deleting a draft
    Given a draft round for the week of 9 November
    When the administrator deletes the draft
    Then there is no active round
