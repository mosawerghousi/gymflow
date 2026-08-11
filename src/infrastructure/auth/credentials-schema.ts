import { z } from "zod";

/** Shared by the Auth.js provider and the login form. */
export const credentialsSchema = z.object({
  email: z.string().trim().email("Enter a valid email address.").max(160),
  password: z.string().min(1, "Enter your password.").max(200),
});

export type CredentialsInput = z.infer<typeof credentialsSchema>;
