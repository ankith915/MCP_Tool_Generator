import { renderProject } from "@/server/services/generate";
import { GalleryCard } from "@/components/gallery/gallery-card";
import type { WizardConfig } from "@/lib/schemas/wizard";

const GALLERY_CONFIGS: Array<{
  config: WizardConfig;
  title: string;
  primaryFile: string;
  language: "typescript" | "python";
}> = [
  {
    title: "Weather Server — TypeScript Streamable HTTP",
    primaryFile: "src/index.ts",
    language: "typescript",
    config: {
      serverName: "weather-server",
      displayName: "Weather Server",
      description: "Fetches current weather data for a given city",
      version: "0.1.0",
      language: "typescript",
      framework: "sdk",
      transport: "streamable-http",
      existingFastapiService: false,
      port: 3000,
      mcpEndpoint: "/mcp",
      logLevel: "info",
      tool: {
        name: "get_weather",
        description:
          "Fetches current weather conditions for a city. Returns temperature, humidity, and weather description. Example: get_weather({ city: 'London' })",
        parameters: [
          {
            name: "city",
            type: "string",
            description: "The city name to fetch weather for",
            required: true,
          },
        ],
      },
    },
  },
  {
    title: "Search Server — Python FastMCP Streamable HTTP",
    primaryFile: "server.py",
    language: "python",
    config: {
      serverName: "search-server",
      displayName: "Search Server",
      description: "Performs web searches and returns structured results",
      version: "0.1.0",
      language: "python",
      framework: "fastmcp",
      transport: "streamable-http",
      existingFastapiService: false,
      port: 3000,
      mcpEndpoint: "/mcp",
      logLevel: "info",
      tool: {
        name: "search_web",
        description:
          "Searches the web and returns top results with titles and URLs. Example: search_web({ query: 'latest AI news', max_results: 5 })",
        parameters: [
          {
            name: "query",
            type: "string",
            description: "The search query string",
            required: true,
          },
          {
            name: "max_results",
            type: "number",
            description: "Maximum number of results to return (default 10)",
            required: false,
          },
        ],
      },
    },
  },
  {
    title: "Orders Server — Python FastAPI-MCP Streamable HTTP",
    primaryFile: "main.py",
    language: "python",
    config: {
      serverName: "orders-server",
      displayName: "Orders Server",
      description: "Exposes order management endpoints as MCP tools via FastAPI-MCP",
      version: "0.1.0",
      language: "python",
      framework: "fastapi-mcp",
      transport: "streamable-http",
      existingFastapiService: true,
      port: 3000,
      mcpEndpoint: "/mcp",
      logLevel: "info",
      tool: {
        name: "get_order",
        description:
          "Retrieves order details by order ID including status, items, and shipping info. Example: get_order({ order_id: 'ord_abc123' })",
        parameters: [
          {
            name: "order_id",
            type: "string",
            description: "The unique order identifier",
            required: true,
          },
        ],
      },
    },
  },
];

export default async function GalleryPage() {
  const cards = await Promise.all(
    GALLERY_CONFIGS.map(async ({ config, title, primaryFile, language }) => {
      const files = await renderProject(config);
      const code = files[primaryFile] ?? "";
      return { title, filename: primaryFile, language, code };
    }),
  );

  return (
    <main className="flex min-h-screen flex-col items-center px-6 py-16 gap-12">
      <section className="max-w-3xl text-center flex flex-col items-center gap-4">
        <h1 className="text-4xl font-bold tracking-tight">Sample Gallery</h1>
        <p className="text-lg text-muted-foreground leading-relaxed">
          Real generated output for three different MCP server configurations. Every file you see
          below is exactly what you get in the downloaded ZIP — no edits.
        </p>
      </section>

      <section className="w-full max-w-6xl flex flex-col gap-8">
        {cards.map((card) => (
          <GalleryCard
            key={card.filename + card.title}
            title={card.title}
            filename={card.filename}
            language={card.language}
            code={card.code}
          />
        ))}
      </section>
    </main>
  );
}
