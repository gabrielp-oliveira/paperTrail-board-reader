/**
 * Utilities for color contrast detection & text color selection
 * Uses WCAG luminance formula to determine if text should be light or dark
 */

/**
 * Converts hex/rgb color string to RGB object
 * @param colorStr - Color in hex (#RRGGBB) or rgb(r,g,b) format
 * @returns {r, g, b} object or null if invalid
 */
export function parseColor(colorStr: string): { r: number; g: number; b: number } | null {
  if (!colorStr) return null;

  // Handle hex colors
  const hexMatch = colorStr.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (hexMatch) {
    return {
      r: parseInt(hexMatch[1], 16),
      g: parseInt(hexMatch[2], 16),
      b: parseInt(hexMatch[3], 16),
    };
  }

  // Handle rgb colors
  const rgbMatch = colorStr.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/);
  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1]),
      g: parseInt(rgbMatch[2]),
      b: parseInt(rgbMatch[3]),
    };
  }

  return null;
}

/**
 * Calculates WCAG luminance (0-1 scale)
 * @param r - Red (0-255)
 * @param g - Green (0-255)
 * @param b - Blue (0-255)
 * @returns Luminance value (0=darkest, 1=brightest)
 */
export function calculateLuminance(r: number, g: number, b: number): number {
  // Normalize to 0-1
  const [rNorm, gNorm, bNorm] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });

  // WCAG luminance formula
  return 0.2126 * rNorm + 0.7152 * gNorm + 0.0722 * bNorm;
}

/**
 * Determines if text should be light or dark based on background color
 * @param colorStr - Background color in hex or rgb format
 * @param threshold - Luminance threshold (default 0.5). Above = light text, below = dark text
 * @returns "light" or "dark"
 */
export function getTextColorForBackground(
  colorStr: string,
  threshold: number = 0.5
): "light" | "dark" {
  const rgb = parseColor(colorStr);
  if (!rgb) return "dark"; // fallback

  const luminance = calculateLuminance(rgb.r, rgb.g, rgb.b);
  return luminance > threshold ? "dark" : "light";
}

/**
 * Gets the actual color string for text (white or black)
 * @param colorStr - Background color
 * @param darkColor - Color to use for dark text (default: black)
 * @param lightColor - Color to use for light text (default: white)
 * @returns Color string (darkColor or lightColor)
 */
export function getTextColor(
  colorStr: string,
  darkColor: string = "black",
  lightColor: string = "white"
): string {
  const textType = getTextColorForBackground(colorStr);
  return textType === "dark" ? darkColor : lightColor;
}

/**
 * Simple helper to check if color is "light" (for boolean logic)
 */
export function isLightColor(colorStr: string): boolean {
  return getTextColorForBackground(colorStr) === "light";
}
