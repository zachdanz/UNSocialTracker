export const LANGUAGES = ["SG", "EN", "AR", "ZH", "ES", "FR", "RU", "SW", "PT", "HI"] as const;

export type LanguageCode = (typeof LANGUAGES)[number];

export const LANGUAGE_LABELS: Record<LanguageCode, string> = {
  SG: "Secretary-General",
  EN: "English",
  AR: "Arabic",
  ZH: "Chinese",
  ES: "Spanish",
  FR: "French",
  RU: "Russian",
  SW: "Kiswahili",
  PT: "Portuguese",
  HI: "Hindi",
};

// Row order for the TOTALS tab (rows 2-12), per spec.
export const TOTALS_ROW_ORDER: (LanguageCode | "TOTAL")[] = [
  "SG",
  "EN",
  "AR",
  "ZH",
  "ES",
  "FR",
  "RU",
  "SW",
  "PT",
  "HI",
  "TOTAL",
];
