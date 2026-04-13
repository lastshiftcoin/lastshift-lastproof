import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: "https://aae706cda4c5cdfe407a517987721071@o4511213815660544.ingest.us.sentry.io/4511213904461824",
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.2,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  environment: process.env.NODE_ENV,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
