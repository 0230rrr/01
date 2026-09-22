# JavaScript structure

`app.js` intentionally contains the complete original JavaScript without logic changes.
The original application is wrapped in one IIFE, so splitting individual functions into separate classic scripts changes lexical scope and can break behavior.

This version therefore prioritizes 1:1 functionality. Once the app is stable, the JavaScript can be refactored into ES modules (`state.js`, `data.js`, `storage.js`, etc.) with explicit imports/exports.
