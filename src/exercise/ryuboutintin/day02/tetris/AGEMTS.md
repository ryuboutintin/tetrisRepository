# AGEMTS.md

## Scope

This folder contains a static browser Tetris project with no build step and no package manager setup.

Files in scope:
- `index.html`: landing page and game page markup
- `style.css`: responsive layout and visual styling
- `script.js`: Tetris gameplay logic, screen switching, and Web Audio BGM
- `README.md`: high-level project description and run instructions

## Project Shape

- The app runs directly in the browser by opening `index.html`.
- There is no framework, bundler, router, or server code in this folder.
- The landing screen is shown first.
- Pressing the play button switches to the game screen and starts Web Audio BGM.

## Gameplay Notes

- Board size is `10 x 20`.
- Canvas cell size is `30`.
- Score rules are:
  - 1 line: `100`
  - 2 lines: `300`
  - 3 lines: `500`
  - 4 lines: `800`
- Controls are:
  - `ArrowLeft` / `ArrowRight`: move
  - `ArrowDown`: soft drop
  - `ArrowUp` or `Space`: rotate
  - `Enter`: restart, or start from landing

## Audio Notes

- BGM is generated with the Web Audio API in `script.js`.
- Audio must start from a user gesture, so changes to autoplay behavior should preserve the current play-button flow.
- Mute is handled in JavaScript by adjusting gain, not by swapping audio assets.

## Editing Guidance

- Keep the project dependency-free unless explicitly requested.
- Prefer small direct edits to the existing HTML/CSS/JS rather than adding new infrastructure.
- If you change scoring, controls, or flow, update both the landing page copy and the gameplay logic together.
- If you add new UI, keep mobile behavior intact and stay consistent with the current panel-based layout.
- If you touch BGM, preserve a safe fallback for browsers that restrict audio until interaction.

## Validation

- Use `node --check script.js` for JavaScript syntax validation.
- Since this is a static browser app, final verification should include opening `index.html` in a browser and checking:
  - landing screen appears first
  - play button enters the game
  - keyboard controls still work
  - BGM starts after interaction
  - mute toggle works
