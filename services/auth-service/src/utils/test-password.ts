import { hashPassword, verifyPassword } from "./password.js";

console.log("Testing password hashing and verification...");

const testPassword = async () => {
	const password = "mySecurePassword123!";
	try {
		// Hash the password
		const hashedPassword = await hashPassword(password);
		const hashedPassword2 = await hashPassword(password);
		console.log("Are hashes equal?", hashedPassword === hashedPassword2);

		// Verify the password
		const isMatch = await verifyPassword(hashedPassword, password);
		console.log("Password Match:", isMatch);

		const isMatchWrong = await verifyPassword(
			hashedPassword,
			"wrongPassword",
		);
		console.log("Password Match with wrong password:", isMatchWrong);
	} catch (error) {
		console.error("Error during password test:", error);
	}
};

testPassword();
