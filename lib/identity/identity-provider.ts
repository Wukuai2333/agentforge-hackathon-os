export type AuthenticatedIdentity = {
  provider: string;
  subject: string;
  email?: string;
  displayName?: string;
};

export interface IdentityProvider {
  /**
   * Returns a verified identity from the active login provider.
   * Implementations may later use email magic links, event codes plus email,
   * or an external OAuth provider. Never trust identity fields from JSON input.
   */
  authenticate(request: Request): Promise<AuthenticatedIdentity | null>;
}

export class IdentityNotConfiguredError extends Error {
  constructor() {
    super("The event identity provider has not been selected yet.");
  }
}
