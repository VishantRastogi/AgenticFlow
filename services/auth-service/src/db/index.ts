import { drizzle } from "drizzle-orm/node-postgres";
import pool from "./client.js";

const db = drizzle(pool, { logger: true });

export default db;
