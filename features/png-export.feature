Feature: Export a published event as a PNG for Slack
  See docs/gather-spec.md §8 "Image export".

  Scenario: The administrator downloads the event image
    Given the outing on Monday 9 November at 21:00 at "Noel" has been published
    When the administrator downloads the image from the event page
    Then they receive a 1200 × 630 PNG named after the event date
    And it shows only the event's public details

  Scenario: Visitors are not offered the export
    When someone who is not the administrator opens the event page
    Then no image download is offered
