import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireWorkspacePermission } from '@/lib/api/workspace';
import { reserveAiCredits } from '@/lib/billing/ai-credits';
import { estimateMessageTokens } from '@/lib/billing/ai-pricing';
import { completeBilled } from '@/lib/ai/billed-completion';
import { QUALITY_MODEL } from '@/lib/ai/models';

const MAX_OUTPUT_TOKENS = 800;
const MAX_PROMPT_CHARS = 2000;

type ProductSuggestion = {
  name: string;
  description: string;
  sku: string;
  category: string;
  unit: string;
  price: number | null;
  taxRate: number | null;
  stockQuantity: number | null;
  reasoning?: string;
};

function extractJsonObject(content: string) {
  const start = content.indexOf('{');
  const end = content.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('AI response did not include valid JSON');
  }

  return JSON.parse(content.slice(start, end + 1));
}

function sanitizeSuggestion(value: any): ProductSuggestion {
  const normalizeText = (input: unknown) => String(input ?? '').trim();
  const normalizeNumber = (input: unknown) => {
    if (input === null || input === undefined || input === '') return null;
    const parsed = Number(input);
    return Number.isFinite(parsed) ? parsed : null;
  };

  return {
    name: normalizeText(value?.name),
    description: normalizeText(value?.description),
    sku: normalizeText(value?.sku),
    category: normalizeText(value?.category),
    unit: normalizeText(value?.unit),
    price: normalizeNumber(value?.price),
    taxRate: normalizeNumber(value?.taxRate),
    stockQuantity: normalizeNumber(value?.stockQuantity),
    reasoning: normalizeText(value?.reasoning),
  };
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'GROQ_API_KEY is not configured' }, { status: 500 });
    }

    const body = await request.json();
    const workspaceId = String(body.workspaceId || '').trim();
    const prompt = String(body.prompt || '').trim().slice(0, MAX_PROMPT_CHARS);
    const currentProduct = body.currentProduct ?? null;

    if (!workspaceId || !prompt) {
      return NextResponse.json(
        { error: 'Workspace ID and prompt are required' },
        { status: 400 }
      );
    }

    const access = await requireWorkspacePermission(workspaceId, 'content:create');
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const [categoryRows, recentProducts] = await Promise.all([
      prisma.$queryRaw<Array<{ category: string | null }>>(Prisma.sql`
        SELECT DISTINCT "category"
        FROM "Product"
        WHERE "workspaceId" = ${workspaceId} AND "category" IS NOT NULL
        ORDER BY "category" ASC
        LIMIT 20
      `),
      prisma.$queryRaw<
        Array<{
          name: string;
          description: string | null;
          category: string | null;
          price: number;
          unit: string | null;
          taxRate: number;
        }>
      >(Prisma.sql`
        SELECT "name", "description", "category", "price", "unit", "taxRate"
        FROM "Product"
        WHERE "workspaceId" = ${workspaceId}
        ORDER BY "updatedAt" DESC
        LIMIT 8
      `),
    ]);

    const categories = categoryRows
      .map((row) => row.category)
      .filter((value): value is string => Boolean(value));

    const systemPrompt = [
      'You are helping generate structured product catalog entries for a business workspace.',
      'Return a single JSON object only. No markdown, no commentary outside JSON.',
      'Keep descriptions concise and reusable for quotes and invoices.',
      'If a price or stock quantity cannot be inferred, return null for that field.',
      'Prefer one of the provided categories when it fits naturally.',
      'Generate realistic business-friendly names and SKUs.',
      'Schema:',
      '{',
      '  "name": string,',
      '  "description": string,',
      '  "sku": string,',
      '  "category": string,',
      '  "unit": string,',
      '  "price": number | null,',
      '  "taxRate": number | null,',
      '  "stockQuantity": number | null,',
      '  "reasoning": string',
      '}',
    ].join('\n');

    const userPrompt = [
      `User request: ${prompt}`,
      categories.length > 0 ? `Available categories: ${categories.join(', ')}` : 'Available categories: none yet',
      recentProducts.length > 0
        ? `Recent product examples: ${JSON.stringify(recentProducts)}`
        : 'Recent product examples: none yet',
      currentProduct
        ? `Current product draft to refine: ${JSON.stringify(currentProduct).slice(0, MAX_PROMPT_CHARS)}`
        : 'Current product draft to refine: none',
    ].join('\n\n');

    const messages = [
      { role: 'system' as const, content: systemPrompt },
      { role: 'user' as const, content: userPrompt },
    ];

    const reserve = await reserveAiCredits({
      userId: access.session.user.id,
      workspaceId,
      feature: 'product',
      model: QUALITY_MODEL,
      estimate: { inputTokens: estimateMessageTokens(messages), outputTokens: MAX_OUTPUT_TOKENS },
    });
    if (!reserve.ok) {
      return reserve.response;
    }

    // completeBilled settles the reservation itself: refunded if the call fails,
    // charged for the tokens used if it answered, even when the answer turns out
    // unusable below. The model spend happened either way.
    const { text: content } = await completeBilled({
      reservation: reserve.reservation,
      messages,
      maxTokens: MAX_OUTPUT_TOKENS,
      temperature: 0.4,
      json: true,
      signal: request.signal,
    });
    if (!content) {
      throw new Error('AI response was empty');
    }

    const suggestion = sanitizeSuggestion(extractJsonObject(content));

    return NextResponse.json({ suggestion });
  } catch (error) {
    console.error('Error generating product suggestion:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to generate AI product suggestion',
      },
      { status: 500 }
    );
  }
}
