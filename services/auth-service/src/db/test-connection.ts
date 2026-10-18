import pool from "./client.js";

const testConnection = async () => {
	let client;
	try {
		client = await pool.connect();
		console.log("Database connection successful.");
		const result = await client.query("SELECT NOW() AS server_time");
		console.log("Current time from database:", result.rows[0].server_time);
	} catch (err) {
		console.error("Database connection failed:", err);
	} finally {
		client?.release();
		await pool.end();
	}
};

testConnection();
