export type PreferenceQuestion = {
  id: string;
  label: string;
  helper?: string;
  placeholder?: string;
};

/** IDs align with profile fields for a future POST /profile wiring. */
export const PREFERENCE_QUESTIONS: PreferenceQuestion[] = [
  {
    id: "profession",
    label: "What do you do?",
    helper: "Helps tailor examples and tone in generated posts.",
    placeholder: "e.g. Product designer",
  },
  {
    id: "audience",
    label: "Who are you writing for?",
    placeholder: "e.g. Indie hackers on X",
  },
  {
    id: "vibe",
    label: "Preferred voice",
    helper: "Casual, professional, witty — whatever fits you.",
    placeholder: "e.g. Friendly and concise",
  },
];
