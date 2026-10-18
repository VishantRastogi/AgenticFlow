import { defineConfig } from "drizzle-kit";

const databaseUrl = (globalThis as typeof globalThis & {
	process: { env: Record<string, string | undefined> };
}).process.env.DATABASE_URL;

export default defineConfig({
	dialect: "postgresql",
	schema: "./src/db/schema.ts",
	out: "./drizzle",
	dbCredentials: {
		url: databaseUrl!,
	},
});
