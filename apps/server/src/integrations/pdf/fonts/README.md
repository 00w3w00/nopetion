# PDF fonts

Nopetion PDF Sans is a derived font under SIL Open Font License 1.1. It keeps Noto Sans KR glyphs and adds missing characters from Noto Sans SC and Noto Sans. This covers the app's Korean/Japanese/Simplified Chinese, Latin and Cyrillic language samples, including Ukrainian `ї`. It does not claim full Unicode coverage.

Full upstream copyright and license notices accompany the assets in the runtime image:

| Upstream source (downloaded 2026-10-10) | Original SHA-256 | Notice |
| --- | --- | --- |
| [Noto Sans KR](https://github.com/google/fonts/tree/main/ofl/notosanskr), `NotoSansKR[wght].ttf` | `194018e6b2b293a7964f037b25c0249ce1418bc9ab3c971060a03aa57861e252` | OFL.txt |
| [Noto Sans SC](https://github.com/google/fonts/tree/main/ofl/notosanssc), `NotoSansSC[wght].ttf` | `a3041811a78c361b1de50f953c805e0244951c21c5bd412f7232ef0d899af0da` | OFL-SC.txt |
| [Noto Sans](https://github.com/google/fonts/tree/main/ofl/notosans), `NotoSans[wdth,wght].ttf` | `bfb7bb691513f12e734dc346c03a03f784912432d7e3fa8e56efcf906fe86b3d` | OFL-Latin.txt |

Reproduce with Python and `fonttools==4.60.2`:

```sh
python scripts/build-pdf-fonts.py KR.ttf SC.ttf NotoSans.ttf apps/server/src/integrations/pdf/fonts
```

The script instantiates Regular (400) and Bold (700) at default width, subsets each donor to missing Unicode characters and merges the static fonts. PDFKit provides horizontal baseline layout, so the unused BASE/vertical/variable-axis metadata tables are omitted. Derived names use Nopetion PDF Sans and do not use the reserved font name “Source”. Font files are checked in; normal builds and PDF exports never download fonts. PDFKit 0.20.2 is MIT-licensed and embeds only glyph subsets used in each PDF.
