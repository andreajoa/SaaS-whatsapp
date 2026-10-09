// @vitest-environment node
/** O worker real usa o mesmo versionamento, embeddings e tabela de chunks de URL e FAQ. */
import { beforeEach, expect, it, vi } from "vitest";
import { processRagIndexer } from "@/workers/rag-indexer";
import { extrairTextoDaUrl, ErroDeFonteUrl } from "@/lib/ai/rag/url-source";
import { embedText } from "@/lib/ai/embed";
import { activateVersion, createKnowledgeVersion, markVersionFailed } from "@/lib/ai/rag/version";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EventRow } from "@/lib/event-log/dispatcher";

vi.mock("@/lib/ai/embed", () => ({
  embedText: vi.fn(),
  SemChaveDeEmbeddingError: class extends Error {},
}));
vi.mock("@/lib/ai/embeddings/chave", () => ({
  resolverChaveDeEmbedding: vi.fn(async () => ({ apiKey: "test-only" })),
}));
vi.mock("@/lib/ai/rag/debounce", () => ({ acquireDebounce: vi.fn(async () => true) }));
vi.mock("@/lib/ai/rag/url-source", () => ({
  extrairTextoDaUrl: vi.fn(),
  ErroDeFonteUrl: class extends Error {},
}));
vi.mock("@/lib/ai/rag/ingest/documento", () => ({
  extrairTextoDoArquivo: vi.fn(),
  ErroDeExtracao: class extends Error {},
}));
vi.mock("@/lib/ai/runtime/history", () => ({
  estimateTokens: (s: string) => Math.ceil(s.length / 4),
}));
vi.mock("@/lib/ai/rag/version", () => ({
  createKnowledgeVersion: vi.fn(),
  markVersionReady: vi.fn(),
  markVersionFailed: vi.fn(),
  activateVersion: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/nuvemshop/api-client", () => ({ NuvemshopApiClient: class {} }));

const row = {
  id: "event-1",
  organization_id: "org-1",
  event_type: "knowledge_source.updated",
  payload: { knowledge_source_id: "source-1" },
  created_at: new Date().toISOString(),
} as unknown as EventRow;
let tipo: string;
let escrita: Array<{ tabela: string; campos: Record<string, unknown> }>;
let filtros: Array<[string, string, unknown]>;

beforeEach(() => {
  vi.clearAllMocks();
  tipo = "url";
  escrita = [];
  filtros = [];
  vi.mocked(extrairTextoDaUrl).mockResolvedValue({
    texto: "Trocas em trinta dias com frete grátis.",
    url: "https://public.site/policy",
  });
  vi.mocked(embedText).mockResolvedValue({
    embedding: [0.1, 0.2],
    promptTokens: 10,
    model: "test",
  });
  vi.mocked(createKnowledgeVersion).mockResolvedValue({
    versionId: "version-new",
    versionNumber: 2,
  });
  vi.mocked(createAdminClient).mockReturnValue({
    from: (tabela: string) => {
      const cadeia = {
        select: () => cadeia,
        eq: (campo: string, valor: unknown) => {
          filtros.push([tabela, campo, valor]);
          return cadeia;
        },
        is: () => cadeia,
        maybeSingle: async () => ({
          data:
            tabela === "ai_knowledge_sources"
              ? {
                  id: "source-1",
                  organization_id: "org-1",
                  agent_id: null,
                  name: "Trocas",
                  source_type: tipo,
                  status: "ready",
                  is_active: true,
                  active_kb_version_id: "version-old",
                  source_metadata: { url: "https://public.site/policy" },
                }
              : null,
          error: null,
        }),
        order: async () => ({
          data: [{ question: "Qual o prazo?", answer: "Trinta dias" }],
          error: null,
        }),
        update: (campos: Record<string, unknown>) => {
          escrita.push({ tabela, campos });
          return cadeia;
        },
        upsert: async (campos: Record<string, unknown>) => {
          escrita.push({ tabela, campos });
          return { error: null };
        },
        insert: async (campos: Record<string, unknown>) => {
          escrita.push({ tabela, campos });
          return { error: null };
        },
      };
      return cadeia;
    },
  } as never);
});

it("URL gera chunks com proveniência e ativa versão pelo pipeline existente", async () => {
  const result = await processRagIndexer(row);
  expect(result.status).toBe("ok");
  expect(extrairTextoDaUrl).toHaveBeenCalledWith("https://public.site/policy");
  expect(createKnowledgeVersion).toHaveBeenCalledWith({
    organizationId: "org-1",
    knowledgeSourceId: "source-1",
    agentId: null,
    sourceType: "url",
  });
  expect(escrita.find((e) => e.tabela === "ai_chunks")?.campos).toMatchObject({
    organization_id: "org-1",
    knowledge_source_id: "source-1",
    kb_version_id: "version-new",
    content: "Trocas em trinta dias com frete grátis.",
    metadata: { source_type: "url", url: "https://public.site/policy" },
  });
  expect(activateVersion).toHaveBeenCalledWith({
    organizationId: "org-1",
    knowledgeSourceId: "source-1",
    versionId: "version-new",
  });
  expect(
    escrita.some(
      (e) =>
        e.campos.last_index_status === "success" && typeof e.campos.last_indexed_at === "string",
    ),
  ).toBe(true);
  expect(filtros).toContainEqual(["ai_knowledge_sources", "organization_id", "org-1"]);
});

it("falha de extração é visível e preserva ponteiro, chunks e última indexação", async () => {
  vi.mocked(extrairTextoDaUrl).mockRejectedValue(new ErroDeFonteUrl("A página redireciona."));
  expect((await processRagIndexer(row)).status).toBe("error");
  expect(createKnowledgeVersion).not.toHaveBeenCalled();
  expect(embedText).not.toHaveBeenCalled();
  expect(activateVersion).not.toHaveBeenCalled();
  expect(escrita).toContainEqual({
    tabela: "ai_knowledge_sources",
    campos: { last_index_status: "failed", last_index_error: "A página redireciona." },
  });
  expect(escrita.some((e) => e.tabela === "agent_inbox_items")).toBe(true);
  expect(
    escrita.every(
      (e) =>
        !("active_kb_version_id" in e.campos) &&
        !("last_indexed_at" in e.campos) &&
        !("chunks_count" in e.campos),
    ),
  ).toBe(true);
  vi.mocked(extrairTextoDaUrl).mockResolvedValue({
    texto: "Página corrigida",
    url: "https://public.site/policy",
  });
  expect((await processRagIndexer(row)).status).toBe("ok");
  expect(activateVersion).toHaveBeenCalledTimes(1);
});

it("falha de embedding não ativa a nova versão", async () => {
  vi.mocked(embedText).mockRejectedValue(new Error("embedding indisponível"));
  expect((await processRagIndexer(row)).status).toBe("error");
  expect(markVersionFailed).toHaveBeenCalled();
  expect(activateVersion).not.toHaveBeenCalled();
});

it("FAQ mantém seu caminho sem buscar URL", async () => {
  tipo = "faq";
  expect((await processRagIndexer(row)).status).toBe("ok");
  expect(extrairTextoDaUrl).not.toHaveBeenCalled();
  expect(escrita.find((e) => e.tabela === "ai_chunks")?.campos.content).toContain(
    "Pergunta: Qual o prazo?",
  );
});
