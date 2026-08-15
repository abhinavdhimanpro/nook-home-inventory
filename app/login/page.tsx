import type { Metadata } from "next";
import Image from "next/image";
import { Box, LockKeyhole, ShieldCheck } from "lucide-react";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; returnTo?: string }> }) {
  const params = await searchParams;
  const configurationError = params.error === "config";
  const credentialError = params.error === "credentials";

  return <main className="login-page">
    <section className="login-story">
      <div className="login-brand"><span><Image src="/nook-mark.svg" alt="" width={40} height={40} priority /></span>Nook</div>
      <div className="login-copy">
        <p className="eyebrow">Your private home memory</p>
        <h1>Know where<br />everything lives.</h1>
        <p>A visual inventory for your rooms, cupboards, shelves, and all the useful things tucked inside them.</p>
      </div>
      <div className="login-feature"><span><Box size={20} /></span><div><strong>Private household access</strong><small>Your inventory stays behind one shared household login.</small></div></div>
    </section>
    <section className="login-form-panel">
      <div className="login-form-wrap">
        <div className="login-lock"><LockKeyhole size={23} /></div>
        <p className="eyebrow">Welcome home</p>
        <h2>Sign in to Nook</h2>
        <p className="login-intro">Use your private household username and password.</p>
        {credentialError && <div className="login-error">That username or password is not correct.</div>}
        {configurationError && <div className="login-error">Login has not been configured on this deployment yet.</div>}
        <form action="/api/auth/login" method="post">
          <input type="hidden" name="returnTo" value={params.returnTo ?? "/"} />
          <label><span>Username</span><input name="username" autoComplete="username" placeholder="Household username" required /></label>
          <label><span>Password</span><input type="password" name="password" autoComplete="current-password" placeholder="Your private password" required /></label>
          <button type="submit">Enter my home <LockKeyhole size={17} /></button>
        </form>
        <p className="login-security"><ShieldCheck size={15} /> Secured with an encrypted, HTTP-only session.</p>
      </div>
    </section>
  </main>;
}
