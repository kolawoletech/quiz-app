This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Firebase setup and security

Create a Firebase project and Cloud Firestore database. Enable **Anonymous** sign-in for students and **Google** sign-in for lecturers. Add the production domain and any Vercel Preview domain used for lecturer sign-in to Firebase Authentication's **Authorized domains**.

Configure these six Firebase web-app values locally and in the Vercel environments that will run the app:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

The Firebase Admin SDK uses one of these server-only credentials:

- Local use: `GOOGLE_APPLICATION_CREDENTIALS` pointing to a service-account JSON outside Git, or `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` in a private local environment file.
- Vercel: `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` configured as a sensitive variable for **each** environment that needs Admin operations (Preview and Production). Never use a `NEXT_PUBLIC_` prefix.

The service account must belong to the same project as `NEXT_PUBLIC_FIREBASE_PROJECT_ID`. Keep all `.env*` files and service-account files out of Git.

### Quiz content and answer-key protection

Quiz documents and question/answer documents are stored in Firestore at `quizzes/{quizId}` and `quizzes/{quizId}/questions/{questionId}`. Submissions are stored separately at `quizzes/{quizId}/submissions/{submissionId}`. Firestore client rules remain deny-all; the Admin SDK reads content and grades submissions on the server. Student join responses contain only the question text, code, options, and points; answer keys and explanations are not sent to the client before submission. Lecturer access requires a verified Google ID token and an email in the server-only `LECTURER_EMAILS` comma-separated allowlist.

The sample source files `Basic_CSharp_Practice_Quiz.json` and `Advanced_CSharp_Practice_Quiz.json` are now ignored by Git. Keep local copies to import them; do not add them back to the repository. Seed or refresh Firestore from the project root with:

```powershell
npm run quizzes:import
```

This command uses the local Firebase Admin credentials and `NEXT_PUBLIC_FIREBASE_PROJECT_ID`; it replaces only the two practice quiz documents and their `questions` subcollections. It does not delete submissions. Confirm the import succeeded before deploying code that reads quizzes from Firestore. The sample room codes are `9762` (Basic C#, 22 questions) and `8341` (Advanced C#, 30 questions).

**Repository history note:** earlier commits contained the sample JSON files, so removing them from the current version does not erase them from Git history. These files are practice samples only. Do not put summative assessment questions or real answer keys into this repository; use a private source and Firestore. If any real assessment answers were committed, treat them as disclosed and replace them.

### Lecturer dashboard

Set `LECTURER_EMAILS` to a comma-separated list of verified lecturer Google account emails in local configuration and in Vercel Preview/Production as appropriate. The `/results` dashboard shows submissions, scores, pass status, per-question performance, and participant response details; CSV export includes participant names and responses. The `/questions` page requires the same lecturer authorization before returning the question bank or answer keys.

The current sample quizzes are for practice, not verified summative assessments. `showCorrectAnswersAfterSubmit` intentionally controls whether a student receives answer review after submission. Keep that disabled for assessments where answers must remain confidential.

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

## Validation and deployment commands

Run these from the repository root:

```powershell
npm ci
npm test
npm run lint
npm run build
```

The Firestore client rules deny all direct access. Deploy them explicitly to the intended Firebase project:

```powershell
firebase deploy --only firestore:rules --project quiz-app-comms
```

Configure Vercel variables in **Project → Settings → Environment Variables**. Use **Preview** for preview deployments and **Production** for the live site. Add/update sensitive `FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON` using Vercel's protected input; never place secret values in command history or source control. `LECTURER_EMAILS` is server-only; the six `NEXT_PUBLIC_FIREBASE_*` values are public Firebase web-app configuration, not secrets.

For a preview deployment from the current local branch:

```powershell
vercel
```

For a production deployment from the checked-out branch:

```powershell
vercel --prod
```

Alternatively, push the intended release branch to GitHub and let Vercel deploy its configured Production Branch (usually `main`). To keep production manual, do not use `vercel --prod` and do not merge/push into that configured branch until ready. Any environment-variable change requires a **new deployment** to take effect. For Firebase Auth, also add each deployed host to Authorized domains before testing Google sign-in.

For this Firestore-backed quiz version, perform these steps before the first deployment after migration:

1. Ensure the quiz source JSONs are present locally (they are intentionally not versioned) and verify the local Firebase Admin credentials point to `quiz-app-comms`.
2. Run `npm run quizzes:import` to seed/update quiz and question documents.
3. Run `npm test`, `npm run lint`, and `npm run build`.
4. Deploy Firestore rules with the project-specific command above.
5. Deploy to Preview with `vercel` and test student join, answer submission, lecturer sign-in, and results.
6. When satisfied, deploy manually to Production with `vercel --prod` or merge/push to the configured production branch.

`firebase.json` deploys only Firestore rules; it does not deploy the Next.js app. Vercel deploys the app. `npm run quizzes:import` writes quiz data to Firestore; it does not deploy app code.

## Practice sample reference

https://mylms.vossie.net/mod/quiz/review.php?attempt=3571596&cmid=1573049&showall=1

Basic C# Practice Quiz — 22 questions, room 9762  
Advanced C# Practice Quiz — 30 questions, room 8341