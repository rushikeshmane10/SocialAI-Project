export type ConnectionStatusResponse = {
  twitter: boolean;
  linkedin: boolean;
};

export type InitiateConnectionResponse = {
  redirectUrl: string;
};

export type ConnectionCallbackResponse = {
  connected: boolean;
  platform: string;
};

export type ComposioLinkedInProfileResponse = {
  id?: string;
  sub?: string;
  localizedFirstName?: string;
  localizedLastName?: string;
  firstName?: {
    localized?: Record<string, string>;
  };
  lastName?: {
    localized?: Record<string, string>;
  };
  name?: string;
  given_name?: string;
  family_name?: string;
  headline?: string | {
    localized?: Record<string, string>;
  };
  picture?: string;
  profilePicture?: {
    displayImage?: string;
    "displayImage~"?: {
      elements?: Array<{
        identifiers?: Array<{
          identifier?: string;
        }>;
      }>;
    };
  };
};
