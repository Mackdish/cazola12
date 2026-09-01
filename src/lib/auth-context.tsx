import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { supabase } from "@/integrations/supabase/client";
import { toFriendlyError, type FriendlyError } from "@/lib/errors";
import {
  availableWorkspaces,
  defaultWorkspacePath,
  type Membership,
  type OrganizationType,
  type PlatformRole,
  type Profile,
  type Workspace,
} from "@/lib/authorization";

type RateLimitEntry = { count: number; firstAttempt: number };
const CLIENT_RATE_LIMITS: Record<string, RateLimitEntry[]> = {};

function checkClientRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const entries = CLIENT_RATE_LIMITS[key] ?? [];
  const recent = entries.filter((e) => now - e.firstAttempt < windowMs);
  const total = recent.reduce((s, e) => s + e.count, 0);
  if (total >= limit) return false;
  recent.push({ count: 1, firstAttempt: now });
  CLIENT_RATE_LIMITS[key] = recent;
  return true;
}

function markClientRateLimitHit(key: string, limit: number, windowMs: number): number {
  const now = Date.now();
  const entries = CLIENT_RATE_LIMITS[key] ?? [];
  const recent = entries.filter((e) => now - e.firstAttempt < windowMs);
  recent.push({ count: 1, firstAttempt: now });
  CLIENT_RATE_LIMITS[key] = recent;
  const total = recent.reduce((s, e) => s + e.count, 0);
  const oldest = recent[0]?.firstAttempt ?? now;
  return Math.max(0, Math.ceil((windowMs - (now - oldest)) / 1000));
}

function validatePassword(password: string): string | null {
  if (password.length < 12) return "Password must be at least 12 characters.";
  if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must include a lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must include a number.";
  if (!/[^A-Za-z0-9]/.test(password)) return "Password must include a special character.";
  return null;
}

type AuthState = {
  initializing: boolean;
  loadingIdentity: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  memberships: Membership[];
  platformRoles: PlatformRole[];
  workspaces: Workspace[];
  homePath: string;
  identityError: FriendlyError | null;
  refreshIdentity: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<FriendlyError | null>;
  signInWithGoogle: () => Promise<FriendlyError | null>;
  signUp: (
    email: string,
    password: string,
    fullName: string,
  ) => Promise<{ error: FriendlyError | null; needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<FriendlyError | null>;
  updatePassword: (password: string) => Promise<FriendlyError | null>;
  createOrganization: (input: {
    name: string;
    slug: string;
    type: OrganizationType;
  }) => Promise<FriendlyError | null>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [initializing, setInitializing] = useState(true);
  const [loadingIdentity, setLoadingIdentity] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [memberships, setMemberships] = useState<Membership[]>([]);
  const [platformRoles, setPlatformRoles] = useState<PlatformRole[]>([]);
  const [identityError, setIdentityError] = useState<FriendlyError | null>(null);
  const pendingFullName = useRef<string | null>(null);

  const clearIdentity = useCallback(() => {
    setProfile(null);
    setMemberships([]);
    setPlatformRoles([]);
    setIdentityError(null);
  }, []);

  const loadIdentity = useCallback(async () => {
    setLoadingIdentity(true);
    setIdentityError(null);
    try {
      const fullName = pendingFullName.current;
      pendingFullName.current = null;

      const profileResult = await supabase.rpc(
        "ensure_profile",
        fullName ? { _full_name: fullName } : {},
      );

      console.log("[auth] ensure_profile result:", {
        error: profileResult.error,
        data: profileResult.data,
        onboarding_completed: profileResult.data?.onboarding_completed,
      });

      if (profileResult.error) throw profileResult.error;
      setProfile(profileResult.data as Profile);

      const [membershipResult, roleResult] = await Promise.all([
        supabase
          .from("organization_members")
          .select("id, role, status, organizations(*)")
          .order("created_at", { ascending: true }),
        supabase.from("platform_roles").select("role"),
      ]);

      console.log("[auth] organization_members query:", {
        error: membershipResult.error,
        count: membershipResult.data?.length,
        rows: membershipResult.data,
      });
      console.log("[auth] platform_roles query:", {
        error: roleResult.error,
        count: roleResult.data?.length,
        rows: roleResult.data,
      });

      if (membershipResult.error) throw membershipResult.error;
      if (roleResult.error) throw roleResult.error;

      const memberships = (membershipResult.data ?? []).flatMap((row) => {
        if (!row.organizations) return [];
        return [
          {
            membershipId: row.id,
            role: row.role,
            status: row.status,
            organization: row.organizations,
          } satisfies Membership,
        ];
      });
      const platformRoles = (roleResult.data ?? []).map((row) => row.role);

      console.log("[auth] computed identity:", {
        profileId: profileResult.data?.id,
        onboarding_completed: profileResult.data?.onboarding_completed,
        membershipsCount: memberships.length,
        memberships: memberships.map((m) => ({
          id: m.membershipId,
          role: m.role,
          status: m.status,
          orgType: m.organization.type,
          orgStatus: m.organization.status,
        })),
        platformRoles,
        workspaces: availableWorkspaces(memberships, platformRoles),
        homePath: defaultWorkspacePath(memberships, platformRoles, profileResult.data as Profile | null),
      });

      setMemberships(memberships);
      setPlatformRoles(platformRoles);
    } catch (error) {
      console.error("[auth] loadIdentity failed", error);
      setIdentityError(toFriendlyError(error, "We couldn't load your account"));
    } finally {
      setLoadingIdentity(false);
    }
  }, []);

  useEffect(() => {
    let active = true;

    const { data: subscription } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      if (event === "SIGNED_OUT" || !nextSession) {
        clearIdentity();
        return;
      }
      if (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "USER_UPDATED") {
        void loadIdentity();
      }
    });

    void supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setInitializing(false);
      if (data.session) void loadIdentity();
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [clearIdentity, loadIdentity]);

  const signIn = useCallback<AuthState["signIn"]>(async (email, password) => {
    const key = `auth:login:${email.toLowerCase()}`;
    if (!checkClientRateLimit(key, 10, 5 * 60 * 1000)) {
      const retryAfter = markClientRateLimitHit(key, 10, 5 * 60 * 1000);
      const error = new Error(`Too many sign-in attempts. Please wait ${retryAfter} seconds.`);
      return toFriendlyError(error, "Sign in failed");
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? toFriendlyError(error, "Sign in failed") : null;
  }, []);

  const signInWithGoogle = useCallback<AuthState["signInWithGoogle"]>(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
        queryParams: { access_type: "offline", prompt: "consent" },
      },
    });
    return error ? toFriendlyError(error, "Google sign-in failed") : null;
  }, []);

  const signUp = useCallback<AuthState["signUp"]>(async (email, password, fullName) => {
    const key = `auth:register:${email.toLowerCase()}`;
    if (!checkClientRateLimit(key, 5, 60 * 60 * 1000)) {
      const retryAfter = markClientRateLimitHit(key, 5, 60 * 60 * 1000);
      const error = new Error(`Too many registration attempts. Please wait ${retryAfter} seconds.`);
      return {
        error: toFriendlyError(error, "Registration failed"),
        needsEmailConfirmation: false,
      };
    }
    const passwordError = validatePassword(password);
    if (passwordError) {
      return {
        error: toFriendlyError(new Error(passwordError), "Registration failed"),
        needsEmailConfirmation: false,
      };
    }
    pendingFullName.current = fullName;
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { full_name: fullName },
      },
    });
    if (error) {
      pendingFullName.current = null;
      return {
        error: toFriendlyError(error, "Registration failed"),
        needsEmailConfirmation: false,
      };
    }
    return { error: null, needsEmailConfirmation: data.session === null };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    clearIdentity();
  }, [clearIdentity]);

  const requestPasswordReset = useCallback<AuthState["requestPasswordReset"]>(async (email) => {
    const key = `auth:reset:${email.toLowerCase()}`;
    if (!checkClientRateLimit(key, 5, 60 * 60 * 1000)) {
      const retryAfter = markClientRateLimitHit(key, 5, 60 * 60 * 1000);
      const error = new Error(`Too many reset attempts. Please wait ${retryAfter} seconds.`);
      return toFriendlyError(error, "We couldn't send the reset email");
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return error ? toFriendlyError(error, "We couldn't send the reset email") : null;
  }, []);

  const updatePassword = useCallback<AuthState["updatePassword"]>(async (password) => {
    const passwordError = validatePassword(password);
    if (passwordError) return toFriendlyError(new Error(passwordError), "We couldn't update your password");
    const { error } = await supabase.auth.updateUser({ password });
    return error ? toFriendlyError(error, "We couldn't update your password") : null;
  }, []);

  const createOrganization = useCallback<AuthState["createOrganization"]>(
    async ({ name, slug, type }) => {
      const { data: org, error: rpcError } = await supabase.rpc(
        "create_organization",
        {
          _name: name,
          _slug: slug,
          _type: type,
        },
      );
      if (rpcError) return toFriendlyError(rpcError, "We couldn't create the organization");
      if (!org?.id) return toFriendlyError(new Error("No organization returned"), "We couldn't create the organization");

      // create_organization already inserts the owner membership server-side.
      await loadIdentity();
      return null;
    },
    [loadIdentity],
  );

  const value = useMemo<AuthState>(() => {
    return {
      initializing,
      loadingIdentity,
      session,
      user: session?.user ?? null,
      profile,
      memberships,
      platformRoles,
      workspaces: availableWorkspaces(memberships, platformRoles),
      homePath: defaultWorkspacePath(memberships, platformRoles, profile),
      identityError,
      refreshIdentity: loadIdentity,
      signIn,
      signInWithGoogle,
      signUp,
      signOut,
      requestPasswordReset,
      updatePassword,
      createOrganization,
    };
  }, [
    initializing,
    loadingIdentity,
    session,
    profile,
    memberships,
    platformRoles,
    identityError,
    loadIdentity,
    signIn,
    signInWithGoogle,
    signUp,
    signOut,
    requestPasswordReset,
    updatePassword,
    createOrganization,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
