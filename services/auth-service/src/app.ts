import { z } from "zod";
import express from "express";
import { requestLogger } from "./middleware/requestLogger.js";
import { registerSchema } from "./schemas/register.schema.js";
import { errorHandler } from "./middleware/errorHandler.js";
import db from "./db/index.js";
import { users } from "./db/schema.js";
import { hashPassword } from "./utils/password.js";

const app = express();

// request logger middleware
app.use(requestLogger);

// built-in middleware to parse JSON request bodies
app.use(express.json());

// health check endpoint
app.get("/health", (_, res) => {
	res.status(200).json({
		status: "ok",
		service: "auth-service",
	});
});

// register endpoint
app.post("/api/v1/auth/register", async (req, res) => {
	const validation = registerSchema.safeParse(req.body);
	if (!validation.success) {
		return res.status(400).json({
			error: "Validation failed",
			details: z.flattenError(validation.error),
		});
	}

	const { username, email, password } = validation.data;
	try {
		const hashedPassword = await hashPassword(password);
		const insertResult = await db
			.insert(users)
			.values({
				username,
				email,
				passwordHash: hashedPassword,
			})
			.returning({
				id: users.id,
				username: users.username,
				email: users.email,
			});
		return res.status(201).json({
			id: insertResult[0].id,
			username: insertResult[0].username,
			email: insertResult[0].email,
		});
	} catch (error) {
		if (
			typeof error === "object" &&
			error !== null &&
			"cause" in error &&
			typeof error.cause === "object" &&
			error.cause !== null &&
			"code" in error.cause &&
			error.cause.code === "23505"
		) {
			return res.status(409).json({
				error: "User with this email already exists.",
				email,
			});
		}
		console.error("Error occurred while inserting user:", error);
		return res.status(500).json({
			error: "Internal server error",
		});
	}
});

// info endpoint
app.get("/api/v1/auth/info", (_, res) => {
	res.status(200).json({
		name: "AgentFlow Auth Service",
		version: "1.0.0",
	});
});

// custom error handler middleware
app.use(errorHandler);

export default app;
