import { z } from "zod";

export const signInSchema = z.object({
  email: z.email({ error: "Please enter a valid email." }),
  password: z.string().min(1, { error: "Password is required." }),
});

export const signUpSchema = z.object({
  firstName: z.string().min(1, { error: "First name is required." }).trim(),
  lastName: z.string().min(1, { error: "Last name is required." }).trim(),
  email: z.email({ error: "Please enter a valid email." }),
  password: z
    .string()
    .min(8, { error: "Password must be at least 8 characters." }),
});

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;

export type AuthActionResult =
  | { error: string }
  | { success: true };
