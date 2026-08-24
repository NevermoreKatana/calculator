'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/db';
import { SettingsSchema, formatZodErrors } from '@/lib/validation/schemas';
import type { ActionResult } from './recipes';

export async function updateSettings(payload: unknown): Promise<ActionResult> {
  const parsed = SettingsSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false, error: 'Проверьте поля', fieldErrors: formatZodErrors(parsed.error) };
  }
  try {
    await prisma.appSettings.upsert({
      where: { id: 'default' },
      update: parsed.data,
      create: { id: 'default', ...parsed.data },
    });
    revalidatePath('/settings');
    return { ok: true };
  } catch {
    return { ok: false, error: 'Не удалось сохранить настройки' };
  }
}
