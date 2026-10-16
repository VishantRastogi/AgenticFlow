import express from "express";

const app = express();

app.get("/health", (_, res) => {
	res.status(200).json({
		status: "ok",
		service: "auth-service",
	});
});

app.get("/api/v1/auth/info", (req, res) => {
	res.status(200).json({
		name: "AgentFlow Auth Service",
		version: "1.0.0",
	});
});

export default app;
