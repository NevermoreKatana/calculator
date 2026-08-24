'use client';

import * as React from 'react';
import { updateSettings } from '@/app/actions/settings';
import { Button, Input, Label, Notice, Select } from '@/components/ui';

interface SettingsValues {
  currency: string;
  defaultPieceWeightG: number;
  awModelId: 'measured' | 'reference' | 'scientific';
  enableExternalLookup: boolean;
}

export function SettingsForm({ initial }: { initial: SettingsValues }) {
  const [values, setValues] = React.useState(initial);
  const [pending, startTransition] = React.useTransition();
  const [message, setMessage] = React.useState<{ tone: 'ok' | 'error'; text: string } | null>(null);

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);
    startTransition(async () => {
      const result = await updateSettings(values);
      setMessage(
        result.ok
          ? { tone: 'ok', text: 'Настройки сохранены' }
          : { tone: 'error', text: result.error ?? 'Ошибка' },
      );
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <Label htmlFor="set-currency">Валюта</Label>
          <Input
            id="set-currency"
            value={values.currency}
            onChange={(e) => setValues((v) => ({ ...v, currency: e.target.value }))}
            maxLength={10}
          />
        </div>
        <div>
          <Label htmlFor="set-piece-weight">Вес конфеты по умолчанию, г</Label>
          <Input
            id="set-piece-weight"
            type="number"
            min={0.1}
            step={0.5}
            className="tabular"
            value={values.defaultPieceWeightG}
            onChange={(e) =>
              setValues((v) => ({ ...v, defaultPieceWeightG: Number(e.target.value) }))
            }
          />
        </div>
        <div>
          <Label htmlFor="set-aw-model">Модель a_w</Label>
          <Select
            id="set-aw-model"
            value={values.awModelId}
            onChange={(e) =>
              setValues((v) => ({ ...v, awModelId: e.target.value as SettingsValues['awModelId'] }))
            }
          >
            <option value="measured">Измеренное значение</option>
            <option value="reference">Справочные измерения (нет данных)</option>
            <option value="scientific">Научная модель (не подключена)</option>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          id="set-external"
          type="checkbox"
          checked={values.enableExternalLookup}
          onChange={(e) => setValues((v) => ({ ...v, enableExternalLookup: e.target.checked }))}
          className="h-4 w-4 accent-[var(--accent)]"
        />
        <label htmlFor="set-external" className="text-sm">
          Разрешить поиск во внешних базах (Open Food Facts)
        </label>
      </div>

      {values.awModelId !== 'measured' ? (
        <Notice tone="warning">
          Выбранная модель сейчас не может вернуть значение: у неё нет входных данных. Приложение
          покажет «Активность воды не определена» вместо расчётного числа.
        </Notice>
      ) : null}

      <div className="flex items-center gap-3">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? 'Сохранение…' : 'Сохранить настройки'}
        </Button>
        {message ? (
          <span
            role="status"
            className={
              message.tone === 'ok'
                ? 'text-sm text-[var(--success)]'
                : 'text-sm text-[var(--danger)]'
            }
          >
            {message.text}
          </span>
        ) : null}
      </div>
    </form>
  );
}
