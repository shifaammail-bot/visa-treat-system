/** A Postgres error message without its "ERROR:" prefix, fit to show staff. */
export const dbError = (message: string) => message.replace(/^.*?ERROR:\s*/i, "");
