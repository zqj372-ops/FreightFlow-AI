import { NextResponse } from "next/server";

import {
  getFallbackContacts,
  isPrismaUnavailable,
  normalizeContactInput,
  toContactRecord,
} from "@/lib/freightflow-data";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const contacts = await prisma.contact.findMany({
      where: { isActive: true },
      orderBy: [{ role: "asc" }, { label: "asc" }],
    });

    return NextResponse.json({ data: contacts.map(toContactRecord), source: "database" });
  } catch (error) {
    if (isPrismaUnavailable(error)) {
      return NextResponse.json({
        data: getFallbackContacts(),
        source: "mock",
        warning: "DATABASE_URL is unavailable or migrations have not been applied; returned mock contacts.",
      });
    }

    console.error("GET /api/contacts failed", error);
    return NextResponse.json({ error: "Failed to load contacts." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const parsed = normalizeContactInput(await request.json().catch(() => null));

  if ("error" in parsed) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const contact = await prisma.contact.upsert({
      where: { email: parsed.value.email },
      create: {
        email: parsed.value.email,
        label: parsed.value.label,
        role: parsed.value.dbRole,
      },
      update: {
        isActive: true,
        label: parsed.value.label,
        role: parsed.value.dbRole,
      },
    });

    return NextResponse.json({ data: toContactRecord(contact), source: "database" }, { status: 201 });
  } catch (error) {
    if (isPrismaUnavailable(error)) {
      return NextResponse.json(
        {
          error: "Database is unavailable; creating contacts requires PostgreSQL persistence.",
          source: "mock",
        },
        { status: 503 },
      );
    }

    console.error("POST /api/contacts failed", error);
    return NextResponse.json({ error: "Failed to persist contact." }, { status: 500 });
  }
}
