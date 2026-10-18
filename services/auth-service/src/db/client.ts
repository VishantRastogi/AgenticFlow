import "dotenv/config";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
	throw new Error("DATABASE_URL environment variable is not set.");
}

const pool = new Pool({
	connectionString,
	max: 10, // maximum number of clients in the pool
});

export default pool;
