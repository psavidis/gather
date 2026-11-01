Feature: Voting results report with transparent recommendations
  After voting closes, the administrator sees a report and a ranked list of
  date/time/venue options. See docs/gather-spec.md §6, §9 and assumptions A2, A13.

  Background:
    Given a round for the week of 9 November with eligible participants Ada (admin), Maria, Nikos and Eleni
    And the venues "Noel" (bar) and "Taverna" (restaurant)
    And Maria, Nikos and Eleni have voted, but Ada has not
    And voting has closed

  Scenario: Participation
    When the administrator opens the report
    Then it shows 4 eligible, 3 submitted, 1 missing response (Ada) and 75% participation

  Scenario: Availability per day keeps missing responses separate
    When the administrator opens the report
    Then Monday shows 2 available at 18:30 and 3 available at 21:00
    And Monday shows 1 missing response, which is never counted as available

  Scenario: Custom availability window (A2)
    When the administrator asks for availability between 19:00 and 22:00
    Then Monday shows 2 available from the start and 1 joining later at 21:00

  Scenario: Ranked recommendations explain their score (A13)
    When the administrator opens the report
    Then the top recommendation is Monday 9 November at 21:00 at Noel
    And it explains "3 available × 3 + 0 flexible × 1 + 2 venue picks × 2 + 1 activity match × 1 = 14"

  Scenario: The report is available only after voting closes
    Given voting is still open
    When the administrator asks for the report
    Then they are told the report is available once voting has closed

  Scenario: Members cannot see results
    When "maria@example.com" asks for the report
    Then she is refused

  Scenario: Copying the report as text
    When the administrator copies the report
    Then a plain-text version suitable for pasting into ChatGPT is available
