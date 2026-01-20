const fs = require("node:fs");
const path = require("node:path");

const ssl =
	process.env.DB_SSL === "true"
		? { ca: fs.readFileSync(path.join(__dirname, "certs", "ca-certificate.crt"), "utf-8") }
		: false;

module.exports = {
	databaseUrl: process.env.DATABASE_URL,
	ssl,
};
