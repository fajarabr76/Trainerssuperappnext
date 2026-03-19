'use client';

import { useAuth } from '@/app/lib/hooks/useAuth';

import { redirect } from 'next/navigation';

export default function QaAnalyzerPage() {
  redirect('/qa-analyzer/dashboard');
}
