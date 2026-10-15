This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Firebase student submissions

Enable **Anonymous** sign-in in Firebase Authentication and create a Cloud Firestore database.

Configure the six `NEXT_PUBLIC_FIREBASE_*` settings from the Firebase project's web app configuration. The Firebase Admin SDK also requires server-only credentials:

- Locally, set `GOOGLE_APPLICATION_CREDENTIALS` to the path of a service-account JSON file. Keep the file out of Git.
- In production, set `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` to the service-account JSON as a server-only secret. Never use a `NEXT_PUBLIC_` prefix.

The service account must belong to the same Firebase project as `NEXT_PUBLIC_FIREBASE_PROJECT_ID`. Student submissions are verified and graded on the server, then stored under `quizzes/{quizId}/submissions`. A one-attempt quiz stores one response per anonymous participant; retries return that saved result. The room and quiz definitions remain demo data in `lib/mock-data.ts`, and the lecturer results page is still a static demo.

Firestore client access is denied by `firestore.rules`; only the server-side Admin SDK writes submissions. Deploy the rules with the Firebase CLI:

```bash
firebase deploy --only firestore:rules
```

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# SAmple quiz

https://mylms.vossie.net/mod/quiz/review.php?attempt=3571596&cmid=1573049&showall=1
