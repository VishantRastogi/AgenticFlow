import db from "./index.js";
import pool from "./client.js";
import { users } from "./schema.js";
import { hashPassword } from "../utils/password.js";

const testInsert = async () => {
	const newUser = {
		username: "Vishant",
		email: "vishant777@gmail.com",
		passwordHash: "",
	};
	try {
		newUser.passwordHash = await hashPassword("Welcome@123");
		const insertedUser = await db.insert(users).values(newUser).returning({
			id: users.id,
			username: users.username,
			email: users.email,
		});
		console.log("Inserted User:", insertedUser);
	} catch (err) {
		if (
			typeof err === "object" &&
			err !== null &&
			"code" in err &&
			err.code === "23505"
		) {
			console.error(
				"User with this email already exists.",
				newUser.email,
			);
		} else {
			console.error("Error occurred while inserting user:", err);
		}
	} finally {
		await pool.end();
	}
};

testInsert();
