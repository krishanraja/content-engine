# Card fonts

Anton.ttf and Mono.ttf are TrueType conversions of the Latin WOFF files shipped
by the repository's locked npm dependencies:

- `@fontsource/anton@5.3.0/files/anton-latin-400-normal.woff`
- `@fontsource/ibm-plex-mono@5.3.0/files/ibm-plex-mono-latin-400-normal.woff`

Converted with fontTools 4.63.0: load with `TTFont`, set `flavor = None`, save as
TrueType. The glyphs and family names are unchanged. Their SIL Open Font
License files are kept here (`Anton-OFL.txt`, `Mono-OFL.txt`). The card renderer
(`../svg-render/render.cjs`) records the exact font hashes in each rendered set's
`render-manifest.json`, and turns off system font fallback.

ArchivoBlack-Regular.ttf is the quick-edit caption font; its licence is
`OFL.txt`.
