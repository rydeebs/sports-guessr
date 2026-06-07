"use client";

import { useEffect, useState } from "react";
import {
  signInWithOAuth,
  signInWithPassword,
  signUpWithPassword,
} from "@/utils/supabase/gameSync";

type WelcomePopupProps = {
  isOpen: boolean;
  isAccountUser: boolean;
  onClose: () => void;
  onCreateAccount: () => void;
  onOpen: () => void;
};

const keywordPattern = /(\s+)/;
const keywords = new Set(["WHEN", "WHERE", "WHO", "WHAT", "WHY"]);

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48">
      <path
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
        fill="#EA4335"
      />
      <path
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
        fill="#4285F4"
      />
      <path
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
        fill="#FBBC05"
      />
      <path
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
        fill="#34A853"
      />
    </svg>
  );
}

function AppleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 384 512">
      <path
        d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"
        fill="currentColor"
      />
    </svg>
  );
}

function XMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path
        d="M5 5l14 14M19 5L5 19"
        fill="none"
        stroke="currentColor"
        strokeLinecap="square"
        strokeWidth="2.4"
      />
    </svg>
  );
}

function Headline({ text }: { text: string }) {
  return (
    <h1 className="mg-popup-headline">
      {text.split(keywordPattern).map((part, index) => {
        const cleaned = part.replace(/[^A-Z]/g, "");

        return keywords.has(cleaned) && part.trim() ? (
          <span className="mg-popup-highlight" key={`${part}-${index}`}>
            {part}
          </span>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        );
      })}
    </h1>
  );
}

export function WelcomePopup({
  isOpen,
  isAccountUser,
  onClose,
  onCreateAccount,
  onOpen,
}: WelcomePopupProps) {
  const [mode, setMode] = useState<"create" | "signin">("create");
  const [showAccount, setShowAccount] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [hasError, setHasError] = useState(false);
  const [authError, setAuthError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const revealAccount = (nextMode: "create" | "signin") => {
    setShowAccount(true);
    setMode(nextMode);
    setHasError(false);
    setAuthError("");
  };

  const completeAccount = () => {
    setHasError(false);
    onCreateAccount();
    onClose();
  };

  const submitAccount = async () => {
    const validName = mode === "signin" || name.trim().length > 0;
    const validUsername =
      mode === "signin" || /^[a-zA-Z0-9_][a-zA-Z0-9_-]{2,23}$/.test(username.trim());
    const validEmail = /.+@.+\..+/.test(email);
    const validPassword = password.length > 0;

    if (!validName || !validUsername || !validEmail || !validPassword) {
      setHasError(true);
      return;
    }

    setAuthError("");
    setIsSubmitting(true);

    try {
      if (mode === "create") {
        await signUpWithPassword(name, username, email, password);
      } else {
        await signInWithPassword(email, password);
      }

      completeAccount();
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : "Authentication failed. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitOAuth = async (provider: "apple" | "google") => {
    setAuthError("");
    setIsSubmitting(true);

    try {
      await signInWithOAuth(provider);
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? error.message
          : "Authentication failed. Please try again.",
      );
      setIsSubmitting(false);
    }
  };

  return (
    <>
      {!isAccountUser ? (
        <button
          className={`mg-popup-reopen${isOpen ? "" : " mg-popup-reopen-show"}`}
          onClick={onOpen}
          type="button"
        >
          <span className="mg-popup-reopen-icon" />
          <span className="mg-popup-reopen-label">Sign in &amp; track stats</span>
        </button>
      ) : null}

      <div
        className={`mg-popup-backdrop${isOpen ? " mg-popup-backdrop-show" : ""}`}
        onClick={onClose}
      >
        <section
          aria-label="Moment Guessr sign in"
          aria-modal="true"
          className="mg-popup-modal"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
        >
          <button
            aria-label="Play as guest"
            className="mg-popup-close"
            onClick={onClose}
            type="button"
          >
            <XMark />
          </button>

          <div className="mg-popup-left">
            <video
              aria-label="Moment Guessr intro video"
              autoPlay
              className="mg-popup-left-video"
              loop
              muted
              playsInline
              poster="/moment-popup/game-bg.png"
              preload="metadata"
            >
              <source src="/moment-popup/intro.mp4" type="video/mp4" />
            </video>
            <div className="mg-popup-video-shade" />
            <div className="mg-popup-corner">
              <span className="mg-popup-live-dot" />
              <span className="mg-popup-live-text">Now Playing</span>
            </div>
          </div>

          <div className="mg-popup-seam" />

          <div className="mg-popup-right">
            <div className="mg-popup-brand">
              <img
                alt="Moment Guessr"
                className="mg-popup-logo"
                src="/moment-popup/logo-popup-attached.png"
              />
            </div>

            <div className="mg-popup-intro">
              <div className="mg-popup-rule" />
              <Headline text="GUESS THE WHEN & WHERE" />
              <p className="mg-popup-subhead">
                of history&apos;s greatest sports moments.
              </p>
            </div>

            <div className="mg-popup-signin">
              {!showAccount ? (
                <>
                  <button
                    className="mg-popup-play"
                    onClick={onClose}
                    type="button"
                  >
                    <span className="mg-popup-play-icon" />
                    Play
                  </button>
                  <div className="mg-popup-foot">
                    <span>
                      Want streaks &amp; leaderboards?{" "}
                      <button
                        className="mg-popup-link"
                        onClick={() => revealAccount("create")}
                        type="button"
                      >
                        Create a free account
                      </button>
                    </span>
                    <button
                      className="mg-popup-link"
                      onClick={() => revealAccount("signin")}
                      type="button"
                    >
                      Sign in
                    </button>
                  </div>
                  <div className="mg-popup-perks">
                    Free account unlocks{" "}
                    <b>streaks / leaderboards / stats / saved progress</b>
                  </div>
                </>
              ) : (
                <>
                  <div className="mg-popup-form-label">
                    <button
                      className="mg-popup-back"
                      onClick={() => {
                        setShowAccount(false);
                        setHasError(false);
                      }}
                      type="button"
                    >
                      &lt; Back
                    </button>
                    {mode === "create" ? "Create your account" : "Welcome back"}
                  </div>

                  <div className="mg-popup-oauth">
                    <button
                      className="mg-popup-button mg-popup-oauth-button"
                      disabled={isSubmitting}
                      onClick={() => submitOAuth("google")}
                      type="button"
                    >
                      <GoogleMark />
                      Google
                    </button>
                    <button
                      className="mg-popup-button mg-popup-oauth-button"
                      disabled={isSubmitting}
                      onClick={() => submitOAuth("apple")}
                      type="button"
                    >
                      <AppleMark />
                      Apple
                    </button>
                  </div>

                  <div className="mg-popup-or">OR</div>

                  {mode === "create" ? (
                    <>
                      <label
                        className={`mg-popup-field${
                          hasError && !name.trim() ? " mg-popup-field-error" : ""
                        }`}
                      >
                        {hasError && !name.trim() ? <span>Required</span> : null}
                        <input
                          onChange={(event) => setName(event.target.value)}
                          placeholder="Name"
                          type="text"
                          value={name}
                        />
                      </label>
                      <label
                        className={`mg-popup-field${
                          hasError &&
                          !/^[a-zA-Z0-9_][a-zA-Z0-9_-]{2,23}$/.test(
                            username.trim(),
                          )
                            ? " mg-popup-field-error"
                            : ""
                        }`}
                      >
                        {hasError &&
                        !/^[a-zA-Z0-9_][a-zA-Z0-9_-]{2,23}$/.test(
                          username.trim(),
                        ) ? (
                          <span>3-24 letters, numbers, _ or -</span>
                        ) : null}
                        <input
                          autoCapitalize="none"
                          onChange={(event) => setUsername(event.target.value)}
                          placeholder="Username"
                          type="text"
                          value={username}
                        />
                      </label>
                    </>
                  ) : null}

                  <label
                    className={`mg-popup-field${
                      hasError && !/.+@.+\..+/.test(email)
                        ? " mg-popup-field-error"
                        : ""
                    }`}
                  >
                    {hasError && !/.+@.+\..+/.test(email) ? (
                      <span>Enter a valid email</span>
                    ) : null}
                    <input
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="Email address"
                      type="email"
                      value={email}
                    />
                  </label>

                  <label
                    className={`mg-popup-field${
                      hasError && !password ? " mg-popup-field-error" : ""
                    }`}
                  >
                    {hasError && !password ? <span>Required</span> : null}
                    <input
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="Password"
                      type="password"
                      value={password}
                    />
                  </label>

                  <button
                    className="mg-popup-button mg-popup-cta"
                    disabled={isSubmitting}
                    onClick={submitAccount}
                    type="button"
                  >
                    {isSubmitting
                      ? "Working..."
                      : mode === "create"
                        ? "Create account & play"
                        : "Sign in & play"}{" "}
                    <span>&gt;</span>
                  </button>

                  {authError ? (
                    <p className="font-sans text-xs font-bold text-[#e43d4f]">
                      {authError}
                    </p>
                  ) : null}

                  <div className="mg-popup-foot">
                    <span>
                      {mode === "create" ? "Already on the roster? " : "New here? "}
                      <button
                        className="mg-popup-link"
                        onClick={() => {
                          setMode(mode === "create" ? "signin" : "create");
                          setHasError(false);
                        }}
                        type="button"
                      >
                        {mode === "create" ? "Sign in" : "Create account"}
                      </button>
                    </span>
                    <button
                      className="mg-popup-link"
                      onClick={onClose}
                      type="button"
                    >
                      Play as guest
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
