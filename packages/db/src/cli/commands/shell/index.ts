import type { AstroConfig } from 'astro';
import { sql } from 'drizzle-orm';
import type { Arguments } from 'yargs-parser';
import { appTokenError } from '../../../errors.js';
import { createRemoteDatabaseClient, getAstroStudioEnv } from '../../../utils.js';

export async function cmd({ config, flags }: { config: AstroConfig; flags: Arguments }) {
	const query = flags.query; 
	const appToken = flags.token ?? getAstroStudioEnv().ASTRO_STUDIO_APP_TOKEN;
	if (!appToken) {
		// eslint-disable-next-line no-console
		console.error(appTokenError);
		process.exit(1);
	}

	const db = createRemoteDatabaseClient(appToken);
	// Temporary: create the migration table just in case it doesn't exist
	const result = await db.run(sql.raw(query));
	console.log(result);
}
