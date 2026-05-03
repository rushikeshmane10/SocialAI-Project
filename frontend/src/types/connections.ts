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
