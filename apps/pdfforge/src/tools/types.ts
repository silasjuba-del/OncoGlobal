import type { InputFile, OutputFile, RunContext } from '../engine/types';

export type Category =
  | 'Organizar PDF'
  | 'Otimizar PDF'
  | 'Converter para PDF'
  | 'Converter de PDF'
  | 'Editar PDF'
  | 'Segurança do PDF';

export const CATEGORY_ORDER: Category[] = [
  'Organizar PDF',
  'Otimizar PDF',
  'Converter para PDF',
  'Converter de PDF',
  'Editar PDF',
  'Segurança do PDF',
];

export type Options = Record<string, string | number | boolean>;

interface FieldBase {
  key: string;
  label: string;
  help?: string;
  /** Exibe o campo apenas quando a condição for verdadeira. */
  showIf?: (o: Options) => boolean;
}

export type Field = FieldBase &
  (
    | { type: 'select'; options: { value: string; label: string }[] }
    | { type: 'segmented'; options: { value: string; label: string }[] }
    | { type: 'number'; min?: number; max?: number; step?: number; unit?: string }
    | { type: 'slider'; min: number; max: number; step: number; format?: (v: number) => string }
    | { type: 'text' | 'password'; placeholder?: string }
    | { type: 'color' }
    | { type: 'checkbox' }
  );

export interface ToolDef {
  id: string;
  name: string;
  category: Category;
  /** Glifo curto exibido no ícone (ex.: "JPG", "OCR"). */
  glyph: string;
  color: string;
  actionText: string;
  description: string;
  /** Tipo de arquivo de entrada. */
  accepts: 'pdf' | 'image' | 'office' | 'none';
  /** Aceita vários arquivos de entrada. */
  multiple: boolean;
  /** Número exato de arquivos exigido (ex.: comparar = 2). */
  exactFiles?: number;
  status: 'ready' | 'planned';
  plannedReason?: string;
  internet?: boolean;
  defaults: Options;
  fields?: Field[];
  /** Editor especializado no lugar do formulário genérico. */
  custom?: 'organize' | 'editor';
  run?: (files: InputFile[], options: Options, ctx: RunContext) => Promise<OutputFile[]>;
}
