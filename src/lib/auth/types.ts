export type SessionUser = { id: string; email: string; name: string | null };

export type CreateUserResult = { id: string } | { error: "exists" | "failed" };
export type SignInResult = { id: string; email: string } | { error: "invalid" | "failed" };

// Email + password only. No verification email, OTP or magic link is ever sent.
export interface AuthBackend {
  createUser(email: string, password: string, meta: { fullName: string }): Promise<CreateUserResult>;
  deleteUser(id: string): Promise<void>;
  /** Verifies credentials and starts a session (sets the session cookie). */
  signIn(email: string, password: string): Promise<SignInResult>;
  /** Verifies credentials without touching the current session (re-auth for password change). */
  checkPassword(email: string, password: string): Promise<boolean>;
  signOut(): Promise<void>;
  currentUser(): Promise<SessionUser | null>;
  setPassword(userId: string, password: string): Promise<void>;
}
