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
      {
        label: "Raleway",
        font: "Raleway",
        weight: "bold",
        preview: "Elegant Sans",
      },
      {
        label: "Work Sans",
        font: "Work Sans",
        weight: "normal",
        preview: "Clean Product",
      },
      {
        label: "Source Sans 3",
        font: "Source Sans 3",
        weight: "normal",
        preview: "Balanced UI",
      },
      {
        label: "Manrope",
        font: "Manrope",
        weight: "bold",
        preview: "Modern Brand",
      },
      {
        label: "DM Sans",
        font: "DM Sans",
        weight: "normal",
        preview: "Friendly Brand",
      },
      {
        label: "Outfit",
        font: "Outfit",
        weight: "bold",
        preview: "Sharp Modern",
      },
      {
        label: "Quicksand",
        font: "Quicksand",
        weight: "bold",
        preview: "Rounded Light",
      },
      {
        label: "Rubik",
        font: "Rubik",
        weight: "normal",
        preview: "Approachable",
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
      {
        label: "Cormorant Garamond",
        font: "Cormorant Garamond",
        weight: "bold",
        preview: "Luxury Serif",
      },
      {
        label: "Libre Baskerville",
        font: "Libre Baskerville",
        weight: "normal",
        preview: "Classic Print",
      },
      {
        label: "EB Garamond",
        font: "EB Garamond",
        weight: "normal",
        preview: "Literary",
      },
      {
        label: "Crimson Text",
        font: "Crimson Text",
        weight: "normal",
        preview: "Warm Editorial",
      },
      {
        label: "DM Serif Display",
        font: "DM Serif Display",
        weight: "normal",
        preview: "Premium Title",
      },
      {
        label: "Fraunces",
        font: "Fraunces",
        weight: "bold",
        preview: "Expressive Serif",
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
      {
        label: "Anton",
        font: "Anton",
        weight: "normal",
        preview: "Bold Impact",
      },
      {
        label: "Abril Fatface",
        font: "Abril Fatface",
        weight: "normal",
        preview: "Fashion Title",
      },
      {
        label: "Archivo Black",
        font: "Archivo Black",
        weight: "normal",
        preview: "Heavy Poster",
      },
      {
        label: "Barlow Condensed",
        font: "Barlow Condensed",
        weight: "bold",
        preview: "Compact Header",
      },
      {
        label: "Cinzel",
        font: "Cinzel",
        weight: "bold",
        preview: "Cinematic",
      },
      {
        label: "Fjalla One",
        font: "Fjalla One",
        weight: "normal",
        preview: "Editorial Impact",
      },
      {
        label: "Josefin Sans",
        font: "Josefin Sans",
        weight: "bold",
        preview: "Art Deco",
      },
    ],
  },
  {
    category: "Script",
    items: [
      {
        label: "Caveat",
        font: "Caveat",
        weight: "bold",
        preview: "Casual Marker",
      },
      {
        label: "Great Vibes",
        font: "Great Vibes",
        weight: "normal",
        preview: "Elegant Signature",
      },
      {
        label: "Satisfy",
        font: "Satisfy",
        weight: "normal",
        preview: "Smooth Script",
      },
      {
        label: "Shadows Into Light",
        font: "Shadows Into Light",
        weight: "normal",
        preview: "Handwritten",
      },
      {
        label: "Kalam",
        font: "Kalam",
        weight: "bold",
        preview: "Natural Notes",
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
      {
        label: "Fira Code",
        font: "Fira Code",
        weight: "normal",
        preview: "Developer",
      },
      {
        label: "IBM Plex Mono",
        font: "IBM Plex Mono",
        weight: "normal",
        preview: "Tech Editorial",
      },
      {
        label: "Space Mono",
        font: "Space Mono",
        weight: "bold",
        preview: "Retro Code",
      },
      {
        label: "Roboto Mono",
        font: "Roboto Mono",
        weight: "normal",
        preview: "Readable Mono",
      },
    ],
  },
  {
    category: "Bengali",
    items: [
      {
        label: "Hind Siliguri",
        font: "Hind Siliguri",
        weight: "bold",
        preview: "Bangla UI",
      },
      {
        label: "Noto Sans Bengali",
        font: "Noto Sans Bengali",
        weight: "normal",
        preview: "Bangla Sans",
      },
      {
        label: "Noto Serif Bengali",
        font: "Noto Serif Bengali",
        weight: "normal",
        preview: "Bangla Serif",
      },
      {
        label: "Baloo Da 2",
        font: "Baloo Da 2",
        weight: "bold",
        preview: "Rounded Bangla",
      },
      {
        label: "Anek Bangla",
        font: "Anek Bangla",
        weight: "bold",
        preview: "Variable Bangla",
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
    "family=Raleway:wght@400;700",
    "family=Work+Sans:wght@400;700",
    "family=Source+Sans+3:wght@400;700",
    "family=Manrope:wght@400;700",
    "family=DM+Sans:wght@400;700",
    "family=Outfit:wght@400;700",
    "family=Quicksand:wght@400;700",
    "family=Rubik:wght@400;700",
    "family=Playfair+Display:wght@400;700",
    "family=Merriweather:wght@400;700",
    "family=Lora:wght@400;700",
    "family=Source+Serif+4:wght@400;700",
    "family=Cormorant+Garamond:wght@400;700",
    "family=Libre+Baskerville:wght@400;700",
    "family=EB+Garamond:wght@400;700",
    "family=Crimson+Text:wght@400;700",
    "family=DM+Serif+Display",
    "family=Fraunces:wght@400;700",
    "family=Oswald:wght@400;700",
    "family=Lobster",
    "family=Bebas+Neue",
    "family=Dancing+Script:wght@400;700",
    "family=Pacifico",
    "family=Anton",
    "family=Abril+Fatface",
    "family=Archivo+Black",
    "family=Barlow+Condensed:wght@400;700",
    "family=Cinzel:wght@400;700",
    "family=Fjalla+One",
    "family=Josefin+Sans:wght@400;700",
    "family=Caveat:wght@400;700",
    "family=Great+Vibes",
    "family=Satisfy",
    "family=Shadows+Into+Light",
    "family=Kalam:wght@400;700",
    "family=JetBrains+Mono:wght@400;700",
    "family=Source+Code+Pro:wght@400;700",
    "family=Fira+Code:wght@400;700",
    "family=IBM+Plex+Mono:wght@400;700",
    "family=Space+Mono:wght@400;700",
    "family=Roboto+Mono:wght@400;700",
    "family=Hind+Siliguri:wght@400;700",
    "family=Noto+Sans+Bengali:wght@400;700",
    "family=Noto+Serif+Bengali:wght@400;700",
    "family=Baloo+Da+2:wght@400;700",
    "family=Anek+Bangla:wght@400;700",
    "display=swap",
  ].join("&");
