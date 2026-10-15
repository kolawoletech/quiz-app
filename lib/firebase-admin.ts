import "server-only";

import { applicationDefault, cert, getApp, getApps, initializeApp, type ServiceAccount } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { z } from "zod";

const serviceAccountSchema = z.object({
  project_id: z.string().min(1),
  client_email: z.string().email(),
  private_key: z.string().min(1),
});

function readServiceAccount() {
  const inlineServiceAccount = process.env.FIREBASE_ADMIN_SERVICE_ACCOUNT_JSON;
  return inlineServiceAccount
    ? serviceAccountSchema.parse(JSON.parse(inlineServiceAccount))
    : null;
}

function getFirebaseAdminApp() {
  const existingApp = getApps().find((app) => app.name === "[DEFAULT]");
  if (existingApp) {
    return getApp();
  }

  const serviceAccount = readServiceAccount();
  const configuredProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (serviceAccount && configuredProjectId && serviceAccount.project_id !== configuredProjectId) {
    throw new Error("Firebase Admin credentials do not match the configured Firebase project.");
  }

  return initializeApp({
    credential: serviceAccount
      ? cert({
          projectId: serviceAccount.project_id,
          clientEmail: serviceAccount.client_email,
          privateKey: serviceAccount.private_key,
        } satisfies ServiceAccount)
      : applicationDefault(),
    ...(serviceAccount
      ? { projectId: serviceAccount.project_id }
      : configuredProjectId
        ? { projectId: configuredProjectId }
        : {}),
  });
}

export function getFirebaseAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

export function getFirebaseAdminFirestore() {
  return getFirestore(getFirebaseAdminApp());
}
