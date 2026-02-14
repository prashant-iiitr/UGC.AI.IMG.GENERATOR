   import * as Sentry from "@sentry/node" 


Sentry.init({
  dsn: "https://fd14ac834d8342d826c7b06651084f8d@o4510798767980544.ingest.us.sentry.io/4510798793736192",
  // Setting this option to true will send default PII data to Sentry.
  // For example, automatic IP address collection on events
  sendDefaultPii: true,
});