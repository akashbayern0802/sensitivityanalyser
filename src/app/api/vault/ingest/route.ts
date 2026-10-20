import { NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { chunkText } from '@/lib/rag/chunker';
import { embedText } from '@/lib/rag/embedder';

const MOCK_USER_ID = 'user_mock_id';

/**
 * POST /api/vault/ingest
 * Body: { itemId?: string, indexRadarEvents?: boolean }
 * - If itemId provided: chunk+embed that specific vault item
 * - If indexRadarEvents: chunk+embed all RadarEvents
 * - If neither: chunk+embed all vault items for the user
 */
export async function POST(req: Request) {
  try {
    const { itemId, indexRadarEvents = false } = await req.json().catch(() => ({}));

    const results: { id: string; chunks: number; status: string }[] = [];

    if (indexRadarEvents) {
      // Index all radar events that have content
      const events = await prisma.radarEvent.findMany({
        where: {
          OR: [
            { extractedText: { not: null } },
            { summary: { not: null } },
          ],
        },
        take: 100,
      });

      for (const event of events) {
        // Skip if already indexed
        const existing = await prisma.knowledgeChunk.findFirst({
          where: { radarEventId: event.id },
        });
        if (existing) {
          results.push({ id: event.id, chunks: 0, status: 'already_indexed' });
          continue;
        }

        const text = event.extractedText || event.summary || '';
        if (!text.trim()) continue;

        const chunks = chunkText(text, {
          source: event.title || 'Radar Event',
          url: event.url,
          date: event.publishedAt?.toISOString() || '',
        });

        let chunkCount = 0;
        for (const chunk of chunks) {
          try {
            let embedding: string | undefined;
            try {
              const vec = await embedText(chunk.content);
              embedding = JSON.stringify(vec);
            } catch {
              // Embedding may fail if API key not set — store chunk without embedding
            }

            await prisma.knowledgeChunk.create({
              data: {
                radarEventId: event.id,
                content: chunk.content,
                chunkIndex: chunk.chunkIndex,
                tokenCount: chunk.tokenCount,
                metadata: JSON.stringify(chunk.metadata),
                ...(embedding && { embedding }),
              },
            });
            chunkCount++;
          } catch (e) {
            console.error(`[Vault Ingest] Failed to store chunk for event ${event.id}:`, e);
          }
        }
        results.push({ id: event.id, chunks: chunkCount, status: 'indexed' });
      }
    }

    // Determine vault items to process
    const vaultQuery = itemId
      ? [await prisma.knowledgeVaultItem.findUnique({ where: { id: itemId } })].filter(Boolean)
      : await prisma.knowledgeVaultItem.findMany({
          where: { userId: MOCK_USER_ID, isActive: true },
        });

    for (const item of vaultQuery as any[]) {
      if (!item) continue;

      // Delete existing chunks for this item (re-ingest)
      await prisma.knowledgeChunk.deleteMany({ where: { vaultItemId: item.id } });

      const chunks = chunkText(item.content, {
        source: item.title,
        category: item.category,
        date: new Date().toISOString(),
      });

      let chunkCount = 0;
      for (const chunk of chunks) {
        try {
          let embedding: string | undefined;
          try {
            const vec = await embedText(chunk.content);
            embedding = JSON.stringify(vec);
          } catch {
            // Store without embedding if API fails
          }

          await prisma.knowledgeChunk.create({
            data: {
              vaultItemId: item.id,
              content: chunk.content,
              chunkIndex: chunk.chunkIndex,
              tokenCount: chunk.tokenCount,
              metadata: JSON.stringify(chunk.metadata),
              ...(embedding && { embedding }),
            },
          });
          chunkCount++;
        } catch (e) {
          console.error(`[Vault Ingest] Failed to store chunk for item ${item.id}:`, e);
        }
      }
      results.push({ id: item.id, chunks: chunkCount, status: 'indexed' });
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error('[Vault Ingest] Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// GET: Check ingest status / chunk counts per vault item
export async function GET() {
  try {
    const items = await prisma.knowledgeVaultItem.findMany({
      where: { userId: MOCK_USER_ID, isActive: true },
      include: {
        chunks: {
          select: { id: true, embedding: true },
        },
      },
    });

    const status = items.map(item => ({
      id: item.id,
      title: item.title,
      category: item.category,
      totalChunks: item.chunks.length,
      embeddedChunks: item.chunks.filter(c => !!c.embedding).length,
    }));

    const radarChunks = await prisma.knowledgeChunk.count({
      where: { radarEventId: { not: null } },
    });

    return NextResponse.json({
      success: true,
      vaultItems: status,
      radarChunksIndexed: radarChunks,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
