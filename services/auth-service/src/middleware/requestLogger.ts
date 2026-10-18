import type { Request, Response, NextFunction } from "express";

export function requestLogger(
	req: Request,
	_res: Response,
	next: NextFunction,
): void {
	const { method, path } = req;

	const timestamp = new Date().toISOString();

	console.log(`[${timestamp}] ${method} ${path}`);

	next();
}
