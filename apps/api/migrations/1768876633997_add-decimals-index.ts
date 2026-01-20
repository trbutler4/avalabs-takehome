import type { MigrationBuilder } from "node-pg-migrate";

export async function up(pgm: MigrationBuilder): Promise<void> {
	pgm.createIndex("tokens", "decimals", {
		where: "decimals IS NOT NULL",
		name: "idx_tokens_decimals_not_null",
	});
}

export async function down(pgm: MigrationBuilder): Promise<void> {
	pgm.dropIndex("tokens", "decimals", {
		name: "idx_tokens_decimals_not_null",
	});
}
