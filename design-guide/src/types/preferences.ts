export type PreferencesLogRequest = {
  answers: Record<string, string>;
};

export type PreferencesLogResponse = {
  ok: true;
};

/** GET /preferences/me — same keys as the onboarding form. */
export type PreferencesMeResponse = {
  answers: Record<string, string>;
};
