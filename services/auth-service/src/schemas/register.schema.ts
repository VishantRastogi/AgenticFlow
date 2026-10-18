import { z } from "zod";

export const registerSchema = z.object({
	username: z.string().trim().min(3).max(50),
	email: z.string().trim().toLowerCase().pipe(z.email()),
	password: z
		.string()
		.min(8)
		.max(128)
		.regex(/[a-z]/, "Must contain a lowercase letter")
		.regex(/[A-Z]/, "Must contain an uppercase letter")
		.regex(/\d/, "Must contain a number"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
