import { z } from "zod";
import express from "express";
import { requestLogger } from "./middleware/requestLogger.js";
import { registerSchema } from "./schemas/register.schema.js";
import { errorHandler } from "./middleware/errorHandler.js";

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
app.post("/api/v1/auth/register", (req, res) => {
	const validation = registerSchema.safeParse(req.body);
	if (!validation.success) {
		return res.status(400).json({
			error: "Validation failed",
			details: z.flattenError(validation.error),
		});
	}

	const { username, email, password } = validation.data;

	return res.status(200).json({
		username,
		email,
		password,
	});
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
