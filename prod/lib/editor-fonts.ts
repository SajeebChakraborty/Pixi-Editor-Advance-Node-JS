/** Fonts used in the text tool sidebar and canvas; load via Google Fonts in root layout. */

export type TextFontPreset = {
  label: string;
  font: string;
  weight: "normal" | "bold";
  preview: string;
};

export type TextFontCategory = {
  category: string;
  items: TextFontPreset[];
};

export const TEXT_FONT_CATEGORIES: TextFontCategory[] = [
  {
    category: "Sans Serif",
    items: [
      {
        label: "Inter",
        font: "Inter",
        weight: "bold",
        preview: "Modern & Clean",
      },
      {
        label: "Roboto",
        font: "Roboto",
        weight: "normal",
        preview: "Standard Web",
      },
      {
        label: "Open Sans",
        font: "Open Sans",
        weight: "normal",
        preview: "Friendly UI",
      },
      {
        label: "Montserrat",
        font: "Montserrat",
        weight: "bold",
        preview: "Geometric",
      },
      {
        label: "Lato",
        font: "Lato",
        weight: "normal",
        preview: "Readable Body",
      },
      {
        label: "Poppins",
        font: "Poppins",
        weight: "bold",
        preview: "Rounded Modern",
      },
      {
        label: "Nunito",
        font: "Nunito",
        weight: "bold",
        preview: "Soft Rounded",
      },
    ],
  },
  {
    category: "Serif",
    items: [
      {
        label: "Playfair Display",
        font: "Playfair Display",
        weight: "bold",
        preview: "Elegant & Classic",
      },
      {
        label: "Merriweather",
        font: "Merriweather",
        weight: "normal",
        preview: "Editorial",
      },
      {
        label: "Lora",
        font: "Lora",
        weight: "normal",
        preview: "Storytelling",
      },
      {
        label: "Source Serif 4",
        font: "Source Serif 4",
        weight: "normal",
        preview: "Book Text",
      },
    ],
  },
  {
    category: "Display",
    items: [
      {
        label: "Oswald",
        font: "Oswald",
        weight: "bold",
        preview: "Strong Impact",
      },
      {
        label: "Lobster",
        font: "Lobster",
        weight: "normal",
        preview: "Playful Script",
      },
      {
        label: "Bebas Neue",
        font: "Bebas Neue",
        weight: "normal",
        preview: "Tall Poster",
      },
      {
        label: "Dancing Script",
        font: "Dancing Script",
        weight: "bold",
        preview: "Handwritten",
      },
      {
        label: "Pacifico",
        font: "Pacifico",
        weight: "normal",
        preview: "Retro Script",
      },
    ],
  },
  {
    category: "Monospace",
    items: [
      {
        label: "JetBrains Mono",
        font: "JetBrains Mono",
        weight: "bold",
        preview: "Code Style",
      },
      {
        label: "Source Code Pro",
        font: "Source Code Pro",
        weight: "normal",
        preview: "Technical",
      },
    ],
  },
];

/** Unique font family names for the properties panel (plus common system fallbacks). */
export const TEXT_PROPERTIES_FONT_OPTIONS: string[] = [
  "Arial",
  ...Array.from(
    new Set(
      TEXT_FONT_CATEGORIES.flatMap((g) => g.items.map((i) => i.font)),
    ),
  ).sort((a, b) => a.localeCompare(b)),
];

/** Single Google Fonts stylesheet for all editor presets (400 + 700 where available). */
export const EDITOR_GOOGLE_FONTS_CSS =
  "https://fonts.googleapis.com/css2?" +
  [
    "family=Inter:wght@400;700",
    "family=Roboto:wght@400;700",
    "family=Open+Sans:wght@400;700",
    "family=Montserrat:wght@400;700",
    "family=Lato:wght@400;700",
    "family=Poppins:wght@400;700",
    "family=Nunito:wght@400;700",
    "family=Playfair+Display:wght@400;700",
    "family=Merriweather:wght@400;700",
    "family=Lora:wght@400;700",
    "family=Source+Serif+4:wght@400;700",
    "family=Oswald:wght@400;700",
    "family=Lobster",
    "family=Bebas+Neue",
    "family=Dancing+Script:wght@400;700",
    "family=Pacifico",
    "family=JetBrains+Mono:wght@400;700",
    "family=Source+Code+Pro:wght@400;700",
    "display=swap",
  ].join("&");
