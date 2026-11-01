Feature: Publish the outing as a public event page and archive
  See docs/gather-spec.md §7, §8 and assumptions A3, A14.

  Background:
    Given voting has closed for the week of 9 November
    And the administrator is reviewing the results

  Scenario: Publishing the decision
    When the administrator publishes "Team outing" on Monday 9 November at 21:00 at "Noel" with the note "First round is on the company"
    Then a public event page shows the title, date, time, venue, address, Google Maps link and note
    And the round is published
    And the decision records who published it and when

  Scenario: The administrator can choose differently from the top recommendation
    When the administrator publishes Friday 13 November at 20:00 at "Taverna"
    Then the event page shows Friday 13 November at 20:00 at "Taverna"

  Scenario: Anyone with the link can see the event without signing in
    Given the outing has been published
    When someone who is not signed in opens the event link
    Then they see the event details
    And they see no email addresses, votes, availability or administrative details

  Scenario: The public archive of outings (A3)
    Given the outing on Monday 9 November has been published
    When someone opens the archive
    Then it lists the outing as upcoming
    When Monday 9 November has passed
    Then the archive lists it as past

  Scenario: Publishing requires a closed round
    Given voting is still open
    When the administrator tries to publish
    Then they are told "Close voting before publishing"

  Scenario: The date must belong to the round's week
    When the administrator publishes on Monday 16 November
    Then they are told "Choose one of the round's days"
