import type { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
	if (err instanceof SyntaxError && "body" in err) {
		res.status(400).json({
			error: "Malformed JSON request body",
		});
		return;
	}

	console.error("Unexpected server error");

	res.status(500).json({
		error: "Internal server error",
	});
};
