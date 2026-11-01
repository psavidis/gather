Feature: Venue catalog and map
  The administrator keeps a reusable catalog of venues, shown on a free
  Leaflet + OpenStreetMap map. No paid Google APIs are used.
  See docs/gather-spec.md §4 and assumption A10.

  Background:
    Given "admin@example.com" is signed in as the administrator

  Scenario: Adding a venue from a Google Maps link
    When the administrator pastes the Google Maps link of "Six d.o.g.s" into the venue form
    Then the name and coordinates are filled in from the link
    When they choose the category "Bar" and save
    Then "Six d.o.g.s" appears in the catalog and on the map
    And it links to the original Google Maps page

  Scenario: Adding a venue by clicking the map
    When the administrator clicks a spot on the map
    Then the venue's coordinates are set to that spot
    When they enter the name "Noel" with the category "Bar" and save
    Then "Noel" appears in the catalog

  Scenario: A short Google Maps link cannot be read (A10)
    When the administrator pastes a "maps.app.goo.gl" short link
    Then they are told to paste the full link or place the venue on the map
    And the link is still kept as the venue's Google Maps link

  Scenario Outline: Venue details are validated
    When the administrator saves a venue with <problem>
    Then they are told "<message>"

    Examples:
      | problem                          | message                                 |
      | no name                          | name is required                        |
      | no location                      | Set the location by clicking the map    |
      | a latitude of 91                 | latitude must be between -90 and 90     |
      | a "javascript:" Google Maps link | Google Maps link must start with https:// |
      | a rating of 6                    | rating must be between 0 and 5          |

  Scenario: Editing a venue
    Given the catalog contains "Noel"
    When the administrator changes its notes to "Book ahead on Fridays"
    Then the catalog shows the new notes

  Scenario: Disabling a venue keeps history but hides it from voting
    Given the catalog contains "Noel"
    When the administrator disables "Noel"
    Then members no longer see "Noel"
    But the administrator still sees it as disabled

  Scenario: Members cannot change the catalog
    Given "maria@example.com" is an enabled member
    When "maria@example.com" tries to add a venue
    Then they are refused
