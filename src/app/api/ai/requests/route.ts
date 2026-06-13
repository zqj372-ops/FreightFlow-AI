import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const shipmentId = searchParams.get("shipmentId")?.trim();

  try {
    const requests = await prisma.aiRequest.findMany({
      where: shipmentId ? { shipmentId } : undefined,
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        shipmentId: true,
        prompt: true,
        reply: true,
        requestStatus: true,
        requestContext: true,
        provider: true,
        endpoint: true,
        errorMessage: true,
        responseTimeMs: true,
        createdAt: true,
        completedAt: true,
      },
    });

    return NextResponse.json({
      requests: requests.map((item) => ({
        ...item,
        status: item.requestStatus.toLowerCase(),
        createdAt: item.createdAt.toISOString(),
        completedAt: item.completedAt?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    console.warn("AI request audit history unavailable", error);

    return NextResponse.json({
      requests: [],
      degraded: true,
      error: "AI request history is temporarily unavailable.",
    });
  }
}
