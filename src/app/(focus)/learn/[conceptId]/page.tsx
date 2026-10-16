import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getLesson } from "@/server/services/learn";
import { LessonRunner } from "@/components/learn/LessonRunner";
import { MasteredState } from "@/components/learn/MasteredState";

export const metadata: Metadata = { title: "Lesson" };

export default async function LessonPage({ params }: { params: Promise<{ conceptId: string }> }) {
  const { conceptId } = await params;
  const user = await requireUser();
  const lesson = await getLesson(db, user.id, conceptId, { canPreview: user.isAdmin });
  if (!lesson) notFound();
  if (lesson.mastered) return <MasteredState concept={lesson.concept} total={lesson.totalQuestions} />;
  return <LessonRunner lesson={lesson} />;
}
