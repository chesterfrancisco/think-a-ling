# Local UI fonts

DM Sans (400/500/600/700) and Manrope (400/500/600/700/800), matching the supplied Figma Make design. Downloaded on 2026-10-09 from Google Fonts' CSS API and its fonts.gstatic.com asset URLs. These files are served locally by the app; no Google Fonts request happens at runtime.

Both families use the SIL Open Font License 1.1. The unmodified license texts are included as `DM-Sans-OFL.txt` and `Manrope-OFL.txt`, obtained from the corresponding `ofl/dmsans` and `ofl/manrope` directories in https://github.com/google/fonts. `src/styles/fonts.css` declares the local font faces. System sans-serif remains the fallback.
