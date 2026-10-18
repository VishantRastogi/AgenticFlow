import db from "./index.js";
import pool from "./client.js";
import { users } from "./schema.js";

const testDrizzle = async () => {
	try {
		const result = await db.select().from(users);
		console.log("Users:", result);
	} catch (err) {
		console.error("Error occurred while fetching users:", err);
	} finally {
		await pool.end();
	}
};

testDrizzle();
