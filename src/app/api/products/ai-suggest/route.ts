import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireWorkspacePermission } from '@/lib/api/workspace';
import { AI_CREDIT_COSTS, chargeAiCredits, refundAiCredits } from '@/lib/billing/ai-credits';
import { getGroq } from '@/lib/groq';

const model = 'llama-3.3-70b-versatile';

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
  let charge: { workspaceId: string; cost: number } | null = null;
  try {
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'GROQ_API_KEY is not configured' }, { status: 500 });
    }

    const body = await request.json();
    const workspaceId = String(body.workspaceId || '').trim();
    const prompt = String(body.prompt || '').trim();
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

    const credits = await chargeAiCredits(
      access.session.user.id,
      workspaceId,
      AI_CREDIT_COSTS.productSuggest
    );
    if (!credits.ok) {
      return credits.response;
    }
    charge = credits;

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
        ? `Current product draft to refine: ${JSON.stringify(currentProduct)}`
        : 'Current product draft to refine: none',
    ].join('\n\n');

    const completion = await getGroq().chat.completions.create({
      model,
      temperature: 0.4,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error('AI response was empty');
    }

    const suggestion = sanitizeSuggestion(extractJsonObject(content));

    return NextResponse.json({ suggestion });
  } catch (error) {
    console.error('Error generating product suggestion:', error);
    // No usable suggestion came back, so the credits go back.
    if (charge) await refundAiCredits(charge);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to generate AI product suggestion',
      },
      { status: 500 }
    );
  }
}
