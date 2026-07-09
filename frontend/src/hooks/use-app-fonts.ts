// Load custom Google Fonts (Outfit + Manrope) via CDN using expo-font.
// Do NOT use @expo-google-fonts/... packages (forbidden).

import { useFonts } from "expo-font";

const FONTS: Record<string, string> = {
  Outfit_400Regular: "https://fonts.gstatic.com/s/outfit/v11/QGYvz_MVcBeNP4NJuktqjIXOA0G_.ttf",
  Outfit_500Medium: "https://fonts.gstatic.com/s/outfit/v11/QGYvz_MVcBeNP4NJuktqhIvOA0G_.ttf",
  Outfit_600SemiBold: "https://fonts.gstatic.com/s/outfit/v11/QGYvz_MVcBeNP4NJuktqhozPA0G_.ttf",
  Outfit_700Bold: "https://fonts.gstatic.com/s/outfit/v11/QGYvz_MVcBeNP4NJuktqk4LPA0G_.ttf",
  Outfit_800ExtraBold: "https://fonts.gstatic.com/s/outfit/v11/QGYvz_MVcBeNP4NJuktqmYvPA0G_.ttf",
  Manrope_400Regular: "https://fonts.gstatic.com/s/manrope/v19/xn7gYHE41ni1AdIRggexSg.ttf",
  Manrope_500Medium: "https://fonts.gstatic.com/s/manrope/v19/xn7gYHE41ni1AdIRggmxSg.ttf",
  Manrope_600SemiBold: "https://fonts.gstatic.com/s/manrope/v19/xn7gYHE41ni1AdIRgguxSg.ttf",
  Manrope_700Bold: "https://fonts.gstatic.com/s/manrope/v19/xn7gYHE41ni1AdIRggqxSg.ttf",
};

export const useAppFonts = (): readonly [boolean, Error | null] => useFonts(FONTS);
