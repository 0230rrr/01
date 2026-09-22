# timee — function-preserving split version

This build separates the original HTML into external CSS and JavaScript files while preserving the original JavaScript logic exactly.

## Use

Open `index.html` in a browser. For best compatibility with browser storage and local file restrictions, a small local server is recommended.

## Why JavaScript is still one file

The original script uses an IIFE with shared lexical state. The previous split moved functions into independent classic scripts and lost code/scope dependencies. This build keeps the complete script in `js/app.js` so the original features remain intact.

CSS is externalized in `css/components.css`; the other CSS files are reserved for later safe cleanup.
