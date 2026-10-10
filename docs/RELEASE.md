# Release status

The source repository and a publicly hosted playable build are separate release steps. The current source has passed automated type, lint, unit, browser, layout, build, and static-preview checks. This does not complete a public playable release.

Before publishing source on GitHub:

- Publish a fresh source history. Earlier local commits contain six personal Blacky photos and personal commit email addresses even though the photos are absent from the current source tree. A normal push of the existing history would publish them.
- Review the wording of the "About Blacky" page. Project-owned material uses the [MIT License](../LICENSE.md); third-party assets have independent terms in [Credits](CREDITS.md).
- Confirm that the source snapshot contains only the intended public documentation and no local private notes.

Before hosting a playable build, also review its privacy text, test on real gamepads and phones, verify browser compatibility and performance on target hardware, and measure the initial download. The current local measurement exceeded the project's target of 10 MB before play.

No GitHub upload or public hosting is performed by the checks in this repository.
