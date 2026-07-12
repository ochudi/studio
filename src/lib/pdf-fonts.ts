import path from "path";
import { Font } from "@react-pdf/renderer";

/**
 * One registration for every PDF the app renders. Full TTFs, not latin
 * subsets: ₦ (U+20A6) lives outside the latin block, and JetBrains Mono has
 * no naira glyph at all, which is why money always renders in Inter.
 */

const fontFile = (name: string) => path.join(process.cwd(), "public", "fonts", name);

let registered = false;

export function registerPdfFonts(): void {
  if (registered) return;
  registered = true;

  Font.register({
    family: "Fraunces",
    fonts: [{ src: fontFile("fraunces-600.ttf"), fontWeight: 600 }],
  });
  Font.register({
    family: "Inter",
    fonts: [
      { src: fontFile("inter-400.ttf"), fontWeight: 400 },
      { src: fontFile("inter-600.ttf"), fontWeight: 600 },
    ],
  });
  Font.register({
    family: "JetBrains Mono",
    fonts: [{ src: fontFile("jetbrains-mono-400.ttf"), fontWeight: 400 }],
  });
  // Words break at spaces only; documents are no place for hyphenation.
  Font.registerHyphenationCallback((word) => [word]);
}

export const PDF_INK = "#111111";
export const PDF_MUTED = "#6f6f6f";
export const PDF_LINE = "#e2e2e2";
