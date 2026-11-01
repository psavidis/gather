Feature: Member voting wizard
  Members state their availability and preferences in a short, mobile-friendly
  wizard. See docs/gather-spec.md §3.2, §3.3, §5 and assumptions A1, A12.

  Background:
    Given "maria@example.com" and "nikos@example.com" are enabled members
    And the administrator has opened voting for the week of Monday 9 November 2026
    And the catalog contains the venues "Noel" and "Six d.o.g.s"

  Scenario: Voting through all steps
    When "maria@example.com" votes:
      | Mon 9 Nov    | After work — 18:30              |
      | Tue 10 Nov   | After going home first — 21:00  |
      | Wed 11 Nov   | Unavailable                     |
      | Thu 12 Nov   | No preference / Flexible        |
      | Fri 13 Nov   | After work — 18:30              |
      | Activity     | Drinks                          |
      | Location     | Near home: Pangrati             |
      | Venues       | Noel                            |
    Then she sees a summary of her choices before submitting
    And after submitting she is told her vote is saved and can be changed until voting closes

  Scenario: Every day needs an answer
    When "maria@example.com" continues past the availability step without answering Wednesday
    Then she is asked to answer every day

  Scenario: Skipping the venue step
    When "maria@example.com" skips venue selection
    Then her vote records no venue preference

  Scenario: Updating a vote while voting is open
    Given "maria@example.com" has voted "Drinks"
    When she changes her activity to "Food"
    Then her vote is updated, starting from her previous answers

  Scenario: Voting closes when everyone has voted (A1)
    Given everyone except "nikos@example.com" has voted
    When "nikos@example.com" submits his vote
    Then voting is closed

  Scenario: No changes after voting closes
    Given voting has closed
    When "maria@example.com" opens Gather
    Then she is told voting has closed and cannot vote

  Scenario: Members added after opening cannot vote
    Given "eleni@example.com" was added after voting opened
    When "eleni@example.com" opens Gather
    Then she is told she is not a participant in this round

  Scenario: Members never see other people's votes
    Given "nikos@example.com" has voted
    When "maria@example.com" opens Gather
    Then she sees only her own vote
