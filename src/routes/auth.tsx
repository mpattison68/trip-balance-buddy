import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import type { EmailOtpType } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Wallet, Mail } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sign in — Trip Balance" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [verificationSent, setVerificationSent] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const handledEmailLink = useRef(false);

  async function clearLocalAuthSession() {
    await supabase.auth.signOut({ scope: "local" });
  }

  async function finishConfirmedAuth(message: string) {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw error ?? new Error("Unable to verify your signed-in account.");
    const confirmedAt = (data.user as { email_confirmed_at?: string | null; confirmed_at?: string | null }).email_confirmed_at
      ?? (data.user as { email_confirmed_at?: string | null; confirmed_at?: string | null }).confirmed_at;
    if (!confirmedAt) {
      await clearLocalAuthSession();
      throw new Error("Email not confirmed yet. Please use the newest verification email or resend it.");
    }
    toast.success(message);
    window.history.replaceState({}, document.title, "/auth");
    navigate({ to: "/app", replace: true });
  }

  useEffect(() => {
    if (handledEmailLink.current) return;
    handledEmailLink.current = true;

    async function handleAuthEntry() {
      const url = new URL(window.location.href);
      const search = url.searchParams;
      const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
      const getParam = (key: string) => search.get(key) ?? hash.get(key);
      const code = search.get("code");
      const tokenHash = getParam("token_hash");
      const otpType = getParam("type") as EmailOtpType | null;
      const accessToken = hash.get("access_token");
      const refreshToken = hash.get("refresh_token");
      const errorDescription = getParam("error_description");

      if (errorDescription) {
        await clearLocalAuthSession();
        toast.error(errorDescription.replace(/\+/g, " "));
        setVerificationSent(true);
        window.history.replaceState({}, document.title, "/auth");
        return;
      }

      try {
        if (tokenHash && otpType) {
          const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: otpType });
          if (error) throw error;
          await finishConfirmedAuth("Email confirmed — you're signed in.");
          return;
        }

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          await finishConfirmedAuth("Email confirmed — you're signed in.");
          return;
        }

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
          await finishConfirmedAuth("Email confirmed — you're signed in.");
          return;
        }

        const { data, error } = await supabase.auth.getUser();
        if (!error && data.user) navigate({ to: "/app", replace: true });
      } catch (err) {
        await clearLocalAuthSession();
        toast.error(err instanceof Error ? err.message : "Confirmation link failed. Please resend it.");
        setVerificationSent(true);
        setMode("signin");
        window.history.replaceState({}, document.title, "/auth");
      }
    }

    void handleAuthEntry();
  }, [navigate]);

  async function handleGoogle() {
    setOauthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth` },
      });
      if (error) throw error;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
      setOauthLoading(false);
    }
  }

  async function handleResend() {
    if (!email) {
      toast.error("Enter your email address first.");
      return;
    }
    setResendLoading(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth` },
      });
      if (error) throw error;
      toast.success("Verification email resent — check your inbox.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to resend email");
    } finally {
      setResendLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset-password`,
        });
        if (error) throw error;
        toast.success("Password reset link sent — check your email.");
        setMode("signin");
        return;
      }
      if (mode === "signup") {
        await clearLocalAuthSession();
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth`,
            data: { name: name || email },
          },
        });
        if (error) throw error;
        // If email confirmation is required, Supabase returns a user but no session.
        if (!data.session) {
          await clearLocalAuthSession();
          toast.success("Account created — check your email to confirm your address before signing in.");
          setVerificationSent(true);
          setMode("signin");
          return;
        }
        setVerificationSent(false);
        await finishConfirmedAuth("Account created — you're signed in!");
        return;
      } else {
        await clearLocalAuthSession();
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await finishConfirmedAuth("Welcome back!");
        return;
      }
    } catch (err) {
      if (err instanceof Error && err.message.toLowerCase().includes("email not confirmed")) {
        setVerificationSent(true);
        setMode("signin");
      }
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2 font-semibold">
          <Wallet className="h-6 w-6 text-primary" /> Trip Balance
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Welcome</CardTitle>
            <CardDescription>Sign in or create an account to track your trips.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={mode === "forgot" ? "signin" : mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="signin">Sign in</TabsTrigger>
                <TabsTrigger value="signup">Sign up</TabsTrigger>
              </TabsList>
              <TabsContent value="signin" />
              <TabsContent value="signup" />
            </Tabs>
            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              {mode === "forgot" && (
                <p className="text-sm text-muted-foreground">
                  Enter your email and we'll send you a link to reset your password.
                </p>
              )}
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="name">Your name</Label>
                  <Input id="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={100} required />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              {mode !== "forgot" && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    {mode === "signin" && (
                      <button
                        type="button"
                        onClick={() => setMode("forgot")}
                        className="text-xs text-primary hover:underline"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={6} required />
                </div>
              )}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading
                  ? "Please wait…"
                  : mode === "signup"
                    ? "Create account"
                    : mode === "forgot"
                      ? "Send reset link"
                      : "Sign in"}
              </Button>
              {mode === "forgot" && (
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className="block w-full text-center text-xs text-muted-foreground hover:underline"
                >
                  Back to sign in
                </button>
              )}
              {mode === "signin" && verificationSent && (
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={resendLoading}
                  className="block w-full text-center text-xs text-primary hover:underline disabled:opacity-50"
                >
                  {resendLoading ? "Sending…" : "Resend verification email"}
                </button>
              )}
            </form>
            {mode !== "forgot" && (
              <>
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">or</span>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleGoogle}
                  disabled={oauthLoading || loading}
                >
                  {oauthLoading ? "Redirecting…" : "Continue with Google"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}