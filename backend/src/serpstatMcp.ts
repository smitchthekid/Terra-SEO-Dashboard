/**
 * Serpstat MCP Client
 *
 * HTTP-based MCP client that talks to https://mcp.serpstat.com/mcp
 * Uses Streamable HTTP transport (JSON-RPC 2.0 over POST).
 */

import axios, { AxiosInstance } from 'axios';

const MCP_ENDPOINT = 'https://mcp.serpstat.com/mcp';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JsonRpcRequest {
    jsonrpc: '2.0';
    id: number;
    method: string;
    params?: Record<string, any>;
}

interface JsonRpcResponse {
    jsonrpc: '2.0';
    id: number;
    result?: any;
    error?: { code: number; message: string; data?: any };
}

interface McpToolResult {
    content: Array<{ type: string; text?: string;[key: string]: any }>;
    isError?: boolean;
}

// ---------------------------------------------------------------------------
// MCP Client Class
// ---------------------------------------------------------------------------

export class SerpstatMcpClient {
    private token: string;
    private client: AxiosInstance;
    private sessionId: string | null = null;
    private requestId = 0;

    constructor(token: string) {
        this.token = token;
        this.client = axios.create({
            baseURL: MCP_ENDPOINT,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json, text/event-stream',
            },
            timeout: 120_000, // 2 minutes -- rank tracker queries can be slow
        });
    }

    private nextId(): number {
        return ++this.requestId;
    }

    /**
     * Send a JSON-RPC request to the MCP endpoint.
     * Handles session tracking via Mcp-Session-Id header.
     */
    private async send(method: string, params?: Record<string, any>): Promise<any> {
        const body: JsonRpcRequest = {
            jsonrpc: '2.0',
            id: this.nextId(),
            method,
            ...(params !== undefined ? { params } : {}),
        };

        const headers: Record<string, string> = {};
        if (this.sessionId) {
            headers['Mcp-Session-Id'] = this.sessionId;
        }

        const response = await this.client.post('', body, { headers });

        // Capture session ID from response headers
        const sid = response.headers['mcp-session-id'];
        if (sid) {
            this.sessionId = sid;
        }

        const data: JsonRpcResponse = response.data;

        if (data.error) {
            throw new Error(`MCP error ${data.error.code}: ${data.error.message}`);
        }

        return data.result;
    }

    /**
     * Initialize the MCP session (handshake).
     */
    async initialize(): Promise<void> {
        await this.send('initialize', {
            protocolVersion: '2025-03-26',
            capabilities: {},
            clientInfo: {
                name: 'terra-seo-dashboard',
                version: '1.0.0',
            },
        });

        // Send initialized notification (no response expected, but we send it)
        try {
            const notif: any = {
                jsonrpc: '2.0',
                method: 'notifications/initialized',
            };
            const headers: Record<string, string> = {
                'Content-Type': 'application/json',
            };
            if (this.sessionId) {
                headers['Mcp-Session-Id'] = this.sessionId;
            }
            await this.client.post('', notif, { headers });
        } catch {
            // Notifications may not return a response -- that is OK
        }
    }

    /**
     * List available tools on the MCP server.
     */
    async listTools(): Promise<any[]> {
        const result = await this.send('tools/list', {});
        return result?.tools || [];
    }

    /**
     * Call a specific tool on the MCP server.
     */
    async callTool(name: string, args: Record<string, any> = {}): Promise<McpToolResult> {
        // Inject the API token into every tool call
        const argsWithToken = { ...args, api_token: this.token };
        const result = await this.send('tools/call', {
            name,
            arguments: argsWithToken,
        });
        return result as McpToolResult;
    }

    /**
     * Extract text content from a tool result, parsing JSON if possible.
     */
    static parseToolResult(result: McpToolResult): any {
        if (result.isError) {
            const errText = result.content
                .filter(c => c.type === 'text')
                .map(c => c.text)
                .join('\n');
            throw new Error(`Tool returned error: ${errText}`);
        }

        const textParts = result.content
            .filter(c => c.type === 'text')
            .map(c => c.text || '');

        const combined = textParts.join('\n');

        try {
            return JSON.parse(combined);
        } catch {
            return combined;
        }
    }
}

// ---------------------------------------------------------------------------
// High-level API functions
// ---------------------------------------------------------------------------

/**
 * Fetch the list of rank tracker projects from Serpstat.
 */
export async function listProjects(token: string): Promise<any[]> {
    const client = new SerpstatMcpClient(token);
    await client.initialize();

    // Try common tool names for listing projects
    const toolNames = ['rt_get_projects', 'get_projects', 'rank_tracker_projects'];
    let result: McpToolResult | null = null;

    for (const name of toolNames) {
        try {
            result = await client.callTool(name, {});
            break;
        } catch (e: any) {
            // Tool not found, try next
            if (e.message?.includes('not found') || e.message?.includes('Unknown tool')) {
                continue;
            }
            throw e;
        }
    }

    if (!result) {
        // Fallback: list all tools and find the right one
        const tools = await client.listTools();
        const projectTool = tools.find((t: any) =>
            t.name?.toLowerCase().includes('project') &&
            (t.name?.toLowerCase().includes('list') || t.name?.toLowerCase().includes('get'))
        );

        if (projectTool) {
            result = await client.callTool(projectTool.name, {});
        } else {
            throw new Error('Could not find a project listing tool. Available tools: ' +
                tools.map((t: any) => t.name).slice(0, 20).join(', '));
        }
    }

    const parsed = SerpstatMcpClient.parseToolResult(result);
    return Array.isArray(parsed) ? parsed : (parsed?.data || parsed?.projects || [parsed]);
}

/**
 * Fetch positions history for a given project and region.
 */
export async function fetchPositionsHistory(
    token: string,
    projectId: number | string,
    regionId?: number | string
): Promise<any> {
    const client = new SerpstatMcpClient(token);
    await client.initialize();

    // Build arguments
    const args: Record<string, any> = {
        project_id: Number(projectId),
    };
    if (regionId !== undefined && regionId !== null && regionId !== '') {
        args.region_id = Number(regionId);
    }

    // Try common tool names for positions history
    const toolNames = [
        'rt_get_positions_history',
        'get_positions_history',
        'rank_tracker_positions_history',
        'getUrlsSerpResultsHistory',
        'getKeywordsSerpResultsHistory',
    ];

    let result: McpToolResult | null = null;

    for (const name of toolNames) {
        try {
            result = await client.callTool(name, args);
            break;
        } catch (e: any) {
            if (e.message?.includes('not found') || e.message?.includes('Unknown tool')) {
                continue;
            }
            throw e;
        }
    }

    if (!result) {
        // Fallback: discover tools
        const tools = await client.listTools();
        const historyTool = tools.find((t: any) =>
            t.name?.toLowerCase().includes('position') ||
            t.name?.toLowerCase().includes('history') ||
            t.name?.toLowerCase().includes('serp')
        );

        if (historyTool) {
            result = await client.callTool(historyTool.name, args);
        } else {
            throw new Error('Could not find a positions history tool. Available tools: ' +
                tools.map((t: any) => t.name).slice(0, 30).join(', '));
        }
    }

    return SerpstatMcpClient.parseToolResult(result);
}

/**
 * Discover all available tools on the MCP server (useful for debugging).
 */
export async function discoverTools(token: string): Promise<any[]> {
    const client = new SerpstatMcpClient(token);
    await client.initialize();
    return client.listTools();
}
