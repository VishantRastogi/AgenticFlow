import rateLimit from "express-rate-limit";

export const loginRateLimiter = rateLimit({
	windowMs: 15 * 60000,
	limit: 5,
	standardHeaders: "draft-8",
	legacyHeaders: false,
	message: {
		error: "Too many login attempts. Please try again later.",
	},
});
