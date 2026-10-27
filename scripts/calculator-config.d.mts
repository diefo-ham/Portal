import type { IncomingMessage, ServerResponse } from "node:http";
export function serveCalculatorConfig(req: IncomingMessage, res: ServerResponse, disabled?: boolean): Promise<boolean>;
