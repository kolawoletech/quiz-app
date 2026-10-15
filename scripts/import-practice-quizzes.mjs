import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { loadEnvConfig } from "@next/env";
import { mapPracticeQuiz } from "./practice-import.mjs";

loadEnvConfig(process.cwd());

const require = createRequire(import.meta.url);
const { applicationDefault, cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

const sources = [
  { file: "Basic_CSharp_Practice_Quiz.json", id: "quiz-basic-csharp-practice", codePrefix: "basic", roomCode: "9762" },
  { file: "Advanced_CSharp_Practice_Quiz.json", id: "quiz-advanced-csharp-practice", codePrefix: "advanced", roomCode: "8341" },
];

const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
if (!projectId) {
  throw new Error("Set NEXT_PUBLIC_FIREBASE_PROJECT_ID before importing quiz content.");
}

const inlineServiceAccount = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
const serviceAccount = inlineServiceAccount ? JSON.parse(inlineServiceAccount) : null;
if (serviceAccount && serviceAccount.project_id !== projectId) {
  throw new Error("Firebase Admin credentials do not match NEXT_PUBLIC_FIREBASE_PROJECT_ID.");
}

if (!serviceAccount && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  throw new Error("Set FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS before importing.");
}

const app = getApps().find((candidate) => candidate.name === "[DEFAULT]") ?? initializeApp({
  credential: serviceAccount
    ? cert({
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        privateKey: serviceAccount.private_key,
      })
    : applicationDefault(),
  projectId,
});
const firestore = getFirestore(app);

for (const source of sources) {
  const content = JSON.parse(await readFile(resolve(process.cwd(), source.file), "utf8"));
  const { quiz, questions } = mapPracticeQuiz(content, source);
  const quizRef = firestore.collection("quizzes").doc(source.id);
  const previousQuestions = await quizRef.collection("questions").get();
  const batch = firestore.batch();

  previousQuestions.docs.forEach((document) => batch.delete(document.ref));
  batch.set(quizRef, quiz);
  questions.forEach(({ id, ...question }) => {
    batch.set(quizRef.collection("questions").doc(id), question);
  });

  await batch.commit();
  console.log(`Imported ${source.id} (${questions.length} questions) into project ${projectId}.`);
}
