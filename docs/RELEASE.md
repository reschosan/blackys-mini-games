# Release status

The source repository and a publicly hosted playable build are separate release steps. This page records release checks and remaining work; test results must be verified against the current commit before publication.

Source publication checks:

- The "About Blacky" page no longer mentions veterinary costs, as requested by the project owner. Its calicivirus link points to Cornell College of Veterinary Medicine. Review health-information wording before hosting a playable build.
- Verify the Git history and tracked files once more before publishing. The commits reachable from `main` start with a fresh source commit and contain no Blacky photos or personal commit email addresses. Local notes under `.docs/` and agent files are ignored.
- Keep third-party asset credits with the source. Project-owned material uses the [MIT License](../LICENSE.md); third-party assets have independent terms in [Credits](CREDITS.md).

Before hosting a playable build, also review its privacy text, test on real gamepads and phones, verify browser compatibility and performance on target hardware, and measure the initial download. The current local measurement exceeded the project's target of 10 MB before play.

No GitHub upload or public hosting is performed by the checks in this repository.
