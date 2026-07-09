-- CreateTable
CREATE TABLE "email_messages" (
    "id" TEXT NOT NULL,
    "shipmentId" VARCHAR(64),
    "mailbox" VARCHAR(255) NOT NULL,
    "messageId" VARCHAR(512) NOT NULL,
    "threadId" VARCHAR(512),
    "inReplyTo" VARCHAR(512),
    "references" JSONB,
    "subject" VARCHAR(255) NOT NULL,
    "from" VARCHAR(255) NOT NULL,
    "to" JSONB,
    "cc" JSONB,
    "body" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL,
    "attachments" JSONB,
    "hasSoAttachment" BOOLEAN NOT NULL DEFAULT false,
    "matchScore" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "email_messages_mailbox_messageId_key" ON "email_messages"("mailbox", "messageId");

-- CreateIndex
CREATE INDEX "email_messages_shipmentId_receivedAt_idx" ON "email_messages"("shipmentId", "receivedAt");

-- CreateIndex
CREATE INDEX "email_messages_threadId_idx" ON "email_messages"("threadId");

-- CreateIndex
CREATE INDEX "email_messages_receivedAt_idx" ON "email_messages"("receivedAt");

-- AddForeignKey
ALTER TABLE "email_messages" ADD CONSTRAINT "email_messages_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
